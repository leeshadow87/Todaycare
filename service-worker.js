/* 오늘아이돌봄지도 V12 - PWA service worker */
const CACHE_NAME = 'todaycare-v12-static';
const DATA_CACHE = 'todaycare-v12-data';
const STATIC_ASSETS = [
  './',
  './index_v12.html',
  './manifest.json',
  './assets/v12.css',
  './assets/v12.js',
  './data_v12.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => ![CACHE_NAME, DATA_CACHE].includes(key)).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/data_v12.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(DATA_CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('./index_v12.html');
      return cached;
    }))
  );
});
