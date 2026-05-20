// Service worker — cache-first for app shell + Bible data.
// Bump CACHE_VERSION when shipping updates; old caches will be cleaned.

const CACHE_VERSION = "hope-v32";
// Note: cache size now ~17MB (KJV + BSB + WEB + ASV all bundled)
const APP_SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "icons/icon.svg",
  "data/kjv.json",
  "data/bsb.json",
  "data/topics.json",
  "data/daily.json",
  "data/voice.json",
  "data/quiz.json",
  "data/plans.json",
];
// Optional translations cached on first request, not at install
const OPTIONAL_DATA = ["data/web.json", "data/asv.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        // Don't cache opaque/error responses
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match("index.html"));
    }),
  );
});
