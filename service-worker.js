
const CACHE_NAME = "studio-kontrolle-v6";

const DATEIEN = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./xlsx.full.min.js"
];

// Neue Version sofort installieren
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(DATEIEN))
            .then(() => self.skipWaiting())
    );
});

// Alte Caches löschen und neue Version aktivieren
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Dateien bevorzugt vom Server holen
self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    // Externe Anfragen nicht über unseren Cache verwalten
    if (new URL(event.request.url).origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {

                if (response.ok) {
                    const kopie = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, kopie));
                }

                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
