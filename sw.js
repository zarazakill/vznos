// sw.js - Service Worker для кеширования и офлайн-доступа
// ВЕРСИЯ ОБНОВЛЕНА до v2.2 для принудительной очистки старого кэша на iOS
const CACHE_NAME = 'berezka2-v2.2';
const STATIC_CACHE = 'berezka2-static-v2.2';
const DATA_CACHE = 'berezka2-data-v2.2';

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

// Background Sync для фото (заглушка)
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

    // 2. ODS файлы — Network Only (ИСПРАВЛЕНО ДЛЯ iOS)
    // На iOS Safari кэширование больших бинарных файлов (.ods) в Cache API 
    // через clone() часто приводит к тихим сбоям, переполнению квоты или отдаче битых данных.
    // Кэшированием этих данных теперь управляет ТОЛЬКО основной скрипт через IndexedDB.
    if (request.url.includes('.ods')) {
        event.respondWith(
            fetch(request).then(networkResponse => {
                // Просто отдаем ответ основному скрипту. Он сам решит, сохранить ли его в IndexedDB.
                return networkResponse;
            }).catch(err => {
                console.warn('SW: Network fetch failed for ODS, relying on main script IndexedDB:', err);
                // Возвращаем ошибку сети. Основной скрипт (loadPlotData) перехватит её 
                // и попытается загрузить данные из своего надежного IndexedDB кэша.
                return new Response(null, { status: 503, statusText: 'Offline' });
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
