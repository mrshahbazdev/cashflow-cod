const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With',
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
