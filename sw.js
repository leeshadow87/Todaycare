/* Legacy cleanup for todaycare V11 service worker.
   V12 uses ./service-worker.js. Keep this file at the site root for a while
   so browsers that previously registered ./sw.js can update, clear old caches,
   unregister the legacy worker, and reload into V12. */

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
      .then(clients => {
        for (const client of clients) {
          client.navigate(client.url);
        }
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
