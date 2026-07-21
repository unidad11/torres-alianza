/* ============================================================
   Simulación de equilibrio, sin navegador.

   Juega los 15 niveles en seco y compara dos configuraciones de los huecos
   de torre: los actuales (el motor los aparta del camino en layoutSpots) y
   los originales del fichero de datos. Sirve para comprobar que tocar las
   posiciones no ha estropeado el equilibrio.

   Uso:  node tools/simular-equilibrio.js [repeticiones]

   OJO, dos cosas que hacen falta para que el resultado signifique algo:

   1. El motor usa Math.random() sin semilla, así que dos partidas iguales dan
      resultados distintos. Aquí se sustituye por un generador con semilla y se
      repite cada combinación varias veces, comparando las medias. Sin esto,
      una sola pasada da diferencias de hasta el 20% que son puro ruido.

   2. En las derrotas las vidas saturan a 0 y no distinguen nada, así que lo
      que se compara es cuánto aguanta cada partida.

   El jugador simulado es mediocre y pierde la mayoría de niveles: esto mide la
   DIFERENCIA entre las dos configuraciones, no si el juego es ganable.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const base = path.resolve(__dirname, "..");

global.window = global;
global.TA = {};
for (const f of ["js/data.js", "js/engine.js"]) {
  (0, eval)(fs.readFileSync(path.join(base, f), "utf8"));
}

const REPES = Number(process.argv[2] || 8);
const DT = 1 / 30;
const MAX_PASOS = 30000;
const MAX_TORRES = 6;              // pocas y fuertes, como en Kingdom Rush
const MEZCLA = ["arqueros", "canon", "magos", "hielo", "cuartel", "electrica", "arqueros"];

// generador con semilla, para que la misma repetición sea idéntica en ambas
// configuraciones y la comparación sea justa
function sembrar(semilla) {
  let s = semilla >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Una sola decisión de gasto por tick. Orden: maestría > rama > subir nivel >
// torre nueva. Rama y maestría son lo que de verdad hace ganar.
function decidir(g) {
  for (const tw of g.towers) if (tw.branch && !tw.mastered && g.buyMastery(tw)) return;
  for (const tw of g.towers) {
    if (tw.level < 2 || tw.branch) continue;
    const ramas = Object.keys(TA.TOWERS[tw.type].branches || {});
    if (ramas.length && g.chooseBranch(tw, ramas[0])) return;
  }
  for (const tw of g.towers) if (tw.level < 2 && g.upgradeTower(tw)) return;
  if (g.towers.length < MAX_TORRES) {
    for (let i = 0; i < g.spots.length; i++) {
      if (g.spots[i].tower) continue;
      if (g.buildTower(g.spots[i], MEZCLA[i % MEZCLA.length])) return;
    }
  }
}

function jugar(lv, usarOriginales, semilla) {
  sembrar(semilla);
  const g = new TA.Game(lv, ["roldan", "lyra"], null);
  if (usarOriginales) {
    g.spots.forEach((sp, i) => { sp.x = lv.spots[i][0]; sp.y = lv.spots[i][1]; });
  }
  let pasos = 0;
  while (!g.over && pasos < MAX_PASOS) {
    g.update(DT);
    if (++pasos % 15 === 0) decidir(g);
  }
  return { gano: g.over && g.lives > 0, vidas: g.lives, aguante: g.time, oleada: g.waveIdx + 1 };
}

const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;

const filas = [];
for (const lv of TA.LEVELS) {
  const viejos = [], nuevos = [];
  for (let r = 1; r <= REPES; r++) {
    viejos.push(jugar(lv, true, r * 7919));
    nuevos.push(jugar(lv, false, r * 7919));   // misma semilla en ambas
  }
  const aV = media(viejos.map((x) => x.aguante));
  const aN = media(nuevos.map((x) => x.aguante));
  filas.push({
    nivel: lv.id,
    gana_antes: viejos.filter((x) => x.gano).length + "/" + REPES,
    gana_ahora: nuevos.filter((x) => x.gano).length + "/" + REPES,
    aguante_antes: +aV.toFixed(1),
    aguante_ahora: +aN.toFixed(1),
    dif_pct: +(((aN - aV) / (aV || 1)) * 100).toFixed(1),
  });
}
console.table(filas);

const difs = filas.map((f) => f.dif_pct);
const cambian = filas.filter((f) => f.gana_antes !== f.gana_ahora);
console.log(JSON.stringify({
  repeticiones: REPES,
  niveles_que_cambian_de_victorias: cambian.map((f) => f.nivel),
  peor_caida_pct: Math.min(...difs),
  mejor_subida_pct: Math.max(...difs),
  media_pct: +media(difs).toFixed(2),
  empeoran_mas_de_5pct: filas.filter((f) => f.dif_pct < -5).map((f) => f.nivel),
}, null, 1));
