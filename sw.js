/* Mister Cab — service worker: offline app shell */
const CACHE = 'mcc-v8';
const SHELL = [
  './', './index.html', './styles.css?v=8', './config.js?v=8', './data.js?v=8', './confirm.js?v=8', './app.js?v=8',
  './vendor/qrcode.js', './manifest.webmanifest', './icons/logo.png', './icons/icon-192.png', './icons/icon-512.png',
  './img/amalfi-positano-ravello.jpg', './img/pompei-porta.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Live data (Supabase) always from the network
  if (url.hostname.endsWith('supabase.co')) return;
  // Same-origin files: network first, fall back to cache when offline
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
    return;
  }
  // Fonts / QR library: cache first
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  })));
});
