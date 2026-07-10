/* ============================================================
   TORRES ALIANZA — arranque
   Pone en marcha la interfaz y el bucle del juego.
   ============================================================ */
"use strict";
(function () {
  let last = 0;

  function loop(ts) {
    const dt = last ? (ts - last) / 1000 : 0;
    last = ts;
    const game = TA.ui.getGame();
    if (game) game.update(dt);
    TA.ui.frame();
    requestAnimationFrame(loop);
  }

  window.addEventListener("DOMContentLoaded", () => {
    TA.ui.init();
    requestAnimationFrame(loop);
  });

  // registrar el "service worker" para que funcione sin conexión
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
