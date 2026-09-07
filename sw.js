// sw.js - Service Worker для кеширования и офлайн-доступа

const CACHE_NAME = 'berezka2-v2.2';
const STATIC_CACHE = 'berezka2-static-v2.2';
const DATA_CACHE = 'berezka2-data-v2.2';

const NETWORK_TIMEOUT_MS = 15000;

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

/* ================================================================
   FETCH С ТАЙМАУТОМ
   ================================================================ */

function fetchWithTimeout(request, timeoutMs = NETWORK_TIMEOUT_MS) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    return fetch(request, {
        signal: controller.signal
    }).finally(() => {
        clearTimeout(timer);
    });
}

/* ================================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ================================================================ */

function sameOrigin(url) {
    return url.origin === self.location.origin;
}

async function cachePut(cacheName, request, response) {
    if (!response || !response.ok) {
        return;
    }

    try {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
    } catch (e) {
        console.warn('SW: ошибка записи в cache:', e);
    }
}

/* ================================================================
   УСТАНОВКА SERVICE WORKER
   ================================================================ */

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(async cache => {

                console.log('SW: установка и кеширование ресурсов');

                /*
                 * Не позволяем одному отсутствующему favicon
                 * или другому необязательному файлу сорвать
                 * установку всего Service Worker.
                 */
                await Promise.all(
                    urlsToCache.map(async url => {
                        try {
                            await cache.add(url);
                        } catch (e) {
                            console.warn(
                                'SW: ресурс пропущен:',
                                url
                            );
                        }
                    })
                );
            })
            .then(() => {
                console.log('SW: skipWaiting');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error(
                    'SW: ошибка установки:',
                    err
                );
            })
    );
});

/* ================================================================
   АКТИВАЦИЯ
   ================================================================ */

self.addEventListener('activate', event => {

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames.map(name => {

                        /*
                         * Удаляем старые версии кешей.
                         */
                        if (
                            name !== STATIC_CACHE &&
                            name !== DATA_CACHE
                        ) {

                            console.log(
                                'SW: удаление старого кеша:',
                                name
                            );

                            return caches.delete(name);
                        }

                        return undefined;
                    })
                );
            })

            .then(() => {
                console.log(
                    'SW: clients.claim()'
                );

                return self.clients.claim();
            })

            .then(() => {
                console.log(
                    'SW: Service Worker активирован'
                );
            })
    );
});

/* ================================================================
   BACKGROUND SYNC
   ================================================================ */

/*
 * Оставляем заглушку для будущей фоновой
 * загрузки фотографии.
 */
self.addEventListener('sync', event => {

    if (
        event.tag &&
        event.tag.startsWith('upload-photo')
    ) {

        event.waitUntil(
            Promise.resolve()
        );
    }
});

/* ================================================================
   FETCH
   ================================================================ */

self.addEventListener('fetch', event => {

    const request = event.request;
    const url = new URL(request.url);

    /*
     * Service Worker работает только с GET.
     *
     * POST используется, в частности, для загрузки
     * фотографий на API и не должен кешироваться.
     */
    if (request.method !== 'GET') {
        return;
    }

    /*
     * Не вмешиваемся в chrome-extension.
     */
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    /* ============================================================
       API Яндекс / DuckDNS
       ============================================================ */

    /*
     * Эти запросы должны идти напрямую.
     * Особенно важно для загрузки фотографий.
     */
    if (
        url.hostname.includes('yandex.net') ||
        url.hostname.includes('duckdns.org')
    ) {
        return;
    }

    /* ============================================================
       1. СТАТИЧЕСКИЕ ФАЙЛЫ
       ============================================================ */

    const isStatic =
        sameOrigin(url) &&
        (
            /*
             * Главная страница /
             */
            url.pathname.endsWith('/')

            ||

            /*
             * Файлы из списка urlsToCache
             */
            urlsToCache.some(u => {

                const path =
                    new URL(
                        u,
                        self.location.href
                    ).pathname;

                return url.pathname === path;
            })

            ||

            /*
             * Manifest
             */
            url.pathname.endsWith(
                '/manifest.json'
            )

            ||

            /*
             * favicon
             */
            url.pathname.includes(
                '/favicon'
            )
        );

    if (isStatic) {

        event.respondWith(

            caches.match(request)

                .then(cached => {

                    /*
                     * Самое важное:
                     * если файл уже есть в кеше —
                     * отдаём его мгновенно.
                     */
                    if (cached) {
                        return cached;
                    }

                    /*
                     * Если кеша нет —
                     * пытаемся получить его из сети,
                     * но только ограниченное время.
                     */
                    return fetchWithTimeout(request)

                        .then(response => {

                            /*
                             * Сохраняем копию в кеш.
                             */
                            event.waitUntil(
                                cachePut(
                                    STATIC_CACHE,
                                    request,
                                    response
                                )
                            );

                            return response;
                        })

                        .catch(() => {

                            /*
                             * Не даём браузеру зависнуть.
                             */
                            return new Response(
                                'Resource unavailable',
                                {
                                    status: 503,
                                    headers: {
                                        'Content-Type':
                                            'text/plain; charset=utf-8'
                                    }
                                }
                            );
                        });
                })
        );

        return;
    }

    /* ============================================================
       2. ODS ФАЙЛЫ
       ============================================================ */

    /*
     * base.ods
     * debit.ods
     * ee.ods
     *
     * Используется схема:
     *
     *   CACHE → сразу пользователю
     *
     *   NETWORK → обновление в фоне
     *
     * Если кеша нет:
     *
     *   NETWORK → максимум 15 сек
     */

    if (
        url.pathname
            .toLowerCase()
            .endsWith('.ods')
    ) {

        event.respondWith(

            caches.open(DATA_CACHE)

                .then(async cache => {

                    const cached =
                        await cache.match(request);

                    /*
                     * Запрос в сеть.
                     */
                    const network =
                        fetchWithTimeout(request)

                            .then(async response => {

                                if (
                                    response &&
                                    response.ok
                                ) {

                                    await cache.put(
                                        request,
                                        response.clone()
                                    );
                                }

                                return response;
                            })

                            .catch(err => {

                                console.warn(
                                    'SW: ошибка загрузки ODS:',
                                    err
                                );

                                /*
                                 * Если есть старый кеш —
                                 * используем его.
                                 */
                                if (cached) {
                                    return cached;
                                }

                                /*
                                 * Если кеша нет —
                                 * возвращаем контролируемую ошибку.
                                 */
                                return new Response(

                                    JSON.stringify({
                                        error: 'offline'
                                    }),

                                    {
                                        status: 503,

                                        headers: {
                                            'Content-Type':
                                                'application/json; charset=utf-8',

                                            'Cache-Control':
                                                'no-store'
                                        }
                                    }
                                );
                            });

                    /*
                     * Есть кеш.
                     *
                     * Отдаём его сразу,
                     * а сеть работает в фоне.
                     */
                    if (cached) {

                        event.waitUntil(
                            network.catch(() => {})
                        );

                        return cached;
                    }

                    /*
                     * Кеша нет —
                     * ждём ограниченный сетевой запрос.
                     */
                    return network;
                })
        );

        return;
    }

    /* ============================================================
       3. CDN
       ============================================================ */

    /*
     * Оставляем поддержку CDN.
     *
     * index.html теперь загружает библиотеки лениво,
     * поэтому проблема блокировки первоначального рендера
     * из-за CDN устранена.
     */

    if (
        url.hostname ===
        'cdn.jsdelivr.net'
    ) {

        event.respondWith(

            caches.match(request)

                .then(cached => {

                    /*
                     * CDN уже в кеше.
                     */
                    if (cached) {
                        return cached;
                    }

                    /*
                     * CDN ещё нет в кеше.
                     */
                    return fetchWithTimeout(request)

                        .then(response => {

                            event.waitUntil(
                                cachePut(
                                    STATIC_CACHE,
                                    request,
                                    response
                                )
                            );

                            return response;
                        })

                        .catch(() => {

                            return new Response(
                                'CDN resource unavailable',
                                {
                                    status: 503,

                                    headers: {
                                        'Content-Type':
                                            'text/plain; charset=utf-8'
                                    }
                                }
                            );
                        });
                })
        );

        return;
    }

    /* ============================================================
       4. ОСТАЛЬНЫЕ GET ЗАПРОСЫ
       ============================================================ */

    /*
     * Network First:
     *
     * 1. сеть
     * 2. максимум 15 секунд
     * 3. если сеть не отвечает — кеш
     * 4. если кеша нет — 503
     */

    event.respondWith(

        fetchWithTimeout(request)

            .then(response => {

                /*
                 * Кешируем только same-origin успешные ответы.
                 */
                if (
                    response &&
                    response.ok &&
                    sameOrigin(url)
                ) {

                    event.waitUntil(
                        cachePut(
                            DATA_CACHE,
                            request,
                            response
                        )
                    );
                }

                return response;
            })

            .catch(() => {

                return caches.match(request)

                    .then(cached => {

                        if (cached) {
                            return cached;
                        }

                        return new Response(
                            'Network unavailable',
                            {
                                status: 503,

                                headers: {
                                    'Content-Type':
                                        'text/plain; charset=utf-8'
                                }
                            }
                        );
                    });
            })
    );
});
