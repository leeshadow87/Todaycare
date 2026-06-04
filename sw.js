/* 오늘아이돌봄 v11 - Service Worker */
const CACHE_NAME = 'todaycare-v11';
const FONT_CACHE = 'todaycare-fonts-v11';
const STATIC_ASSETS = [
  './',
  './index.html',
  './assets/app.css',
  './assets/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 설치: 정적 자산 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => ![CACHE_NAME, FONT_CACHE].includes(k)).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: 정적 자산은 캐시 우선, places.json은 네트워크 우선(최신 데이터)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Google Fonts: 캐시 우선, 실패 시 시스템 폰트로 자연 fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(e.request).then(cached => cached || fetch(e.request).then(res => {
          cache.put(e.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // places.json: 네트워크 우선, 실패 시 캐시
  if (url.pathname.includes('places.json')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 그 외: 캐시 우선, 없으면 네트워크
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
