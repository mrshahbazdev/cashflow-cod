/* Phase 3.4 — offline-capable form service worker.
 * - Caches widget JS/CSS for offline use.
 * - Intercepts POST /api/public/submissions and queues them in IndexedDB when
 *   the network is unavailable (navigator.onLine === false or fetch fails).
 * - Replays the queue on 'sync' event and on 'online' message from the page.
 */
/* eslint-disable no-restricted-globals */
(function () {
  var CACHE_NAME = 'cod-form-v1';
  var QUEUE_DB = 'cod-form-queue';
  var QUEUE_STORE = 'pending';

  self.addEventListener('install', function (event) {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
  });

  function openQueueDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(QUEUE_DB, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function enqueueSubmission(entry) {
    return openQueueDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(QUEUE_STORE, 'readwrite');
        tx.objectStore(QUEUE_STORE).add(entry);
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  function drainQueue() {
    return openQueueDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(QUEUE_STORE, 'readwrite');
        var store = tx.objectStore(QUEUE_STORE);
        var req = store.getAll();
        req.onsuccess = function () {
          var items = req.result || [];
          Promise.all(
            items.map(function (it) {
              return fetch(it.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: it.body,
              })
                .then(function (res) {
                  if (res.ok) {
                    return new Promise(function (r) {
                      var tx2 = db.transaction(QUEUE_STORE, 'readwrite');
                      tx2.objectStore(QUEUE_STORE).delete(it.id);
                      tx2.oncomplete = function () {
                        r(true);
                      };
                    });
                  }
                  return false;
                })
                .catch(function () {
                  return false;
                });
            }),
          ).then(function () {
            resolve();
          });
        };
        req.onerror = function () {
          resolve();
        };
      });
    });
  }

  self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'drain-queue') {
      event.waitUntil(drainQueue());
    }
  });

  self.addEventListener('sync', function (event) {
    if (event.tag === 'cod-form-submission') {
      event.waitUntil(drainQueue());
    }
  });

  self.addEventListener('fetch', function (event) {
    var req = event.request;
    var url;
    try {
      url = new URL(req.url);
    } catch (_e) {
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/public/submissions') {
      event.respondWith(
        req
          .clone()
          .text()
          .then(function (body) {
            return fetch(req.clone()).catch(function () {
              return enqueueSubmission({ url: req.url, body: body, ts: Date.now() }).then(
                function () {
                  if ('sync' in self.registration) {
                    self.registration.sync
                      .register('cod-form-submission')
                      .catch(function () {});
                  }
                  return new Response(
                    JSON.stringify({
                      ok: true,
                      queued: true,
                      message:
                        'Submitted offline — will be delivered when your connection is restored.',
                    }),
                    { status: 202, headers: { 'Content-Type': 'application/json' } },
                  );
                },
              );
            });
          }),
      );
      return;
    }
    // Static caching for widget assets.
    if (req.method === 'GET' && /cod-form\.(js|css)$/.test(url.pathname)) {
      event.respondWith(
        caches.open(CACHE_NAME).then(function (cache) {
          return cache.match(req).then(function (hit) {
            var fetchPromise = fetch(req)
              .then(function (res) {
                if (res && res.ok) cache.put(req, res.clone());
                return res;
              })
              .catch(function () {
                return hit;
              });
            return hit || fetchPromise;
          });
        }),
      );
    }
  });
})();
