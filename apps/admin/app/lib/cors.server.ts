import { json } from '@remix-run/node';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function withCors(response: Response): Response {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

export function preflight(): Response {
  return withCors(new Response(null, { status: 204 }));
}

export function corsHeaders(_request: Request): HeadersInit {
  return { ...CORS_HEADERS };
}

export function handleOptions(_request: Request): Response {
  return preflight();
}

/**
 * Standard loader for POST-only public API routes. In Remix, OPTIONS
 * preflight requests are routed to `loader` (alongside GET), so the
 * loader must return a 2xx CORS-headered response for the browser to
 * accept the preflight. Without this, the browser rejects the actual
 * POST with "Response to preflight request doesn't pass access control
 * check: It does not have HTTP ok status."
 */
export function postOnlyLoader({ request }: { request: Request }): Response {
  if (request.method === 'OPTIONS') return preflight();
  return withCors(json({ error: 'Method not allowed' }, { status: 405 }));
}
