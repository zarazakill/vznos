// sw.js - Service Worker для кеширования и офлайн-доступа
const CACHE_NAME = 'berezka2-v2.3';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
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
        .catch(err => console.warn('SW install error:', err))
    );
});

// Активация и очистка старых кешей
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        console.log('SW: deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия: сначала сеть, при ошибке — кеш
self.addEventListener('fetch', event => {
    const request = event.request;

    // Пропускаем запросы к расширениям Chrome и POST-запросы
    if (request.url.startsWith('chrome-extension://') ||
        request.method !== 'GET') {
        return;
    }

    // Пропускаем ODS файлы (загружаются напрямую, не кешируются)
    if (request.url.toLowerCase().includes('.ods')) {
        return;
    }

    // Пропускаем API запросы к Яндекс.Диску и DuckDNS
    if (request.url.includes('yandex.net') || request.url.includes('duckdns.org')) {
        return;
    }

    event.respondWith(
        fetch(request)
        .then(response => {
            // Кешируем успешные GET-ответы
            if (response && response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, responseClone);
                }).catch(() => {});
            }
            return response;
        })
        .catch(() => {
            return caches.match(request);
        })
    );
});
