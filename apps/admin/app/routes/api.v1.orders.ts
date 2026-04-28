/**
 * Public REST API: GET /api/v1/orders
 *
 * Auth: Bearer <api key> (scope `orders:read`)
 * Query: ?limit=50&cursor=<id>&disposition=NEW
 */
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import prisma from '../db.server';
import { authenticateApiKey, logApiCall, requireScope } from '../lib/api-keys.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const start = Date.now();
  const auth = await authenticateApiKey(request);
  if (!auth) return new Response('Unauthorized', { status: 401 });
  requireScope(auth.scopes, 'orders:read');

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const cursor = url.searchParams.get('cursor');
  const disposition = url.searchParams.get('disposition') ?? undefined;

  const orders = await prisma.order.findMany({
    where: {
      shopId: auth.shopId,
      ...(disposition ? { disposition: disposition as never } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      shopifyOrderId: true,
      phone: true,
      email: true,
      customerName: true,
      city: true,
      country: true,
      total: true,
      currency: true,
      disposition: true,
      riskScore: true,
      createdAt: true,
    },
  });
  const hasMore = orders.length > limit;
  const slice = hasMore ? orders.slice(0, limit) : orders;
  const last = slice[slice.length - 1];
  await logApiCall({
    apiKeyId: auth.apiKeyId,
    path: '/api/v1/orders',
    method: 'GET',
    status: 200,
    durationMs: Date.now() - start,
  });
  return json({
    data: slice.map((o) => ({ ...o, total: o.total ? Number(o.total) : null, createdAt: o.createdAt.toISOString() })),
    nextCursor: hasMore && last ? last.id : null,
  });
};
