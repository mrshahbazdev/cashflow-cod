/**
 * Public REST API: /api/v1/returns
 *
 * GET — list returns (scope `returns:read`)
 * POST — create a return for an order (scope `returns:write`)
 *   body JSON: { orderId, reason, resolution?, notes? }
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { authenticateApiKey, logApiCall, requireScope } from '../lib/api-keys.server';
import { createReturn, listReturns } from '../lib/returns.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const start = Date.now();
  const auth = await authenticateApiKey(request);
  if (!auth) return new Response('Unauthorized', { status: 401 });
  requireScope(auth.scopes, 'returns:read');
  const data = await listReturns(auth.shopId);
  await logApiCall({
    apiKeyId: auth.apiKeyId,
    path: '/api/v1/returns',
    method: 'GET',
    status: 200,
    durationMs: Date.now() - start,
  });
  return json({
    data: data.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      trackingCode: r.trackingCode,
      reason: r.reason,
      resolution: r.resolution,
      status: r.status,
      refundAmount: r.refundAmount ? Number(r.refundAmount) : null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const start = Date.now();
  const auth = await authenticateApiKey(request);
  if (!auth) return new Response('Unauthorized', { status: 401 });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  requireScope(auth.scopes, 'returns:write');
  const payload = (await request.json().catch(() => null)) as {
    orderId?: string;
    reason?: string;
    resolution?: 'REFUND' | 'REPLACE' | 'STORE_CREDIT';
    notes?: string;
  } | null;
  if (!payload?.orderId || !payload.reason) {
    return new Response(JSON.stringify({ error: 'orderId and reason required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const rma = await createReturn({
    shopId: auth.shopId,
    orderId: payload.orderId,
    reason: payload.reason,
    resolution: payload.resolution,
    notes: payload.notes,
  });
  await logApiCall({
    apiKeyId: auth.apiKeyId,
    path: '/api/v1/returns',
    method: 'POST',
    status: 201,
    durationMs: Date.now() - start,
  });
  return json({ id: rma.id, trackingCode: rma.trackingCode, status: rma.status }, { status: 201 });
};
