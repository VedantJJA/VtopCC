const CACHE_NAME = 'vtopcc-store-v2';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// 1. Install Event: Cache core shell immediately & force immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core app shell');
      return cache.addAll(CORE_ASSETS).catch(() => {});
    })
  );
});

// 2. Activate Event: Clean up old caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Full Offline Guard (Stale-While-Revalidate for Assets, Cache-Fallback for Navigation)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip API requests and non-GET requests
  if (url.pathname.startsWith('/api') || req.method !== 'GET') {
    return;
  }

  // A. Navigation requests (Opening the app / page reloads)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed (Offline): return cached index.html
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // B. Static Assets (JS, CSS, Images, Fonts) -> Cache First, update in background
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached file immediately (works 100% offline)
        // Background revalidate if online
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // If asset not in cache yet, fetch from network and cache for offline use
      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        return new Response('Offline asset unavailable', { status: 408, statusText: 'Offline' });
      });
    })
  );
});
