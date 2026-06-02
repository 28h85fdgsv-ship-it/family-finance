const CACHE = 'shem-tov-v8';

const STATIC = [
    './',
    './index.html',
    './style.css',
    './icon.svg',
    './icon-192.png',
    './icon-512.png'
];
// app.js ו-data.json לא נשמרים ב-cache - תמיד טריים מהרשת

// Install: cache all static assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

// Activate: clear old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch: serve from cache, fall back to network and update cache
self.addEventListener('fetch', e => {
    // Only handle same-origin GET requests
    if (e.request.method !== 'GET') return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            const network = fetch(e.request).then(res => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            }).catch(() => null);

            // Return cached instantly; update in background
            return cached || network;
        })
    );
});
