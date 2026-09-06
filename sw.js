// sw.js - Service Worker для кеширования и офлайн-доступа
const CACHE_NAME = 'berezka2-v2';
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
'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
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

// Стратегия: сначала сеть, при ошибке — кеш (только для GET запросов)
self.addEventListener('fetch', event => {
    // Пропускаем запросы к расширениям Chrome и POST-запросы
    if (event.request.url.startsWith('chrome-extension://') ||
        event.request.method !== 'GET') {
        return;
        }

        event.respondWith(
            fetch(event.request)
            .then(response => {
                // Кешируем успешные GET-ответы
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
