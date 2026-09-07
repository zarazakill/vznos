// sw.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const CACHE_NAME = 'berezka2-v2.3';
const STATIC_CACHE = 'berezka2-static-v2.3';
const DATA_CACHE = 'berezka2-data-v2.3';

// НЕ КЕШИРУЕМ index.html для избежания проблем с обновлением
const urlsToCache = [
    './manifest.json',
    './favicon.ico',
    './favicon-16x16.png',
    './favicon-32x32.png',
    './favicon-96x96.png',
    './favicon-192x192.png',
    './favicon-512x512.png',
    './apple-touch-icon.png',
    './js/jszip.min.js',
    './js/qrcode.min.js'
];

// ============================================================
// УСТАНОВКА
// ============================================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
        .then(cache => {
            console.log('SW: кеширование статики');
            return cache.addAll(urlsToCache);
        })
        .then(() => self.skipWaiting())
        .catch(err => console.warn('SW: ошибка установки:', err))
    );
});

// ============================================================
// АКТИВАЦИЯ — ОЧИЩАЕМ СТАРЫЙ КЕШ
// ============================================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
        .then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== STATIC_CACHE && name !== DATA_CACHE) {
                        console.log('SW: удаление старого кеша:', name);
                        return caches.delete(name);
                    }
                    return Promise.resolve();
                })
            );
        })
        .then(() => {
            console.log('SW: clients.claim()');
            return self.clients.claim();
        })
    );
});

// ============================================================
// FETCH С ТАЙМАУТОМ
// ============================================================
function fetchWithTimeout(request, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(request, { signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Только GET
    if (request.method !== 'GET') return;

    // Не вмешиваемся в chrome-extension и внешние API
    if (url.protocol === 'chrome-extension:') return;
    if (url.hostname.includes('yandex.net') || url.hostname.includes('duckdns.org')) {
        return;
    }

    // ============================================================
    // СТАТИКА — КЕШ ПЕРВЫЙ
    // ============================================================
    const isStatic = urlsToCache.some(u => {
        const path = new URL(u, self.location.href).pathname;
        return url.pathname === path;
    }) || url.pathname.includes('/favicon') || url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg');

    if (isStatic) {
        event.respondWith(
            caches.match(request)
            .then(cached => cached || fetchWithTimeout(request))
            .catch(() => new Response('Resource unavailable', { status: 503 }))
        );
        return;
    }

    // ============================================================
    // ODS — СЕТЬ ПЕРВАЯ, КЕШ КАК ЗАПАС
    // ============================================================
    if (url.pathname.toLowerCase().endsWith('.ods')) {
        event.respondWith(
            fetchWithTimeout(request, 15000)
            .then(response => {
                if (response && response.ok) {
                    const cloned = response.clone();
                    event.waitUntil(
                        caches.open(DATA_CACHE).then(cache => cache.put(request, cloned))
                    );
                }
                return response;
            })
            .catch(() => {
                return caches.match(request).then(cached => {
                    if (cached) return cached;
                    // Возвращаем корректную ошибку, а не undefined
                    return new Response(
                        JSON.stringify({ error: 'offline' }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json; charset=utf-8' }
                        }
                    );
                });
            })
        );
        return;
    }

    // ============================================================
    // index.html — ВСЕГДА ИЗ СЕТИ (НЕ КЕШИРУЕМ)
    // ============================================================
    if (url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
        event.respondWith(
            fetchWithTimeout(request, 10000)
            .then(response => {
                // Добавляем заголовки для предотвращения кеширования
                const newHeaders = new Headers(response.headers);
                newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                newHeaders.set('Pragma', 'no-cache');
                newHeaders.set('Expires', '0');
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders
                });
            })
            .catch(() => {
                return caches.match(request).then(cached => {
                    if (cached) return cached;
                    return new Response('Network unavailable', { status: 503 });
                });
            })
        );
        return;
    }

    // ============================================================
    // ВСЁ ОСТАЛЬНОЕ — СЕТЬ С ЗАПАСНЫМ КЕШЕМ
    // ============================================================
    event.respondWith(
        fetchWithTimeout(request, 10000)
        .then(response => {
            if (response && response.ok && sameOrigin(url)) {
                event.waitUntil(
                    caches.open(DATA_CACHE).then(cache => cache.put(request, response.clone()))
                );
            }
            return response;
        })
        .catch(() => {
            return caches.match(request).then(cached => {
                if (cached) return cached;
                return new Response('Network unavailable', { status: 503 });
            });
        })
    );
});

function sameOrigin(url) {
    return url.origin === self.location.origin;
}
