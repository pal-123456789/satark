// Satark service worker — offline-first app shell so the tool works on low /
// no bandwidth. Pure static precache + cache-first; no tracking, no network
// calls to third parties.
const CACHE = 'satark-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icon.svg',
  'src/main.js',
  'src/engine/index.js',
  'src/engine/parse.js',
  'src/engine/signals.js',
  'src/engine/scoring.js',
  'src/data/knowledge-base.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => hit)
    )
  );
});
