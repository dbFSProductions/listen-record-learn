// Service worker: makes Xerra work with no signal once installed.
//
// App shell is precached. The Azure SDK is cached on first use rather than up
// front, so the initial load stays light. Azure and card-assistant calls are
// never cached — they're API requests and must always go to the network.

// Bumped with VERSION in js/version.js — Settings shows the two side by side,
// so forgetting one of them shows up as two different numbers on screen.
const VERSION = "xerra-v138";
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/about.js",
  "./js/add.js",
  "./js/ask.js",
  "./js/audio.js",
  "./js/books.js",
  "./js/card-assistant.js",
  "./js/chat.js",
  "./js/content.js",
  "./js/core.js",
  "./js/deck-manager.js",
  "./js/drill.js",
  "./js/epub.js",
  "./js/match.js",
  "./js/build.js",
  "./js/message.js",
  "./js/phrase.js",
  "./js/pictures.js",
  "./js/practice.js",
  "./js/quick.js",
  "./js/reader.js",
  "./js/replies.js",
  "./js/score.js",
  "./js/settings.js",
  "./js/speech.js",
  "./js/store.js",
  "./js/stories.js",
  "./js/story-page.js",
  "./js/streak.js",
  "./js/version.js",
  "./js/voices.js",
  "./vendor/fonts/nunito-latin.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/crest.png",
];

/* Precache from the network, never from the browser's own HTTP cache.
   Pages serves every asset with `max-age=600`, so for ten minutes after a
   deploy a plain `cache.add()` can still be handed the *previous* copy of a
   file. That filled a brand-new cache with a mix — a new index.html sitting
   next to the old app.js — and cache-first then served that mix for good,
   which is the one way this app has actually broken on deploy. `reload`
   bypasses the HTTP cache, so a version's cache is all of one version. */
/* And past every cache between here and Pages, too: the URL carries the
   version, so nothing in between can answer with a copy from before this
   deploy. Deb-o-lingo's v64 reached a phone as new scripts beside an old
   stylesheet, which `reload` alone did not prevent. The cache stores each
   file under that URL, so every lookup below uses `ignoreSearch`. */
const fromNetwork = (url) => new Request(`${url}?v=${VERSION}`, { cache: "reload" });

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // Individual failures shouldn't abort the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(fromNetwork(url)))))
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

  /* The document names the scripts the page will load, so it's the one file
     that must never be staler than the cache behind it: network-first, with
     the cache as the offline fallback. A deploy then lands on the first
     reload rather than the second. */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match("./index.html", { ignoreSearch: true })))
    );
    return;
  }

  // Everything else cache-first, then network, refreshing the cache as we go.
  // Suits a static app shell that changes only when it's redeployed.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
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
