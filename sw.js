// sw.js - Service Worker для кеширования и офлайн-доступа
const CACHE_NAME = 'berezka2-v1';
const urlsToCache = [
    './',
'./index.html',
'./favicon.ico',
'./favicon-16x16.png',
'./favicon-32x32.png',
'./favicon-96x96.png',
'./favicon-192x192.png',
'./favicon-512x512.png',
'./apple-touch-icon.png',
'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(urlsToCache))
        .then(() => self.skipWaiting())
    );
});

// Активация и очистка старых кешей
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия: сначала сеть, при ошибке — кеш
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
        .then(response => {
            // Кешируем успешные ответы
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
            });
            return response;
        })
        .catch(() => {
            return caches.match(event.request);
        })
    );
});
