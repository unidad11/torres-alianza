/* ============================================================
   TORRES ALIANZA — arte dibujado (fase 0 de la dirección de arte)
   Personajes y torres dibujados como ilustración (ficheros SVG de la
   carpeta art/) que se pintan como sprites de cartón sobre el terreno 3D.
   Siempre miran a la cámara, como en los juegos de dibujos.

   Para volver al arte antiguo (formas 3D sencillas) basta con abrir el
   juego con ?arte=0 al final de la dirección.
   ============================================================ */
"use strict";
(function () {
  const A = TA.arte = {};
  A.enabled = !/[?&]arte=0(&|$)/.test(location.search);

  // misma versión (?v=) que el propio script: así los dibujos también se
  // refrescan cuando se sube el número, sin un tercer número que recordar
  const script = document.currentScript;
  const VERSION = script && script.src.indexOf("?") >= 0 ? script.src.split("?")[1] : "";

  // w/h: tamaño del dibujo · feetX/feetY: dónde apoya en el suelo (px del dibujo)
  // alto: alto real del personaje en unidades 3D (1 unidad = 12 px de juego)
  // cw/ch: tamaño de la textura (potencias de 2, para que funcionen los mipmaps)
  const DEFS = {
    arqueros: { file: "art/arqueros.svg", w: 300, h: 400, feetX: 150, feetY: 378, topY: 4,  alto: 8.4, cw: 512, ch: 512 },
    goblin:   { file: "art/goblin.svg",   w: 300, h: 340, feetX: 150, feetY: 322, topY: 10, alto: 3.8, cw: 512, ch: 512 },
    roldan:   { file: "art/roldan.svg",   w: 300, h: 760, feetX: 150, feetY: 744, topY: 6,  alto: 5.6, cw: 512, ch: 1024 },
  };

  A.has = function (name) { return A.enabled && !!(DEFS[name] && DEFS[name].tex); };
  A.altoDe = function (name) { return DEFS[name] ? DEFS[name].alto : 1.5; };

  // ---------- carga: cada SVG se dibuja una vez en un lienzo y pasa a textura ----------
  A.load = function () {
    if (!A.enabled) return Promise.resolve();
    return Promise.all(Object.keys(DEFS).map((name) => new Promise((resolve) => {
      const d = DEFS[name];
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement("canvas");
          cv.width = d.cw; cv.height = d.ch;
          cv.getContext("2d").drawImage(img, 0, 0, d.cw, d.ch);
          const tex = new THREE.CanvasTexture(cv);
          tex.anisotropy = 4;
          d.tex = tex;
        } catch (e) { /* sin textura: el juego usa el modelo 3D de siempre */ }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = d.file + (VERSION ? "?" + VERSION : "");
    })));
  };

  // ---------- sombra redonda en el suelo (los sprites no proyectan sombra) ----------
  let blobGeo = null, blobMat = null;
  function makeBlob(radio) {
    if (!blobGeo) {
      blobGeo = new THREE.CircleGeometry(1, 20);
      blobGeo.rotateX(-Math.PI / 2);
      blobMat = new THREE.MeshBasicMaterial({ color: 0x0a0612, transparent: true, opacity: 0.32, depthWrite: false });
    }
    const m = new THREE.Mesh(blobGeo, blobMat);
    m.scale.set(radio, 1, radio * 0.8);
    m.position.y = 0.2;   // por encima del camino (0.14-0.17)
    return m;
  }

  // ---------- crear un personaje o torre dibujado ----------
  // devuelve un grupo con el sprite y su sombra; null si no hay dibujo
  A.make = function (name, radioSombra) {
    const d = DEFS[name];
    if (!A.has(name)) return null;
    const mat = new THREE.SpriteMaterial({ map: d.tex, transparent: true, alphaTest: 0.04, fog: false });
    const spr = new THREE.Sprite(mat);
    const upp = d.alto / (d.feetY - d.topY);        // unidades 3D por píxel del dibujo
    const wu = d.w * upp, hu = d.h * upp;
    spr.scale.set(wu, hu, 1);
    spr.center.set(d.feetX / d.w, 1 - d.feetY / d.h);   // pivote en los pies
    const g = new THREE.Group();
    g.add(makeBlob(radioSombra || 1));
    g.add(spr);
    g.userData.art = { sprite: spr, wu, hu, alto: d.alto };
    return g;
  };

  // ---------- pose: mirar a un lado, botar al andar, respirar parado ----------
  // No hay fotogramas de animación: se anima el propio dibujo (aplastar y
  // estirar, un balanceo suave), que es lo que da vida a un dibujo estático.
  A.pose = function (g, o) {
    const a = g.userData.art;
    if (!a) return;
    const t = o.t, ph = o.phase || 0;
    let sx = 1, sy = 1, lift = 0, sway;
    if (o.moving) {
      const bote = Math.abs(Math.sin(t * 7 + ph));
      sy = 1 + 0.05 * bote - 0.02;
      sx = 1 - 0.03 * bote + 0.01;
      lift = 0.14 * bote * a.alto / 2.5;
      sway = Math.sin(t * 7 + ph) * 0.05;
    } else {
      sy = 1 + 0.012 * Math.sin(t * 2.2 + ph);
      sx = 1 - 0.006 * Math.sin(t * 2.2 + ph);
      sway = Math.sin(t * 1.4 + ph) * 0.012;
    }
    if (o.pulso) { sy *= 1 + o.pulso; sx *= 1 - o.pulso * 0.5; }
    a.sprite.scale.set(a.wu * sx * (o.flip ? -1 : 1), a.hu * sy, 1);
    a.sprite.material.rotation = sway;
    a.sprite.position.y = lift;
  };

  A.load();   // arranca la carga al abrir el juego, mucho antes de la primera partida
})();
