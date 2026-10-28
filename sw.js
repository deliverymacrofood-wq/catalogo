const CACHE_NAME = 'macrofood-pwa-v1';
const CORE_FILES = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './theme.js',
  './app.js',
  './logo-macrofood.jpg',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './pedidos.html',
  './pedidos.js',
  './suporte.html',
  './suporte.js',
  './login/',
  './login/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_FILES.map(async path => {
      try { await cache.add(new Request(path, {cache: 'reload'})); } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('macrofood-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Do not cache dynamic Supabase/API requests; only same-origin site files.
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        const cached = await caches.match(request);
        return cached || await caches.match('./index.html') || new Response('Você está offline. Conecte-se à internet e tente novamente.', {
          status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      fetch(request).then(response => {
        if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response));
      }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      return new Response('', {status: 504, statusText: 'Offline'});
    }
  })());
});
