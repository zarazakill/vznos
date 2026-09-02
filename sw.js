// sw.js - Service Worker для кеширования и офлайн-доступа
const CACHE_NAME = 'berezka2-v2.1';
const STATIC_CACHE = 'berezka2-static-v2.1';
const DATA_CACHE = 'berezka2-data-v2.1';

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
    './apple-touch-icon.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
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
                    if (name !== STATIC_CACHE && name !== DATA_CACHE) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Background Sync для фото (заглушка — в полной версии достаём из IndexedDB)
self.addEventListener('sync', event => {
    if (event.tag.startsWith('upload-photo')) {
        event.waitUntil(
            console.log('Background sync triggered:', event.tag)
        );
    }
});

// Стратегия кеширования
self.addEventListener('fetch', event => {
    const { request } = event;

    // Пропускаем запросы к расширениям Chrome и POST-запросы
    if (request.url.startsWith('chrome-extension://') || request.method !== 'GET') {
        return;
    }

    // 1. Статические ресурсы (Cache First)
    if (urlsToCache.some(u => request.url.endsWith(u.replace('./', ''))) || 
        request.url.includes('favicon') ||
        request.url.endsWith('manifest.json')) {

        event.respondWith(
            caches.match(request).then(cached => {
                return cached || fetch(request).then(response => {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // 2. ODS файлы — Stale While Revalidate (кэш первым, фоном обновляем)
    if (request.url.includes('.ods')) {
        event.respondWith(
            caches.open(DATA_CACHE).then(cache => {
                return cache.match(request).then(cached => {
                    const fetchPromise = fetch(request).then(networkResponse => {
                        if (networkResponse.ok) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(err => {
                        console.warn('Network fetch failed for ODS, using cache:', err);
                        if (!cached) {
                            return new Response(JSON.stringify({error: "offline"}), {
                                headers: {'Content-Type': 'application/json'}
                            });
                        }
                        throw err;
                    });

                    return cached || fetchPromise;
                });
            })
        );
        return;
    }

    // 3. CDN скрипты (jszip, qrcode) — Cache First с fallback
    if (request.url.includes('cdn.jsdelivr.net')) {
        event.respondWith(
            caches.match(request).then(cached => {
                return cached || fetch(request).then(response => {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                    return response;
                }).catch(() => {
                    return new Response('CDN resource unavailable', {status: 503});
                });
            })
        );
        return;
    }

    // 4. Всё остальное — Network First с fallback на кэш
    event.respondWith(
        fetch(request).then(response => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(DATA_CACHE).then(cache => cache.put(request, clone));
            }
            return response;
        }).catch(() => {
            return caches.match(request);
        })
    );
});
