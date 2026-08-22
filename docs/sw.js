// Service worker: makes Xerra work with no signal once installed.
//
// App shell is precached. The Azure SDK is cached on first use rather than up
// front, so the initial load stays light. Azure and card-assistant calls are
// never cached — they're API requests and must always go to the network.

const VERSION = "xerra-v16";
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/store.js",
  "./js/audio.js",
  "./js/card-assistant.js",
  "./js/speech.js",
  "./js/content.js",
  "./vendor/fonts/nunito-latin.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // Individual failures shouldn't abort the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let Azure through untouched

  // Cache-first, then network, refreshing the cache as we go. Suits a static
  // app shell that changes only when it's redeployed.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
