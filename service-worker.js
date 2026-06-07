/* Legacy cleanup for earlier V12 prototype.
   V12_3 uses ./sw.js. Keep this file briefly if an older deployment registered
   service-worker.js, so stale prototype caches are cleared automatically. */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    self.registration.unregister()
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => clients.forEach(client => client.navigate(client.url)))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
