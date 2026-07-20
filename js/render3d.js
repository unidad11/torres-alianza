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
  let terrainMesh = null, pathGroup = null, sceneryGroup = null, spotGroup = null, currentPaths = [];
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

    ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    sun = new THREE.DirectionalLight(0xffffff, 0.95);
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

  // ---------- relieve del terreno ----------
  // Única fuente de altura del suelo: la usan el terreno, el camino, el
  // decorado, las torres y las unidades. Si cada uno calculase la suya por su
  // cuenta acabarían descuadrados (el camino enterrado bajo las dunas, las
  // torres flotando sobre ellas).
  // Se precalcula una rejilla por nivel y se interpola: llamar a path.at()
  // por cada consulta sería carísimo, y las torres consultan cada fotograma.
  const GX = 96, GZ = 54;        // celdas de la rejilla (10 px de juego cada una)
  let heightGrid = null;         // (GX+1) x (GZ+1) alturas ya calculadas

  // cuánto ondula cada región: el desierto tiene dunas de verdad, el bosque apenas
  const REGION_RELIEF = { desierto: 0.9, bosque: 0.35, montana: 0.65 };

  function buildHeightGrid(level, paths) {
    const amp = REGION_RELIEF[level.region] || 0.35;
    const rng = TA.mulberry32((level.seed || 1) * 977 + 13);
    const ph1 = rng() * 6.283, ph2 = rng() * 6.283;

    // el camino se muestrea una sola vez: hay miles de vértices que consultar
    const pathPts = [];
    for (const path of paths) {
      if (path.total < 1) continue;
      const step = Math.max(6, path.total / 140);
      for (let s = 0; s <= path.total; s += step) {
        const p = path.at(s);
        pathPts.push(p.x, p.y);
      }
    }
    const spots = level.spots || [];
    const river = level.river;

    // 0 = terreno aplanado, 1 = duna entera. Se aplana bajo el camino (si no,
    // lo atraviesa), en los huecos de torre (si no, las torres se inclinan)
    // y en el río.
    function flatFactor(x, y) {
      let d = Infinity;
      for (let i = 0; i < pathPts.length; i += 2) {
        const dd = Math.hypot(pathPts[i] - x, pathPts[i + 1] - y);
        if (dd < d) d = dd;
      }
      for (const sp of spots) {
        const dd = Math.hypot(sp[0] - x, sp[1] - y) - 18;
        if (dd < d) d = dd;
      }
      if (river) {
        const dd = Math.abs(x - river.x) - river.w / 2;
        if (dd < d) d = dd;
      }
      return Math.max(0, Math.min(1, (d - 30) / 70)); // llano hasta 30 px, duna entera a 100
    }

    heightGrid = new Float32Array((GX + 1) * (GZ + 1));
    for (let j = 0; j <= GZ; j++) {
      for (let i = 0; i <= GX; i++) {
        const x = (i / GX) * TA.W, y = (j / GZ) * TA.H;
        const h = Math.sin(x * 0.011 + ph1) * 0.55 + Math.sin(y * 0.017 + x * 0.006 + ph2) * 0.4;
        heightGrid[j * (GX + 1) + i] = h * amp * flatFactor(x, y);
      }
    }
  }

  // altura del suelo (unidades 3D) en coordenadas de juego
  R3.groundY = function (x, y) {
    if (!heightGrid) return 0;
    const fx = Math.max(0, Math.min(GX, (x / TA.W) * GX));
    const fy = Math.max(0, Math.min(GZ, (y / TA.H) * GZ));
    const i = Math.min(GX - 1, Math.floor(fx)), j = Math.min(GZ - 1, Math.floor(fy));
    const tx = fx - i, ty = fy - j;
    const at = (a, b) => heightGrid[b * (GX + 1) + a];
    return at(i, j) * (1 - tx) * (1 - ty) + at(i + 1, j) * tx * (1 - ty)
         + at(i, j + 1) * (1 - tx) * ty + at(i + 1, j + 1) * tx * ty;
  };
  const groundY = R3.groundY;

  // ambiente por región. La luz total se mantiene por debajo de ~1.4: por
  // encima, los tonos claros (arena, nieve) se saturan a blanco y el camino
  // deja de distinguirse del suelo que tiene al lado.
  const REGION_LOOK = {
    desierto: { sky: 0xf0dca0, near: 50, far: 130, sun: 0xfff2d0, sunI: 0.85, amb: 0xfff0d5, ambI: 0.35 },
    bosque:   { sky: 0x8fc7ec, near: 55, far: 130, sun: 0xffffff, sunI: 0.95, amb: 0xffffff, ambI: 0.50 },
    montana:  { sky: 0xcfe4f2, near: 45, far: 120, sun: 0xeaf4ff, sunI: 0.80, amb: 0xdce9f5, ambI: 0.42 },
  };
  let ambient = null; // se guarda en init para poder ajustarla por región

  function applyRegionLook(region) {
    const L = REGION_LOOK[region] || REGION_LOOK.bosque;
    scene.background = new THREE.Color(L.sky);
    scene.fog = new THREE.Fog(L.sky, L.near, L.far);
    sun.color.setHex(L.sun); sun.intensity = L.sunI;
    if (ambient) { ambient.color.setHex(L.amb); ambient.intensity = L.ambI; }
  }

  // ---------- terreno ----------
  // franja del camino que sigue el relieve. La altura se mide en cada borde,
  // no en el centro: con la del centro, el lateral queda enterrado allí donde
  // el terreno sube.
  function buildRibbon(path, halfW, lift, color) {
    const steps = Math.max(2, Math.round(path.total / 6));
    const verts = [], idx = [];
    for (let i = 0; i <= steps; i++) {
      const p = path.at((path.total * i) / steps);
      const lx = p.x + p.nx * halfW, ly = p.y + p.ny * halfW;
      const rx = p.x - p.nx * halfW, ry = p.y - p.ny * halfW;
      verts.push(toX(lx), groundY(lx, ly) + lift, toZ(ly));
      verts.push(toX(rx), groundY(rx, ry) + lift, toZ(ry));
    }
    for (let i = 0; i < steps; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, toonMat(color, { side: THREE.DoubleSide }));
    m.receiveShadow = true;
    return m;
  }

  R3.buildTerrain = function (level, paths) {
    if (terrainMesh) { scene.remove(terrainMesh); }
    if (pathGroup) { scene.remove(pathGroup); }
    if (sceneryGroup) { scene.remove(sceneryGroup); }
    if (spotGroup) { scene.remove(spotGroup); }
    if (rangeGroup) { scene.remove(rangeGroup); rangeGroup = null; rangeKey = ""; }
    currentPaths = paths;
    buildHeightGrid(level, paths);
    applyRegionLook(level.region);

    const REGION_COLOR = { bosque: 0x5a9d42, desierto: 0xd9bc7a, montana: 0xe8f0f5 };
    const color = REGION_COLOR[level.region] || REGION_COLOR.bosque;
    // la rejilla del terreno coincide con la del relieve, así que el suelo y
    // las consultas de altura dan exactamente el mismo valor en cada vértice
    const geo = new THREE.PlaneGeometry(TA.W * SCALE, TA.H * SCALE, GX, GZ);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // el plano se gira -90° en X: el vértice local (x, y) acaba en el mundo
      // en (x, -y). Sin ese signo se aplanaría el reflejo del camino.
      const g = fromWorld(pos.getX(i), -pos.getY(i));
      pos.setZ(i, groundY(g.x, g.y));
    }
    geo.computeVertexNormals();
    terrainMesh = new THREE.Mesh(geo, toonMat(color));
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    pathGroup = new THREE.Group();
    const halfW = 21; // mitad del ancho del camino, en píxeles de juego
    const EDGE = { bosque: 0x6b4a2c, desierto: 0x6b5236, montana: 0x8a9aa8 };
    for (const path of paths) {
      if (path.total < 1) continue;
      // dos franjas: la de abajo asoma por los lados como borde oscuro, que es
      // lo que separa el camino del suelo cuando ambos tiran a marrón claro
      pathGroup.add(buildRibbon(path, halfW + 3.5, 0.06, EDGE[level.region] || EDGE.bosque));
      pathGroup.add(buildRibbon(path, halfW, 0.10, 0xb0895a));
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

    sceneryGroup = buildScenery(level, paths);
    scene.add(sceneryGroup);

    spotGroup = buildSpotMarkers(level);
    scene.add(spotGroup);
  };

  // ---------- huecos de construcción ----------
  // Plataforma de piedra que marca dónde se puede levantar una torre. Sin
  // esto no hay manera de saber dónde se construye: el juego 2D las dibujaba
  // y el paso a 3D se las había dejado por el camino.
  function makeSpotMarker() {
    const g = new THREE.Group();
    const R = 22 * SCALE; // mismo radio que en el juego 2D
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.05, 0.14, 16), toonMat(0xb9a684));
    base.position.y = 0.07;
    base.receiveShadow = true;
    addOutline(base, 0x6b5f45, 1.05);
    g.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.82, R * 0.86, 0.07, 16), toonMat(0xcbb894));
    top.position.y = 0.17;
    g.add(top);
    // anillo dorado: solo llama la atención mientras no haya ninguna torre
    const ring = new THREE.Mesh(
      // más grueso que la línea de 3 px del 2D: en perspectiva el anillo se ve
      // de canto y se adelgaza. Con menos de esto desaparece contra la arena.
      new THREE.TorusGeometry(R * 1.18, 3.6 * SCALE, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xf5c33b, transparent: true, opacity: 0 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.22;
    g.add(ring);
    g.userData.ring = ring;
    return g;
  }

  function buildSpotMarkers(level) {
    const g = new THREE.Group();
    for (const sp of (level.spots || [])) {
      const m = makeSpotMarker();
      m.position.set(toX(sp[0]), groundY(sp[0], sp[1]), toZ(sp[1]));
      g.add(m);
    }
    return g;
  }

  function updateSpotMarkers(game) {
    if (!spotGroup) return;
    // el pulso usa el reloj del juego, no el del navegador, para que se pare
    // también cuando se pausa la partida
    const pulse = game.towers.length === 0 ? Math.sin((game.time || 0) * 3) * 0.5 + 0.5 : 0;
    for (let i = 0; i < spotGroup.children.length; i++) {
      const spot = game.spots[i], m = spotGroup.children[i];
      if (!spot) continue;
      m.visible = !spot.tower;           // ocupado: la torre ocupa su sitio
      const ring = m.userData.ring;
      ring.material.opacity = pulse * 0.9;
      const s = 1 + (1 - pulse) * 0.3;   // se abre al desvanecerse, como el 2D
      ring.scale.set(s, s, 1);
    }
  }

  // ---------- alcance de la torre o hueco seleccionado ----------
  // Se dibuja pegado al relieve y no como un disco plano: con radios de 130 px
  // o más, un disco plano se hunde en las dunas y asoma a trozos.
  let rangeGroup = null, rangeKey = "";

  function buildRangeRing(cx, cy, rInner, rOuter, color, opacity) {
    const geo = new THREE.RingGeometry(rInner * SCALE, rOuter * SCALE, 64, 6);
    geo.rotateX(-Math.PI / 2); // tumbado en el suelo: (x, y) local pasa a (x, -z)
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const gx = cx + pos.getX(i) / SCALE;
      const gy = cy + pos.getZ(i) / SCALE;
      pos.setY(i, groundY(gx, gy) + 0.2);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity,
      side: THREE.DoubleSide,
      depthWrite: false, // si no, el relleno tapa lo que tiene detrás
    }));
  }

  function updateRange(selection) {
    const key = selection && selection.range
      ? selection.x + "," + selection.y + "," + selection.range : "";
    if (key === rangeKey) return;
    rangeKey = key;
    if (rangeGroup) {
      scene.remove(rangeGroup);
      rangeGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      rangeGroup = null;
    }
    if (!key) return;
    const r = selection.range;
    rangeGroup = new THREE.Group();
    rangeGroup.add(buildRangeRing(selection.x, selection.y, 0.5, r, 0xffffff, 0.12)); // relleno
    rangeGroup.add(buildRangeRing(selection.x, selection.y, r * 0.955, r, 0xffffff, 0.55)); // borde
    rangeGroup.position.set(toX(selection.x), 0, toZ(selection.y));
    scene.add(rangeGroup);
  }

  // ---------- decorado del escenario ----------
  function makeRock(s) {
    const geo = new THREE.DodecahedronGeometry(0.6 * s, 0);
    geo.scale(1, 0.7, 0.85);
    const m = new THREE.Mesh(geo, toonMat(0x9d8768));
    m.position.y = 0.35 * s;
    m.castShadow = true; m.receiveShadow = true;
    addOutline(m, 0x3d2f1a, 1.06);
    const g = new THREE.Group();
    g.add(m);
    return g;
  }

  // saguaro: tronco con dos brazos que suben, la silueta que lee como "desierto"
  function makeCactus(s) {
    const g = new THREE.Group();
    const green = 0x5c8f4e, ink = 0x2d4a26;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 1.6 * s, 8), toonMat(green));
    trunk.position.y = 0.8 * s; trunk.castShadow = true; addOutline(trunk, ink);
    g.add(trunk);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.7 * s, 6), toonMat(green));
      arm.position.set(side * 0.28 * s, 0.9 * s, 0);
      arm.rotation.z = side * 0.5;
      arm.castShadow = true; addOutline(arm, ink);
      g.add(arm);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.11 * s, 0.5 * s, 6), toonMat(green));
      up.position.set(side * 0.5 * s, 1.3 * s, 0);
      up.castShadow = true; addOutline(up, ink);
      g.add(up);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 8, 8), toonMat(green));
    tip.position.y = 1.6 * s; addOutline(tip, ink);
    g.add(tip);
    return g;
  }

  // ruina: columnas partidas a distinta altura sobre una base de piedra
  function makeRuina(s) {
    const g = new THREE.Group();
    const stone = 0xc4b394, ink = 0x5a4a30;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.18 * s, 1.5 * s), toonMat(stone));
    base.position.y = 0.09 * s; base.receiveShadow = true; addOutline(base, ink, 1.04);
    g.add(base);
    const alturas = [1.25, 0.55, 0.9];
    alturas.forEach((h, i) => {
      const a = (i / alturas.length) * Math.PI * 2 + 0.4;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.19 * s, h * s, 7), toonMat(stone));
      col.position.set(Math.cos(a) * 0.5 * s, 0.18 * s + (h * s) / 2, Math.sin(a) * 0.5 * s);
      col.castShadow = true; addOutline(col, ink);
      g.add(col);
    });
    return g;
  }

  // Mismas reglas de reparto que el decorado del juego 2D (26 piezas, apartadas
  // del camino y de los huecos de torre): así cada nivel conserva su propio
  // reparto, ligado a su semilla, en vez de cambiar en cada partida.
  function buildScenery(level, paths) {
    const g = new THREE.Group();
    if (level.region !== "desierto") return g; // Bosque y Montaña, aún sin diseñar
    const rng = TA.mulberry32((level.seed || 1) * 1000 + 7);
    const puestas = [];
    const libre = (x, y) => {
      for (const path of paths) {
        for (let s = 0; s < path.total; s += 14) {
          const p = path.at(s);
          if (Math.hypot(p.x - x, p.y - y) < 48) return false;
        }
      }
      for (const sp of (level.spots || [])) if (Math.hypot(sp[0] - x, sp[1] - y) < 42) return false;
      if (level.river && Math.abs(x - level.river.x) < level.river.w / 2 + 26) return false;
      for (const d of puestas) if (Math.hypot(d.x - x, d.y - y) < 34) return false;
      return true;
    };
    let tries = 0;
    while (puestas.length < 26 && tries < 700) {
      tries++;
      const x = 20 + rng() * (TA.W - 40), y = 20 + rng() * (TA.H - 40);
      if (!libre(x, y)) continue;
      const r = rng(), s = 0.7 + rng() * 0.6;
      const obj = r < 0.5 ? makeCactus(s) : r < 0.78 ? makeRock(s) : r < 0.93 ? makeRuina(s) : makeRock(s);
      obj.position.set(toX(x), groundY(x, y), toZ(y));
      obj.rotation.y = rng() * Math.PI * 2;
      g.add(obj);
      puestas.push({ x, y });
    }
    return g;
  }

  // ---------- torres ----------
  // cada tipo tiene su propia silueta y gana piezas nuevas (no solo color) al subir de nivel
  const TOWER_FIT = 0.45; // el radio original quedaba más ancho que el camino
  const LEVEL_SCALE = [1, 1.4, 1.85]; // salto de tamaño claro entre niveles

  function disposeChildren(g) {
    while (g.children.length) {
      const c = g.children.pop();
      if (c.children) c.children.length = 0;
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  function buildArqueros(g, lv) {
    const LEG = [0x8a6a48, 0x6b4a30, 0x4a3320];
    const DECK = [0xa9835a, 0x8a6440, 0x6b4a30];
    const ROOF = [0x8d6a45, 0x9a3b30, 0xc23b30];
    const legH = 5.6;
    const legMat = toonMat(LEG[lv]);
    for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, legH, 8), legMat);
      leg.position.set(lx, legH / 2, lz);
      leg.rotation.x = lz * -0.06; leg.rotation.z = lx * 0.06;
      leg.castShadow = true; addOutline(leg, 0x201a14);
      g.add(leg);
    }
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.7, 8), toonMat(DECK[lv]));
    deck.position.y = legH + 0.1; deck.castShadow = true; addOutline(deck, 0x201a14);
    g.add(deck);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.9, 8, 1, true), toonMat(DECK[lv], { side: THREE.DoubleSide }));
    rail.position.y = legH + 0.9; addOutline(rail, 0x201a14, 1.03);
    g.add(rail);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 2.6, 8), toonMat(ROOF[lv]));
    roof.position.y = legH + 1.7; roof.castShadow = true; addOutline(roof, 0x201a14);
    g.add(roof);
    if (lv >= 1) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 5), toonMat(ROOF[lv]));
        spike.position.set(Math.cos(a) * 2.5, legH + 0.7, Math.sin(a) * 2.5);
        g.add(spike);
      }
    }
    if (lv >= 2) {
      const roof2 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 8), toonMat(ROOF[lv]));
      roof2.position.y = legH + 3.6; roof2.castShadow = true; addOutline(roof2, 0x201a14);
      g.add(roof2);
    }
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 8), toonMat(0x5c7a9d));
    body.position.y = legH + 1.2; addOutline(body, 0x201a14);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), toonMat(0xe8b98a));
    head.position.y = legH + 1.9; addOutline(head, 0x201a14);
    g.add(head);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 12, Math.PI), toonMat(0x4a3323));
    bow.position.set(0.35, legH + 1.3, 0); bow.rotation.y = Math.PI / 2;
    g.add(bow);
    if (lv >= 2) {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 6), toonMat(0x5ec24a));
      feather.position.set(0.15, legH + 2.5, 0); feather.rotation.z = -0.5;
      g.add(feather);
    }
  }

  function buildCuartel(g, lv) {
    const WALL = [0x8a8172, 0xa89478, 0xd9c9a0];
    const CREN = [0x726a5c, 0x8a7a5c, 0xb8a370];
    const FLAG = [0x3f68b0, 0xc9c9c9, 0xe8b33b];
    const w = 5.6, h = 4;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4.4), toonMat(WALL[lv]));
    wall.position.y = h / 2; wall.castShadow = true; addOutline(wall, 0x201a14);
    g.add(wall);
    for (let i = 0; i < 6; i++) {
      const cren = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), toonMat(CREN[lv]));
      const side = i < 3 ? 1 : -1;
      cren.position.set(-2.1 + (i % 3) * 2.1, h + 0.35, side * 2.05);
      cren.castShadow = true; addOutline(cren, 0x201a14);
      g.add(cren);
    }
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2, 12, 1, false, 0, Math.PI), toonMat(0x4a3323));
    door.rotation.z = Math.PI; door.position.set(0, 1, 2.21);
    g.add(door);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), toonMat(0x6b4a30));
    pole.position.set(1.8, h + 1.5, 0); g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), toonMat(FLAG[lv], { side: THREE.DoubleSide }));
    flag.position.set(2.45, h + 2.4, 0); addOutline(flag, 0x201a14, 1.05);
    g.userData.banner = flag;
    g.add(flag);
    if (lv >= 1) {
      const corners = lv >= 2 ? [[-2.6, -1.9], [2.6, -1.9], [-2.6, 1.9], [2.6, 1.9]] : [[-2.6, -1.9], [2.6, -1.9]];
      for (const [cx, cz] of corners) {
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.65, h + 1.4, 8), toonMat(WALL[lv]));
        turret.position.set(cx, (h + 1.4) / 2, cz); turret.castShadow = true; addOutline(turret, 0x201a14);
        g.add(turret);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1, 8), toonMat(CREN[lv]));
        cap.position.set(cx, h + 1.9, cz); addOutline(cap, 0x201a14);
        g.add(cap);
      }
    }
  }

  function buildMagos(g, lv) {
    const SPIRE = [0x5c4a7a, 0x7a5ca0, 0xa06fd9];
    const CAP = [0x7a5ca0, 0x9d6fd4, 0xc98fff];
    const ORB = [0xbf9dea, 0xd9b8ff, 0xf0d9ff];
    const spireH = 7;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 2, 8), toonMat(0x4a3d63));
    base.position.y = 1; base.castShadow = true; addOutline(base, 0x201a14);
    g.add(base);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, spireH, 10), toonMat(SPIRE[lv]));
    spire.position.y = 2 + spireH / 2; spire.castShadow = true; addOutline(spire, 0x201a14);
    g.add(spire);
    const capY = 2 + spireH;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2, 10), toonMat(CAP[lv]));
    cap.position.y = capY + 1; cap.castShadow = true; addOutline(cap, 0x201a14);
    g.add(cap);
    g.userData.rings = [];
    if (lv >= 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 6, 20), toonMat(CAP[lv]));
      ring.rotation.x = Math.PI / 2.4; ring.position.y = capY - 0.5;
      g.add(ring); g.userData.rings.push(ring);
    }
    if (lv >= 2) {
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.1, 6, 20), toonMat(CAP[lv]));
      ring2.rotation.x = -Math.PI / 2.4; ring2.position.y = capY - 0.3;
      g.add(ring2); g.userData.rings.push(ring2);
      g.userData.shards = [];
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), toonMat(ORB[lv], { emissive: 0x7a4dc9, emissiveIntensity: 0.5 }));
        g.add(shard); g.userData.shards.push(shard);
      }
    }
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 + lv * 0.2, 1), toonMat(ORB[lv], { emissive: 0x7a4dc9, emissiveIntensity: 0.35 + lv * 0.25 }));
    orb.position.y = capY + 2.6; addOutline(orb, 0x3d2d5c, 1.1);
    g.userData.orb = orb;
    g.userData.orbY = capY + 2.6;
    g.add(orb);
  }

  function buildCanon(g, lv) {
    const BASE = [0x5a5a5a, 0x4a5568, 0x2a2a2a];
    const TURRET = [0x4a4a4a, 0x3d4a5c, 0x1f1f1f];
    const barrelLen = 3.6 + lv * 1.1, barrelR = 0.5 + lv * 0.15;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.3, 2.6, 12), toonMat(BASE[lv]));
    base.position.y = 1.3; base.castShadow = true; addOutline(base, 0x1a1a1a);
    g.add(base);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 1.6, 12), toonMat(TURRET[lv]));
    turret.position.y = 3.4; turret.castShadow = true; addOutline(turret, 0x1a1a1a);
    g.add(turret);
    const offsets = lv >= 1 ? [-0.55, 0.55] : [0];
    for (const oz of offsets) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelR, barrelR + 0.05, barrelLen, 10), toonMat(TURRET[lv]));
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(2 + barrelLen / 2, 3.4, oz); barrel.castShadow = true; addOutline(barrel, 0x1a1a1a);
      g.add(barrel);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(barrelR + 0.05, 0.1, 6, 12), toonMat(0x8a8a8a));
      rim.rotation.y = Math.PI / 2; rim.position.set(2 + barrelLen, 3.4, oz);
      g.add(rim);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), toonMat(0x8a8a8a));
      rivet.position.set(Math.cos(a) * 2.9, 1.3, Math.sin(a) * 2.9);
      g.add(rivet);
    }
    if (lv >= 1) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(2.05, lv >= 2 ? 0.16 : 0.09, 6, 16), toonMat(0xe8b33b));
      band.rotation.x = Math.PI / 2; band.position.y = 3.4;
      g.add(band);
    }
  }

  function buildHielo(g, lv) {
    const CORE = [0x9dc9e0, 0x5ca8d9, 0xaef2ff];
    const SPIKE = [0xd9f2fa, 0xbfeafd, 0xe8ffff];
    const coreH = 3 + lv * 1.1;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 3, 8), toonMat(0x7fa8bf));
    base.position.y = 1.5; base.castShadow = true; addOutline(base, 0x1a3d4d);
    g.add(base);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, coreH, 8), toonMat(CORE[lv]));
    core.position.y = 3 + coreH / 2; core.castShadow = true; addOutline(core, 0x1a3d4d);
    g.add(core);
    const topY = 3 + coreH;
    const glow = 0.15 + lv * 0.25;
    const spikeSets = [
      [[0, 0, 1.1, 3.2]],
      [[0, 0, 1.1, 3.2], [0.7, 0.6, 0.7, 2.4], [-0.7, -0.5, 0.7, 2.6]],
      [[0, 0, 1.1, 3.2], [0.7, 0.6, 0.7, 2.4], [-0.7, -0.5, 0.7, 2.6], [0.5, -0.7, 0.6, 2.2], [-0.6, 0.6, 0.6, 2]],
    ];
    for (const [ox, oz, r, h0] of spikeSets[lv]) {
      const h = h0 + lv * 0.8;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), toonMat(SPIKE[lv], { emissive: 0x8fd9ec, emissiveIntensity: glow }));
      spike.position.set(ox, topY + h / 2, oz);
      spike.castShadow = true; addOutline(spike, 0x2d5c6b, 1.06);
      g.add(spike);
    }
    if (lv >= 2) {
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 5), toonMat(SPIKE[lv], { emissive: 0x8fd9ec, emissiveIntensity: glow }));
        wing.rotation.z = side * 1.15;
        wing.position.set(side * 2.1, topY - 0.4, 0);
        wing.castShadow = true; addOutline(wing, 0x2d5c6b, 1.06);
        g.add(wing);
      }
    }
  }

  function buildElectrica(g, lv) {
    const MAST = [0x4a6b60, 0x3a8a78, 0x2a2a2a];
    const COIL = [0x4a9d8f, 0x3ad9c4, 0xd4f23a];
    const ORB = [0xc9d94a, 0xeaff5a, 0xfff9b0];
    const mastH = 6 + lv * 1.6;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 2, 10), toonMat(0x5c7a6f));
    base.position.y = 1; base.castShadow = true; addOutline(base, 0x1a2d28);
    g.add(base);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, mastH, 8), toonMat(MAST[lv]));
    mast.position.y = 2 + mastH / 2; mast.castShadow = true; addOutline(mast, 0x1a2d28);
    g.add(mast);
    const coilTop = 2 + mastH;
    const coilCount = lv === 0 ? 2 : 4;
    for (let i = 0; i < coilCount; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.12, 0.14, 8, 16), toonMat(COIL[lv]));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = coilTop - 3.8 + i * 0.9;
      addOutline(ring, 0x1a2d28, 1.05);
      g.add(ring);
    }
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5 + lv * 0.18, 12, 12), toonMat(ORB[lv], { emissive: 0xaad42a, emissiveIntensity: 0.45 + lv * 0.25 }));
    orb.position.y = coilTop + 0.4; addOutline(orb, 0x5c6b1a, 1.1);
    g.userData.orb = orb;
    g.add(orb);
    if (lv >= 2) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const bolt = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 4), toonMat(0xfff9b0, { emissive: 0xd4f23a, emissiveIntensity: 0.6 }));
        bolt.position.set(Math.cos(a) * 1, coilTop + 0.4, Math.sin(a) * 1);
        bolt.rotation.z = Math.PI / 2; bolt.rotation.y = a;
        g.add(bolt);
      }
    }
  }

  function buildApoyo(g, lv) {
    const DRUM = [0x8f7a4a, 0xb08f4a, 0xd9b03a];
    const BANNER = [0xc9a04a, 0xe0b050, 0xf5c93b];
    const postH = 7 + lv * 1.5;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 2.4, 12), toonMat(DRUM[lv]));
    drum.position.y = 1.2; drum.castShadow = true; addOutline(drum, 0x2d2210);
    g.add(drum);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, postH, 8), toonMat(0x6b4a30));
    post.position.y = 2.4 + postH / 2; post.castShadow = true; addOutline(post, 0x2d2210);
    g.add(post);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), toonMat(0xd9c060));
    finial.position.y = 2.4 + postH + 0.4; addOutline(finial, 0x2d2210);
    g.add(finial);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2, 4, 6), toonMat(BANNER[lv], { side: THREE.DoubleSide }));
    banner.position.set(1.3, 2.4 + postH * 0.55, 0);
    addOutline(banner, 0x2d2210, 1.04);
    g.userData.banner = banner;
    g.add(banner);
    if (lv >= 2) {
      const banner2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2, 4, 6), toonMat(BANNER[lv], { side: THREE.DoubleSide }));
      banner2.position.set(-1.3, 2.4 + postH * 0.4, 0); banner2.rotation.y = Math.PI;
      addOutline(banner2, 0x2d2210, 1.04);
      g.userData.banner2 = banner2;
      g.add(banner2);
    }
    if (lv >= 1) {
      const aura = new THREE.Mesh(new THREE.TorusGeometry(2.9 + lv * 0.3, 0.08 + lv * 0.05, 6, 24), toonMat(0xf5c33b, { emissive: 0xe8b33b, emissiveIntensity: 0.3 + lv * 0.25 }));
      aura.rotation.x = Math.PI / 2; aura.position.y = 0.05;
      g.add(aura);
    }
  }

  const TOWER_BUILDERS = {
    arqueros: buildArqueros, cuartel: buildCuartel, magos: buildMagos,
    canon: buildCanon, hielo: buildHielo, electrica: buildElectrica, apoyo: buildApoyo,
  };

  function populateTower(g, tw) {
    disposeChildren(g);
    g.userData.orb = null; g.userData.rings = null; g.userData.shards = null;
    g.userData.banner = null; g.userData.banner2 = null;
    const lv = Math.max(0, Math.min(2, tw.level || 0));
    const build = TOWER_BUILDERS[tw.type] || TOWER_BUILDERS.arqueros;
    build(g, lv);
    g.scale.setScalar(TOWER_FIT * LEVEL_SCALE[lv]);
    g.userData.builtLevel = lv;
  }

  function makeTowerMesh(tw) {
    const g = new THREE.Group();
    populateTower(g, tw);
    return g;
  }
  function updateTowerMesh(tw, g) {
    // se dibuja en la posición real del hueco: el motor ya lo aparta del camino
    // al crear la partida, así que no hace falta corregirlo aquí (antes se movía
    // solo el dibujo y la torre no cuadraba con su propia plataforma)
    // apoyada en el suelo: el hueco está aplanado, así que no se inclina
    g.position.set(toX(tw.x), groundY(tw.x, tw.y), toZ(tw.y));
    if (typeof tw.aimAngle === "number") g.rotation.y = -tw.aimAngle;
    const lv = Math.max(0, Math.min(2, tw.level || 0));
    if (g.userData.builtLevel !== lv) populateTower(g, tw);
    const t = performance.now() * 0.001;
    if (g.userData.orb) g.userData.orb.rotation.y += 0.02;
    if (g.userData.rings) for (const r of g.userData.rings) r.rotation.z += 0.01;
    if (g.userData.shards) g.userData.shards.forEach((s, i) => {
      const a = t * 1.2 + (i / g.userData.shards.length) * Math.PI * 2;
      s.position.set(Math.cos(a) * 1.3, g.userData.orbY, Math.sin(a) * 1.3);
    });
    if (g.userData.banner) g.userData.banner.rotation.y = Math.sin(t * 1.5) * 0.15;
    if (g.userData.banner2) g.userData.banner2.rotation.y = Math.PI + Math.sin(t * 1.5) * 0.15;
  }

  // ---------- enemigos ----------
  // forma genérica (color por hash) para los tipos que aún no tienen arte propio
  function buildGenericEnemy(scale, e) {
    const g = new THREE.Group();
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
    return g;
  }

  // ---------- 6 enemigos del Bosque, diseño propio ----------
  function buildGoblin(scale) {
    const g = new THREE.Group();
    const skin = 0x6b8f4e;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.42 * scale, 0.8 * scale, 8), toonMat(skin));
    body.position.y = 0.5 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4 * scale, 10, 10), toonMat(skin));
    head.position.y = 1.05 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.5 * scale, 6), toonMat(skin));
      ear.position.set(side * 0.42 * scale, 1.1 * scale, 0);
      ear.rotation.z = side * -1.1;
      addOutline(ear, 0x1a1a1a);
      g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 6, 6), toonMat(0xffe066));
      eye.position.set(side * 0.16 * scale, 1.08 * scale, 0.34 * scale);
      g.add(eye);
    }
    const dagger = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.5 * scale, 4), toonMat(0x9a9a9a));
    dagger.position.set(0.45 * scale, 0.55 * scale, 0.2 * scale);
    dagger.rotation.z = -0.6;
    g.add(dagger);
    g.userData.bob = 0.08 * scale;
    return g;
  }

  function buildLobo(scale) {
    const g = new THREE.Group();
    const fur = 0x7a6f5c;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * scale, 0.32 * scale, 1.1 * scale, 8), toonMat(fur));
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.45 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    for (const [lx, lz] of [[-0.35, -0.15], [0.35, -0.15], [-0.35, 0.15], [0.35, 0.15]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.07 * scale, 0.45 * scale, 6), toonMat(fur));
      leg.position.set(lx * scale, 0.22 * scale, lz * scale);
      g.add(leg);
    }
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.22 * scale, 0.55 * scale, 8), toonMat(fur));
    head.rotation.z = Math.PI / 2;
    head.position.set(0.65 * scale, 0.55 * scale, 0);
    head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.22 * scale, 5), toonMat(fur));
      ear.position.set(0.55 * scale, 0.78 * scale, side * 0.12 * scale);
      g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1 * scale, 0.5 * scale, 6), toonMat(fur));
    tail.rotation.z = -Math.PI / 2.4;
    tail.position.set(-0.65 * scale, 0.55 * scale, 0);
    g.add(tail);
    g.userData.bob = 0.05 * scale;
    return g;
  }

  function buildOrco(scale) {
    const g = new THREE.Group();
    const skin = 0x5c7a4e;
    const armor = 0x6b5c4a;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.5 * scale, 1 * scale, 8), toonMat(skin));
    body.position.y = 0.6 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    for (const side of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.2 * scale, 0.35 * scale), toonMat(armor));
      pad.position.set(side * 0.42 * scale, 1.05 * scale, 0);
      pad.castShadow = true; addOutline(pad, 0x1a1a1a);
      g.add(pad);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36 * scale, 10, 10), toonMat(skin));
    head.position.y = 1.4 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.22 * scale, 5), toonMat(0xeee8d5));
      tusk.position.set(side * 0.14 * scale, 1.27 * scale, 0.3 * scale);
      tusk.rotation.x = -0.4;
      g.add(tusk);
    }
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.46 * scale, 0.46 * scale, 0.12 * scale, 8), toonMat(0x3d2d1d));
    belt.position.y = 0.35 * scale; g.add(belt);
    g.userData.bob = 0.06 * scale;
    return g;
  }

  function buildChaman(scale) {
    const g = new THREE.Group();
    const robe = 0x6b5c8f;
    const skin = 0x6b8f4e;
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42 * scale, 1.1 * scale, 8), toonMat(robe));
    cloak.position.y = 0.55 * scale; cloak.castShadow = true; addOutline(cloak, 0x1a1a1a);
    g.add(cloak);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 10, 10), toonMat(skin));
    head.position.y = 1.3 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.38 * scale, 0.5 * scale, 8), toonMat(robe));
    hood.position.y = 1.55 * scale; addOutline(hood, 0x1a1a1a);
    g.add(hood);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 1.4 * scale, 6), toonMat(0x4a3323));
    staff.position.set(0.4 * scale, 0.9 * scale, 0);
    g.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 10, 10), toonMat(0x7cfc9a, { emissive: 0x3fa85c, emissiveIntensity: 0.5 }));
    orb.position.set(0.4 * scale, 1.65 * scale, 0);
    addOutline(orb, 0x1a4d2d, 1.1);
    g.userData.orb = orb;
    g.add(orb);
    g.userData.bob = 0.07 * scale;
    return g;
  }

  function buildOgro(scale) {
    const g = new THREE.Group();
    const skin = 0x8a6f4a;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.75 * scale, 12, 12), toonMat(skin));
    belly.scale.set(1, 1.15, 0.9);
    belly.position.y = 0.9 * scale; belly.castShadow = true; addOutline(belly, 0x1a1a1a);
    g.add(belly);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.24 * scale, 1 * scale, 8), toonMat(skin));
      arm.position.set(side * 0.85 * scale, 0.75 * scale, 0);
      arm.rotation.z = side * 0.3;
      arm.castShadow = true; addOutline(arm, 0x1a1a1a);
      g.add(arm);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4 * scale, 10, 10), toonMat(skin));
    head.position.y = 1.85 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.3 * scale, 5), toonMat(0xeee8d5));
      tusk.position.set(side * 0.16 * scale, 1.68 * scale, 0.32 * scale);
      tusk.rotation.x = -0.5;
      g.add(tusk);
    }
    const club = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, 1.3 * scale, 8), toonMat(0x5c4a30));
    club.position.set(1.15 * scale, 1 * scale, 0.1 * scale);
    club.rotation.z = 0.5;
    club.castShadow = true; addOutline(club, 0x1a1a1a);
    g.add(club);
    g.userData.bob = 0.1 * scale;
    return g;
  }

  function buildBerserker(scale) {
    const g = new THREE.Group();
    const skin = 0x9d4a3a;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.52 * scale, 1 * scale, 8), toonMat(skin));
    body.position.y = 0.6 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(new THREE.ConeGeometry(0.22 * scale, 0.3 * scale, 6), toonMat(0x3d2d2d));
      pauldron.position.set(side * 0.45 * scale, 1.05 * scale, 0);
      addOutline(pauldron, 0x1a1a1a);
      g.add(pauldron);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 10, 10), toonMat(skin));
    head.position.y = 1.35 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.9 * scale, 6), toonMat(0x4a3323));
    handle.position.set(0.6 * scale, 0.9 * scale, 0);
    handle.rotation.z = -0.5;
    g.add(handle);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.22 * scale, 0.4 * scale, 4), toonMat(0x9a9a9a));
    blade.position.set(0.95 * scale, 1.3 * scale, 0);
    blade.rotation.z = -0.5;
    addOutline(blade, 0x1a1a1a);
    g.add(blade);
    g.userData.bob = 0.09 * scale;
    return g;
  }

  // ---------- 7 enemigos del Desierto, diseño propio ----------
  function buildMurcielago(scale) {
    const g = new THREE.Group();
    const skin = 0x4a3a5c;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 10, 10), toonMat(skin));
    body.scale.set(1, 1.1, 0.8);
    body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.55 * scale, 0.12 * scale, 3), toonMat(skin, { transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      wing.rotation.z = side * Math.PI / 2;
      wing.rotation.y = 0.3;
      wing.position.set(side * 0.55 * scale, 0.05 * scale, 0);
      g.userData["wing" + side] = wing;
      addOutline(wing, 0x1a1a1a, 1.05);
      g.add(wing);
    }
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09 * scale, 0.28 * scale, 5), toonMat(skin));
      ear.position.set(side * 0.14 * scale, 0.45 * scale, 0);
      g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05 * scale, 6, 6), toonMat(0xd9302a, { emissive: 0x8a1a1a, emissiveIntensity: 0.5 }));
      eye.position.set(side * 0.12 * scale, 0.32 * scale, 0.26 * scale);
      g.add(eye);
    }
    g.userData.wingFlap = true;
    return g;
  }

  function buildGargola(scale) {
    const g = new THREE.Group();
    const stone = 0x7a7a72;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * scale, 0.45 * scale, 0.9 * scale, 8), toonMat(stone));
    body.position.y = 0.55 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.7 * scale, 0.15 * scale, 3), toonMat(0x5c5c54, { side: THREE.DoubleSide }));
      wing.rotation.z = side * Math.PI / 2.3;
      wing.rotation.y = 0.2;
      wing.position.set(side * 0.65 * scale, 0.75 * scale, -0.1 * scale);
      g.userData["wing" + side] = wing;
      addOutline(wing, 0x1a1a1a, 1.05);
      g.add(wing);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 10, 10), toonMat(stone));
    head.position.y = 1.15 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.35 * scale, 5), toonMat(0x3d3d38));
      horn.position.set(side * 0.16 * scale, 1.42 * scale, 0);
      horn.rotation.z = side * -0.3;
      g.add(horn);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 6), toonMat(0xd9903a, { emissive: 0xaa5a1a, emissiveIntensity: 0.6 }));
      eye.position.set(side * 0.13 * scale, 1.18 * scale, 0.27 * scale);
      g.add(eye);
    }
    g.userData.wingFlap = true;
    return g;
  }

  function buildEscorpion(scale) {
    const g = new THREE.Group();
    const shell = 0x7a3a2a;
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale - i * 0.02, 8, 8), toonMat(shell));
      seg.scale.set(1, 0.75, 1.1);
      seg.position.set(-0.1 * scale - i * 0.28 * scale, 0.28 * scale, 0);
      seg.castShadow = true; addOutline(seg, 0x1a1a1a);
      g.add(seg);
    }
    for (const side of [-1, 1]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.16 * scale, 0.4 * scale, 6), toonMat(shell));
      claw.rotation.z = Math.PI / 2;
      claw.position.set(0.42 * scale, 0.3 * scale, side * 0.22 * scale);
      claw.castShadow = true; addOutline(claw, 0x1a1a1a);
      g.add(claw);
    }
    const tailPts = [[-0.4, 0.3], [-0.55, 0.5], [-0.62, 0.78], [-0.5, 1.0], [-0.28, 1.1]];
    for (let i = 0; i < tailPts.length; i++) {
      const [tx, ty] = tailPts[i];
      const seg = new THREE.Mesh(new THREE.SphereGeometry((0.1 - i * 0.006) * scale, 8, 8), toonMat(shell));
      seg.position.set(tx * scale, ty * scale, 0);
      addOutline(seg, 0x1a1a1a);
      g.add(seg);
      if (i > 0) {
        const [px, py] = tailPts[i - 1];
        const dx = tx - px, dy = ty - py;
        const len = Math.hypot(dx, dy);
        const link = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.08 * scale, len * scale, 6), toonMat(shell));
        link.position.set((tx + px) / 2 * scale, (ty + py) / 2 * scale, 0);
        link.rotation.z = Math.atan2(-dx, dy);
        g.add(link);
      }
    }
    const [lastX, lastY] = tailPts[tailPts.length - 1];
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.26 * scale, 6), toonMat(0x2d1a12));
    stinger.position.set(lastX * scale, (lastY + 0.16) * scale, 0);
    stinger.rotation.z = 0.4;
    addOutline(stinger, 0x1a1a1a);
    g.add(stinger);
    for (const [lx, lz] of [[-0.1, -0.2], [-0.1, 0.2], [-0.4, -0.22], [-0.4, 0.22]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.3 * scale, 5), toonMat(0x5c2a1e));
      leg.position.set(lx * scale, 0.12 * scale, lz * scale);
      leg.rotation.x = lz > 0 ? 0.6 : -0.6;
      g.add(leg);
    }
    g.userData.bob = 0.04 * scale;
    return g;
  }

  function buildMomia(scale) {
    const g = new THREE.Group();
    const wrap = 0xc9b076;
    const wrapDark = 0x8f7a4a;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * scale, 0.4 * scale, 1 * scale, 8), toonMat(wrap));
    body.position.y = 0.6 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.38 * scale, 0.075 * scale, 6, 16), toonMat(wrapDark));
      band.rotation.x = Math.PI / 2;
      band.position.y = (0.32 + i * 0.3) * scale;
      addOutline(band, 0x1a1a1a, 1.03);
      g.add(band);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 10, 10), toonMat(wrap));
    head.position.y = 1.35 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const headBand = new THREE.Mesh(new THREE.TorusGeometry(0.31 * scale, 0.06 * scale, 6, 16), toonMat(wrapDark));
    headBand.rotation.x = Math.PI / 2; headBand.rotation.z = 0.3;
    headBand.position.set(0, 1.3 * scale, 0);
    g.add(headBand);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.09 * scale, 0.6 * scale, 6), toonMat(wrap));
      arm.rotation.z = side * 0.55;
      arm.rotation.x = -0.5;
      arm.position.set(side * 0.4 * scale, 0.85 * scale, 0.32 * scale);
      arm.castShadow = true; addOutline(arm, 0x1a1a1a);
      g.add(arm);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 6), toonMat(0x7cfc9a, { emissive: 0x3fa85c, emissiveIntensity: 0.7 }));
      eye.position.set(side * 0.12 * scale, 1.38 * scale, 0.26 * scale);
      g.add(eye);
    }
    g.userData.bob = 0.05 * scale;
    return g;
  }

  function buildGargolaRey(scale) {
    const g = new THREE.Group();
    const stone = 0x5c5c54;
    const gold = 0xd9b03a;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.62 * scale, 1.3 * scale, 10), toonMat(stone));
    body.position.y = 0.75 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 0.2 * scale, 3), toonMat(0x4a4a44, { side: THREE.DoubleSide }));
      wing.rotation.z = side * Math.PI / 2.3;
      wing.rotation.y = 0.2;
      wing.position.set(side * 1 * scale, 1.05 * scale, -0.15 * scale);
      g.userData["wing" + side] = wing;
      addOutline(wing, 0x1a1a1a, 1.05);
      g.add(wing);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44 * scale, 10, 10), toonMat(stone));
    head.position.y = 1.65 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    for (let i = -1; i <= 1; i++) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.45 * scale, 5), toonMat(gold));
      horn.position.set(i * 0.2 * scale, 2.05 * scale, 0);
      horn.rotation.z = i * -0.25;
      addOutline(horn, 0x1a1a1a);
      g.add(horn);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 8, 8), toonMat(0xff7a2a, { emissive: 0xd94a1a, emissiveIntensity: 0.7 }));
      eye.position.set(side * 0.17 * scale, 1.68 * scale, 0.36 * scale);
      g.add(eye);
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.5 * scale, 0.08 * scale, 6, 16), toonMat(gold));
    collar.rotation.x = Math.PI / 2; collar.position.y = 1.35 * scale;
    addOutline(collar, 0x1a1a1a, 1.05);
    g.add(collar);
    g.userData.wingFlap = true;
    return g;
  }

  function buildEspectroAlado(scale) {
    const g = new THREE.Group();
    const ghost = 0xbfd9ea;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.32 * scale, 0.9 * scale, 8), toonMat(ghost, { transparent: true, opacity: 0.55 }));
    body.position.y = 0.55 * scale; body.rotation.x = Math.PI;
    addOutline(body, 0x5c7a8f, 1.05);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 10, 10), toonMat(ghost, { transparent: true, opacity: 0.65 }));
    head.position.y = 1.05 * scale;
    addOutline(head, 0x5c7a8f, 1.05);
    g.add(head);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.5 * scale, 0.1 * scale, 3), toonMat(0xd9ecff, { transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
      wing.rotation.z = side * Math.PI / 2;
      wing.rotation.y = 0.3;
      wing.position.set(side * 0.45 * scale, 0.85 * scale, -0.1 * scale);
      g.userData["wing" + side] = wing;
      g.add(wing);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05 * scale, 6, 6), toonMat(0x9adfff, { emissive: 0x5cb8ea, emissiveIntensity: 0.8 }));
      eye.position.set(side * 0.1 * scale, 1.08 * scale, 0.2 * scale);
      g.add(eye);
    }
    g.userData.wingFlap = true;
    return g;
  }

  function buildEnjambre(scale) {
    const g = new THREE.Group();
    const bug = 0x8a9d3a;
    const offsets = [[0, 0.3, 0], [0.18, 0.4, 0.1], [-0.18, 0.35, -0.12], [0.1, 0.5, -0.15], [-0.12, 0.48, 0.15], [0, 0.25, 0.2]];
    g.userData.parts = [];
    offsets.forEach(([ox, oy, oz], i) => {
      const part = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 8, 8), toonMat(bug));
      part.position.set(ox * scale, oy * scale, oz * scale);
      addOutline(part, 0x1a1a1a, 1.1);
      g.add(part);
      g.userData.parts.push({ mesh: part, base: [ox * scale, oy * scale, oz * scale], phase: i });
    });
    return g;
  }

  function buildYeti(scale) {
    const g = new THREE.Group();
    const fur = 0xf0f5f7;
    const furShade = 0xc9d9e0;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7 * scale, 12, 12), toonMat(fur));
    body.scale.set(1.05, 1.2, 0.9);
    body.position.y = 0.9 * scale; body.castShadow = true; addOutline(body, 0x1a2a30);
    g.add(body);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.28 * scale, 1.05 * scale, 8), toonMat(fur));
      arm.position.set(side * 0.82 * scale, 0.85 * scale, 0.1 * scale);
      arm.rotation.z = side * 0.45;
      arm.rotation.x = -0.3;
      arm.castShadow = true; addOutline(arm, 0x1a2a30);
      g.add(arm);
      const fist = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 8, 8), toonMat(furShade));
      fist.position.set(side * 1.15 * scale, 0.5 * scale, 0.35 * scale);
      addOutline(fist, 0x1a2a30);
      g.add(fist);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42 * scale, 10, 10), toonMat(fur));
    head.position.y = 1.85 * scale; head.castShadow = true; addOutline(head, 0x1a2a30);
    g.add(head);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 8, 8), toonMat(furShade));
    muzzle.position.set(0, 1.75 * scale, 0.36 * scale);
    g.add(muzzle);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scale, 8, 8), toonMat(0x5cd9ff, { emissive: 0x2a9dcf, emissiveIntensity: 0.7 }));
      eye.position.set(side * 0.18 * scale, 1.92 * scale, 0.35 * scale);
      g.add(eye);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.35 * scale, 6), toonMat(0xd9ecff));
      horn.position.set(side * 0.28 * scale, 2.2 * scale, 0);
      horn.rotation.z = side * -0.3;
      addOutline(horn, 0x1a2a30);
      g.add(horn);
    }
    for (const side of [-1, 1]) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05 * scale, 0.16 * scale, 5), toonMat(0xffffff));
      tooth.position.set(side * 0.1 * scale, 1.62 * scale, 0.4 * scale);
      tooth.rotation.x = Math.PI;
      g.add(tooth);
    }
    g.userData.bob = 0.08 * scale;
    return g;
  }

  function buildColoso(scale) {
    const g = new THREE.Group();
    const stone = 0x8a8478;
    const stoneDark = 0x6b6558;
    const moss = 0x5c8f4e;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.65 * scale, 0.7 * scale, 8), toonMat(stoneDark));
    legs.position.y = 0.35 * scale; legs.castShadow = true; addOutline(legs, 0x1a1a18);
    g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1 * scale, 0.9 * scale, 0.75 * scale), toonMat(stone));
    torso.position.y = 1.05 * scale; torso.castShadow = true; addOutline(torso, 0x1a1a18);
    g.add(torso);
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 8, 8), toonMat(stone));
      shoulder.position.set(side * 0.6 * scale, 1.4 * scale, 0);
      shoulder.castShadow = true; addOutline(shoulder, 0x1a1a18);
      g.add(shoulder);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.26 * scale, 0.85 * scale, 8), toonMat(stoneDark));
      arm.position.set(side * 0.68 * scale, 0.85 * scale, 0);
      arm.rotation.z = side * -0.15;
      arm.castShadow = true; addOutline(arm, 0x1a1a18);
      g.add(arm);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.3 * scale, 0.32 * scale), toonMat(stone));
      fist.position.set(side * 0.72 * scale, 0.42 * scale, 0);
      addOutline(fist, 0x1a1a18);
      g.add(fist);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.45 * scale, 0.45 * scale), toonMat(stoneDark));
    head.position.y = 1.75 * scale; head.castShadow = true; addOutline(head, 0x1a1a18);
    g.add(head);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 6, 6), toonMat(0xff9a3a, { emissive: 0xd9601a, emissiveIntensity: 0.7 }));
      eye.position.set(side * 0.13 * scale, 1.78 * scale, 0.25 * scale);
      g.add(eye);
    }
    for (const [mx, my, mz] of [[0.35, 1.2, 0.3], [-0.4, 0.5, 0.3], [0.1, 1.6, -0.3]]) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 6, 6), toonMat(moss));
      patch.scale.set(1, 0.4, 1);
      patch.position.set(mx * scale, my * scale, mz * scale);
      g.add(patch);
    }
    g.userData.bob = 0.03 * scale;
    return g;
  }

  const ENEMY_BUILDERS = {
    goblin: buildGoblin, lobo: buildLobo, orco: buildOrco,
    chaman: buildChaman, ogro: buildOgro, berserker: buildBerserker,
    murcielago: buildMurcielago, gargola: buildGargola, escorpion: buildEscorpion,
    momia: buildMomia, gargolaRey: buildGargolaRey, espectro_alado: buildEspectroAlado,
    enjambre: buildEnjambre, yeti: buildYeti, coloso: buildColoso,
  };

  function makeEnemyMesh(e) {
    const scale = Math.max(0.6, (e.r || 12) / 12);
    const builder = ENEMY_BUILDERS[e.type];
    const g = builder ? builder(scale) : buildGenericEnemy(scale, e);
    g.userData.fly = !!e.fly;
    g.userData.baseHover = e.fly ? 1.9 * scale : (builder ? 0 : 0.65 * scale);
    return g;
  }
  function updateEnemyMesh(e, g) {
    // los voladores mantienen su altura de vuelo por encima del relieve
    g.position.set(toX(e.x), groundY(e.x, e.y) + g.userData.baseHover, toZ(e.y));
    if (e.dx !== undefined) g.rotation.y = Math.atan2(e.dx, e.dy || 0.001) + Math.PI;
    const t = performance.now() * 0.001;
    if (g.userData.fly) {
      g.position.y = g.userData.baseHover + Math.sin(t * 4 + e.x) * 0.15;
    } else if (g.userData.bob) {
      g.position.y = g.userData.baseHover + Math.sin(t * 6 + e.x) * g.userData.bob;
    }
    if (g.userData.wingFlap) {
      const flap = Math.sin(t * 8 + e.x) * 0.4;
      if (g.userData.wing1) g.userData.wing1.rotation.x = flap;
      if (g.userData["wing-1"]) g.userData["wing-1"].rotation.x = -flap;
    }
    if (g.userData.parts) g.userData.parts.forEach((p) => {
      p.mesh.position.set(
        p.base[0] + Math.sin(t * 4 + p.phase) * 0.15,
        p.base[1] + Math.cos(t * 5 + p.phase * 1.3) * 0.15,
        p.base[2] + Math.sin(t * 3.5 + p.phase * 0.7) * 0.15
      );
    });
    if (g.userData.orb) g.userData.orb.rotation.y += 0.03;
  }

  // ---------- héroes, diseño propio ----------
  const HERO_SKIN = 0xe0b088;

  function buildRoldan(scale) {
    const g = new THREE.Group();
    const armor = 0x8f8478;
    const cape = 0x9d4444;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * scale, 0.4 * scale, 0.95 * scale, 8), toonMat(armor));
    body.position.y = 0.58 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    const capeMesh = new THREE.Mesh(new THREE.ConeGeometry(0.32 * scale, 0.9 * scale, 6, 1, true), toonMat(cape, { side: THREE.DoubleSide }));
    capeMesh.position.set(0, 0.55 * scale, -0.12 * scale);
    capeMesh.rotation.x = Math.PI;
    g.add(capeMesh);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 10, 10), toonMat(armor));
    head.position.y = 1.2 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.4 * scale, 6), toonMat(cape));
    plume.position.set(0, 1.5 * scale, 0);
    g.add(plume);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.28 * scale, 0.06 * scale, 8), toonMat(cape));
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.45 * scale, 0.75 * scale, 0.15 * scale);
    addOutline(shield, 0x1a1a1a, 1.05);
    g.add(shield);
    const sword = new THREE.Mesh(new THREE.ConeGeometry(0.05 * scale, 0.75 * scale, 4), toonMat(0xc9ccd4));
    sword.position.set(0.45 * scale, 1 * scale, 0.1 * scale);
    sword.rotation.z = -0.3;
    addOutline(sword, 0x1a1a1a);
    g.add(sword);
    return g;
  }

  function buildLyra(scale) {
    const g = new THREE.Group();
    const robe = 0x4e8f5a;
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 1 * scale, 8), toonMat(robe));
    cloak.position.y = 0.55 * scale; cloak.castShadow = true; addOutline(cloak, 0x1a1a1a);
    g.add(cloak);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 10, 10), toonMat(HERO_SKIN));
    head.position.y = 1.18 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3 * scale, 0.55 * scale, 8), toonMat(0x3a6b46));
    hat.position.y = 1.5 * scale; addOutline(hat, 0x1a1a1a);
    g.add(hat);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 1.2 * scale, 6), toonMat(0x4a3323));
    staff.position.set(0.4 * scale, 0.85 * scale, 0);
    g.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 10, 10), toonMat(0xff9a3a, { emissive: 0xd9601a, emissiveIntensity: 0.6 }));
    orb.position.set(0.4 * scale, 1.5 * scale, 0);
    addOutline(orb, 0x8a3a0a, 1.1);
    g.userData.orb = orb;
    g.add(orb);
    return g;
  }

  function buildAmir(scale) {
    const g = new THREE.Group();
    const cloth = 0xc9a04a;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.34 * scale, 0.9 * scale, 8), toonMat(cloth));
    body.position.y = 0.55 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 10, 10), toonMat(HERO_SKIN));
    head.position.y = 1.12 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const turban = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), toonMat(0xe0dcc8));
    turban.position.y = 1.2 * scale; addOutline(turban, 0x1a1a1a);
    g.add(turban);
    for (const side of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.TorusGeometry(0.32 * scale, 0.035 * scale, 6, 10, Math.PI * 1.1), toonMat(0xd4d8e0));
      blade.position.set(side * 0.4 * scale, 0.85 * scale, 0.2 * scale);
      blade.rotation.y = side > 0 ? 0.3 : Math.PI - 0.3;
      addOutline(blade, 0x1a1a1a, 1.04);
      g.add(blade);
    }
    return g;
  }

  function buildZahra(scale) {
    const g = new THREE.Group();
    const cloth = 0x7a5ca0;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * scale, 0.3 * scale, 0.88 * scale, 8), toonMat(cloth));
    body.position.y = 0.54 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21 * scale, 10, 10), toonMat(HERO_SKIN));
    head.position.y = 1.08 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24 * scale, 0.4 * scale, 8), toonMat(0x5c4480));
    hood.position.y = 1.28 * scale; addOutline(hood, 0x1a1a1a);
    g.add(hood);
    const bandolier = new THREE.Mesh(new THREE.TorusGeometry(0.29 * scale, 0.04 * scale, 6, 12), toonMat(0x4a3323));
    bandolier.rotation.z = 0.5; bandolier.position.y = 0.6 * scale;
    g.add(bandolier);
    for (let i = 0; i < 3; i++) {
      const dagger = new THREE.Mesh(new THREE.ConeGeometry(0.035 * scale, 0.22 * scale, 4), toonMat(0xc9ccd4));
      dagger.position.set(-0.15 * scale + i * 0.13 * scale, 0.75 * scale, 0.24 * scale);
      dagger.rotation.x = Math.PI;
      g.add(dagger);
    }
    return g;
  }

  function buildBjorn(scale) {
    const g = new THREE.Group();
    const fur = 0x5c7a9d;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * scale, 0.46 * scale, 1 * scale, 8), toonMat(fur));
    body.position.y = 0.6 * scale; body.castShadow = true; addOutline(body, 0x1a1a1a);
    g.add(body);
    const furCloak = new THREE.Mesh(new THREE.ConeGeometry(0.42 * scale, 0.6 * scale, 8, 1, true), toonMat(0xd9d0c0, { side: THREE.DoubleSide }));
    furCloak.position.set(0, 1.0 * scale, -0.1 * scale);
    g.add(furCloak);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 10, 10), toonMat(HERO_SKIN));
    head.position.y = 1.35 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toonMat(0x4a5560));
    helmet.position.y = 1.4 * scale; addOutline(helmet, 0x1a1a1a);
    g.add(helmet);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.32 * scale, 6), toonMat(0xe0dcc8));
      horn.position.set(side * 0.28 * scale, 1.55 * scale, 0);
      horn.rotation.z = side * -0.5;
      g.add(horn);
    }
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 0.9 * scale, 6), toonMat(0x4a3323));
    handle.position.set(0.5 * scale, 0.9 * scale, 0);
    handle.rotation.z = -0.4;
    g.add(handle);
    const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.22 * scale, 0.22 * scale), toonMat(0x6b6f78));
    hammerHead.position.set(0.78 * scale, 1.25 * scale, 0);
    hammerHead.rotation.z = -0.4;
    addOutline(hammerHead, 0x1a1a1a);
    g.add(hammerHead);
    return g;
  }

  function buildFrida(scale) {
    const g = new THREE.Group();
    const robe = 0xb87fa0;
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.33 * scale, 0.98 * scale, 8), toonMat(robe));
    cloak.position.y = 0.55 * scale; cloak.castShadow = true; addOutline(cloak, 0x1a1a1a);
    g.add(cloak);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23 * scale, 10, 10), toonMat(HERO_SKIN));
    head.position.y = 1.15 * scale; head.castShadow = true; addOutline(head, 0x1a1a1a);
    g.add(head);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28 * scale, 0.5 * scale, 8), toonMat(0xe8ecf5, { transparent: true, opacity: 0.9 }));
    hood.position.y = 1.42 * scale; addOutline(hood, 0x1a1a1a);
    g.add(hood);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 1.15 * scale, 6), toonMat(0xd9ecff));
    staff.position.set(0.4 * scale, 0.85 * scale, 0);
    g.add(staff);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * scale, 0), toonMat(0x9adfff, { emissive: 0x5cb8ea, emissiveIntensity: 0.6 }));
    crystal.position.set(0.4 * scale, 1.48 * scale, 0);
    addOutline(crystal, 0x1a4d5c, 1.1);
    g.userData.orb = crystal;
    g.add(crystal);
    return g;
  }

  const HERO_BUILDERS = {
    roldan: buildRoldan, lyra: buildLyra, amir: buildAmir,
    zahra: buildZahra, bjorn: buildBjorn, frida: buildFrida,
  };

  // ---------- unidades: soldados y héroes ----------
  function makeUnitMesh(u) {
    const isHero = u.kindU === "hero";
    if (isHero) {
      const builder = HERO_BUILDERS[u.type];
      if (builder) return builder(1.15);
    }
    const g = new THREE.Group();
    const color = 0x6f7a8f;
    const h = 0.9;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, h, 10), toonMat(color));
    body.position.y = h / 2;
    body.castShadow = true; addOutline(body, 0x1a1a1a, 1.1);
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), toonMat(color));
    head.position.y = h + 0.2;
    head.castShadow = true; addOutline(head, 0x1a1a1a, 1.1);
    g.add(head);
    return g;
  }
  function updateUnitMesh(u, g) {
    g.position.set(toX(u.x), groundY(u.x, u.y), toZ(u.y));
    g.visible = !u.dead;
    if (g.userData.orb) g.userData.orb.rotation.y += 0.03;
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
  R3.render = function (game, selection) {
    updateSpotMarkers(game);
    updateRange(selection);
    syncPool(pools.towers, game.towers, makeTowerMesh, updateTowerMesh);
    syncPool(pools.enemies, game.enemies, makeEnemyMesh, updateEnemyMesh);
    syncPool(pools.units, game.units, makeUnitMesh, updateUnitMesh);
    syncPool(pools.projectiles, game.projectiles, makeProjMesh, updateProjMesh);
    syncPool(pools.effects, game.effects, makeEffectMesh, updateEffectMesh);
    renderer.render(scene, camera);
  };
})();
