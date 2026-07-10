/* ============================================================
   TORRES ALIANZA — sonido
   Música y efectos generados con Web Audio API: nada de archivos
   externos, todo sintetizado por código (igual que el arte).
   ============================================================ */
"use strict";
(function () {
  const A = TA.audio = {};
  const MUTE_KEY = "torres-alianza-muted";

  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicTimer = null, musicWanted = false, musicStep = 0;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { muted = false; }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function ensureCtx() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
    return ctx;
  }

  // se activa con el primer toque de pantalla (norma de iOS/Safari: el audio
  // no puede arrancar solo, necesita un gesto real del usuario)
  A.unlock = function () {
    ensureCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
    if (musicWanted) A.startMusic();
  };

  A.isMuted = () => muted;
  A.setMuted = function (v) {
    muted = v;
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    if (muted) A.stopMusic(); else if (musicWanted) A.startMusic();
  };
  A.toggleMute = function () { A.setMuted(!muted); return muted; };

  // ---------- fábricas de sonido ----------
  function tone(freq, dur, opts) {
    if (!ctx || muted) return;
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    const g = ctx.createGain();
    const vol = opts.vol != null ? opts.vol : 0.22;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, opts) {
    if (!ctx || muted) return;
    opts = opts || {};
    const t0 = ctx.currentTime + (opts.delay || 0);
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.filter || "bandpass";
    filt.frequency.value = opts.freq || 1200;
    const g = ctx.createGain();
    g.gain.value = opts.vol != null ? opts.vol : 0.3;
    src.connect(filt); filt.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  // ---------- catálogo de efectos ----------
  const SFX = {
    shot_flecha() { tone(rand(730, 790), 0.09, { type: "triangle", vol: 0.14, slideTo: 300 }); },
    shot_rayo() { tone(900, 0.12, { type: "sawtooth", vol: 0.1, slideTo: 1400 }); },
    shot_rayo_cadena() { tone(950, 0.1, { type: "sawtooth", vol: 0.1, slideTo: 1500 }); },
    shot_bomba() { noise(0.16, { freq: 220, vol: 0.24, filter: "lowpass" }); tone(90, 0.2, { type: "sine", vol: 0.18, slideTo: 40 }); },
    shot_hielo() { tone(1400, 0.12, { type: "sine", vol: 0.12, slideTo: 1800 }); },
    shot_meteoro() { noise(0.2, { freq: 500, vol: 0.2, filter: "lowpass" }); },
    hit() { noise(0.05, { freq: rand(1300, 1700), vol: 0.12, filter: "highpass" }); },
    kill() { tone(500, 0.14, { type: "square", vol: 0.12, slideTo: 120 }); },
    kill_boss() { tone(200, 0.5, { type: "sawtooth", vol: 0.2, slideTo: 60 }); },
    ability() {
      tone(500, 0.22, { type: "sine", vol: 0.18, slideTo: 900 });
      tone(700, 0.22, { type: "sine", vol: 0.13, slideTo: 1100, delay: 0.05 });
    },
    build() { tone(440, 0.08, { type: "square", vol: 0.12, slideTo: 660 }); },
    coin() { tone(1200, 0.08, { type: "square", vol: 0.08, slideTo: 1600 }); },
    wave() {
      tone(220, 0.35, { type: "sawtooth", vol: 0.16, slideTo: 260 });
      tone(330, 0.35, { type: "sawtooth", vol: 0.12, delay: 0.12, slideTo: 380 });
    },
    lives_lost() { tone(180, 0.25, { type: "square", vol: 0.18, slideTo: 90 }); },
    hero_down() { tone(300, 0.3, { type: "sawtooth", vol: 0.16, slideTo: 100 }); },
    hero_up() { tone(500, 0.2, { type: "sine", vol: 0.14, slideTo: 750 }); },
    victory() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: "triangle", vol: 0.18, delay: i * 0.12 })); },
    defeat() { [392, 349, 294, 220].forEach((f, i) => tone(f, 0.35, { type: "sawtooth", vol: 0.16, delay: i * 0.14 })); },
    button() { tone(600, 0.05, { type: "square", vol: 0.07, slideTo: 500 }); },
  };

  // algunos sonidos se disparan muchas veces seguidas (disparos, golpes...):
  // se limitan para que no suenen como una ametralladora
  const THROTTLE_MS = {
    shot_flecha: 70, shot_rayo: 80, shot_rayo_cadena: 80, shot_bomba: 150,
    shot_hielo: 100, shot_meteoro: 200, hit: 90, coin: 60, kill: 60, build: 40,
  };
  const lastPlayed = {};
  function allowed(name) {
    const gap = THROTTLE_MS[name];
    if (!gap) return true;
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < gap) return false;
    lastPlayed[name] = now;
    return true;
  }

  A.play = function (name) {
    if (!ctx || muted) return;
    const fn = SFX[name];
    if (!fn || !allowed(name)) return;
    fn();
  };

  // ---------- música de fondo (melodía sencilla en bucle) ----------
  const MELODY = [523, 587, 659, 587, 523, 440, 392, 440];
  A.startMusic = function () {
    musicWanted = true;
    if (!ctx || muted || musicTimer) return;
    const stepDur = 0.85;
    function playStep() {
      if (!musicWanted || muted) return;
      const freq = MELODY[musicStep % MELODY.length] / 2; // octava grave, de fondo
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 0.9);
      osc.connect(g); g.connect(musicGain);
      osc.start(t0); osc.stop(t0 + stepDur);
      musicStep++;
    }
    playStep();
    musicTimer = setInterval(playStep, stepDur * 1000);
  };
  A.stopMusic = function () {
    musicWanted = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  };
})();
