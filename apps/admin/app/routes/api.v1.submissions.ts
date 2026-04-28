/**
 * Public REST API: GET /api/v1/submissions
 *
 * Auth: Bearer <api key> (scope `submissions:read`)
 */
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import prisma from '../db.server';
import { authenticateApiKey, logApiCall, requireScope } from '../lib/api-keys.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const start = Date.now();
  const auth = await authenticateApiKey(request);
  if (!auth) return new Response('Unauthorized', { status: 401 });
  requireScope(auth.scopes, 'submissions:read');

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const cursor = url.searchParams.get('cursor');

  const submissions = await prisma.submission.findMany({
    where: { form: { shopId: auth.shopId } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      formId: true,
      status: true,
      phone: true,
      email: true,
      country: true,
      riskScore: true,
      createdAt: true,
    },
  });
  const hasMore = submissions.length > limit;
  const slice = hasMore ? submissions.slice(0, limit) : submissions;
  const last = slice[slice.length - 1];
  await logApiCall({
    apiKeyId: auth.apiKeyId,
    path: '/api/v1/submissions',
    method: 'GET',
    status: 200,
    durationMs: Date.now() - start,
  });
  return json({
    data: slice.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    nextCursor: hasMore && last ? last.id : null,
  });
};
