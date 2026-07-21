/* Service worker: guarda el juego en caché para jugar sin conexión */
"use strict";
// OJO: al cambiar cualquier fichero de FILES hay que subir este número Y el
// "?v=" de los <script> y el <link> de index.html, y dejar los dos iguales.
//
// Son dos cachés distintas y hacen falta las dos:
//  - este número controla la caché del service worker (el juego instalado).
//  - el "?v=" de index.html cambia la URL de cada fichero, que es lo único que
//    obliga al navegador a soltar su copia. Sin él, el navegador sirve el
//    JavaScript viejo indefinidamente y no ves tus propios cambios.
const CACHE = "torres-alianza-v17";
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
