/* Rastnevis service worker: network-first with an offline fallback.
 * Online visitors always get the latest deploy; the cache is only used when the network fails.
 * Bump CACHE_VERSION on every release so stale entries are dropped. */
const CACHE_VERSION = 'rastnevis-1.1.0';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/theme.js',
  './assets/js/app.js',
  './assets/fonts/Vazirmatn-33.0.3-wght.woff2',
  './assets/fonts/JetBrainsMono-5.3.0-latin-wght.woff2',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './vendor/marked-12.0.2.min.js',
  './vendor/purify-3.4.17.min.js',
  './vendor/highlight-11.9.0.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // markdown images from other sites go straight to the network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const key = req.mode === 'navigate' ? './index.html' : req;
        event.waitUntil(cache.put(key, res.clone()));
      }
      return res;
    } catch (err) {
      const hit = await cache.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
