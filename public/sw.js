
const CACHE_NAME = 'cultivator-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

const CACHEABLE_CONTENT_TYPES = {
  document: ['text/html'],
  script: ['application/javascript', 'text/javascript'],
  style: ['text/css']
};

const hasExpectedContentType = (request, response) => {
  const expectedTypes =
    CACHEABLE_CONTENT_TYPES[request.destination] ||
    (request.mode === 'navigate' ? CACHEABLE_CONTENT_TYPES.document : null);

  if (!expectedTypes || !response.headers) {
    return false;
  }

  const contentType = response.headers.get('content-type');
  return Boolean(contentType && expectedTypes.some((type) => contentType.includes(type)));
};

const isCacheableResponse = (request, response) => {
  if (!response || response.status !== 200 || !response.ok) return false;
  if (response.type !== 'basic' || response.redirected) return false;

  const cacheControl = response.headers.get('cache-control');
  if (cacheControl && cacheControl.includes('no-store')) return false;

  return hasExpectedContentType(request, response);
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Stale-While-Revalidate Strategy for Navigation and JS/CSS
  if (event.request.mode === 'navigate' || event.request.destination === 'script' || event.request.destination === 'style') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (isCacheableResponse(event.request, networkResponse)) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Network First for API calls (Gemini, etc)
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
