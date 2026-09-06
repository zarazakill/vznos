// sw.js - Service Worker для кеширования и офлайн-доступа
const CACHE_NAME = 'berezka2-v2.1';
const STATIC_CACHE = 'berezka2-static-v2.1';
const DATA_CACHE = 'berezka2-data-v2.1';
const CDN_CACHE = 'berezka2-cdn-v2.1';

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
            const currentCaches = [STATIC_CACHE, DATA_CACHE, CDN_CACHE];
            return Promise.all(
                cacheNames.map(name => {
                    if (!currentCaches.includes(name)) {
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

// Вспомогательная функция fetch с таймаутом для SW
function swFetchWithTimeout(request, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('SW: fetch timeout'));
        }, timeoutMs);

        fetch(request).then(response => {
            clearTimeout(timeout);
            resolve(response);
        }).catch(err => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

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
                if (cached) return cached;
                return swFetchWithTimeout(request).then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                    }
                    return response;
                }).catch(() => {
                    return new Response('Resource unavailable', { status: 503 });
                });
            })
        );
        return;
        }

        // 2. CDN скрипты — отдельный кеш с длительным хранением
        if (request.url.includes('cdn.jsdelivr.net')) {
            event.respondWith(
                caches.open(CDN_CACHE).then(cache => {
                    return cache.match(request).then(cached => {
                        if (cached) return cached;
                        return swFetchWithTimeout(request).then(response => {
                            if (response && response.ok) {
                                const clone = response.clone();
                                cache.put(request, clone);
                            }
                            return response;
                        }).catch(() => {
                            return new Response('CDN resource unavailable', {
                                status: 503,
                                headers: { 'Content-Type': 'text/plain' }
                            });
                        });
                    });
                })
            );
            return;
        }

        // 3. ODS файлы — Stale While Revalidate (кэш первым, фоном обновляем)
        if (request.url.includes('.ods')) {
            event.respondWith(
                caches.open(DATA_CACHE).then(cache => {
                    return cache.match(request).then(cached => {
                        // Если есть кэш — возвращаем сразу, но фоном обновляем
                        if (cached) {
                            // Фоновое обновление с таймаутом
                            event.waitUntil(
                                swFetchWithTimeout(request).then(networkResponse => {
                                    if (networkResponse && networkResponse.ok) {
                                        cache.put(request, networkResponse.clone());
                                    }
                                    return networkResponse;
                                }).catch(() => {})
                            );
                            return cached;
                        }

                        // Кэша нет — пробуем загрузить с таймаутом
                        return swFetchWithTimeout(request).then(networkResponse => {
                            if (networkResponse && networkResponse.ok) {
                                cache.put(request, networkResponse.clone());
                            }
                            return networkResponse;
                        }).catch(() => {
                            return new Response(JSON.stringify({error: "offline"}), {
                                headers: {'Content-Type': 'application/json'},
                                status: 503
                            });
                        });
                    });
                })
            );
            return;
        }

        // 4. Всё остальное — Network First с fallback на кэш
        event.respondWith(
            swFetchWithTimeout(request).then(response => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(DATA_CACHE).then(cache => cache.put(request, clone));
                }
                return response;
            }).catch(() => {
                return caches.match(request).then(cached => {
                    if (cached) return cached;
                    return new Response('Network unavailable', { status: 503 });
                });
            })
        );
});
