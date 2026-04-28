/* Cashflow COD — Agent PWA service worker.
 *
 * Strategy:
 *   - precache the shell on install
 *   - network-first for /mobile/agent and /api/mobile/* with offline fallback
 *   - background sync queues failed POSTs (disposition updates) until reconnect
 */
const CACHE_VERSION = 'cf-agent-v1';
const SHELL = ['/mobile/agent', '/mobile-agent-manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') {
    if (url.pathname.startsWith('/api/mobile/')) {
      event.respondWith(handleMutation(event.request.clone()));
    }
    return;
  }
  if (url.pathname.startsWith('/mobile/') || url.pathname === '/mobile-agent-manifest.json') {
    event.respondWith(networkFirst(event.request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone()).catch(() => undefined);
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'offline' });
  }
}

async function handleMutation(request) {
  try {
    return await fetch(request);
  } catch {
    const body = await request.text();
    await queueMutation({ url: request.url, method: request.method, headers: [...request.headers], body });
    return new Response(JSON.stringify({ queued: true, offline: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  }
}

async function queueMutation(item) {
  const cache = await caches.open(`${CACHE_VERSION}-queue`);
  const key = `queue-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await cache.put(
    key,
    new Response(JSON.stringify(item), { headers: { 'content-type': 'application/json' } }),
  );
  if ('sync' in self.registration) {
    try {
      await self.registration.sync.register('cf-agent-replay');
    } catch {
      // sync not supported — fallback to next page load replay
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'cf-agent-replay') {
    event.waitUntil(replayQueue());
  }
});

async function replayQueue() {
  const cache = await caches.open(`${CACHE_VERSION}-queue`);
  const keys = await cache.keys();
  for (const key of keys) {
    const resp = await cache.match(key);
    if (!resp) continue;
    const item = await resp.json();
    try {
      const headers = new Headers(item.headers);
      const init = { method: item.method, headers };
      if (item.method !== 'GET' && item.method !== 'HEAD') init.body = item.body;
      const replay = await fetch(item.url, init);
      if (replay.ok) await cache.delete(key);
    } catch {
      // keep in queue for next attempt
    }
  }
}
