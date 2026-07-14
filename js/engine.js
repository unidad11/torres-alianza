/* ============================================================
   TORRES ALIANZA — motor del juego
   Movimiento por caminos, combate cuerpo a cuerpo y a distancia,
   oleadas, proyectiles, héroes, poderes y efectos.
   ============================================================ */
"use strict";
(function () {

  // ---------- utilidades ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (arr) => Math.round(rand(arr[0], arr[1]));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  TA.rand = rand;

  // generador aleatorio con semilla (para que el decorado sea siempre igual)
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- caminos ----------
  function buildPath(points) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ x1, y1, x2, y2, len, start: total });
      total += len;
    }
    return {
      points, segs, total,
      at(s) {
        s = Math.max(0, Math.min(s, this.total - 0.01));
        let seg = this.segs[this.segs.length - 1];
        for (const g of this.segs) if (s >= g.start && s <= g.start + g.len) { seg = g; break; }
        const k = (s - seg.start) / seg.len;
        const dx = (seg.x2 - seg.x1) / seg.len, dy = (seg.y2 - seg.y1) / seg.len;
        return { x: seg.x1 + (seg.x2 - seg.x1) * k, y: seg.y1 + (seg.y2 - seg.y1) * k, dx, dy, nx: -dy, ny: dx };
      },
    };
  }

  // ---------- caminos con bifurcación ----------
  // Un nivel puede definir "trunk" (tramo común) + "forkOptions" (2+ continuaciones
  // posibles desde el final del tramo común). Se resuelve en caminos completos
  // independientes para reutilizar todo el motor tal cual.
  function buildLevelPaths(levelDef) {
    if (levelDef.trunk) {
      return levelDef.forkOptions.map((opt) => buildPath(levelDef.trunk.concat(opt)));
    }
    return levelDef.paths.map(buildPath);
  }

  // ---------- clase principal ----------
  class Game {
    constructor(levelDef, heroTypes, progression) {
      this.def = levelDef;
      this.paths = buildLevelPaths(levelDef);
      this.forked = !!levelDef.trunk;
      this.forkRng = mulberry32(levelDef.seed * 777 + 3);
      this.progression = progression || { heroTalents: {}, tech: {}, hard: false };
      this.hardMode = !!this.progression.hard;
      this.gold = Math.round(levelDef.gold * (1 + this.techSum("goldPct")) * (this.hardMode ? 0.85 : 1));
      this.lives = levelDef.lives;
      this.time = 0;
      this.speed = 1;
      this.paused = false;
      this.over = false;

      this.enemies = [];
      this.towers = [];   // {type, level, x, y, spotIdx, cd, spent, rally, soldiers[], respawnT}
      this.units = [];    // soldados, milicianos y héroes
      this.projectiles = [];
      this.effects = [];
      this.spots = levelDef.spots.map(([x, y], i) => ({ x, y, i, tower: null }));

      // oleadas
      this.waveIdx = -1;            // aún no ha empezado ninguna
      this.waveTimer = 12;          // cuenta atrás para la primera
      this.spawning = [];           // grupos activos {def, spawned, timer, wait}
      this.allSpawned = false;

      // poderes del jugador
      this.powerCd = { refuerzos: 0, meteoro: 0 };

      // héroes
      this.heroTypes = heroTypes;
      this.heroes = heroTypes.map((ht, i) => this.makeHero(ht, i));
      this.units.push(...this.heroes);

      this.onEvent = null; // lo engancha la interfaz
    }

    emit(ev, data) { if (this.onEvent) this.onEvent(ev, data); }

    // suma de un mismo efecto entre todas las tecnologías compradas
    techSum(field) {
      let s = 0;
      for (const key in TA.TECH) {
        if (this.progression.tech[key] && TA.TECH[key][field]) s += TA.TECH[key][field];
      }
      return s;
    }

    // ----- héroes -----
    makeHero(type, i) {
      const base = TA.HEROES[type];
      const talentKeys = (this.progression.heroTalents && this.progression.heroTalents[type]) || [];
      let hp = base.hp, dmg = [...base.dmg], abilityDmg = base.ability.dmg, abilityCd = base.ability.cd;
      for (const key of talentKeys) {
        const t = base.talents && base.talents[key];
        if (!t) continue;
        if (t.hpBonus) hp += t.hpBonus;
        if (t.dmgPct) dmg = [dmg[0] * (1 + t.dmgPct), dmg[1] * (1 + t.dmgPct)];
        if (t.abilityPct) abilityDmg *= (1 + t.abilityPct);
        if (t.cdPct) abilityCd *= (1 - t.cdPct);
      }
      hp = Math.round(hp * (1 + this.techSum("heroHpPct")));
      const dmgMul = 1 + this.techSum("heroDmgPct");
      dmg = [Math.round(dmg[0] * dmgMul), Math.round(dmg[1] * dmgMul)];
      const d = { ...base, hp, dmg, ability: { ...base.ability, dmg: Math.round(abilityDmg), cd: abilityCd } };

      const start = this.paths[0].at(this.paths[0].total * 0.65);
      return {
        kindU: "hero", type, def: d, hp: d.hp, maxHp: d.hp,
        x: start.x + (i ? 40 : -40), y: start.y + 40,
        tx: null, ty: null, moving: false, flip: false, selected: false,
        atkCd: 0, abilityCd: d.ability.cd * 0.5, engaged: null,
        dead: false, respawnT: 0, animSeed: Math.random() * 10,
      };
    }

    // ----- torres -----
    buildTower(spot, type) {
      const def = TA.TOWERS[type];
      const cost = def.levels[0].cost;
      if (this.gold < cost || spot.tower) return false;
      this.gold -= cost;
      const tw = {
        type, level: 0, branch: null, mastered: false, x: spot.x, y: spot.y, spot, cd: rand(0.2, 0.6),
        spent: cost, soldiers: [], respawnT: 0, aimAngle: -0.5,
      };
      if (type === "cuartel") {
        const p = this.nearestPathPoint(spot.x, spot.y);
        tw.rally = { x: p.x, y: p.y };
        this.spawnSoldiers(tw, 3);
      }
      spot.tower = tw;
      this.towers.push(tw);
      this.emit("gold");
      this.emit("build");
      return true;
    }

    upgradeTower(tw) {
      const def = TA.TOWERS[tw.type];
      if (tw.level >= 2) return false;
      const cost = def.levels[tw.level + 1].cost;
      if (this.gold < cost) return false;
      this.gold -= cost;
      tw.spent += cost;
      tw.level++;
      if (tw.type === "cuartel") {
        // los soldados vivos se curan y mejoran
        for (const s of tw.soldiers) if (!s.dead) {
          const sd = def.levels[tw.level].soldier;
          s.maxHp = sd.hp; s.hp = sd.hp; s.dmg = sd.dmg; s.rate = sd.rate;
        }
      }
      this.emit("gold");
      return true;
    }

    // estadísticas efectivas de una torre (nivel máximo + rama + maestría si las tiene,
    // más el bono de las torres de Apoyo cercanas)
    towerStats(tw) {
      const def = TA.TOWERS[tw.type];
      let base = tw.branch ? { ...def.levels[2], ...def.branches[tw.branch] } : def.levels[tw.level];
      if (tw.branch && tw.mastered) base = { ...base, ...def.branches[tw.branch].mastery };
      if (def.support || tw.type === "cuartel") return base;
      let dmgMul = 1 + this.techSum("dmgPct"), rateMul = 1 - this.techSum("ratePct"), rangeMul = 1 + this.techSum("rangePct");
      for (const other of this.towers) {
        const odef = TA.TOWERS[other.type];
        if (other === tw || !odef.support) continue;
        const ostats = this.towerStats(other);
        if (dist(tw, other) <= ostats.range) { dmgMul += ostats.dmgBonus; rateMul -= ostats.rateBonus; }
      }
      rateMul = Math.max(0.25, rateMul);
      return { ...base, dmg: [Math.round(base.dmg[0] * dmgMul), Math.round(base.dmg[1] * dmgMul)], rate: base.rate * rateMul, range: base.range * rangeMul };
    }

    chooseBranch(tw, key) {
      const def = TA.TOWERS[tw.type];
      const b = def.branches && def.branches[key];
      if (!b || tw.level < 2 || tw.branch || this.gold < b.cost) return false;
      this.gold -= b.cost;
      tw.spent += b.cost;
      tw.branch = key;
      if (tw.type === "cuartel") {
        for (const s of tw.soldiers) if (!s.dead) {
          s.maxHp = b.soldier.hp; s.hp = b.soldier.hp; s.dmg = b.soldier.dmg; s.rate = b.soldier.rate;
        }
      }
      this.emit("gold");
      return true;
    }

    buyMastery(tw) {
      const def = TA.TOWERS[tw.type];
      const b = tw.branch && def.branches[tw.branch];
      const m = b && b.mastery;
      if (!m || tw.mastered || this.gold < m.cost) return false;
      this.gold -= m.cost;
      tw.spent += m.cost;
      tw.mastered = true;
      if (tw.type === "cuartel") {
        for (const s of tw.soldiers) if (!s.dead) {
          s.maxHp = m.soldier.hp; s.hp = m.soldier.hp; s.dmg = m.soldier.dmg; s.rate = m.soldier.rate;
        }
      }
      this.emit("gold");
      return true;
    }

    sellTower(tw) {
      const refund = Math.round(tw.spent * TA.SELL_RATIO);
      this.gold += refund;
      tw.spot.tower = null;
      this.towers = this.towers.filter(t => t !== tw);
      for (const s of tw.soldiers) s.dead = true;
      this.units = this.units.filter(u => !(u.kindU === "soldier" && u.tower === tw));
      this.effects.push({ kind: "coin", x: tw.x, y: tw.y - 20, age: 0, dur: 0.8 });
      this.emit("gold");
      return refund;
    }

    nearestPathPoint(x, y) {
      let best = null, bd = 1e9;
      for (const path of this.paths) {
        for (let s = 0; s < path.total; s += 12) {
          const p = path.at(s);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bd) { bd = d; best = p; }
        }
      }
      return best;
    }

    setRally(tw, x, y) {
      const def = TA.TOWERS.cuartel;
      const d = Math.hypot(x - tw.x, y - tw.y);
      if (d > def.rallyRadius) {
        const k = def.rallyRadius / d;
        x = tw.x + (x - tw.x) * k; y = tw.y + (y - tw.y) * k;
      }
      tw.rally = { x, y };
      let n = 0;
      for (const s of tw.soldiers) if (!s.dead) {
        s.anchor = { x: x + (n - 1) * 16, y: y + (n % 2) * 12 };
        n++;
      }
    }

    spawnSoldiers(tw, count) {
      const sd = this.towerStats(tw).soldier;
      for (let i = 0; i < count; i++) {
        if (tw.soldiers.filter(s => !s.dead).length >= 3) break;
        const u = {
          kindU: "soldier", tower: tw, def: sd,
          hp: sd.hp, maxHp: sd.hp, dmg: sd.dmg, rate: sd.rate,
          x: tw.x, y: tw.y + 10,
          anchor: { x: tw.rally.x + (i - 1) * 16, y: tw.rally.y + (i % 2) * 12 },
          atkCd: 0, engaged: null, moving: false, flip: false, dead: false,
          animSeed: Math.random() * 10,
        };
        tw.soldiers.push(u);
        this.units.push(u);
      }
      tw.soldiers = tw.soldiers.filter(s => !s.dead);
    }

    // ----- poderes -----
    castRefuerzos(x, y) {
      if (this.powerCd.refuerzos > 0) return false;
      const m = TA.POWERS.refuerzos.militia;
      for (let i = 0; i < 2; i++) {
        this.units.push({
          kindU: "militia", def: m, hp: m.hp, maxHp: m.hp, dmg: m.dmg, rate: m.rate,
          x: x + (i ? 18 : -18), y, anchor: { x: x + (i ? 18 : -18), y },
          atkCd: 0, engaged: null, moving: false, flip: false, dead: false,
          life: m.life, animSeed: Math.random() * 10,
        });
      }
      this.powerCd.refuerzos = TA.POWERS.refuerzos.cd;
      return true;
    }

    castMeteoro(x, y) {
      if (this.powerCd.meteoro > 0) return false;
      const P = TA.POWERS.meteoro;
      for (let i = 0; i < P.count; i++) {
        const tx = x + rand(-30, 30), ty = y + rand(-24, 24);
        this.projectiles.push({
          kind: "meteoro", x: tx - 120, y: ty - 260, tx, ty,
          delay: i * 0.35, speed: 420, dmg: P.dmg, aoe: P.aoe,
          angle: Math.atan2(260, 120),
        });
      }
      this.powerCd.meteoro = P.cd;
      this.emit("shot", { kind: "meteoro" });
      return true;
    }

    // ----- oleadas -----
    startNextWave(early) {
      if (this.waveIdx + 1 >= this.def.waves.length) return;
      if (early && this.waveTimer > 0) {
        const bonus = Math.floor(this.waveTimer);
        if (bonus > 0) {
          this.gold += bonus;
          this.effects.push({ kind: "coin", x: TA.W / 2, y: 60, age: 0, dur: 1 });
        }
      }
      this.waveIdx++;
      this.waveTimer = 0;
      const wave = this.def.waves[this.waveIdx];
      for (const g of wave) {
        this.spawning.push({ def: g, spawned: 0, timer: 0, wait: g.d || 0 });
      }
      this.emit("wave");
    }

    // ----- daño ----
    applyDamage(e, amount, type, showText) {
      const red = type === "mag" ? (e.def.mres || 0) : (e.def.armor || 0);
      const dmg = Math.max(1, Math.round(amount * (1 - red)));
      e.hp -= dmg;
      this.effects.push({ kind: "spark", x: e.x, y: e.y - e.def.r * 0.6, age: 0, dur: 0.22, seed: rand(0, 6), color: type === "mag" ? "#9ad2ff" : "#fff2c8" });
      if (showText) this.effects.push({ kind: "dmg", x: e.x + rand(-6, 6), y: e.y - 20, age: 0, dur: 0.7, text: dmg, color: type === "mag" ? "#9ad2ff" : "#ffd9a0" });
      this.emit("hit");
      if (e.hp <= 0 && !e.dead) this.killEnemy(e);
    }

    killEnemy(e) {
      e.dead = true;
      this.gold += e.def.bounty;
      this.effects.push({ kind: "puff", x: e.x, y: e.y - 6, age: 0, dur: 0.5, seed: rand(0, 6) });
      this.effects.push({ kind: "coin", x: e.x, y: e.y - 14, age: 0, dur: 0.8 });
      if (e.blocker) e.blocker.engaged = null;
      this.emit("gold");
      this.emit("kill", { boss: !!e.def.boss });
    }

    aoeDamage(x, y, r, amount, type) {
      for (const e of this.enemies) {
        if (!e.dead && Math.hypot(e.x - x, e.y - y) <= r) {
          this.applyDamage(e, amount * rand(0.85, 1.15), type, true);
        }
      }
      this.effects.push({ kind: "boom", x, y, r, age: 0, dur: 0.45 });
    }

    // ---------- BUCLE PRINCIPAL ----------
    update(rawDt) {
      if (this.paused || this.over) return;
      const dt = Math.min(rawDt, 0.05) * this.speed;
      this.time += dt;

      this.updateWaves(dt);
      this.updateEnemies(dt);
      this.updateUnits(dt);
      this.updateTowers(dt);
      this.updateProjectiles(dt);
      this.updateAmbient(dt);

      for (const k in this.powerCd) this.powerCd[k] = Math.max(0, this.powerCd[k] - dt);
      for (const fx of this.effects) fx.age += dt;
      this.effects = this.effects.filter(fx => fx.age < fx.dur);

      // ¿victoria o derrota?
      if (this.lives <= 0) {
        this.over = true;
        this.emit("defeat");
      } else if (this.allSpawned && this.enemies.length === 0 && this.spawning.length === 0) {
        this.over = true;
        const stars = this.lives >= 18 ? 3 : this.lives >= 10 ? 2 : 1;
        this.emit("victory", { stars, lives: this.lives });
      }
    }

    updateWaves(dt) {
      // grupos en marcha
      for (const g of this.spawning) {
        if (g.wait > 0) { g.wait -= dt; continue; }
        g.timer -= dt;
        if (g.timer <= 0 && g.spawned < g.def.n) {
          g.timer = g.def.i;
          g.spawned++;
          const pathIdx = g.def.p != null ? g.def.p : (this.forked ? Math.floor(this.forkRng() * this.paths.length) : 0);
          this.spawnEnemy(g.def.t, pathIdx);
        }
      }
      this.spawning = this.spawning.filter(g => g.spawned < g.def.n);

      // cuenta atrás para la siguiente oleada
      const moreWaves = this.waveIdx + 1 < this.def.waves.length;
      if (moreWaves && this.spawning.length === 0) {
        if (this.waveTimer <= 0 && this.waveIdx >= 0) this.waveTimer = 22;
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) this.startNextWave(false);
      }
      if (!moreWaves && this.spawning.length === 0) this.allSpawned = true;
    }

    spawnEnemy(type, pathIdx) {
      const base = TA.ENEMIES[type];
      // en modo difícil el enemigo sube en varios frentes a la vez (vida, daño, aguante,
      // velocidad y cadencia), no solo la vida — clon propio, no toca la tabla compartida
      const def = this.hardMode
        ? {
            ...base,
            hp: Math.round(base.hp * 1.5),
            dmg: [Math.round(base.dmg[0] * 1.25), Math.round(base.dmg[1] * 1.25)],
            bounty: Math.round(base.bounty * 1.2),
            spd: base.spd * 1.15,
            rate: base.rate * 0.85,
            armor: Math.min(0.85, (base.armor || 0) + 0.1),
            mres: Math.min(0.85, (base.mres || 0) + 0.1),
          }
        : base;
      this.enemies.push({
        type, def, hp: def.hp, dead: false,
        path: this.paths[pathIdx], s: 0, laneOff: rand(-11, 11),
        x: -40, y: -40, flip: false, blocker: null, atkCd: 0,
        healCd: def.heal ? def.heal.cd : 0, healGlow: 0,
        slowUntil: 0, slowPct: 0,
        animSeed: Math.random() * 10,
      });
    }

    updateEnemies(dt) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.healGlow > 0) e.healGlow -= dt * 2;

        if (e.blocker && !e.blocker.dead) {
          // luchando contra un defensor
          e.atkCd -= dt;
          if (e.atkCd <= 0) {
            e.atkCd = e.def.rate;
            const u = e.blocker;
            u.hp -= randInt(e.def.dmg);
            this.emit("hit");
            if (u.hp <= 0) this.killUnit(u);
          }
        } else {
          if (e.blocker) e.blocker = null;
          const slow = this.time < e.slowUntil ? (1 - e.slowPct) : 1;
          e.s += e.def.spd * slow * dt;
          if (e.s >= e.path.total) {
            e.dead = true;
            this.lives -= e.def.lives;
            this.emit("lives");
            continue;
          }
          const p = e.path.at(e.s);
          e.x = p.x + p.nx * e.laneOff;
          e.y = p.y + p.ny * e.laneOff;
          e.flip = p.dx < -0.1;
        }

        // regeneración propia (ej. momia)
        if (e.def.regen && e.hp < e.def.hp && !e.blocker) {
          e.hp = Math.min(e.def.hp, e.hp + e.def.regen * dt);
        }

        // chamán: cura a los cercanos
        if (e.def.heal) {
          e.healCd -= dt;
          if (e.healCd <= 0) {
            e.healCd = e.def.heal.cd;
            let healed = false;
            for (const o of this.enemies) {
              if (!o.dead && o !== e && o.hp < o.def.hp && dist(o, e) < e.def.heal.r) {
                o.hp = Math.min(o.def.hp, o.hp + e.def.heal.amt);
                this.effects.push({ kind: "heal", x: o.x, y: o.y - 20, age: 0, dur: 0.6 });
                healed = true;
              }
            }
            if (healed) e.healGlow = 1;
          }
        }
      }
      this.enemies = this.enemies.filter(e => !e.dead);
    }

    killUnit(u) {
      u.dead = true;
      u.engaged = null;
      this.effects.push({ kind: "puff", x: u.x, y: u.y - 6, age: 0, dur: 0.5, seed: rand(0, 6) });
      if (u.kindU === "hero") {
        u.respawnT = u.def.respawn;
        u.selected = false;
        this.emit("heroDown", u);
      } else if (u.kindU === "soldier") {
        u.tower.respawnT = Math.max(u.tower.respawnT, 0.01);
      }
    }

    updateUnits(dt) {
      for (const u of this.units) {
        if (u.dead) {
          if (u.kindU === "hero") {
            u.respawnT -= dt;
            if (u.respawnT <= 0) {
              u.dead = false;
              u.hp = u.maxHp;
              this.effects.push({ kind: "boom", x: u.x, y: u.y, r: 30, age: 0, dur: 0.4 });
              this.emit("heroUp", u);
            }
          }
          continue;
        }

        // caducidad de la milicia
        if (u.kindU === "militia") {
          u.life -= dt;
          if (u.life <= 0) {
            u.dead = true;
            this.effects.push({ kind: "puff", x: u.x, y: u.y - 6, age: 0, dur: 0.5, seed: 1 });
            continue;
          }
        }

        // regeneración del héroe
        if (u.kindU === "hero" && u.hp < u.maxHp) {
          u.hp = Math.min(u.maxHp, u.hp + u.def.regen * dt);
        }

        const isHero = u.kindU === "hero";
        const d = isHero ? u.def : u;
        const isRanged = isHero && u.def.kind === "ranged";

        // combate cuerpo a cuerpo
        if (!isRanged) {
          if (u.engaged && !u.engaged.dead) {
            const e = u.engaged;
            const dd = dist(u, e);
            if (dd > 26) { // acercarse al enemigo
              this.stepToward(u, e.x, e.y, (isHero ? u.def.spd : 70) * dt);
            } else {
              u.moving = false;
              u.atkCd -= dt;
              if (u.atkCd <= 0) {
                u.atkCd = isHero ? u.def.rate : u.rate;
                this.applyDamage(e, randInt(isHero ? u.def.dmg : u.dmg), isHero ? u.def.dmgType : "fis", false);
              }
            }
            continue;
          }
          u.engaged = null;
          // buscar enemigo cercano sin bloquear
          const anchor = isHero ? u : u.anchor;
          const seekR = isHero ? 55 : 60;
          let best = null, bd = 1e9;
          for (const e of this.enemies) {
            if (e.dead || e.def.fly || (e.blocker && !e.blocker.dead && e.blocker !== u)) continue;
            const dd = Math.hypot(e.x - anchor.x, e.y - anchor.y);
            if (dd < seekR && dd < bd) { bd = dd; best = e; }
          }
          if (best) {
            u.engaged = best;
            best.blocker = u;
            continue;
          }
        } else {
          // héroe a distancia: dispara sin moverse
          u.atkCd -= dt;
          if (u.atkCd <= 0 && !u.moving) {
            let best = null, bd = 1e9;
            for (const e of this.enemies) {
              if (e.dead) continue;
              const dd = dist(u, e);
              if (dd < u.def.range && dd < bd) { bd = dd; best = e; }
            }
            if (best) {
              u.atkCd = u.def.rate;
              u.flip = best.x < u.x;
              this.projectiles.push({
                kind: "rayo", x: u.x, y: u.y - 24, target: best,
                speed: 320, dmg: randInt(u.def.dmg), dmgType: "mag",
              });
              this.emit("shot", { kind: "rayo" });
            }
          }
        }

        // habilidad automática del héroe
        if (isHero) {
          u.abilityCd -= dt;
          if (u.abilityCd <= 0) this.tryHeroAbility(u);
        }

        // volver a su puesto
        const home = isHero
          ? (u.tx != null ? { x: u.tx, y: u.ty } : null)
          : u.anchor;
        if (home) {
          const dd = Math.hypot(home.x - u.x, home.y - u.y);
          if (dd > 4) {
            this.stepToward(u, home.x, home.y, (isHero ? u.def.spd : 70) * dt);
          } else {
            u.moving = false;
            if (isHero) { u.tx = null; u.ty = null; }
          }
        } else u.moving = false;
      }
      this.units = this.units.filter(u => !u.dead || u.kindU === "hero");

      // reponer soldados de los cuarteles
      for (const tw of this.towers) {
        if (tw.type !== "cuartel") continue;
        const alive = tw.soldiers.filter(s => !s.dead).length;
        if (alive < 3) {
          tw.respawnT -= dt;
          if (tw.respawnT <= 0) {
            tw.respawnT = TA.TOWERS.cuartel.respawn;
            this.spawnSoldiers(tw, 1);
          }
        }
      }
    }

    stepToward(u, x, y, step) {
      const dd = Math.hypot(x - u.x, y - u.y);
      if (dd < 0.001) return;
      u.x += ((x - u.x) / dd) * Math.min(step, dd);
      u.y += ((y - u.y) / dd) * Math.min(step, dd);
      u.moving = true;
      u.flip = x < u.x;
    }

    tryHeroAbility(h) {
      const ab = h.def.ability;
      if (ab.type === "torbellino") {
        let n = 0;
        for (const e of this.enemies) if (!e.dead && dist(e, h) < ab.aoe) n++;
        if (n >= 2) {
          h.abilityCd = ab.cd;
          this.effects.push({ kind: "whirl", x: h.x, y: h.y, r: ab.aoe, age: 0, dur: 0.6 });
          this.aoeDamage(h.x, h.y, ab.aoe, ab.dmg, "fis");
          this.emit("ability");
        }
      } else if (ab.type === "fireball") {
        // busca el grupo más denso a su alcance
        let best = null, bn = 1;
        for (const e of this.enemies) {
          if (e.dead || dist(e, h) > h.def.range + 40) continue;
          let n = 0;
          for (const o of this.enemies) if (!o.dead && dist(o, e) < ab.aoe) n++;
          if (n > bn) { bn = n; best = e; }
        }
        if (best && bn >= 2) {
          h.abilityCd = ab.cd;
          this.projectiles.push({
            kind: "meteoro", vis: ab.vis || null, x: h.x, y: h.y - 30, tx: best.x, ty: best.y,
            delay: 0, speed: 300, dmg: ab.dmg, aoe: ab.aoe,
            angle: Math.atan2(best.y - h.y, best.x - h.x),
          });
          this.emit("ability");
        }
      }
    }

    updateTowers(dt) {
      for (const tw of this.towers) {
        if (tw.type === "cuartel" || TA.TOWERS[tw.type].support) continue;
        const lvl = this.towerStats(tw);
        tw.cd -= dt;
        if (tw.cd > 0) continue;
        // objetivo: el enemigo más avanzado dentro del alcance
        let best = null, bs = -1;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (tw.type === "canon" && e.def.fly) continue; // el cañón no alcanza a los voladores
          if (dist(e, tw) <= lvl.range && e.s > bs) { bs = e.s; best = e; }
        }
        if (!best) continue;
        tw.cd = lvl.rate;
        const def = TA.TOWERS[tw.type];
        if (tw.type === "canon") {
          tw.aimAngle = Math.atan2(best.y - tw.y, best.x - (tw.x)) * 0.4 - 0.4;
          this.projectiles.push({
            kind: "bomba", x: tw.x, y: tw.y - 20, tx: best.x + rand(-8, 8), ty: best.y + rand(-6, 6),
            t: 0, dur: 0.55, x0: tw.x, y0: tw.y - 20,
            dmg: randInt(lvl.dmg), aoe: lvl.aoe, groundY: best.y,
          });
          this.emit("shot", { kind: "bomba" });
        } else {
          this.projectiles.push({
            kind: def.proj, x: tw.x, y: tw.y - 30, target: best,
            speed: def.proj === "flecha" ? 420 : 300,
            dmg: randInt(lvl.dmg), dmgType: def.dmgType, aoe: lvl.aoe || 0,
            chain: lvl.chain || 0, chainR: lvl.chainR || 0,
            slowPct: lvl.slowPct || 0, slowDur: lvl.slowDur || 0,
            angle: Math.atan2(best.y - tw.y, best.x - tw.x),
          });
          this.emit("shot", { kind: def.proj });
        }
      }
    }

    // clima ambiental de fondo: hojas/arena/nieve según la región (solo estética)
    updateAmbient(dt) {
      this.ambientTimer = (this.ambientTimer || 0) - dt;
      if (this.ambientTimer > 0) return;
      this.ambientTimer = 0.3 + rand(0, 0.35);
      const region = this.def.region || "bosque";
      const variant = region === "desierto" ? "arena" : region === "montana" ? "nieve" : "hoja";
      this.effects.push({
        kind: "ambient", variant,
        x0: rand(-20, TA.W + 20), y0: -20, age: 0, dur: 6 + rand(0, 3),
        drift: rand(-25, 25), fallSpd: 16 + rand(0, 12), seed: rand(0, 10),
      });
    }

    updateProjectiles(dt) {
      for (const p of this.projectiles) {
        if (p.delay > 0) { p.delay -= dt; continue; }

        if (p.kind === "bomba") {
          // vuelo en parábola hasta el punto marcado
          p.t += dt;
          const k = Math.min(1, p.t / p.dur);
          p.x = p.x0 + (p.tx - p.x0) * k;
          p.y = p.y0 + (p.ty - p.y0) * k - Math.sin(k * Math.PI) * 60;
          p.groundY = p.y0 + (p.ty - p.y0) * k;
          if (k >= 1) {
            p.done = true;
            this.aoeDamage(p.tx, p.ty, p.aoe, p.dmg, "fis");
          }
        } else if (p.kind === "meteoro") {
          const dd = Math.hypot(p.tx - p.x, p.ty - p.y);
          const step = p.speed * dt;
          if (dd <= step) {
            p.done = true;
            this.aoeDamage(p.tx, p.ty, p.aoe, p.dmg, "fis");
          } else {
            p.x += ((p.tx - p.x) / dd) * step;
            p.y += ((p.ty - p.y) / dd) * step;
          }
        } else {
          // flecha / rayo: persigue a su objetivo
          const e = p.target;
          if (!e || e.dead) { p.done = true; continue; }
          const dd = dist(p, e);
          const step = p.speed * dt;
          if (dd <= step + 6) {
            p.done = true;
            if (p.chain) {
              this.applyDamage(e, p.dmg, p.dmgType, true);
              const visited = new Set([e]);
              let curDmg = p.dmg, last = e;
              for (let i = 1; i < p.chain; i++) {
                let next = null, nd = 1e9;
                for (const o of this.enemies) {
                  if (o.dead || visited.has(o)) continue;
                  const dd2 = dist(o, last);
                  if (dd2 <= p.chainR && dd2 < nd) { nd = dd2; next = o; }
                }
                if (!next) break;
                curDmg = Math.round(curDmg * 0.72);
                this.applyDamage(next, curDmg, p.dmgType, true);
                this.effects.push({ kind: "boom", x: next.x, y: next.y, r: 16, age: 0, dur: 0.25 });
                visited.add(next); last = next;
              }
            } else if (p.aoe) {
              this.aoeDamage(e.x, e.y, p.aoe, p.dmg, p.dmgType);
            } else {
              this.applyDamage(e, p.dmg, p.dmgType, false);
            }
            if (p.slowPct && !e.def.slowImmune) {
              const effPct = p.slowPct * (1 - (e.def.slowRes || 0));
              if (effPct > 0.01) {
                e.slowUntil = Math.max(e.slowUntil, this.time + p.slowDur);
                e.slowPct = Math.max(e.slowPct, effPct);
              }
            }
          } else {
            p.x += ((e.x - p.x) / dd) * step;
            p.y += ((e.y - p.y) / dd) * step;
            p.angle = Math.atan2(e.y - p.y, e.x - p.x);
          }
        }
      }
      this.projectiles = this.projectiles.filter(p => !p.done);
    }
  }

  TA.Game = Game;
  TA.buildPath = buildPath;
  TA.mulberry32 = mulberry32;
})();
