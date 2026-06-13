/* TOP LOTTO Service Worker — cache static + offline fallback */
const CACHE = 'toplotto-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Network-first for API GETs, cache-fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((m) => m || new Response(JSON.stringify({ offline: true }), { headers: { 'Content-Type': 'application/json' }, status: 503 })))
    );
    return;
  }

  // Cache-first for static
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('/index.html')))
  );
});
