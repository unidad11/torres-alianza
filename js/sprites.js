/* ============================================================
   TORRES ALIANZA — gráficos
   Todo el arte se dibuja por código en el canvas: personajes
   cabezones con contorno grueso, estilo dibujo animado.
   ============================================================ */
"use strict";
(function () {
  const S = TA.sprites = {};
  const INK = "#3a2314"; // contorno marrón oscuro (tinta cálida)

  // ---------- ayudas ----------
  function pathEllipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }
  function blob(ctx, x, y, rx, ry, fill, lw) {
    pathEllipse(ctx, x, y, rx, ry);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = lw || 2.5; ctx.strokeStyle = INK; ctx.stroke();
  }
  function rect(ctx, x, y, w, h, fill, r, lw) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r || 3); else ctx.rect(x, y, w, h);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = lw || 2.5; ctx.strokeStyle = INK; ctx.stroke();
  }
  function eyes(ctx, x, y, sep, r) {
    ctx.fillStyle = "#fff";
    pathEllipse(ctx, x - sep, y, r, r * 1.15); ctx.fill();
    pathEllipse(ctx, x + sep, y, r, r * 1.15); ctx.fill();
    ctx.fillStyle = INK;
    pathEllipse(ctx, x - sep + r * 0.25, y, r * 0.45, r * 0.5); ctx.fill();
    pathEllipse(ctx, x + sep + r * 0.25, y, r * 0.45, r * 0.5); ctx.fill();
  }
  S.INK = INK;

  // sombra bajo los pies
  function shadow(ctx, x, y, r) {
    ctx.fillStyle = "rgba(40,25,10,0.25)";
    pathEllipse(ctx, x, y, r, r * 0.38); ctx.fill();
  }

  // ---------- ENEMIGOS ----------
  // Todos se dibujan mirando a la derecha; `flip` los voltea.
  S.enemy = function (ctx, e, t) {
    const flying = !!e.def.fly;
    const hover = flying ? 16 + Math.sin(t * 3 + e.animSeed) * 3 : 0;
    const bob = Math.sin(t * 9 + e.animSeed) * 2;
    ctx.save();
    ctx.translate(e.x, e.y);
    shadow(ctx, 0, 4, flying ? e.def.r * 0.55 : e.def.r);
    if (e.flip) ctx.scale(-1, 1);
    ctx.translate(0, -e.def.r * 0.9 + bob * 0.4 - hover);
    const fn = S["e_" + e.type] || S.e_goblin;
    fn(ctx, t, bob, e);
    ctx.restore();
    // barra de vida (fuera del flip)
    if (e.hp < e.def.hp) {
      const w = e.def.r * 2, pct = Math.max(0, e.hp / e.def.hp);
      ctx.fillStyle = INK;
      ctx.fillRect(e.x - w / 2 - 1, e.y - e.def.r * 2.4 - 1, w + 2, 5);
      ctx.fillStyle = pct > 0.5 ? "#5ec24a" : pct > 0.25 ? "#e8b33b" : "#d43d2a";
      ctx.fillRect(e.x - w / 2, e.y - e.def.r * 2.4, w * pct, 3);
    }
  };

  S.e_goblin = function (ctx, t, bob) {
    // piernas
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(-4, 12 + Math.sin(t * 12) * 2); ctx.moveTo(3, 6); ctx.lineTo(4, 12 - Math.sin(t * 12) * 2); ctx.stroke();
    blob(ctx, 0, 0, 8, 9, "#7fb944");            // cuerpo
    blob(ctx, 2, -10, 9, 8, "#8fc954");          // cabezón
    // orejas puntiagudas
    ctx.fillStyle = "#8fc954"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-13, -16); ctx.lineTo(-5, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    eyes(ctx, 4, -11, 3.5, 2.2);
    // daga
    ctx.strokeStyle = "#c8c8d0"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(9, -2); ctx.lineTo(15, -7 + bob); ctx.stroke();
  };

  S.e_lobo = function (ctx, t) {
    const run = Math.sin(t * 14);
    // patas
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-7, 4); ctx.lineTo(-9 - run * 3, 11);
    ctx.moveTo(-3, 4); ctx.lineTo(-2 + run * 3, 11);
    ctx.moveTo(4, 4); ctx.lineTo(3 - run * 3, 11);
    ctx.moveTo(8, 4); ctx.lineTo(10 + run * 3, 11);
    ctx.stroke();
    // cuerpo horizontal
    blob(ctx, 0, 0, 13, 7, "#9aa0ab");
    // cola
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, -2); ctx.quadraticCurveTo(-18, -6, -16, -10 + run); ctx.stroke();
    // cabeza + hocico
    blob(ctx, 11, -6, 7, 6, "#aab0bb");
    blob(ctx, 17, -4, 4, 2.6, "#c8ccd4");
    eyes(ctx, 11, -8, 2.5, 1.6);
    // orejas
    ctx.fillStyle = "#9aa0ab"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(8, -11); ctx.lineTo(7, -16); ctx.lineTo(11, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
  };

  S.e_orco = function (ctx, t, bob) {
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-5, 14 + Math.sin(t * 8) * 2); ctx.moveTo(4, 8); ctx.lineTo(5, 14 - Math.sin(t * 8) * 2); ctx.stroke();
    blob(ctx, 0, 0, 11, 11, "#5d8f3c");           // cuerpo
    rect(ctx, -9, -4, 18, 9, "#6d5844", 3, 2);    // peto de cuero
    blob(ctx, 2, -13, 10, 9, "#6da04a");          // cabeza
    eyes(ctx, 4, -14, 3.5, 2);
    // colmillos
    ctx.fillStyle = "#f5f0dc";
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(1, -4); ctx.lineTo(3, -8); ctx.closePath(); ctx.fill();
    // hacha
    ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(11, 2); ctx.lineTo(18, -10 + bob); ctx.stroke();
    blob(ctx, 18, -12 + bob, 4.5, 3.5, "#b9bec8", 2);
  };

  S.e_chaman = function (ctx, t, bob, e) {
    // túnica
    ctx.fillStyle = "#8e5bc7"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, 10); ctx.quadraticCurveTo(0, -14, 8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    blob(ctx, 1, -12, 8, 7.5, "#7fb944");          // cabeza goblin
    eyes(ctx, 3, -13, 3, 2);
    // capucha
    ctx.strokeStyle = "#6e42a0"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(1, -13, 9, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
    // bastón con calavera
    ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, 8); ctx.lineTo(12, -14); ctx.stroke();
    blob(ctx, 12, -17, 4, 4, "#f5f0dc", 2);
    // aura al curar
    if (e && e.healGlow > 0) {
      ctx.strokeStyle = "rgba(120,255,140," + (e.healGlow * 0.8) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -4, 18 + (1 - e.healGlow) * 14, 0, Math.PI * 2); ctx.stroke();
    }
  };

  S.e_ogro = function (ctx, t, bob) {
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(-9, 24 + Math.sin(t * 6) * 2); ctx.moveTo(8, 14); ctx.lineTo(9, 24 - Math.sin(t * 6) * 2); ctx.stroke();
    blob(ctx, 0, 0, 20, 18, "#b3703f", 3.5);       // cuerpazo
    rect(ctx, -16, 2, 32, 12, "#7a5a38", 4, 2.5);  // taparrabos
    blob(ctx, 3, -20, 15, 13, "#c07f4c", 3);       // cabeza
    eyes(ctx, 6, -22, 5, 2.6);
    // cuerno
    ctx.fillStyle = "#f5f0dc"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-9, -38); ctx.lineTo(-1, -32); ctx.closePath(); ctx.fill(); ctx.stroke();
    // garrote
    ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(18, 4); ctx.lineTo(30, -16 + bob); ctx.stroke();
    blob(ctx, 31, -20 + bob, 8, 7, "#8d6a45", 2.5);
  };

  S.e_yeti = function (ctx, t, bob) {
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-9, 15); ctx.lineTo(-10, 25 + Math.sin(t * 5) * 2); ctx.moveTo(9, 15); ctx.lineTo(10, 25 - Math.sin(t * 5) * 2); ctx.stroke();
    blob(ctx, 0, 0, 21, 19, "#eef4f7", 3.5);        // pelaje blanco
    blob(ctx, -8, -6, 8, 10, "#dbe6ec", 2.5);
    blob(ctx, 8, 4, 9, 11, "#dbe6ec", 2.5);
    blob(ctx, 3, -21, 15, 13, "#eef4f7", 3);        // cabeza
    ctx.fillStyle = "#3a2314";
    pathEllipse(ctx, 7, -23, 4, 3); ctx.fill();      // hocico oscuro
    ctx.fillStyle = "#e8394a";
    pathEllipse(ctx, 3, -26, 3, 2.2); ctx.fill();
    pathEllipse(ctx, 9, -26, 3, 2.2); ctx.fill();
    // colmillos
    ctx.fillStyle = "#f5f0dc";
    ctx.beginPath(); ctx.moveTo(4, -16); ctx.lineTo(5, -11); ctx.lineTo(7, -16); ctx.closePath(); ctx.fill();
    // garras
    ctx.strokeStyle = "#c8ccd4"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(17, 2); ctx.lineTo(24, -6 + bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-16, -2); ctx.lineTo(-23, -10 - bob); ctx.stroke();
  };

  S.e_murcielago = function (ctx, t) {
    const flap = Math.sin(t * 20);
    ctx.fillStyle = "#4a3d55"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(-14, -10 * flap - 4, -18, 2 * flap); ctx.quadraticCurveTo(-9, 2, -2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.quadraticCurveTo(14, -10 * flap - 4, 18, 2 * flap); ctx.quadraticCurveTo(9, 2, 2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    blob(ctx, 0, 0, 7, 6.5, "#5b4c68");
    ctx.fillStyle = "#5b4c68"; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-6, -12); ctx.lineTo(-1, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(6, -12); ctx.lineTo(1, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e8394a";
    pathEllipse(ctx, -2, -1, 1.4, 1.4); ctx.fill();
    pathEllipse(ctx, 2, -1, 1.4, 1.4); ctx.fill();
  };

  S.e_gargola = function (ctx, t, bob) {
    const flap = Math.sin(t * 6);
    ctx.strokeStyle = "#5a5f68"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-3, 4); ctx.quadraticCurveTo(-22, -6 * flap - 6, -30, 4 * flap); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, 4); ctx.quadraticCurveTo(22, -6 * flap - 6, 30, 4 * flap); ctx.stroke();
    blob(ctx, 0, 0, 13, 12, "#7d848f", 3);
    rect(ctx, -9, -3, 18, 8, "#5a5f68", 3, 2);
    blob(ctx, 2, -15, 11, 10, "#8b929c", 3);
    ctx.fillStyle = "#e8b33b";
    pathEllipse(ctx, 5, -16, 2.2, 2.2); ctx.fill();
    pathEllipse(ctx, 0, -16, 2.2, 2.2); ctx.fill();
    ctx.fillStyle = "#e2ddd0"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, -24); ctx.lineTo(-7, -31); ctx.lineTo(-1, -25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(9, -31); ctx.lineTo(3, -25); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  S.e_gargolaRey = function (ctx, t, bob, e) {
    ctx.save(); ctx.scale(1.7, 1.7);
    S.e_gargola(ctx, t, bob, e);
    ctx.restore();
  };

  S.e_escorpion = function (ctx, t) {
    const run = Math.sin(t * 10);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 6, 2); ctx.lineTo(side * 13, -2 + run * 2);
      ctx.moveTo(side * 2, 4); ctx.lineTo(side * 8, 9 - run * 2);
      ctx.stroke();
    }
    blob(ctx, 0, 2, 12, 8, "#b5642f", 2.8);
    blob(ctx, 10, -1, 6, 5.5, "#c47238", 2.5);
    eyes(ctx, 12, -2, 2.2, 1.3);
    // pinzas
    ctx.strokeStyle = "#8f4a20"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(21, -3); ctx.stroke();
    blob(ctx, 22, -4, 4, 3, "#c47238", 2);
    // cola curvada con aguijón
    ctx.strokeStyle = "#b5642f"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-20, -6, -16, -16); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(-16, -16); ctx.lineTo(-12, -19); ctx.lineTo(-13, -13); ctx.closePath(); ctx.fill();
  };

  S.e_momia = function (ctx, t, bob, e) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-4, 14); ctx.moveTo(3, 8); ctx.lineTo(4, 14); ctx.stroke();
    blob(ctx, 0, 0, 9, 10, "#d8cfa8", 2.5);
    blob(ctx, 1, -13, 8.5, 8, "#dcd4b0", 2.5);
    // vendas cruzadas
    ctx.strokeStyle = "#b0a578"; ctx.lineWidth = 2;
    for (const yy of [-2, 2, 6, -16, -11]) {
      ctx.beginPath(); ctx.moveTo(-9, yy); ctx.lineTo(9, yy - 3); ctx.stroke();
    }
    ctx.fillStyle = INK;
    pathEllipse(ctx, -1, -14, 2.4, 1.6); ctx.fill();
    pathEllipse(ctx, 5, -14, 2.4, 1.6); ctx.fill();
    // brazos vendados extendidos
    ctx.strokeStyle = "#dcd4b0"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(16, -4 + bob); ctx.stroke();
    // aura verdosa cuando regenera
    if (e && e.hp < e.def.hp) {
      const g = 0.35 + Math.sin(t * 3) * 0.15;
      ctx.strokeStyle = "rgba(140,200,110," + g + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -4, 15, 0, Math.PI * 2); ctx.stroke();
    }
  };

  // ---------- ALIADOS ----------
  S.soldier = function (ctx, u, t) {
    const bob = u.moving ? Math.sin(t * 10 + u.animSeed) * 1.5 : 0;
    ctx.save(); ctx.translate(u.x, u.y);
    shadow(ctx, 0, 3, 9);
    if (u.flip) ctx.scale(-1, 1);
    ctx.translate(0, -8 + bob * 0.5);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(-3, 10 + bob); ctx.moveTo(2, 5); ctx.lineTo(3, 10 - bob); ctx.stroke();
    blob(ctx, 0, 0, 6.5, 7, u.color || "#5a7fbe", 2);   // cuerpo con peto
    blob(ctx, 1, -8, 6.5, 6, "#f0c8a0", 2);             // cara
    eyes(ctx, 2.5, -8.5, 2.2, 1.4);
    // casco
    ctx.fillStyle = "#b9bec8"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(1, -9.5, 6.5, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    // escudo y espada
    blob(ctx, -7, 0, 3.5, 4.5, "#8d6a45", 2);
    ctx.strokeStyle = "#c8c8d0"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(7, -1); ctx.lineTo(11, -6 + bob); ctx.stroke();
    ctx.restore();
    if (u.hp < u.maxHp) barHp(ctx, u.x, u.y - 24, 18, u.hp / u.maxHp);
  };

  S.militia = function (ctx, u, t) { u.color = "#a06a3c"; S.soldier(ctx, u, t); };

  function barHp(ctx, x, y, w, pct) {
    pct = Math.max(0, pct);
    ctx.fillStyle = INK; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
    ctx.fillStyle = pct > 0.5 ? "#5ec24a" : pct > 0.25 ? "#e8b33b" : "#d43d2a";
    ctx.fillRect(x - w / 2, y, w * pct, 3);
  }
  S.barHp = barHp;

  S.hero = function (ctx, h, t) {
    const bob = h.moving ? Math.sin(t * 10) * 2 : Math.sin(t * 3) * 1;
    ctx.save(); ctx.translate(h.x, h.y);
    shadow(ctx, 0, 4, 11);
    // anillo de selección
    if (h.selected) {
      ctx.strokeStyle = "#f5c33b"; ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (h.flip) ctx.scale(-1, 1);
    ctx.translate(0, -11 + bob * 0.5);
    if (h.type === "amir") {
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(-4, 13 + bob); ctx.moveTo(3, 7); ctx.lineTo(4, 13 - bob); ctx.stroke();
      ctx.fillStyle = "#c9973f"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-8, 9); ctx.quadraticCurveTo(0, -6, 8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      blob(ctx, 1, -10, 8, 7.5, "#e0b088", 2.2);
      eyes(ctx, 3, -11, 2.8, 1.8);
      // turbante
      ctx.fillStyle = "#3f68b0"; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(1, -14, 8, Math.PI, Math.PI * 2.3); ctx.fill(); ctx.stroke();
      // dos cimitarras cruzadas
      ctx.strokeStyle = "#dfe3ea"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(8, -2); ctx.quadraticCurveTo(16, -8, 18, -16 + bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(-14, 2, -14, 10 - bob); ctx.stroke();
    } else if (h.type === "zahra") {
      ctx.fillStyle = "#b0673c"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-8, 12); ctx.quadraticCurveTo(0, -10, 8, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      blob(ctx, 1, -10, 7.5, 7, "#e0b088", 2.2);
      eyes(ctx, 3, -11, 2.6, 1.7);
      // velo del desierto
      ctx.strokeStyle = "#8e5bc7"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(1, -10, 8.5, Math.PI * 0.15, Math.PI * 0.95); ctx.stroke();
      ctx.fillStyle = "#8e5bc7";
      ctx.beginPath(); ctx.moveTo(6, -6); ctx.quadraticCurveTo(10, 2, 6, 8); ctx.quadraticCurveTo(4, 0, 5, -6); ctx.closePath(); ctx.fill();
      // dagas al cinto
      ctx.strokeStyle = "#c8c8d0"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(9, 2); ctx.lineTo(14, -4 + bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, 6); ctx.lineTo(15, 2 - bob); ctx.stroke();
    } else if (h.type === "roldan") {
      ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(-4, 13 + bob); ctx.moveTo(3, 7); ctx.lineTo(4, 13 - bob); ctx.stroke();
      blob(ctx, 0, 0, 9, 9.5, "#3f68b0");             // armadura azul
      rect(ctx, -7, -2, 14, 7, "#2d4d85", 3, 2);
      blob(ctx, 1, -11, 8.5, 7.5, "#f0c8a0", 2.2);    // cara
      eyes(ctx, 3, -12, 2.8, 1.8);
      // yelmo con pluma roja
      ctx.fillStyle = "#c8ccd4"; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(1, -13, 8.5, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#d43d2a"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(-3, -20); ctx.quadraticCurveTo(-9, -24, -12, -18); ctx.stroke();
      // espadón
      ctx.strokeStyle = "#dfe3ea"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(17, -10 + bob); ctx.stroke();
      blob(ctx, -9, 0, 4, 5.5, "#e8b33b", 2);          // escudo dorado
    } else if (h.type === "bjorn") {
      ctx.strokeStyle = INK; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-5, 14 + bob); ctx.moveTo(4, 8); ctx.lineTo(5, 14 - bob); ctx.stroke();
      blob(ctx, 0, 0, 11, 11, "#6b6f78");              // cuerpazo con pieles
      rect(ctx, -8, -3, 16, 9, "#8d6a45", 3, 2.2);     // peto de cuero
      blob(ctx, 1, -12, 9, 8.5, "#e0b088", 2.2);       // cara curtida
      eyes(ctx, 3, -13, 3, 1.8);
      // barba y casco con cuernos
      ctx.fillStyle = "#e8e4da"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-5, -8); ctx.quadraticCurveTo(1, 2, 7, -8); ctx.lineTo(4, -6); ctx.lineTo(-2, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#8d8574";
      ctx.beginPath(); ctx.arc(1, -15, 9, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#e8e4da";
      ctx.beginPath(); ctx.moveTo(-7, -20); ctx.lineTo(-11, -28); ctx.lineTo(-3, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, -20); ctx.lineTo(13, -28); ctx.lineTo(5, -22); ctx.closePath(); ctx.fill(); ctx.stroke();
      // mazo enorme
      ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(9, 2); ctx.lineTo(19, -12 + bob); ctx.stroke();
      rect(ctx, 15, -20 + bob, 12, 12, "#8d8574", 3, 2.2);
    } else if (h.type === "frida") {
      ctx.fillStyle = "#3f8fc7"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-9, 12); ctx.quadraticCurveTo(0, -12, 9, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      blob(ctx, 1, -10, 8, 7.5, "#f5f0e8", 2.2);
      eyes(ctx, 3, -11, 2.8, 1.8);
      // capucha de piel
      ctx.strokeStyle = "#dfe9ee"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-8, -14); ctx.quadraticCurveTo(1, -22, 10, -14); ctx.stroke();
      ctx.fillStyle = "#2e6b8a"; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-9, -13); ctx.lineTo(11, -13); ctx.lineTo(2, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
      // báculo con carámbano
      ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(13, -16); ctx.stroke();
      const glow = 0.6 + Math.sin(t * 5) * 0.3;
      ctx.fillStyle = "rgba(190,235,255," + glow + ")";
      pathEllipse(ctx, 13, -19, 4.5, 5.5); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    } else {
      // Lyra, la maga
      ctx.fillStyle = "#8e5bc7"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-9, 12); ctx.quadraticCurveTo(0, -12, 9, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      blob(ctx, 1, -10, 8, 7.5, "#f5d9b8", 2.2);
      eyes(ctx, 3, -11, 2.8, 1.8);
      // melena y sombrero de pico
      ctx.strokeStyle = "#b0673c"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-6, -12); ctx.quadraticCurveTo(-10, -4, -8, 2); ctx.stroke();
      ctx.fillStyle = "#6e42a0"; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-10, -14); ctx.lineTo(12, -14); ctx.lineTo(3, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
      // bastón con gema
      ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(13, -16); ctx.stroke();
      const glow = 0.6 + Math.sin(t * 5) * 0.3;
      ctx.fillStyle = "rgba(120,220,255," + glow + ")";
      pathEllipse(ctx, 13, -19, 4.5, 4.5); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
    barHp(ctx, h.x, h.y - 34, 24, h.hp / h.maxHp);
  };

  // ---------- TORRES ----------
  S.tower = function (ctx, tw, t) {
    ctx.save(); ctx.translate(tw.x, tw.y);
    const lv = tw.level; // 0..2
    const fn = S["t_" + tw.type];
    // losa base de piedra
    blob(ctx, 0, 6, 24, 12, "#a8a294", 2.5);
    blob(ctx, 0, 4, 21, 10, "#c2bcae", 2);
    if (fn) fn(ctx, lv, t, tw);
    ctx.restore();
  };

  S.t_arqueros = function (ctx, lv, t) {
    const h = 26 + lv * 7;
    // patas de madera
    ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(-8, -h + 8); ctx.moveTo(12, 6); ctx.lineTo(8, -h + 8); ctx.stroke();
    ctx.strokeStyle = S.INK; ctx.lineWidth = 1.5; ctx.stroke();
    // plataforma
    rect(ctx, -15, -h, 30, 9, "#a06a3c", 3, 2.5);
    // tejadillo (más nivel = tejado mejor)
    ctx.fillStyle = lv >= 1 ? "#b04030" : "#8d6a45"; ctx.strokeStyle = S.INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-17, -h); ctx.lineTo(0, -h - 16 - lv * 3); ctx.lineTo(17, -h); ctx.closePath(); ctx.fill(); ctx.stroke();
    // arquero asomado
    blob(ctx, 0, -h - 2, 5, 5, "#f0c8a0", 2);
    if (lv >= 2) { // pluma en el gorro al nivel máximo
      ctx.strokeStyle = "#5ec24a"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(3, -h - 8); ctx.lineTo(7, -h - 14); ctx.stroke();
    }
  };

  S.t_cuartel = function (ctx, lv, t) {
    const w = 34 + lv * 3, h = 22 + lv * 4;
    rect(ctx, -w / 2, -h, w, h + 4, "#b5aa96", 4, 2.5);       // muros de piedra
    rect(ctx, -w / 2 - 3, -h - 6, w + 6, 8, "#8d8574", 2, 2); // almena
    // puerta
    ctx.fillStyle = "#6b4a26"; ctx.strokeStyle = S.INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 4, 8, Math.PI, 0); ctx.lineTo(8, 4); ctx.lineTo(-8, 4); ctx.fill(); ctx.stroke();
    // estandarte
    ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w / 2 - 2, -h - 6); ctx.lineTo(w / 2 - 2, -h - 22); ctx.stroke();
    ctx.fillStyle = lv >= 2 ? "#e8b33b" : "#3f68b0"; ctx.strokeStyle = S.INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w / 2 - 2, -h - 22); ctx.lineTo(w / 2 - 16, -h - 18); ctx.lineTo(w / 2 - 2, -h - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  };

  S.t_magos = function (ctx, lv, t) {
    const h = 30 + lv * 8;
    // torre cónica
    ctx.fillStyle = "#7d6da8"; ctx.strokeStyle = S.INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(-9, -h); ctx.lineTo(9, -h); ctx.lineTo(13, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // tejado pico
    ctx.fillStyle = "#4a3a78";
    ctx.beginPath(); ctx.moveTo(-12, -h); ctx.lineTo(0, -h - 18 - lv * 3); ctx.lineTo(12, -h); ctx.closePath(); ctx.fill(); ctx.stroke();
    // gema flotante que late
    const glow = 0.55 + Math.sin(t * 4) * 0.3;
    ctx.fillStyle = "rgba(140,220,255," + glow + ")";
    pathEllipse(ctx, 0, -h - 24 - lv * 3, 5 + lv, 6 + lv); ctx.fill();
    ctx.strokeStyle = S.INK; ctx.lineWidth = 2; ctx.stroke();
    // ventana
    ctx.fillStyle = "#cfe6ff";
    pathEllipse(ctx, 0, -h + 12, 4, 6); ctx.fill(); ctx.stroke();
  };

  S.t_canon = function (ctx, lv, t, tw) {
    // base metálica
    rect(ctx, -14, -12, 28, 16, "#6b6f78", 4, 2.5);
    // cañón que apunta al último objetivo
    const ang = tw && tw.aimAngle != null ? tw.aimAngle : -0.5;
    ctx.save(); ctx.translate(0, -12); ctx.rotate(ang);
    rect(ctx, 0, -5 - lv, 22 + lv * 4, 10 + lv * 2, "#4d5158", 4, 2.5);
    ctx.restore();
    // remaches
    ctx.fillStyle = "#c8ccd4";
    pathEllipse(ctx, -8, -6, 2, 2); ctx.fill();
    pathEllipse(ctx, 8, -6, 2, 2); ctx.fill();
    if (lv >= 2) { // bandas doradas al máximo
      ctx.strokeStyle = "#e8b33b"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
    }
  };

  S.t_hielo = function (ctx, lv, t) {
    const h = 26 + lv * 7;
    // pilar de hielo
    ctx.fillStyle = "#bfe6f5"; ctx.strokeStyle = S.INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-11, 4); ctx.lineTo(-7, -h); ctx.lineTo(7, -h); ctx.lineTo(11, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // cristales puntiagudos
    ctx.fillStyle = "#eaf9ff";
    ctx.beginPath(); ctx.moveTo(-6, -h + 4); ctx.lineTo(0, -h - 14 - lv * 3); ctx.lineTo(6, -h + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // brillo pulsante frío
    const glow = 0.5 + Math.sin(t * 3) * 0.3;
    ctx.fillStyle = "rgba(180,235,255," + glow + ")";
    pathEllipse(ctx, 0, -h - 18 - lv * 3, 4 + lv, 5 + lv); ctx.fill();
    ctx.strokeStyle = S.INK; ctx.lineWidth = 2; ctx.stroke();
  };

  S.t_electrica = function (ctx, lv, t) {
    const h = 26 + lv * 6;
    // bobina metálica
    rect(ctx, -10, -h, 20, h + 4, "#5a5f68", 3, 2.5);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = "#c8ccd4"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -h + 8 + i * 9, 10, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // esfera de energía chisporroteante
    const glow = 0.6 + Math.sin(t * 9) * 0.35;
    ctx.fillStyle = "rgba(255,240,120," + glow + ")";
    pathEllipse(ctx, 0, -h - 12 - lv * 2, 6 + lv, 6 + lv); ctx.fill();
    ctx.strokeStyle = S.INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "#fff59a"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = t * 6 + i * 1.6;
      ctx.beginPath(); ctx.moveTo(0, -h - 12 - lv * 2);
      ctx.lineTo(Math.cos(a) * (10 + lv * 2), -h - 12 - lv * 2 + Math.sin(a) * (10 + lv * 2));
      ctx.stroke();
    }
  };

  S.t_apoyo = function (ctx, lv, t) {
    const h = 24 + lv * 5;
    // mástil con estandarte
    ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -h - 20); ctx.stroke();
    ctx.fillStyle = "#e8b33b"; ctx.strokeStyle = S.INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -h - 20); ctx.lineTo(24, -h - 12); ctx.lineTo(0, -h - 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    // tambor en la base
    blob(ctx, 0, -6, 12, 9, "#a06a3c", 2.5);
    ctx.strokeStyle = "#6b4a26"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(12, -6); ctx.stroke();
    // aura de mejora, pulso lento
    const k = (Math.sin(t * 2) + 1) / 2;
    ctx.strokeStyle = "rgba(245,195,59," + (0.35 + k * 0.3) + ")"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 18 + k * 6, 0, Math.PI * 2); ctx.stroke();
  };

  // hueco de construcción
  S.spot = function (ctx, x, y, pulse) {
    ctx.save(); ctx.translate(x, y);
    blob(ctx, 0, 4, 22, 11, "#b9a684", 2.5);
    blob(ctx, 0, 2, 18, 8.5, "#cbb894", 2);
    ctx.strokeStyle = "#8a7a58"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 4); ctx.moveTo(-4, 6); ctx.lineTo(6, -1); ctx.stroke();
    if (pulse > 0) {
      ctx.strokeStyle = "rgba(245,195,59," + pulse + ")"; ctx.lineWidth = 3;
      pathEllipse(ctx, 0, 3, 26 + (1 - pulse) * 8, 14 + (1 - pulse) * 4); ctx.stroke();
    }
    ctx.restore();
  };

  // ---------- DECORADO ----------
  S.tree = function (ctx, x, y, s, tone) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "rgba(40,25,10,0.18)";
    pathEllipse(ctx, 0, 2, 14, 5); ctx.fill();
    ctx.strokeStyle = "#6b4a26"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -10); ctx.stroke();
    const g = tone ? "#2e6b25" : "#3e8a2e";
    blob(ctx, -7, -16, 10, 9, g, 2.5);
    blob(ctx, 8, -14, 9, 8, g, 2.5);
    blob(ctx, 0, -24, 11, 10, tone ? "#3e8a2e" : "#54a53c", 2.5);
    ctx.restore();
  };
  S.rock = function (ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    blob(ctx, 0, 0, 12, 8, "#a8a294", 2.5);
    blob(ctx, -5, -5, 6, 4.5, "#c2bcae", 2);
    ctx.restore();
  };
  S.bush = function (ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    blob(ctx, 0, 0, 10, 6, "#54a53c", 2);
    ctx.fillStyle = "#d43d2a";
    pathEllipse(ctx, -3, -2, 1.6, 1.6); ctx.fill();
    pathEllipse(ctx, 4, -1, 1.6, 1.6); ctx.fill();
    ctx.restore();
  };
  S.cactus = function (ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "rgba(40,25,10,0.18)";
    pathEllipse(ctx, 0, 2, 10, 4); ctx.fill();
    blob(ctx, 0, -10, 6, 16, "#4a8f4a", 2.5);
    blob(ctx, -8, -8, 4, 8, "#4a8f4a", 2.2);
    blob(ctx, 8, -14, 4, 8, "#4a8f4a", 2.2);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    for (let i = -18; i < 6; i += 6) { ctx.beginPath(); ctx.moveTo(-4, i); ctx.lineTo(4, i); ctx.stroke(); }
    ctx.restore();
  };
  S.ruina = function (ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "rgba(40,25,10,0.18)";
    pathEllipse(ctx, 0, 2, 13, 5); ctx.fill();
    rect(ctx, -6, -22, 12, 24, "#cbb894", 2, 2.5);
    ctx.strokeStyle = "#a8916a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(6, -14); ctx.moveTo(-6, -6); ctx.lineTo(6, -6); ctx.stroke();
    blob(ctx, 10, 0, 7, 5, "#b9a684", 2.2);
    ctx.restore();
  };
  S.pinoNieve = function (ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "rgba(40,25,10,0.18)";
    pathEllipse(ctx, 0, 2, 13, 5); ctx.fill();
    ctx.strokeStyle = "#5a4530"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -8); ctx.stroke();
    ctx.fillStyle = "#2e5c4a"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    for (const [dy, w] of [[-8, 20], [-18, 15], [-27, 10]]) {
      ctx.beginPath(); ctx.moveTo(-w / 2, dy); ctx.lineTo(0, dy - 13); ctx.lineTo(w / 2, dy); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = "#f5fafd";
    for (const [dy, w] of [[-8, 20], [-18, 15], [-27, 10]]) {
      ctx.beginPath(); ctx.moveTo(-w / 2, dy); ctx.lineTo(0, dy - 13); ctx.lineTo(w / 2, dy); ctx.lineTo(w / 2 - 3, dy - 3); ctx.lineTo(0, dy - 10); ctx.lineTo(-w / 2 + 3, dy - 3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  S.flower = function (ctx, x, y) {
    ctx.fillStyle = "#f5e9c8";
    pathEllipse(ctx, x, y, 2.2, 2.2); ctx.fill();
    ctx.fillStyle = "#e8b33b";
    pathEllipse(ctx, x, y, 1, 1); ctx.fill();
  };

  // ---------- PROYECTILES Y EFECTOS ----------
  S.projectile = function (ctx, p, t) {
    ctx.save(); ctx.translate(p.x, p.y);
    if (p.vis === "escarcha") {
      ctx.rotate(p.angle || 0);
      const g = ctx.createLinearGradient(-16, 0, 8, 0);
      g.addColorStop(0, "rgba(190,235,255,0)"); g.addColorStop(1, "#d6f3ff");
      ctx.fillStyle = g;
      pathEllipse(ctx, -6, 0, 14, 5); ctx.fill();
      ctx.fillStyle = "#eaf9ff"; ctx.strokeStyle = "#8fd4ee"; ctx.lineWidth = 1.5;
      blob(ctx, 4, 0, 6.5, 6.5, "#eaf9ff", 1.5);
    } else if (p.vis === "daga") {
      ctx.rotate(t * 14);
      ctx.strokeStyle = "#c8c8d0"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.fillStyle = "#dfe3ea";
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(1, -3); ctx.lineTo(1, 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-12, 0); ctx.stroke();
    } else if (p.kind === "flecha") {
      ctx.rotate(p.angle);
      ctx.strokeStyle = "#6b4a26"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
      ctx.fillStyle = "#c8ccd4";
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill();
    } else if (p.kind === "rayo") {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 8);
      g.addColorStop(0, "#e6f6ff"); g.addColorStop(0.5, "#7cc8ff"); g.addColorStop(1, "rgba(124,200,255,0)");
      ctx.fillStyle = g;
      pathEllipse(ctx, 0, 0, 8, 8); ctx.fill();
    } else if (p.kind === "bomba") {
      // sombra en el suelo mientras vuela
      ctx.fillStyle = "rgba(40,25,10,0.2)";
      pathEllipse(ctx, 0, p.groundY - p.y, 6, 2.5); ctx.fill();
      blob(ctx, 0, 0, 6, 6, "#33363c", 2);
      ctx.strokeStyle = "#e8b33b"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 3, -0.5, 1); ctx.stroke();
    } else if (p.kind === "meteoro") {
      ctx.rotate(p.angle);
      const g = ctx.createLinearGradient(-16, 0, 8, 0);
      g.addColorStop(0, "rgba(255,120,40,0)"); g.addColorStop(1, "#ffd23b");
      ctx.fillStyle = g;
      pathEllipse(ctx, -6, 0, 14, 5); ctx.fill();
      blob(ctx, 4, 0, 6.5, 6.5, "#e06428", 2);
    } else if (p.kind === "hielo") {
      ctx.rotate(t * 10);
      ctx.fillStyle = "#d6f3ff"; ctx.strokeStyle = "#8fd4ee"; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate((Math.PI / 3) * i);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.stroke();
        ctx.restore();
      }
      pathEllipse(ctx, 0, 0, 3, 3); ctx.fill(); ctx.stroke();
    } else if (p.kind === "rayo_cadena") {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 7);
      g.addColorStop(0, "#fffde6"); g.addColorStop(0.5, "#fff59a"); g.addColorStop(1, "rgba(255,245,154,0)");
      ctx.fillStyle = g;
      pathEllipse(ctx, 0, 0, 7, 7); ctx.fill();
    }
    ctx.restore();
  };

  // explosión en anillo
  S.boom = function (ctx, fx) {
    const k = fx.age / fx.dur;
    ctx.strokeStyle = "rgba(255,150,50," + (1 - k) + ")";
    ctx.lineWidth = 5 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,210,80," + (1 - k) * 0.5 + ")";
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * k * 0.7, 0, Math.PI * 2); ctx.fill();
  };
  // nubecita al morir
  S.puff = function (ctx, fx) {
    const k = fx.age / fx.dur;
    ctx.fillStyle = "rgba(240,235,220," + (1 - k) * 0.8 + ")";
    for (let i = 0; i < 3; i++) {
      const a = fx.seed + i * 2.1;
      pathEllipse(ctx, fx.x + Math.cos(a) * 10 * k, fx.y - 8 * k + Math.sin(a) * 6 * k, 7 * (1 - k * 0.5), 6 * (1 - k * 0.5));
      ctx.fill();
    }
  };
  // moneda que sube
  S.coin = function (ctx, fx) {
    const k = fx.age / fx.dur;
    ctx.globalAlpha = 1 - k;
    blob(ctx, fx.x, fx.y - 24 * k, 6, 6, "#f5c33b", 2);
    ctx.fillStyle = "#c79420";
    ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("$", fx.x, fx.y - 24 * k + 3);
    ctx.globalAlpha = 1;
  };
  // número de daño flotante
  S.dmgText = function (ctx, fx) {
    const k = fx.age / fx.dur;
    ctx.globalAlpha = 1 - k;
    ctx.font = "bold 13px 'Chalkboard SE', sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.strokeText(fx.text, fx.x, fx.y - 18 * k);
    ctx.fillStyle = fx.color || "#fff";
    ctx.fillText(fx.text, fx.x, fx.y - 18 * k);
    ctx.globalAlpha = 1;
  };
  // torbellino del caballero
  S.whirl = function (ctx, fx) {
    const k = fx.age / fx.dur;
    ctx.strokeStyle = "rgba(200,220,255," + (1 - k) + ")";
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, (fx.r * 0.4 + i * fx.r * 0.25) * (0.5 + k * 0.8), fx.age * 12 + i, fx.age * 12 + i + 2.2);
      ctx.stroke();
    }
  };
  // destello de curación
  S.healFx = function (ctx, fx) {
    const k = fx.age / fx.dur;
    ctx.fillStyle = "rgba(120,255,140," + (1 - k) * 0.9 + ")";
    ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("+", fx.x, fx.y - 14 * k);
  };
})();
