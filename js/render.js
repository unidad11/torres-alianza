/* ============================================================
   TORRES ALIANZA — renderizado
   Dibuja el escenario (cacheado) y todo lo que se mueve.
   ============================================================ */
"use strict";
(function () {
  const S = () => TA.sprites;

  // ---------- escenario cacheado ----------
  // El terreno no cambia durante la partida: se dibuja una vez
  // en un canvas oculto y luego se pinta de golpe cada frame.
  TA.buildTerrain = function (level, paths) {
    const cv = document.createElement("canvas");
    cv.width = TA.W; cv.height = TA.H;
    const ctx = cv.getContext("2d");
    const rng = TA.mulberry32(level.seed * 1000 + 7);
    const desert = level.region === "desierto";
    const montana = level.region === "montana";

    if (montana) {
      // nieve con parches de sombra azulada
      ctx.fillStyle = "#e8f0f5";
      ctx.fillRect(0, 0, TA.W, TA.H);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = i % 2 ? "rgba(190,210,225,0.35)" : "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.ellipse(rng() * TA.W, rng() * TA.H, 30 + rng() * 70, 18 + rng() * 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // huellas y grietas de hielo
      ctx.strokeStyle = "rgba(150,180,200,0.4)"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 50; i++) {
        const x = rng() * TA.W, y = rng() * TA.H, w = 10 + rng() * 20;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + w * 0.3); ctx.stroke();
      }
    } else if (desert) {
      // arena con dunas de tono
      ctx.fillStyle = "#e0c078";
      ctx.fillRect(0, 0, TA.W, TA.H);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = i % 2 ? "rgba(196,158,90,0.35)" : "rgba(232,204,140,0.3)";
        ctx.beginPath();
        ctx.ellipse(rng() * TA.W, rng() * TA.H, 30 + rng() * 70, 18 + rng() * 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // rizos de duna
      ctx.strokeStyle = "rgba(170,130,68,0.4)"; ctx.lineWidth = 1.8;
      for (let i = 0; i < 60; i++) {
        const x = rng() * TA.W, y = rng() * TA.H, w = 14 + rng() * 22;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y - 4, x + w, y); ctx.stroke();
      }
    } else {
      // hierba con parches de tono
      ctx.fillStyle = "#79bd4f";
      ctx.fillRect(0, 0, TA.W, TA.H);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = i % 2 ? "rgba(90,160,55,0.35)" : "rgba(140,205,95,0.3)";
        ctx.beginPath();
        ctx.ellipse(rng() * TA.W, rng() * TA.H, 30 + rng() * 70, 18 + rng() * 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // matitas de hierba
      ctx.strokeStyle = "rgba(60,120,40,0.5)"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 120; i++) {
        const x = rng() * TA.W, y = rng() * TA.H;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 5);
        ctx.moveTo(x + 3, y); ctx.lineTo(x + 4, y - 5); ctx.stroke();
      }
    }

    // río (nivel con river definido)
    if (level.river) {
      const rv = level.river;
      ctx.fillStyle = "#4fa9d9";
      ctx.fillRect(rv.x - rv.w / 2, 0, rv.w, TA.H);
      ctx.strokeStyle = "#2e7fb0"; ctx.lineWidth = 3;
      ctx.strokeRect(rv.x - rv.w / 2, -4, rv.w, TA.H + 8);
      // brillos del agua
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const y = rng() * TA.H, x = rv.x - rv.w / 2 + 8 + rng() * (rv.w - 16);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 3, x + 12, y); ctx.stroke();
      }
    }

    // caminos de tierra
    for (const path of paths) {
      strokePath(ctx, path.points, 42, "#8a6335");
      strokePath(ctx, path.points, 34, "#c89b5f");
      // pisadas centrales
      ctx.setLineDash([2, 26]);
      strokePath(ctx, path.points, 10, "rgba(138,99,53,0.55)");
      ctx.setLineDash([]);
    }

    // puente de madera sobre el río
    if (level.river) {
      const rv = level.river;
      ctx.fillStyle = "#a06a3c";
      ctx.fillRect(rv.x - rv.w / 2 - 8, rv.bridgeY - rv.bridgeH / 2, rv.w + 16, rv.bridgeH);
      ctx.strokeStyle = S().INK; ctx.lineWidth = 2.5;
      ctx.strokeRect(rv.x - rv.w / 2 - 8, rv.bridgeY - rv.bridgeH / 2, rv.w + 16, rv.bridgeH);
      ctx.strokeStyle = "#7a4a24"; ctx.lineWidth = 2;
      for (let x = rv.x - rv.w / 2 - 2; x < rv.x + rv.w / 2 + 8; x += 9) {
        ctx.beginPath(); ctx.moveTo(x, rv.bridgeY - rv.bridgeH / 2 + 3); ctx.lineTo(x, rv.bridgeY + rv.bridgeH / 2 - 3); ctx.stroke();
      }
    }

    // decorado procedural: árboles, rocas, arbustos y flores
    // (se colocan lejos del camino y de los huecos de construcción)
    const decor = [];
    const clearOf = (x, y, margin) => {
      for (const path of paths) {
        for (let s = 0; s < path.total; s += 14) {
          const p = path.at(s);
          if (Math.hypot(p.x - x, p.y - y) < margin) return false;
        }
      }
      for (const [sx, sy] of level.spots) {
        if (Math.hypot(sx - x, sy - y) < 42) return false;
      }
      if (level.river && Math.abs(x - level.river.x) < level.river.w / 2 + 26) return false;
      for (const d of decor) if (Math.hypot(d.x - x, d.y - y) < 34) return false;
      return true;
    };
    let tries = 0;
    while (decor.length < 26 && tries < 700) {
      tries++;
      const x = 20 + rng() * (TA.W - 40), y = 20 + rng() * (TA.H - 40);
      if (!clearOf(x, y, 48)) continue;
      const r = rng();
      const kind = montana
        ? (r < 0.55 ? "pinoNieve" : "rock")
        : desert
        ? (r < 0.5 ? "cactus" : r < 0.78 ? "rock" : r < 0.93 ? "ruina" : "rock")
        : (r < 0.55 ? "tree" : r < 0.75 ? "rock" : r < 0.9 ? "bush" : "flower");
      decor.push({ x, y, kind, s: 0.7 + rng() * 0.6, tone: rng() < 0.5 });
    }
    decor.sort((a, b) => a.y - b.y);
    for (const d of decor) {
      if (d.kind !== "flower") S().castShadow(ctx, d.x, d.y, d.s);
      if (d.kind === "tree") S().tree(ctx, d.x, d.y, d.s, d.tone);
      else if (d.kind === "pinoNieve") S().pinoNieve(ctx, d.x, d.y, d.s);
      else if (d.kind === "rock") S().rock(ctx, d.x, d.y, d.s);
      else if (d.kind === "bush") S().bush(ctx, d.x, d.y, d.s);
      else if (d.kind === "cactus") S().cactus(ctx, d.x, d.y, d.s);
      else if (d.kind === "ruina") S().ruina(ctx, d.x, d.y, d.s);
      else S().flower(ctx, d.x, d.y);
    }

    // marcas de entrada del camino (si hay bifurcación, todas comparten el mismo tramo inicial)
    const seenStarts = [];
    for (const path of paths) {
      const a = path.at(6);
      if (seenStarts.some((p) => Math.hypot(p.x - a.x, p.y - a.y) < 10)) continue;
      seenStarts.push(a);
      drawArrow(ctx, a, "#d43d2a");     // por aquí entran
    }
    // banderita azul en cada salida (lo que defendemos; si hay bifurcación puede haber varias)
    const seenEnds = [];
    for (const path of paths) {
      const end = path.at(path.total - 8);
      if (seenEnds.some((p) => Math.hypot(p.x - end.x, p.y - end.y) < 10)) continue;
      seenEnds.push(end);
      ctx.strokeStyle = "#6b4a26"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(end.x, end.y); ctx.lineTo(end.x, end.y - 34); ctx.stroke();
      ctx.fillStyle = "#3f68b0"; ctx.strokeStyle = S().INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(end.x, end.y - 34); ctx.lineTo(end.x + 22, end.y - 27); ctx.lineTo(end.x, end.y - 20);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // viñeta sutil: oscurece un poco los bordes para dar profundidad
    const vg = ctx.createRadialGradient(TA.W / 2, TA.H / 2, TA.H * 0.35, TA.W / 2, TA.H / 2, TA.H * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(20,15,8,0.28)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, TA.W, TA.H);

    return cv;
  };

  function strokePath(ctx, pts, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  function drawArrow(ctx, p, color) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.dy, p.dx));
    ctx.fillStyle = color; ctx.strokeStyle = S().INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -9); ctx.lineTo(6, 0); ctx.lineTo(-12, 9);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---------- dibujo de cada frame ----------
  TA.render = function (ctx, game, terrain, selection) {
    ctx.clearRect(0, 0, TA.W, TA.H);
    ctx.drawImage(terrain, 0, 0);
    const t = game.time;

    // huecos de construcción (con pulso si no hay torres aún)
    const hint = game.towers.length === 0 ? (Math.sin(t * 3) * 0.5 + 0.5) : 0;
    for (const spot of game.spots) {
      if (!spot.tower) S().spot(ctx, spot.x, spot.y, hint);
    }

    // alcance de la torre o hueco seleccionado
    if (selection && selection.range) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(selection.x, selection.y, selection.range, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
    }
    // banderín del punto de reunión del cuartel seleccionado
    if (selection && selection.rally) {
      const r = selection.rally;
      ctx.strokeStyle = "#6b4a26"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y - 22); ctx.stroke();
      ctx.fillStyle = "#d43d2a"; ctx.strokeStyle = S().INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r.x, r.y - 22); ctx.lineTo(r.x + 14, r.y - 17); ctx.lineTo(r.x, r.y - 12);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // todo lo que vive en el mapa, ordenado por altura (y)
    const drawables = [];
    for (const tw of game.towers) drawables.push({ y: tw.y, f: () => S().tower(ctx, tw, t) });
    for (const e of game.enemies) drawables.push({ y: e.y, f: () => S().enemy(ctx, e, t) });
    for (const u of game.units) {
      if (u.dead) continue;
      if (u.kindU === "hero") drawables.push({ y: u.y, f: () => S().hero(ctx, u, t) });
      else if (u.kindU === "militia") drawables.push({ y: u.y, f: () => S().militia(ctx, u, t) });
      else drawables.push({ y: u.y, f: () => S().soldier(ctx, u, t) });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.f();

    // proyectiles por encima de todo
    for (const p of game.projectiles) {
      if (!p.delay || p.delay <= 0) S().projectile(ctx, p, t);
    }

    // efectos
    for (const fx of game.effects) {
      if (fx.kind === "boom") S().boom(ctx, fx);
      else if (fx.kind === "puff") S().puff(ctx, fx);
      else if (fx.kind === "coin") S().coin(ctx, fx);
      else if (fx.kind === "dmg") S().dmgText(ctx, fx);
      else if (fx.kind === "whirl") S().whirl(ctx, fx);
      else if (fx.kind === "heal") S().healFx(ctx, fx);
      else if (fx.kind === "spark") S().spark(ctx, fx);
      else if (fx.kind === "ambient") S().ambient(ctx, fx);
    }

    // héroes muertos: reloj de reaparición sobre el suelo
    for (const h of game.heroes) {
      if (h.dead) {
        ctx.fillStyle = "rgba(40,25,10,0.5)";
        ctx.beginPath(); ctx.ellipse(h.x, h.y, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px 'Chalkboard SE', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(Math.ceil(h.respawnT), h.x, h.y - 8);
      }
    }
  };
})();
