/**
 * Public REST API: GET /api/v1/health
 *
 * Open endpoint — confirms API auth roundtrip when called with Bearer header.
 */
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { authenticateApiKey } from '../lib/api-keys.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateApiKey(request);
  return json({
    status: 'ok',
    authenticated: Boolean(auth),
    shopId: auth?.shopId ?? null,
    scopes: auth?.scopes ?? [],
    timestamp: new Date().toISOString(),
  });
};
