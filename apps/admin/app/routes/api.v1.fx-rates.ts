/**
 * Public REST API: GET /api/v1/fx-rates
 *
 * Auth: Bearer <api key> (scope `analytics:read`)
 */
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { authenticateApiKey, logApiCall, requireScope } from '../lib/api-keys.server';
import { listRates } from '../lib/fx-rates.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const start = Date.now();
  const auth = await authenticateApiKey(request);
  if (!auth) return new Response('Unauthorized', { status: 401 });
  requireScope(auth.scopes, 'analytics:read');
  const rates = await listRates(auth.shopId);
  await logApiCall({
    apiKeyId: auth.apiKeyId,
    path: '/api/v1/fx-rates',
    method: 'GET',
    status: 200,
    durationMs: Date.now() - start,
  });
  return json({
    data: rates.map((r) => ({
      base: r.base,
      target: r.target,
      rate: Number(r.rate),
      source: r.source,
      fetchedAt: r.fetchedAt.toISOString(),
    })),
  });
};
