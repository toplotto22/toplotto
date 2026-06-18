/* TOP LOTTO Service Worker — cache static + offline fallback + push + auto-update */
const CACHE = 'toplotto-v4-' + (self.location.search.slice(1) || 'auto');
const STATIC_ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon.ico'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // CRITICAL: Network-first for the SPA shell (index.html / navigations).
  // This ensures users get the latest JS bundle hash after a deploy.
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

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

  // Network-first for JS/CSS bundles (they have content hashes so it's safe; ensures fresh content)
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for other static assets (images, fonts, icons)
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


// Web Push handler — "Rezilta yo soti" notifications
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'TOP LOTTO', body: event.data?.text() || '' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'TOP LOTTO', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'toplotto-push',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
