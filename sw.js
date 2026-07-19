/* Service worker: guarda el juego en caché para jugar sin conexión */
"use strict";
const CACHE = "torres-alianza-v4";
const FILES = [
  ".", "index.html", "manifest.json",
  "css/style.css",
  "js/data.js", "js/sprites.js", "js/engine.js", "js/render.js", "js/webgl.js",
  "js/vendor/three.min.js", "js/render3d.js",
  "js/audio.js", "js/ui.js", "js/main.js",
  "icon-180.png", "icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
