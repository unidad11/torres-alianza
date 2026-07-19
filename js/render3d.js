/* ============================================================
   TORRES ALIANZA — render 3D (Three.js)
   Sustituye a render.js + sprites.js + webgl.js para la pantalla
   de partida. El motor (engine.js) sigue igual: aquí solo se
   traduce el estado del juego (game.towers, game.enemies, ...)
   a una escena 3D con estilo "cartoon" (sombreado plano + contorno).
   ============================================================ */
"use strict";
(function () {
  const R3 = TA.render3d = {};

  // 1 píxel de juego (960x540) = SCALE unidades 3D
  const SCALE = 1 / 12;
  const toX = (x) => (x - TA.W / 2) * SCALE;
  const toZ = (y) => (y - TA.H / 2) * SCALE;
  const fromWorld = (wx, wz) => ({ x: wx / SCALE + TA.W / 2, y: wz / SCALE + TA.H / 2 });

  let renderer, scene, camera, sun, raycaster, groundPlane;
  let terrainMesh = null, pathGroup = null, currentPaths = [];
  const pools = { towers: new Map(), enemies: new Map(), units: new Map(), projectiles: new Map(), effects: new Map() };

  // aparta un punto del camino si queda demasiado cerca (solo para dibujar,
  // no cambia tw.x/tw.y que usa el motor para rango y selección)
  function clearOfPath(x, y, minClear) {
    let best = Infinity, nx = 0, ny = 0;
    for (const path of currentPaths) {
      for (const seg of path.segs) {
        const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
        const len2 = dx * dx + dy * dy;
        let t = len2 ? ((x - seg.x1) * dx + (y - seg.y1) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = seg.x1 + dx * t, cy = seg.y1 + dy * t;
        const d = Math.hypot(x - cx, y - cy);
        if (d < best) {
          best = d;
          const nlen = Math.hypot(dx, dy) || 1;
          nx = -dy / nlen; ny = dx / nlen;
          if ((x - cx) * nx + (y - cy) * ny < 0) { nx = -nx; ny = -ny; }
        }
      }
    }
    if (best >= minClear || best === Infinity) return { x, y };
    const push = minClear - best;
    return { x: x + nx * push, y: y + ny * push };
  }

  // ---------- utilidades de material/geometría "cartoon" ----------
  function toonMat(color, extra) {
    return new THREE.MeshToonMaterial(Object.assign({ color }, extra || {}));
  }
  function addOutline(mesh, color, scale) {
    const outline = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: color || 0x201a14, side: THREE.BackSide }));
    outline.scale.multiplyScalar(scale || 1.08);
    mesh.add(outline);
  }
  function hashColor(str, sat, light) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return new THREE.Color().setHSL((h % 360) / 360, sat || 0.4, light || 0.5).getHex();
  }
  // pequeño lienzo con texto para números de daño / oro flotantes
  function makeTextSprite(text, color) {
    const cv = document.createElement("canvas");
    cv.width = 128; cv.height = 64;
    const c = cv.getContext("2d");
    c.font = "bold 40px sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.lineWidth = 6; c.strokeStyle = "rgba(0,0,0,0.6)";
    c.strokeText(text, 64, 32);
    c.fillStyle = color || "#fff";
    c.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    spr.scale.set(1.6, 0.8, 1);
    spr.renderOrder = 999;
    return spr;
  }

  // ---------- inicialización ----------
  R3.init = function (canvas) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
    catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fc7ec);
    scene.fog = new THREE.Fog(0x8fc7ec, 55, 130);

    camera = new THREE.PerspectiveCamera(42, 16 / 9, 1, 300);
    camera.position.set(0, 60, 46);
    camera.lookAt(0, 0, -4);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(28, 48, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46 });
    scene.add(sun);

    raycaster = new THREE.Raycaster();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    return true;
  };

  R3.resize = function (w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };

  // ---------- entrada: pantalla <-> mundo de juego ----------
  R3.screenToGame = function (clientX, clientY, rect) {
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, pt);
    return pt ? fromWorld(pt.x, pt.z) : { x: TA.W / 2, y: TA.H / 2 };
  };
  R3.gameToScreen = function (x, y) {
    const v = new THREE.Vector3(toX(x), 0, toZ(y)).project(camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; // fracción 0..1 del lienzo
  };

  // ---------- terreno ----------
  R3.buildTerrain = function (level, paths) {
    if (terrainMesh) { scene.remove(terrainMesh); }
    if (pathGroup) { scene.remove(pathGroup); }
    currentPaths = paths;

    const REGION_COLOR = { bosque: 0x5a9d42, desierto: 0xd9bc7a, montana: 0xe8f0f5 };
    const color = REGION_COLOR[level.region] || REGION_COLOR.bosque;
    const geo = new THREE.PlaneGeometry(TA.W * SCALE, TA.H * SCALE, 20, 12);
    terrainMesh = new THREE.Mesh(geo, toonMat(color));
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    pathGroup = new THREE.Group();
    const pathMat = toonMat(0xb0895a, { side: THREE.DoubleSide });
    const halfW = 21; // mitad del ancho del camino, en píxeles de juego
    for (const path of paths) {
      if (path.total < 1) continue;
      const steps = Math.max(2, Math.round(path.total / 6));
      const left = [], right = [];
      for (let i = 0; i <= steps; i++) {
        const s = (path.total * i) / steps;
        const p = path.at(s);
        left.push(toX(p.x + p.nx * halfW), 0.03, toZ(p.y + p.ny * halfW));
        right.push(toX(p.x - p.nx * halfW), 0.03, toZ(p.y - p.ny * halfW));
      }
      // franja plana (triangle strip): dos vértices por muestra, alternando lado
      const verts = [];
      for (let i = 0; i <= steps; i++) {
        verts.push(left[i * 3], left[i * 3 + 1], left[i * 3 + 2]);
        verts.push(right[i * 3], right[i * 3 + 1], right[i * 3 + 2]);
      }
      const idx = [];
      for (let i = 0; i < steps; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, b, c, b, d, c);
      }
      const ribbonGeo = new THREE.BufferGeometry();
      ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      ribbonGeo.setIndex(idx);
      ribbonGeo.computeVertexNormals();
      const ribbon = new THREE.Mesh(ribbonGeo, pathMat);
      ribbon.receiveShadow = true;
      pathGroup.add(ribbon);
    }
    if (level.river) {
      const rv = level.river;
      const riverGeo = new THREE.PlaneGeometry(rv.w * SCALE, TA.H * SCALE);
      const river = new THREE.Mesh(riverGeo, toonMat(0x4fa9d9));
      river.rotation.x = -Math.PI / 2;
      river.position.set(toX(rv.x), 0.02, 0);
      pathGroup.add(river);
    }
    scene.add(pathGroup);
  };

  // ---------- torres ----------
  const TOWER_STYLE = {
    arqueros:  { base: 0x9d7050, roof: 0xb8934f, gem: 0x4a9d6e },
    cuartel:   { base: 0x7a6b5f, roof: 0x5c5248, gem: 0xc9a04a },
    magos:     { base: 0x5c4a7a, roof: 0x7a5ca0, gem: 0x9d6fd4 },
    canon:     { base: 0x5a5a5a, roof: 0x3d3d3d, gem: 0x8a8a8a },
    hielo:     { base: 0x6f97a8, roof: 0x8fc4d9, gem: 0xbfe8f7 },
    electrica: { base: 0x5c7a6f, roof: 0x4a9d8f, gem: 0xc9d94a },
    apoyo:     { base: 0x8f7a4a, roof: 0xc9b37a, gem: 0xd9c98a },
  };
  const LEVEL_GEM = [0x8f9d7a, 0x4a90d9, 0xb87fd4];

  function makeTowerMesh(tw) {
    const st = TOWER_STYLE[tw.type] || TOWER_STYLE.arqueros;
    const g = new THREE.Group();

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 2.2, 14), toonMat(st.base));
    base.position.y = 1.1; base.castShadow = true; addOutline(base, 0x201a14, 1.08);
    g.add(base);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 4.4, 14), toonMat(st.base));
    body.position.y = 4.4; body.castShadow = true; addOutline(body, 0x201a14, 1.08);
    g.add(body);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cren = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.8), toonMat(st.base));
      cren.position.set(Math.cos(a) * 2.4, 6.9, Math.sin(a) * 2.4);
      cren.castShadow = true; addOutline(cren, 0x201a14, 1.08);
      g.add(cren);
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 1.8, 14), toonMat(st.roof));
    roof.position.y = 7.7; roof.castShadow = true; addOutline(roof, 0x201a14, 1.08);
    g.add(roof);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), toonMat(st.gem, { emissive: st.gem, emissiveIntensity: 0.3 }));
    gem.position.y = 8.9; gem.castShadow = true; addOutline(gem, 0x1a1a1a, 1.1);
    g.add(gem);
    g.userData.gem = gem;
    g.scale.setScalar(0.45); // el radio original quedaba más ancho que el camino

    return g;
  }
  function updateTowerMesh(tw, g) {
    if (g.userData.gx === undefined) {
      const clear = clearOfPath(tw.x, tw.y, 38); // 21 de medio camino + margen de la base de la torre
      g.userData.gx = clear.x; g.userData.gy = clear.y;
    }
    g.position.set(toX(g.userData.gx), 0, toZ(g.userData.gy));
    if (typeof tw.aimAngle === "number") g.rotation.y = -tw.aimAngle;
    const lvl = Math.max(0, Math.min(2, (tw.level || 1) - 1));
    g.userData.gem.material.color.setHex(LEVEL_GEM[lvl]);
    g.userData.gem.rotation.y += 0.02;
  }

  // ---------- enemigos (forma genérica + color por tipo) ----------
  function makeEnemyMesh(e) {
    const g = new THREE.Group();
    const scale = Math.max(0.6, (e.r || 12) / 12);
    const color = hashColor(e.type || "enemigo", 0.35, e.boss ? 0.42 : 0.5);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.1 * scale, 1.3 * scale, 1.1 * scale, 2, 2, 2),
      toonMat(color)
    );
    body.castShadow = true; addOutline(body, 0x1a1a1a, 1.1);
    g.add(body);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 8, 8), toonMat(0xffffff));
      eye.position.set(side * 0.32 * scale, 0.35 * scale, 0.58 * scale);
      addOutline(eye, 0x000000, 1.15);
      g.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 8), toonMat(0x000000));
      pupil.position.set(side * 0.32 * scale, 0.35 * scale, 0.7 * scale);
      g.add(pupil);
    }

    if (e.fly) {
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.5 * scale, 1 * scale, 4), toonMat(color, { transparent: true, opacity: 0.85 }));
        wing.rotation.z = side * 1.1;
        wing.position.set(side * 0.75 * scale, 0.2 * scale, 0);
        g.add(wing);
      }
    }

    g.userData.hover = e.fly ? 1.9 * scale : 0.65 * scale;
    g.userData.fly = !!e.fly;
    return g;
  }
  function updateEnemyMesh(e, g) {
    g.position.set(toX(e.x), g.userData.hover, toZ(e.y));
    if (e.dx !== undefined) g.rotation.y = Math.atan2(e.dx, e.dy || 0.001) + Math.PI;
    if (g.userData.fly) g.position.y = g.userData.hover + Math.sin(performance.now() * 0.004 + e.x) * 0.15;
  }

  // ---------- unidades: soldados y héroes ----------
  const HERO_COLOR = { roldan: 0x9d4444, lyra: 0x4e8f5a, amir: 0xc9a04a, zahra: 0x7a5ca0, bjorn: 0x5c7a9d, frida: 0xb87fa0 };
  function makeUnitMesh(u) {
    const g = new THREE.Group();
    const isHero = u.kindU === "hero";
    const color = isHero ? (HERO_COLOR[u.type] || 0xc9a04a) : 0x6f7a8f;
    const h = isHero ? 1.1 : 0.9;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, h, 10), toonMat(color));
    body.position.y = h / 2;
    body.castShadow = true; addOutline(body, 0x1a1a1a, 1.1);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), toonMat(color));
    head.position.y = h + 0.2;
    head.castShadow = true; addOutline(head, 0x1a1a1a, 1.1);
    g.add(head);
    if (isHero) {
      const helm = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 8), toonMat(0xd9c060));
      helm.position.y = h + 0.45; addOutline(helm, 0x1a1a1a, 1.1);
      g.add(helm);
    }
    return g;
  }
  function updateUnitMesh(u, g) {
    g.position.set(toX(u.x), 0, toZ(u.y));
    g.visible = !u.dead;
  }

  // ---------- proyectiles ----------
  function makeProjMesh(p) {
    const color = p.type === "mag" || p.type === "rayo" ? 0x8fd4ff : 0xe8dca0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color }));
    return m;
  }
  function updateProjMesh(p, m) { m.position.set(toX(p.x), 0.9, toZ(p.y)); }

  // ---------- efectos (partículas simples) ----------
  function makeEffectMesh(fx) {
    if (fx.kind === "dmg") return makeTextSprite(String(fx.text), fx.color || "#fff2c8");
    if (fx.kind === "coin") return makeTextSprite("+" + "$", "#ffd94a");
    if (fx.kind === "heal") return makeTextSprite("+", "#7CFC9A");
    const color = fx.kind === "boom" ? 0xff9d4a : fx.kind === "whirl" ? 0xbfe0ff : 0xffffff;
    const geo = fx.kind === "boom" || fx.kind === "whirl" ? new THREE.TorusGeometry(0.6, 0.15, 6, 12) : new THREE.SphereGeometry(0.25, 6, 6);
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  }
  function updateEffectMesh(fx, m) {
    const t = fx.age / fx.dur;
    m.position.set(toX(fx.x), 1.2 + t * 1.2, toZ(fx.y));
    const s = fx.kind === "boom" || fx.kind === "whirl" ? 1 + t * 2 : 1;
    m.scale.set(s, s, s);
    if (m.material) m.material.opacity = Math.max(0, 1 - t);
  }

  // ---------- sincronización genérica de pools ----------
  function syncPool(pool, list, factory, updater) {
    const seen = new Set();
    for (const obj of list) {
      let mesh = pool.get(obj);
      if (!mesh) { mesh = factory(obj); scene.add(mesh); pool.set(obj, mesh); }
      updater(obj, mesh);
      seen.add(obj);
    }
    for (const [obj, mesh] of pool) {
      if (!seen.has(obj)) { scene.remove(mesh); pool.delete(obj); }
    }
  }

  // ---------- bucle de dibujado ----------
  R3.render = function (game) {
    syncPool(pools.towers, game.towers, makeTowerMesh, updateTowerMesh);
    syncPool(pools.enemies, game.enemies, makeEnemyMesh, updateEnemyMesh);
    syncPool(pools.units, game.units, makeUnitMesh, updateUnitMesh);
    syncPool(pools.projectiles, game.projectiles, makeProjMesh, updateProjMesh);
    syncPool(pools.effects, game.effects, makeEffectMesh, updateEffectMesh);
    renderer.render(scene, camera);
  };
})();
