// service-worker.js
const CACHE_NAME = 'transfercheckers-v1';
const ASSETS_TO_CACHE = [
  '/', // Cache the root if index.html is served from there
  '/index.html',
  '/result.html',
  '/global.css',
  '/styles.css', // Assuming for index.html
  '/result-style.css',
  '/design-tokens.css',
  '/scripts/main.js',
  '/scripts/verify.js',
  '/assets/favicon.ico',
  // Add paths to your PWA icons specified in manifest.json
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png',
  '/assets/maskable-icon-192x192.png',
  '/assets/maskable-icon-512x512.png',
  // Add other important assets like logos, fonts if local
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap' // Caching external assets can be tricky
];

// Install event: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(error => {
        console.error('Service Worker: Caching failed', error);
      })
  );
  self.skipWaiting(); // Activate worker immediately
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of uncontrolled clients
});

// Fetch event: serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // Serve from cache
        }
        // Not in cache, fetch from network
        return fetch(event.request).then(networkResponse => {
          // Optionally, cache new requests dynamically
          // Be careful caching everything, especially API responses if they change frequently
          // and are not meant for offline use without specific handling.
          // For example, for GET requests of static assets:
          // if (event.request.method === 'GET' && ASSETS_TO_CACHE.includes(new URL(event.request.url).pathname)) {
          //   return caches.open(CACHE_NAME).then(cache => {
          //     cache.put(event.request, networkResponse.clone());
          //     return networkResponse;
          //   });
          // }
          return networkResponse;
        }).catch(error => {
          console.error('Service Worker: Fetch failed', error);
          // You could return an offline fallback page here if appropriate
          // For example, for HTML pages:
          // if (event.request.mode === 'navigate') {
          //   return caches.match('/offline.html'); // You'd need to create and cache an offline.html
          // }
        });
      })
  );
});
