/**
 * Service Worker — Caches app shell and PDF.js for offline use
 */

const CACHE_NAME = 'pdf-reader-pro-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/pdf-engine.js',
  './js/search.js',
  './js/annotations.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lucide/0.263.1/lucide.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Cache addAll failed for some assets:', err);
        // Try adding individually
        return Promise.all(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((e) => console.warn('Failed to cache:', url, e))
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // For static assets, use cache-first
  if (STATIC_ASSETS.includes(request.url) || STATIC_ASSETS.includes('./' + url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For PDF.js CDN files
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For PDF blob URLs (user files), use network only
  if (url.protocol === 'blob:') {
    event.respondWith(fetch(request));
    return;
  }

  // Default: network first, fallback to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request)).then((response) => {
      if (response) return response;
      // Offline fallback
      if (request.mode === 'navigate') {
        return caches.match('./');
      }
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
