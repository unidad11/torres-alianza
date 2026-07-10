/* ============================================================
   TORRES ALIANZA — interfaz
   Pantallas, HUD, menú de construcción, héroes, poderes,
   ventanas de victoria/derrota y guardado de progreso.
   ============================================================ */
"use strict";
(function () {
  const UI = TA.ui = {};
  const $ = (id) => document.getElementById(id);

  // ---------- guardado ----------
  const SAVE_KEY = "torres-alianza-v1";
  const SAVE_DEFAULTS = { stars: {}, unlocked: 1, alliancePoints: 0, totalEarnedPoints: 0, heroTalents: {}, tech: {}, hard: false };
  UI.load = function () {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { saved = null; }
    // fusiona con los valores por defecto para que las partidas antiguas no se rompan
    return Object.assign({}, SAVE_DEFAULTS, saved || {});
  };
  UI.save = function (data) { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); };

  // ---------- pantallas ----------
  UI.show = function (name) {
    for (const s of ["scr-title", "scr-map", "scr-game"]) {
      $(s).classList.toggle("visible", s === "scr-" + name);
    }
  };

  // ---------- mapa de niveles ----------
  // posiciones de los nodos sobre el pergamino (en %), una lista por región
  const NODE_POS = {
    bosque:   [[14, 72], [30, 48], [50, 62], [68, 36], [84, 58]],
    desierto: [[10, 62], [24, 32], [40, 58], [54, 30], [68, 55], [80, 30], [90, 62]],
    montana:  [[16, 60], [50, 32], [84, 58]],
  };
  let mapRegion = "bosque";

  function trailD(positions) {
    return positions.map((p, i) => (i === 0 ? "M " : "L ") + p[0] + " " + p[1]).join(" ");
  }

  UI.buildMap = function () {
    const wrap = $("map-nodes");
    wrap.innerHTML = "";
    const save = UI.load();
    const positions = NODE_POS[mapRegion];
    const levels = TA.LEVELS.filter(lv => (lv.region || "bosque") === mapRegion);
    $("ap-count").textContent = save.alliancePoints;
    $("btn-hard").textContent = save.hard ? "☠ Difícil" : "⚔ Normal";
    $("btn-hard").classList.toggle("active", save.hard);
    $("map-trail").querySelector("path").setAttribute("d", trailD(positions));
    $("btn-region-bosque").classList.toggle("active", mapRegion === "bosque");
    $("btn-region-desierto").classList.toggle("active", mapRegion === "desierto");
    $("btn-region-montana").classList.toggle("active", mapRegion === "montana");
    levels.forEach((lv, i) => {
      const node = document.createElement("button");
      node.className = "map-node";
      node.style.left = positions[i][0] + "%";
      node.style.top = positions[i][1] + "%";
      const locked = lv.id > save.unlocked;
      if (locked) {
        node.classList.add("locked");
        node.innerHTML = "<span class='node-num'>🔒</span>";
      } else {
        const stars = save.stars[lv.id] || 0;
        node.innerHTML =
          "<span class='node-num'>" + lv.id + "</span>" +
          "<span class='node-stars'>" +
          "★".repeat(stars) + "<i>" + "★".repeat(3 - stars) + "</i>" +
          "</span>";
        node.addEventListener("click", () => UI.openHeroPick(lv));
      }
      node.setAttribute("aria-label", "Nivel " + lv.id + ": " + lv.name);
      wrap.appendChild(node);
    });
  };

  // ---------- partida ----------
  let game = null, terrain = null, selection = null;
  let targeting = null;   // 'refuerzos' | 'meteoro' | 'rally'
  let rallyTower = null;
  let canvasScale = 1;

  // ---------- elección de héroes ----------
  function heroCard(type) {
    return miniCanvas(46, 46, (ctx) => {
      ctx.translate(23, 36); ctx.scale(1.15, 1.15);
      const d = TA.HEROES[type];
      const fake = { type, x: 0, y: 0, selected: false, moving: false, dead: false, hp: d.hp, maxHp: d.hp, flip: false };
      TA.sprites.hero(ctx, fake, 0.3);
    });
  }

  UI.openHeroPick = function (levelDef) {
    const save = UI.load();
    const picked = [];
    const m = $("modal");
    function renderPick() {
      m.innerHTML =
        "<div class='modal-card'><h2>Elige tu escuadra</h2>" +
        "<p>" + levelDef.id + ". " + levelDef.name + "</p>" +
        "<div class='hero-pick' id='hp-list'></div>" +
        "<div class='modal-btns'><button class='btn wood' id='hp-cancel'>Cancelar</button>" +
        "<button class='btn gold' id='hp-go'>Empezar</button></div></div>";
      const list = $("hp-list");
      for (const type in TA.HEROES) {
        const h = TA.HEROES[type];
        const unlocked = !h.unlockLevel || save.unlocked >= h.unlockLevel;
        const btn = document.createElement("button");
        btn.className = "hp-btn" + (picked.includes(type) ? " sel" : "") + (unlocked ? "" : " locked");
        if (unlocked) {
          btn.appendChild(heroCard(type));
          btn.insertAdjacentHTML("beforeend", "<span class='bm-name'>" + h.name + "</span>");
          btn.addEventListener("click", () => {
            const idx = picked.indexOf(type);
            if (idx >= 0) picked.splice(idx, 1);
            else if (picked.length < 2) picked.push(type);
            renderPick();
          });
        } else {
          btn.disabled = true;
          btn.innerHTML = "<span class='hp-lock'>🔒</span><span class='bm-name'>" + h.name + "</span><small>Nivel " + h.unlockLevel + "</small>";
        }
        list.appendChild(btn);
      }
      const go = $("hp-go");
      go.disabled = picked.length !== 2;
      go.addEventListener("click", () => {
        if (picked.length === 2) { m.classList.remove("open"); UI.startLevel(levelDef, picked.slice()); }
      });
      $("hp-cancel").addEventListener("click", () => m.classList.remove("open"));
    }
    renderPick();
    m.classList.add("open");
  };

  // ---------- progresión permanente: talentos de héroe + tecnología ----------
  let progTab = "heroes";
  UI.openProgression = function () {
    const m = $("modal");
    function render() {
      const save = UI.load();
      let html = "<div class='modal-card prog-card'><h2>Progresión de la Alianza</h2>" +
        "<p class='ap-earned'>💎 " + save.alliancePoints + " Puntos de Alianza</p>" +
        "<div class='prog-tabs'>" +
        "<button class='btn wood small" + (progTab === "heroes" ? " active" : "") + "' id='pt-heroes'>Héroes</button>" +
        "<button class='btn wood small" + (progTab === "tech" ? " active" : "") + "' id='pt-tech'>Tecnología</button>" +
        "<button class='btn wood small" + (progTab === "logros" ? " active" : "") + "' id='pt-logros'>Logros</button>" +
        "</div><div id='prog-body'></div>" +
        "<div class='modal-btns'><button class='btn wood' id='prog-close'>Cerrar</button></div></div>";
      m.innerHTML = html;
      const body = $("prog-body");

      if (progTab === "heroes") {
        for (const type in TA.HEROES) {
          const h = TA.HEROES[type];
          if (h.unlockLevel && save.unlocked < h.unlockLevel) continue;
          if (!h.talents) continue;
          const bought = save.heroTalents[type] || [];
          const box = document.createElement("div");
          box.className = "prog-hero";
          box.innerHTML = "<h3>" + h.name + "</h3>";
          for (const key in h.talents) {
            const t = h.talents[key];
            const has = bought.includes(key);
            const node = document.createElement("button");
            node.className = "prog-node" + (has ? " bought" : "");
            node.innerHTML = "<b>" + t.name + "</b><small>" + t.desc + "</small>" +
              (has ? "<span class='prog-cost'>✅ comprado</span>" : "<span class='prog-cost'>💎 " + t.cost + "</span>");
            if (!has) {
              if (save.alliancePoints < t.cost) node.classList.add("poor");
              node.addEventListener("click", () => {
                const s2 = UI.load();
                if (s2.alliancePoints < t.cost) return;
                s2.alliancePoints -= t.cost;
                s2.heroTalents[type] = [...(s2.heroTalents[type] || []), key];
                UI.save(s2);
                render();
              });
            } else {
              node.disabled = true;
            }
            box.appendChild(node);
          }
          body.appendChild(box);
        }
      } else if (progTab === "logros") {
        const box = document.createElement("div");
        box.className = "prog-hero";
        for (const a of TA.ACHIEVEMENTS) {
          const has = a.check(save);
          const node = document.createElement("div");
          node.className = "prog-node" + (has ? " bought" : "");
          node.innerHTML = "<b>" + (has ? "🏆 " : "🔒 ") + a.name + "</b><small>" + a.desc + "</small>";
          box.appendChild(node);
        }
        body.appendChild(box);
      } else {
        const box = document.createElement("div");
        box.className = "prog-hero";
        for (const key in TA.TECH) {
          const t = TA.TECH[key];
          const has = !!save.tech[key];
          const node = document.createElement("button");
          node.className = "prog-node" + (has ? " bought" : "");
          node.innerHTML = "<b>" + t.name + "</b><small>" + t.desc + "</small>" +
            (has ? "<span class='prog-cost'>✅ comprado</span>" : "<span class='prog-cost'>💎 " + t.cost + "</span>");
          if (!has) {
            if (save.alliancePoints < t.cost) node.classList.add("poor");
            node.addEventListener("click", () => {
              const s2 = UI.load();
              if (s2.alliancePoints < t.cost) return;
              s2.alliancePoints -= t.cost;
              s2.tech[key] = true;
              UI.save(s2);
              render();
            });
          } else {
            node.disabled = true;
          }
          box.appendChild(node);
        }
        body.appendChild(box);
      }

      $("pt-heroes").addEventListener("click", () => { progTab = "heroes"; render(); });
      $("pt-tech").addEventListener("click", () => { progTab = "tech"; render(); });
      $("pt-logros").addEventListener("click", () => { progTab = "logros"; render(); });
      $("prog-close").addEventListener("click", () => { m.classList.remove("open"); UI.buildMap(); });
    }
    render();
    m.classList.add("open");
  };

  UI.startLevel = function (levelDef, heroTypes) {
    const save = UI.load();
    const progression = { heroTalents: save.heroTalents, tech: save.tech, hard: save.hard };
    game = new TA.Game(levelDef, heroTypes || ["roldan", "lyra"], progression);
    TA.currentGame = game;
    terrain = TA.buildTerrain(levelDef, game.paths);
    selection = null; targeting = null; rallyTower = null;
    game.onEvent = onGameEvent;
    $("hud-level-name").textContent = levelDef.id + ". " + levelDef.name;
    $("build-menu").classList.remove("open");
    $("modal").classList.remove("open");
    buildHeroBar();
    buildPowerBar();
    updateHud();
    UI.show("game");
    resize(); // el contenedor ya es visible: ajustar el lienzo ahora
    game.paused = false;
    TA.audio.startMusic();
  };

  function playEventSound(ev, data) {
    switch (ev) {
      case "shot": TA.audio.play("shot_" + data.kind); break;
      case "hit": TA.audio.play("hit"); break;
      case "kill": TA.audio.play(data.boss ? "kill_boss" : "kill"); break;
      case "ability": TA.audio.play("ability"); break;
      case "build": TA.audio.play("build"); break;
      case "gold": TA.audio.play("coin"); break;
      case "wave": TA.audio.play("wave"); break;
      case "lives": TA.audio.play("lives_lost"); break;
      case "heroDown": TA.audio.play("hero_down"); break;
      case "heroUp": TA.audio.play("hero_up"); break;
      case "victory": TA.audio.stopMusic(); TA.audio.play("victory"); break;
      case "defeat": TA.audio.stopMusic(); TA.audio.play("defeat"); break;
    }
  }

  function onGameEvent(ev, data) {
    playEventSound(ev, data);
    if (ev === "victory") {
      const save = UI.load();
      const prev = save.stars[game.def.id] || 0;
      save.stars[game.def.id] = Math.max(prev, data.stars);
      save.unlocked = Math.max(save.unlocked, Math.min(game.def.id + 1, TA.LEVELS.length));
      const earned = Math.round((10 + data.stars * 5) * (game.hardMode ? 1.6 : 1));
      save.alliancePoints = (save.alliancePoints || 0) + earned;
      save.totalEarnedPoints = (save.totalEarnedPoints || 0) + earned;
      UI.save(save);
      showEndModal(true, data.stars, earned);
    } else if (ev === "defeat") {
      showEndModal(false, 0);
    }
  }

  function showEndModal(won, stars, earned) {
    const m = $("modal");
    const nextDef = TA.LEVELS.find(l => l.id === game.def.id + 1);
    let html = "<div class='modal-card'>";
    if (won) {
      html += "<h2>¡Victoria!</h2>";
      html += "<div class='modal-stars'>" +
        [1, 2, 3].map(i => "<span class='star " + (i <= stars ? "on" : "") + "' style='animation-delay:" + (i * 0.25) + "s'>★</span>").join("") +
        "</div>";
      html += "<p>Has aguantado con " + game.lives + " vidas.</p>";
      html += "<p class='ap-earned'>💎 +" + earned + " Puntos de Alianza</p>";
      html += "<div class='modal-btns'>";
      html += "<button class='btn wood' id='m-map'>Mapa</button>";
      html += "<button class='btn wood' id='m-retry'>Repetir</button>";
      if (nextDef) html += "<button class='btn gold' id='m-next'>Siguiente ▶</button>";
      html += "</div>";
    } else {
      html += "<h2 class='ko'>Derrota…</h2>";
      html += "<p>Los enemigos han arrasado la aldea. ¡Prueba otra estrategia!</p>";
      html += "<div class='modal-btns'>";
      html += "<button class='btn wood' id='m-map'>Mapa</button>";
      html += "<button class='btn gold' id='m-retry'>Reintentar</button>";
      html += "</div>";
    }
    html += "</div>";
    m.innerHTML = html;
    m.classList.add("open");
    $("m-map").addEventListener("click", () => { m.classList.remove("open"); UI.buildMap(); UI.show("map"); });
    $("m-retry").addEventListener("click", () => UI.startLevel(game.def, game.heroTypes));
    if (won && nextDef) $("m-next").addEventListener("click", () => { m.classList.remove("open"); UI.openHeroPick(nextDef); });
  }

  // ---------- HUD ----------
  function updateHud() {
    if (!game) return;
    $("hud-lives").textContent = Math.max(0, game.lives);
    $("hud-gold").textContent = game.gold;
    $("hud-wave").textContent = Math.max(1, game.waveIdx + 1) + "/" + game.def.waves.length;
    $("btn-speed").textContent = "▶▶" + (game.speed === 2 ? " x2" : "");
    $("btn-speed").classList.toggle("active", game.speed === 2);
    $("btn-pause").textContent = game.paused ? "▶" : "❚❚";

    // botón de oleada anticipada
    const btn = $("wave-call");
    const moreWaves = game.waveIdx + 1 < game.def.waves.length;
    const counting = moreWaves && game.spawning.length === 0 && game.waveTimer > 0 && !game.over;
    btn.classList.toggle("show", counting);
    if (counting) {
      btn.innerHTML = "⚔ ¡Oleada " + (game.waveIdx + 2) + " en " + Math.ceil(game.waveTimer) +
        "s!<small>toca para llamarla y ganar oro</small>";
    }

    // héroes y poderes
    game.heroes.forEach((h, i) => {
      const el = $("hero-" + i); if (!el) return;
      el.classList.toggle("dead", h.dead);
      el.classList.toggle("selected", h.selected);
      const bar = el.querySelector(".hp-fill");
      bar.style.width = Math.max(0, (h.hp / h.maxHp) * 100) + "%";
      el.querySelector(".respawn").textContent = h.dead ? Math.ceil(h.respawnT) : "";
    });
    for (const k of ["refuerzos", "meteoro"]) {
      const el = $("pow-" + k); if (!el) continue;
      const cd = game.powerCd[k], max = TA.POWERS[k].cd;
      el.classList.toggle("cooling", cd > 0);
      el.classList.toggle("armed", targeting === k);
      el.querySelector(".cd-mask").style.height = (cd / max * 100) + "%";
      el.querySelector(".cd-num").textContent = cd > 0 ? Math.ceil(cd) : "";
    }
  }
  UI.updateHud = updateHud;

  // ---------- barras de héroes y poderes ----------
  function miniCanvas(w, h, draw) {
    const cv = document.createElement("canvas");
    cv.width = w * 2; cv.height = h * 2; // nítido en pantallas retina
    cv.style.width = w + "px"; cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    ctx.scale(2, 2);
    draw(ctx);
    return cv;
  }

  function buildHeroBar() {
    const bar = $("heroes-bar");
    bar.innerHTML = "";
    game.heroes.forEach((h, i) => {
      const el = document.createElement("button");
      el.className = "hero-btn";
      el.id = "hero-" + i;
      el.appendChild(miniCanvas(46, 46, (ctx) => {
        ctx.translate(23, 36); ctx.scale(1.15, 1.15);
        const fake = { ...h, x: 0, y: 0, selected: false, moving: false, dead: false, hp: h.maxHp };
        TA.sprites.hero(ctx, fake, 0.3);
      }));
      el.insertAdjacentHTML("beforeend",
        "<span class='hp-bar'><span class='hp-fill'></span></span><span class='respawn'></span>");
      el.addEventListener("click", () => selectHero(h));
      bar.appendChild(el);
    });
  }

  function selectHero(h) {
    if (h.dead) return;
    const was = h.selected;
    game.heroes.forEach(x => x.selected = false);
    h.selected = !was;
    targeting = null; closeBuildMenu();
  }

  function buildPowerBar() {
    const bar = $("powers-bar");
    bar.innerHTML = "";
    const icons = { refuerzos: "🛡", meteoro: "☄" };
    for (const k of ["refuerzos", "meteoro"]) {
      const el = document.createElement("button");
      el.className = "power-btn";
      el.id = "pow-" + k;
      el.innerHTML = "<span class='pow-icon'>" + icons[k] + "</span>" +
        "<span class='cd-mask'></span><span class='cd-num'></span>";
      el.title = TA.POWERS[k].name;
      el.addEventListener("click", () => {
        if (game.powerCd[k] > 0) return;
        targeting = targeting === k ? null : k;
        game.heroes.forEach(x => x.selected = false);
        closeBuildMenu();
      });
      bar.appendChild(el);
    }
  }

  // ---------- menú de construcción ----------
  function towerIcon(type, level) {
    return miniCanvas(46, 40, (ctx) => {
      ctx.translate(23, 32); ctx.scale(0.62, 0.62);
      const fake = { type, level: level || 0, x: 0, y: 0, aimAngle: -0.5 };
      TA.sprites.tower(ctx, fake, 0.3);
    });
  }

  function openBuildMenu(spot) {
    const menu = $("build-menu");
    menu.innerHTML = "";
    selection = { x: spot.x, y: spot.y, range: 130 };
    for (const type of ["arqueros", "cuartel", "magos", "canon", "hielo", "electrica", "apoyo"]) {
      const def = TA.TOWERS[type];
      const cost = def.levels[0].cost;
      const b = document.createElement("button");
      b.className = "bm-btn" + (game.gold < cost ? " poor" : "");
      b.appendChild(towerIcon(type));
      b.insertAdjacentHTML("beforeend",
        "<span class='bm-name'>" + def.name + "</span><span class='bm-cost'>🪙" + cost + "</span>");
      b.addEventListener("click", () => {
        if (game.buildTower(spot, type)) closeBuildMenu();
      });
      menu.appendChild(b);
    }
    placeMenu(menu, spot.x, spot.y);
  }

  function openTowerMenu(tw) {
    const menu = $("build-menu");
    menu.innerHTML = "";
    const def = TA.TOWERS[tw.type];
    const lvl = game.towerStats(tw);
    selection = { x: tw.x, y: tw.y, range: lvl.range || 0, rally: tw.rally || null };

    const info = document.createElement("div");
    info.className = "bm-info";
    const branchLine = tw.branch
      ? "<br><small>🌟 " + def.branches[tw.branch].name + (tw.mastered ? " · ⭐ " + def.branches[tw.branch].mastery.name : "") + "</small>"
      : "";
    info.innerHTML = "<b>" + def.name + "</b> nivel " + (tw.level + 1) + branchLine + "<br><small>" + def.desc + "</small>";
    menu.appendChild(info);

    if (tw.level < 2) {
      const cost = def.levels[tw.level + 1].cost;
      const b = document.createElement("button");
      b.className = "bm-btn" + (game.gold < cost ? " poor" : "");
      b.appendChild(towerIcon(tw.type, tw.level + 1));
      b.insertAdjacentHTML("beforeend",
        "<span class='bm-name'>Mejorar</span><span class='bm-cost'>🪙" + cost + "</span>");
      b.addEventListener("click", () => {
        if (game.upgradeTower(tw)) openTowerMenu(tw);
      });
      menu.appendChild(b);
    } else if (!tw.branch && def.branches) {
      for (const key in def.branches) {
        const br = def.branches[key];
        const b = document.createElement("button");
        b.className = "bm-btn" + (game.gold < br.cost ? " poor" : "");
        b.appendChild(towerIcon(tw.type, 2));
        b.insertAdjacentHTML("beforeend",
          "<span class='bm-name'>" + br.name + "</span><span class='bm-cost'>🪙" + br.cost + "</span>");
        b.title = br.desc;
        b.addEventListener("click", () => {
          if (game.chooseBranch(tw, key)) openTowerMenu(tw);
        });
        menu.appendChild(b);
      }
    } else if (tw.branch && !tw.mastered) {
      const m = def.branches[tw.branch].mastery;
      const b = document.createElement("button");
      b.className = "bm-btn" + (game.gold < m.cost ? " poor" : "");
      b.appendChild(towerIcon(tw.type, 2));
      b.insertAdjacentHTML("beforeend",
        "<span class='bm-name'>⭐ " + m.name + "</span><span class='bm-cost'>🪙" + m.cost + "</span>");
      b.title = m.desc;
      b.addEventListener("click", () => {
        if (game.buyMastery(tw)) openTowerMenu(tw);
      });
      menu.appendChild(b);
    }
    if (tw.type === "cuartel") {
      const b = document.createElement("button");
      b.className = "bm-btn";
      b.innerHTML = "<span class='pow-icon'>🚩</span><span class='bm-name'>Mover bandera</span>";
      b.addEventListener("click", () => {
        targeting = "rally"; rallyTower = tw; closeBuildMenu(true);
      });
      menu.appendChild(b);
    }
    const sell = document.createElement("button");
    sell.className = "bm-btn sell";
    sell.innerHTML = "<span class='pow-icon'>💰</span><span class='bm-name'>Vender</span>" +
      "<span class='bm-cost'>+" + Math.round(tw.spent * TA.SELL_RATIO) + "</span>";
    sell.addEventListener("click", () => { game.sellTower(tw); closeBuildMenu(); });
    menu.appendChild(sell);

    placeMenu(menu, tw.x, tw.y);
  }

  function placeMenu(menu, cx, cy) {
    menu.classList.add("open");
    const holder = $("cv-holder");
    // coordenadas de lienzo → píxeles dentro del contenedor
    // (el lienzo queda centrado, así que hay que sumar su desplazamiento)
    const cvRect = $("cv").getBoundingClientRect();
    const hRect = holder.getBoundingClientRect();
    const px = cvRect.left - hRect.left + cx * canvasScale;
    const py = cvRect.top - hRect.top + cy * canvasScale;
    menu.style.left = Math.max(8, Math.min(holder.clientWidth - menu.offsetWidth - 8, px - menu.offsetWidth / 2)) + "px";
    const above = py - menu.offsetHeight - 46 * canvasScale;
    menu.style.top = Math.max(8, above > 8 ? above : py + 40 * canvasScale) + "px";
  }

  function closeBuildMenu(keepSel) {
    $("build-menu").classList.remove("open");
    if (!keepSel) selection = null;
  }

  // ---------- entrada táctil / ratón ----------
  function canvasPoint(ev) {
    const rect = $("cv").getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) / rect.width * TA.W,
      y: (ev.clientY - rect.top) / rect.height * TA.H,
    };
  }

  function onTap(ev) {
    if (!game || game.over) return;
    const p = canvasPoint(ev);

    // 1) modos de puntería (poderes / bandera)
    if (targeting === "refuerzos") { if (game.castRefuerzos(p.x, p.y)) targeting = null; return; }
    if (targeting === "meteoro") { if (game.castMeteoro(p.x, p.y)) targeting = null; return; }
    if (targeting === "rally" && rallyTower) {
      game.setRally(rallyTower, p.x, p.y);
      targeting = null; rallyTower = null; selection = null;
      return;
    }

    // 2) ¿ha tocado un héroe?
    for (const h of game.heroes) {
      if (!h.dead && Math.hypot(h.x - p.x, h.y - p.y) < 24) { selectHero(h); return; }
    }

    // 3) héroe seleccionado → orden de movimiento
    const sel = game.heroes.find(h => h.selected);
    if (sel) {
      sel.tx = Math.max(16, Math.min(TA.W - 16, p.x));
      sel.ty = Math.max(16, Math.min(TA.H - 16, p.y));
      if (sel.engaged) { if (sel.engaged.blocker === sel) sel.engaged.blocker = null; sel.engaged = null; }
      return;
    }

    // 4) ¿hueco o torre?
    for (const spot of game.spots) {
      if (Math.hypot(spot.x - p.x, spot.y - p.y) < 30) {
        if (spot.tower) openTowerMenu(spot.tower);
        else openBuildMenu(spot);
        return;
      }
    }

    // 5) nada: cerrar menús
    closeBuildMenu();
    targeting = null;
  }

  // ---------- ajuste de tamaño ----------
  function resize() {
    const holder = $("cv-holder");
    const w = holder.clientWidth, h = holder.clientHeight;
    canvasScale = Math.min(w / TA.W, h / TA.H);
    const cv = $("cv");
    cv.style.width = (TA.W * canvasScale) + "px";
    cv.style.height = (TA.H * canvasScale) + "px";
  }

  // ---------- arranque de la interfaz ----------
  UI.init = function () {
    const cv = $("cv");
    cv.width = TA.W; cv.height = TA.H;
    UI.ctx = cv.getContext("2d");

    // el audio necesita un toque real del usuario para arrancar (norma de iOS/Safari)
    window.addEventListener("pointerdown", TA.audio.unlock, { once: true });
    $("btn-mute").textContent = TA.audio.isMuted() ? "🔇" : "🔊";
    $("btn-mute").addEventListener("click", () => {
      const muted = TA.audio.toggleMute();
      $("btn-mute").textContent = muted ? "🔇" : "🔊";
    });
    // pequeño clic en todos los botones de navegación (no en los del propio tablero de juego)
    document.addEventListener("click", (e) => {
      if (e.target.closest(".btn")) TA.audio.play("button");
    });

    $("btn-play").addEventListener("click", () => { UI.buildMap(); UI.show("map"); });
    $("btn-region-bosque").addEventListener("click", () => { mapRegion = "bosque"; UI.buildMap(); });
    $("btn-region-desierto").addEventListener("click", () => { mapRegion = "desierto"; UI.buildMap(); });
    $("btn-region-montana").addEventListener("click", () => { mapRegion = "montana"; UI.buildMap(); });
    $("btn-progression").addEventListener("click", () => UI.openProgression());
    $("btn-hard").addEventListener("click", () => {
      const save = UI.load();
      save.hard = !save.hard;
      UI.save(save);
      UI.buildMap();
    });
    $("btn-map-back").addEventListener("click", () => UI.show("title"));
    $("btn-home").addEventListener("click", () => {
      if (game) game.paused = true;
      TA.audio.stopMusic();
      UI.buildMap(); UI.show("map");
    });
    $("btn-pause").addEventListener("click", () => { if (game && !game.over) game.paused = !game.paused; });
    $("btn-speed").addEventListener("click", () => { if (game) game.speed = game.speed === 1 ? 2 : 1; });
    $("wave-call").addEventListener("click", () => { if (game) game.startNextWave(true); });
    cv.addEventListener("pointerdown", onTap);

    window.addEventListener("resize", resize);
    resize();
  };

  UI.frame = function () {
    if (game && document.getElementById("scr-game").classList.contains("visible")) {
      TA.render(UI.ctx, game, terrain, selection);
      updateHud();
    }
  };
  UI.getGame = () => game;
})();
