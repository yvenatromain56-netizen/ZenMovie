const CACHE_NAME = "zenmovie-v10";

const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./style.css",
    "./config.js",
    "./couple.js",
    "./app.js",
    "./movies.json",
    "./icon.svg",
    "./icon-192.svg",
    "./icon-512.svg"
];

// Install: pre-cache essential files
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network first for API calls, cache first for static assets
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // TMDB API calls and external resources: network first, cache as fallback
    if (url.origin !== location.origin) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache successful image responses for offline use
                    if (response.ok && (url.hostname.includes("image.tmdb.org") || url.hostname.includes("picsum.photos"))) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Local files: cache first, then network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        })
    );
});
