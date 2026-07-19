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
    if (g.userData.gx === undefined) {
      const clear = clearOfPath(tw.x, tw.y, 38); // 21 de medio camino + margen de la base de la torre
      g.userData.gx = clear.x; g.userData.gy = clear.y;
    }
    g.position.set(toX(g.userData.gx), 0, toZ(g.userData.gy));
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
