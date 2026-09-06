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
        .then(cache => {
            console.log('SW: Caching static assets');
            return cache.addAll(urlsToCache);
        })
        .then(() => self.skipWaiting())
        .catch(err => console.error('SW: Install failed:', err))
    );
});

// Активация и очистка старых кешей
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== STATIC_CACHE && name !== DATA_CACHE) {
                        console.log('SW: Deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => {
            console.log('SW: Activated, claiming clients');
            return self.clients.claim();
        })
    );
});

// Background Sync для фото (заглушка)
self.addEventListener('sync', event => {
    if (event.tag.startsWith('upload-photo')) {
        event.waitUntil(
            console.log('Background sync triggered:', event.tag)
        );
    }
});

// Стратегия кеширования с корректной обработкой ошибок
self.addEventListener('fetch', event => {
    const { request } = event;

    // Пропускаем запросы к расширениям Chrome и POST-запросы
    if (request.url.startsWith('chrome-extension://') || request.method !== 'GET') {
        return;
    }

    // Пропускаем запросы к API (яндекс, upload) — они не должны кешироваться
    if (request.url.includes('yandex.net') || request.url.includes('duckdns.org')) {
        return;
    }

    // 1. Статические ресурсы (Cache First)
    if (urlsToCache.some(u => request.url.endsWith(u.replace('./', ''))) ||
        request.url.includes('favicon') ||
        request.url.endsWith('manifest.json')) {

        event.respondWith(
            caches.match(request).then(cached => {
                return cached || fetch(request).then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                    }
                    return response;
                }).catch(() => {
                    // Если ресурс не закеширован и сеть недоступна — возвращаем fallback
                    return new Response('Resource unavailable', { status: 503 });
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
                            if (networkResponse && networkResponse.ok) {
                                cache.put(request, networkResponse.clone());
                            }
                            return networkResponse;
                        }).catch(err => {
                            console.warn('SW: Network fetch failed for ODS:', err);
                            if (!cached) {
                                return new Response(JSON.stringify({error: "offline"}), {
                                    headers: {'Content-Type': 'application/json'},
                                    status: 503
                                });
                            }
                            // Если есть кэш, возвращаем его даже при ошибке сети
                            return cached;
                        });

                        // Если есть кэш — возвращаем сразу, но фоном обновляем
                        if (cached) {
                            // Фоновое обновление
                            event.waitUntil(fetchPromise.catch(() => {}));
                            return cached;
                        }
                        return fetchPromise;
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
                        if (response && response.ok) {
                            const clone = response.clone();
                            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                        }
                        return response;
                    }).catch(() => {
                        return new Response('CDN resource unavailable', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
                })
            );
            return;
        }

        // 4. Всё остальное — Network First с fallback на кэш
        event.respondWith(
            fetch(request).then(response => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(DATA_CACHE).then(cache => cache.put(request, clone));
                }
                return response;
            }).catch(() => {
                return caches.match(request).then(cached => {
                    if (cached) return cached;
                    // Если нет кэша и сеть недоступна — возвращаем корректный fallback
                    return new Response('Network unavailable', { status: 503 });
                });
            })
        );
});
