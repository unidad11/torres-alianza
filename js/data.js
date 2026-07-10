/* ============================================================
   TORRES ALIANZA — datos del juego
   Torres, enemigos, héroes, poderes y niveles.
   Todo el equilibrio del juego vive aquí.
   ============================================================ */
"use strict";
const TA = window.TA = {};

// Tamaño lógico del lienzo (se escala a la pantalla)
TA.W = 960;
TA.H = 540;

// ---------- TORRES ----------
// dmg: [mín, máx] · rate: segundos entre disparos · range: alcance en px
// type de daño: 'fis' (lo reduce la armadura) o 'mag' (lo reduce la resist. mágica)
TA.TOWERS = {
  arqueros: {
    name: "Arqueros", dmgType: "fis", proj: "flecha",
    desc: "Disparo rápido a un enemigo",
    levels: [
      { cost: 70,  dmg: [4, 6],   rate: 0.75, range: 130 },
      { cost: 110, dmg: [7, 11],  rate: 0.70, range: 140 },
      { cost: 160, dmg: [11, 17], rate: 0.60, range: 150 },
    ],
    branches: {
      francotirador: { name: "Francotirador", desc: "Un solo blanco, daño altísimo y mucho alcance", cost: 200, dmg: [45, 65], rate: 1.7, range: 195,
        mastery: { name: "Ojo de águila", desc: "Aún más daño y alcance", cost: 380, dmg: [70, 95], rate: 1.6, range: 230 } },
      mosquetero:    { name: "Mosquetero",    desc: "Ráfagas muy rápidas, ideal contra bandadas y voladores", cost: 200, dmg: [7, 11], rate: 0.32, range: 140,
        mastery: { name: "Repetición", desc: "Ráfaga todavía más rápida", cost: 380, dmg: [9, 14], rate: 0.22, range: 150 } },
    },
  },
  cuartel: {
    name: "Cuartel", dmgType: "fis", proj: null,
    desc: "3 soldados que cortan el paso",
    levels: [
      { cost: 70,  soldier: { hp: 55,  dmg: [2, 4],  rate: 1.0 } },
      { cost: 110, soldier: { hp: 90,  dmg: [4, 7],  rate: 1.0 } },
      { cost: 160, soldier: { hp: 140, dmg: [7, 11], rate: 0.9 } },
    ],
    branches: {
      veteranos: { name: "Veteranos", desc: "Soldados con mucha más vida y aguante", cost: 220, soldier: { hp: 220, dmg: [12, 18], rate: 0.85 },
        mastery: { name: "Guardia real", desc: "Soldados casi indestructibles", cost: 360, soldier: { hp: 340, dmg: [16, 24], rate: 0.8 } } },
      asalto:    { name: "Asalto",    desc: "Soldados frágiles pero que golpean muy fuerte", cost: 220, soldier: { hp: 130, dmg: [16, 24], rate: 0.7 },
        mastery: { name: "Furia", desc: "Golpean todavía más fuerte", cost: 360, soldier: { hp: 160, dmg: [24, 34], rate: 0.6 } } },
    },
    respawn: 10, rallyRadius: 130,
  },
  magos: {
    name: "Magos", dmgType: "mag", proj: "rayo",
    desc: "Daño mágico que ignora armadura",
    levels: [
      { cost: 100, dmg: [10, 16], rate: 1.5, range: 125 },
      { cost: 160, dmg: [18, 28], rate: 1.4, range: 135 },
      { cost: 240, dmg: [30, 46], rate: 1.3, range: 145 },
    ],
    branches: {
      archimago: { name: "Archimago", desc: "Daño mágico brutal a un solo objetivo", cost: 260, dmg: [55, 80], rate: 1.6, range: 150,
        mastery: { name: "Sabiduría arcana", desc: "Daño mágico devastador", cost: 440, dmg: [85, 120], rate: 1.5, range: 160 } },
      piromante: { name: "Piromante", desc: "Bola de fuego que golpea en área", cost: 260, dmg: [20, 30], rate: 1.0, range: 140, aoe: 45,
        mastery: { name: "Infierno", desc: "Área mucho mayor", cost: 440, dmg: [28, 40], rate: 0.9, range: 150, aoe: 65 } },
    },
  },
  canon: {
    name: "Cañón", dmgType: "fis", proj: "bomba",
    desc: "Daño en área, lento pero brutal",
    levels: [
      { cost: 125, dmg: [9, 17],  rate: 3.0, range: 115, aoe: 55 },
      { cost: 220, dmg: [17, 32], rate: 2.8, range: 125, aoe: 62 },
      { cost: 320, dmg: [32, 58], rate: 2.6, range: 135, aoe: 70 },
    ],
    branches: {
      mortero:  { name: "Mortero",  desc: "Mucho alcance y área, muy lento", cost: 300, dmg: [40, 70], rate: 3.2, range: 190, aoe: 95,
        mastery: { name: "Bombardeo", desc: "Área enorme", cost: 480, dmg: [55, 90], rate: 3.0, range: 210, aoe: 120 } },
      metralla: { name: "Metralla", desc: "Dispara mucho más rápido en área más pequeña", cost: 300, dmg: [16, 26], rate: 1.4, range: 120, aoe: 45,
        mastery: { name: "Lluvia de acero", desc: "Cadencia altísima", cost: 480, dmg: [22, 34], rate: 1.0, range: 130, aoe: 50 } },
    },
  },
  hielo: {
    name: "Hielo", dmgType: "fis", proj: "hielo",
    desc: "Poco daño, pero ralentiza a quien golpea",
    levels: [
      { cost: 90,  dmg: [3, 5],  rate: 1.0, range: 120, slowPct: 0.35, slowDur: 2.0 },
      { cost: 140, dmg: [5, 8],  rate: 0.9, range: 130, slowPct: 0.40, slowDur: 2.2 },
      { cost: 200, dmg: [8, 13], rate: 0.8, range: 140, slowPct: 0.45, slowDur: 2.5 },
    ],
    branches: {
      ventisca:  { name: "Ventisca",  desc: "Ralentiza mucho más y golpea más lejos", cost: 230, dmg: [10, 16], rate: 0.8, range: 170, slowPct: 0.6, slowDur: 3.0,
        mastery: { name: "Corazón helado", desc: "Casi paraliza", cost: 360, dmg: [14, 20], rate: 0.75, range: 180, slowPct: 0.75, slowDur: 3.5 } },
      carambano: { name: "Carámbano", desc: "Menos frío pero mucho más daño", cost: 230, dmg: [22, 32], rate: 0.9, range: 140, slowPct: 0.25, slowDur: 1.5,
        mastery: { name: "Punta de diamante", desc: "Daño perforante", cost: 360, dmg: [32, 45], rate: 0.85, range: 150, slowPct: 0.3, slowDur: 1.6 } },
    },
  },
  electrica: {
    name: "Eléctrica", dmgType: "mag", proj: "rayo_cadena",
    desc: "El rayo salta de un enemigo a otro cercano",
    levels: [
      { cost: 130, dmg: [8, 13],  rate: 1.1, range: 120, chain: 3, chainR: 80 },
      { cost: 190, dmg: [13, 20], rate: 1.0, range: 130, chain: 4, chainR: 90 },
      { cost: 270, dmg: [20, 30], rate: 0.9, range: 140, chain: 5, chainR: 100 },
    ],
    branches: {
      tormenta:   { name: "Tormenta",   desc: "Salta a muchos más enemigos", cost: 280, dmg: [16, 24], rate: 0.9, range: 140, chain: 8, chainR: 110,
        mastery: { name: "Tempestad", desc: "Salta a casi todo lo cercano", cost: 400, dmg: [20, 30], rate: 0.85, range: 150, chain: 12, chainR: 120 } },
      sobrecarga: { name: "Sobrecarga", desc: "Menos saltos pero un golpe inicial enorme", cost: 280, dmg: [45, 65], rate: 1.0, range: 150, chain: 3, chainR: 90,
        mastery: { name: "Fusión", desc: "Golpe inicial descomunal", cost: 400, dmg: [65, 90], rate: 0.95, range: 160, chain: 3, chainR: 90 } },
    },
  },
  apoyo: {
    name: "Apoyo", dmgType: null, proj: null, support: true,
    desc: "No ataca: mejora el daño y la velocidad de las torres cercanas",
    levels: [
      { cost: 100, range: 140, dmgBonus: 0.15, rateBonus: 0.10 },
      { cost: 160, range: 150, dmgBonus: 0.22, rateBonus: 0.16 },
      { cost: 230, range: 160, dmgBonus: 0.30, rateBonus: 0.22 },
    ],
    branches: {
      tambores:   { name: "Tambores de guerra", desc: "Mucho más daño para las torres cercanas", cost: 260, range: 160, dmgBonus: 0.5, rateBonus: 0.15,
        mastery: { name: "Grito de guerra", desc: "Bono de daño altísimo", cost: 340, range: 170, dmgBonus: 0.8, rateBonus: 0.15 } },
      estandarte: { name: "Estandarte veloz",   desc: "Mucha más velocidad de disparo cercana", cost: 260, range: 170, dmgBonus: 0.15, rateBonus: 0.45,
        mastery: { name: "Viento favorable", desc: "Bono de velocidad altísimo", cost: 340, range: 180, dmgBonus: 0.15, rateBonus: 0.65 } },
    },
  },
};
TA.SELL_RATIO = 0.7; // se recupera el 70% de lo invertido al vender

// ---------- ENEMIGOS ----------
// armor: reduce daño físico (0.25 = -25%) · mres: reduce daño mágico
// lives: vidas que quita si llega al final
TA.ENEMIES = {
  goblin: { name: "Goblin",  hp: 22,  spd: 58,  dmg: [1, 3],   rate: 1.0, bounty: 4,  lives: 1, r: 12 },
  lobo:   { name: "Lobo",    hp: 18,  spd: 100, dmg: [2, 4],   rate: 0.8, bounty: 4,  lives: 1, r: 12 },
  orco:   { name: "Orco",    hp: 75,  spd: 38,  dmg: [3, 6],   rate: 1.2, bounty: 8,  lives: 1, r: 14, armor: 0.25 },
  chaman: { name: "Chamán",  hp: 55,  spd: 45,  dmg: [1, 3],   rate: 1.2, bounty: 10, lives: 1, r: 13, mres: 0.4,
            heal: { amt: 12, cd: 2.5, r: 95 } },
  ogro:   { name: "Ogro",    hp: 950, spd: 20,  dmg: [10, 18], rate: 1.5, bounty: 90, lives: 3, r: 22, armor: 0.3, boss: true },
  // ---- región Desierto ----
  murcielago: { name: "Murciélago", hp: 26,  spd: 95,  dmg: [2, 4],  rate: 0.9, bounty: 6,  lives: 1, r: 11, fly: true },
  gargola:    { name: "Gárgola",    hp: 190, spd: 48,  dmg: [6, 11], rate: 1.1, bounty: 22, lives: 2, r: 16, fly: true, armor: 0.2 },
  escorpion:  { name: "Escorpión",  hp: 130, spd: 34,  dmg: [5, 9],  rate: 1.0, bounty: 14, lives: 1, r: 15, armor: 0.5 },
  momia:      { name: "Momia",      hp: 220, spd: 26,  dmg: [4, 8],  rate: 1.3, bounty: 18, lives: 2, r: 15, mres: 0.25, regen: 6 },
  gargolaRey: { name: "Gárgola Real", hp: 1600, spd: 24, dmg: [14, 22], rate: 1.4, bounty: 140, lives: 4, r: 24, fly: true, armor: 0.25, boss: true },
  // ---- región Montaña ----
  yeti: { name: "Yeti", hp: 2200, spd: 22, dmg: [16, 26], rate: 1.3, bounty: 160, lives: 5, r: 26, mres: 0.5, boss: true },
};

// ---------- HÉROES ----------
TA.HEROES = {
  roldan: {
    name: "Roldán", kind: "melee", hp: 240, regen: 4, dmg: [9, 15], rate: 0.9,
    spd: 85, respawn: 14, dmgType: "fis", r: 14,
    ability: { name: "Torbellino", cd: 10, aoe: 75, dmg: 26, type: "torbellino" },
    desc: "Caballero que aguanta y bloquea",
    talents: {
      vida:      { name: "Vitalidad",   desc: "+50 puntos de vida máxima", cost: 60, hpBonus: 50 },
      dano:      { name: "Filo mayor",  desc: "+30% de daño básico", cost: 90, dmgPct: 0.30 },
      habilidad: { name: "Torbellino mejorado", desc: "+40% de daño de habilidad y recarga más rápida", cost: 130, abilityPct: 0.40, cdPct: 0.20 },
    },
  },
  lyra: {
    name: "Lyra", kind: "ranged", hp: 130, regen: 3, dmg: [11, 19], rate: 1.1,
    spd: 90, respawn: 14, dmgType: "mag", range: 140, r: 12,
    ability: { name: "Bola de fuego", cd: 12, aoe: 60, dmg: 38, type: "fireball" },
    desc: "Maga de ataque a distancia",
    talents: {
      vida:      { name: "Reservas de maná",  desc: "+40 puntos de vida máxima", cost: 60, hpBonus: 40 },
      dano:      { name: "Poder arcano",      desc: "+30% de daño básico", cost: 90, dmgPct: 0.30 },
      habilidad: { name: "Bola de fuego mayor", desc: "+40% de daño de habilidad y recarga más rápida", cost: 130, abilityPct: 0.40, cdPct: 0.20 },
    },
  },
  amir: {
    name: "Amir", kind: "melee", hp: 210, regen: 4, dmg: [7, 13], rate: 0.55,
    spd: 105, respawn: 14, dmgType: "fis", r: 13,
    ability: { name: "Danza de cimitarras", cd: 9, aoe: 65, dmg: 20, type: "torbellino" },
    desc: "Espadachín del desierto, golpea muy rápido",
    unlockLevel: 6,
    talents: {
      vida:      { name: "Piel de acero",  desc: "+45 puntos de vida máxima", cost: 60, hpBonus: 45 },
      dano:      { name: "Golpe certero",  desc: "+30% de daño básico", cost: 90, dmgPct: 0.30 },
      habilidad: { name: "Danza mortal",   desc: "+40% de daño de habilidad y recarga más rápida", cost: 130, abilityPct: 0.40, cdPct: 0.20 },
    },
  },
  zahra: {
    name: "Zahra", kind: "ranged", hp: 115, regen: 3, dmg: [9, 15], rate: 0.8,
    spd: 95, respawn: 14, dmgType: "fis", range: 150, r: 12,
    ability: { name: "Lluvia de dagas", cd: 11, aoe: 55, dmg: 30, type: "fireball", vis: "daga" },
    desc: "Lanza dagas arrojadizas a distancia",
    unlockLevel: 6,
    talents: {
      vida:      { name: "Reflejos",         desc: "+35 puntos de vida máxima", cost: 60, hpBonus: 35 },
      dano:      { name: "Filo envenenado",  desc: "+30% de daño básico", cost: 90, dmgPct: 0.30 },
      habilidad: { name: "Lluvia mortal",    desc: "+40% de daño de habilidad y recarga más rápida", cost: 130, abilityPct: 0.40, cdPct: 0.20 },
    },
  },
  bjorn: {
    name: "Björn", kind: "melee", hp: 280, regen: 5, dmg: [11, 18], rate: 1.0,
    spd: 75, respawn: 15, dmgType: "fis", r: 15,
    ability: { name: "Grito de guerra", cd: 11, aoe: 85, dmg: 30, type: "torbellino" },
    desc: "Guerrero de las montañas, lento pero durísimo",
    unlockLevel: 13,
    talents: {
      vida:      { name: "Piel de oso",         desc: "+55 puntos de vida máxima", cost: 60, hpBonus: 55 },
      dano:      { name: "Puño de piedra",      desc: "+30% de daño básico", cost: 90, dmgPct: 0.30 },
      habilidad: { name: "Grito ensordecedor",  desc: "+40% de daño de habilidad y recarga más rápida", cost: 130, abilityPct: 0.40, cdPct: 0.20 },
    },
  },
  frida: {
    name: "Frida", kind: "ranged", hp: 125, regen: 3, dmg: [12, 20], rate: 1.15,
    spd: 88, respawn: 15, dmgType: "mag", range: 145, r: 12,
    ability: { name: "Aliento gélido", cd: 13, aoe: 65, dmg: 34, type: "fireball", vis: "escarcha" },
    desc: "Bruja de las nieves, congela grupos de enemigos",
    unlockLevel: 13,
    talents: {
      vida:      { name: "Manto de nieve",     desc: "+40 puntos de vida máxima", cost: 60, hpBonus: 40 },
      dano:      { name: "Escarcha afilada",   desc: "+30% de daño básico", cost: 90, dmgPct: 0.30 },
      habilidad: { name: "Ventisca eterna",    desc: "+40% de daño de habilidad y recarga más rápida", cost: 130, abilityPct: 0.40, cdPct: 0.20 },
    },
  },
};

// ---------- ÁRBOL DE TECNOLOGÍA (mejoras permanentes para toda la alianza) ----------
TA.TECH = {
  punteria:  { name: "Puntería",       desc: "+12% de daño en todas las torres a distancia", cost: 150, dmgPct: 0.12 },
  cadencia:  { name: "Cadencia",       desc: "+12% de velocidad de disparo en todas las torres", cost: 150, ratePct: 0.12 },
  alcance:   { name: "Alcance",        desc: "+10% de alcance en todas las torres", cost: 150, rangePct: 0.10 },
  vigor:     { name: "Vigor",          desc: "+20% de vida máxima en los héroes", cost: 180, heroHpPct: 0.20 },
  furia:     { name: "Furia",          desc: "+15% de daño en los héroes", cost: 180, heroDmgPct: 0.15 },
  tesoro:    { name: "Tesoro de guerra", desc: "+15% de oro inicial en cada batalla", cost: 200, goldPct: 0.15 },
};

// ---------- LOGROS ----------
TA.ACHIEVEMENTS = [
  { key: "primera_victoria", name: "Primera victoria", desc: "Gana tu primera batalla",
    check: (s) => Object.keys(s.stars).length > 0 },
  { key: "bosque_perfecto", name: "Maestro del Bosque", desc: "3 estrellas en los 5 niveles del Bosque",
    check: (s) => [1, 2, 3, 4, 5].every((id) => (s.stars[id] || 0) === 3) },
  { key: "desierto_perfecto", name: "Maestro del Desierto", desc: "3 estrellas en los 7 niveles del Desierto",
    check: (s) => [6, 7, 8, 9, 10, 11, 12].every((id) => (s.stars[id] || 0) === 3) },
  { key: "montana_perfecta", name: "Maestro de la Montaña", desc: "3 estrellas en los 3 niveles de la Montaña",
    check: (s) => [13, 14, 15].every((id) => (s.stars[id] || 0) === 3) },
  { key: "coleccionista", name: "Coleccionista", desc: "Compra al menos un talento de cada héroe",
    check: (s) => Object.keys(TA.HEROES).every((h) => (s.heroTalents[h] || []).length > 0) },
  { key: "cientifico", name: "Científico de la Alianza", desc: "Desbloquea toda la tecnología",
    check: (s) => Object.keys(TA.TECH).every((k) => s.tech[k]) },
  { key: "veterano", name: "Veterano de guerra", desc: "Consigue 1000 Puntos de Alianza en total",
    check: (s) => (s.totalEarnedPoints || 0) >= 1000 },
];

// ---------- PODERES DEL JUGADOR ----------
TA.POWERS = {
  refuerzos: { name: "Refuerzos", cd: 12,
    militia: { hp: 60, dmg: [3, 6], rate: 1.0, life: 14 } },
  meteoro:   { name: "Lluvia de fuego", cd: 45, dmg: 60, aoe: 75, count: 3 },
};

// ---------- NIVELES ----------
// path(s): lista de puntos [x,y] que siguen los enemigos (de fuera a fuera)
// spots: huecos donde construir torres
// waves: oleadas → grupos {t: tipo, n: cuántos, i: intervalo s, d: retardo s, p: camino}
TA.LEVELS = [
  {
    id: 1, name: "El sendero del bosque", gold: 250, lives: 20, seed: 11,
    paths: [
      [[-40, 300], [150, 300], [250, 215], [420, 215], [520, 330], [700, 330], [800, 235], [1010, 235]],
    ],
    spots: [[185, 245], [215, 360], [330, 160], [355, 285], [470, 265], [565, 390], [655, 270], [760, 300]],
    waves: [
      [{ t: "goblin", n: 6,  i: 1.4 }],
      [{ t: "goblin", n: 9,  i: 1.1 }],
      [{ t: "goblin", n: 6,  i: 1.1 }, { t: "lobo", n: 4, i: 1.0, d: 5 }],
      [{ t: "lobo",   n: 9,  i: 0.9 }],
      [{ t: "goblin", n: 10, i: 0.8 }, { t: "lobo", n: 6, i: 0.8, d: 6 }],
    ],
  },
  {
    id: 2, name: "El vado del río", gold: 270, lives: 20, seed: 22,
    river: { x: 505, w: 64, bridgeY: 285, bridgeH: 66 },
    paths: [
      [[-40, 140], [190, 140], [300, 230], [430, 285], [640, 285], [720, 190], [830, 190], [880, 300], [1010, 300]],
    ],
    spots: [[160, 200], [255, 160], [305, 300], [415, 215], [455, 350], [620, 220], [660, 350], [790, 250], [845, 370]],
    waves: [
      [{ t: "goblin", n: 8,  i: 1.2 }],
      [{ t: "goblin", n: 6,  i: 1.0 }, { t: "lobo", n: 5, i: 0.9, d: 4 }],
      [{ t: "orco",   n: 4,  i: 2.2 }],
      [{ t: "goblin", n: 10, i: 0.9 }, { t: "orco", n: 3, i: 2.0, d: 5 }],
      [{ t: "lobo",   n: 10, i: 0.7 }],
      [{ t: "orco",   n: 6,  i: 1.8 }, { t: "lobo", n: 6, i: 0.9, d: 6 }],
      [{ t: "goblin", n: 12, i: 0.7 }, { t: "orco", n: 5, i: 1.6, d: 4 }],
    ],
  },
  {
    id: 3, name: "El claro de los lobos", gold: 290, lives: 20, seed: 33,
    paths: [
      [[430, -40], [430, 120], [300, 200], [180, 300], [300, 400], [520, 400], [640, 300], [560, 200], [700, 130], [860, 200], [860, 380], [1010, 430]],
    ],
    spots: [[370, 150], [490, 150], [250, 260], [255, 360], [385, 340], [470, 460], [590, 350], [600, 240], [690, 200], [790, 280], [800, 420]],
    waves: [
      [{ t: "lobo",   n: 8,  i: 1.0 }],
      [{ t: "goblin", n: 10, i: 0.9 }, { t: "lobo", n: 5, i: 0.9, d: 5 }],
      [{ t: "orco",   n: 5,  i: 2.0 }],
      [{ t: "orco",   n: 4,  i: 2.0 }, { t: "chaman", n: 2, i: 3.0, d: 3 }],
      [{ t: "lobo",   n: 12, i: 0.7 }],
      [{ t: "goblin", n: 12, i: 0.8 }, { t: "chaman", n: 3, i: 2.5, d: 4 }],
      [{ t: "orco",   n: 7,  i: 1.5 }, { t: "lobo", n: 8, i: 0.8, d: 5 }],
      [{ t: "orco",   n: 8,  i: 1.3 }, { t: "chaman", n: 4, i: 2.2, d: 4 }],
    ],
  },
  {
    id: 4, name: "Los dos caminos", gold: 330, lives: 20, seed: 44,
    paths: [
      [[-40, 130], [200, 130], [330, 200], [480, 260], [620, 300], [780, 300], [880, 380], [1010, 380]],
      [[-40, 460], [220, 460], [360, 390], [480, 330], [620, 300], [780, 300], [880, 380], [1010, 380]],
    ],
    spots: [[170, 190], [280, 130], [300, 270], [430, 200], [260, 400], [380, 460], [430, 330], [560, 250], [560, 370], [700, 240], [720, 370], [830, 310]],
    waves: [
      [{ t: "goblin", n: 6, i: 1.2, p: 0 }, { t: "goblin", n: 6, i: 1.2, p: 1 }],
      [{ t: "lobo", n: 6, i: 0.9, p: 0 }, { t: "goblin", n: 8, i: 1.0, p: 1, d: 3 }],
      [{ t: "orco", n: 4, i: 2.0, p: 1 }, { t: "lobo", n: 6, i: 0.9, p: 0, d: 4 }],
      [{ t: "goblin", n: 10, i: 0.8, p: 0 }, { t: "orco", n: 4, i: 1.8, p: 1, d: 2 }],
      [{ t: "chaman", n: 2, i: 3.0, p: 0 }, { t: "orco", n: 5, i: 1.8, p: 0, d: 1 }],
      [{ t: "lobo", n: 8, i: 0.7, p: 0 }, { t: "lobo", n: 8, i: 0.7, p: 1 }],
      [{ t: "orco", n: 6, i: 1.6, p: 1 }, { t: "chaman", n: 3, i: 2.5, p: 1, d: 3 }],
      [{ t: "goblin", n: 14, i: 0.6, p: 0 }, { t: "goblin", n: 14, i: 0.6, p: 1, d: 2 }],
      [{ t: "orco", n: 8, i: 1.4, p: 0 }, { t: "lobo", n: 10, i: 0.7, p: 1, d: 4 }],
      [{ t: "orco", n: 10, i: 1.2, p: 1 }, { t: "chaman", n: 4, i: 2.2, p: 0, d: 3 }],
    ],
  },
  {
    id: 5, name: "La guarida del ogro", gold: 350, lives: 20, seed: 55,
    paths: [
      [[-40, 430], [180, 430], [280, 340], [200, 230], [300, 140], [500, 140], [600, 240], [520, 340], [620, 430], [820, 430], [900, 330], [900, 190], [1010, 120]],
    ],
    spots: [[150, 360], [250, 470], [215, 290], [305, 230], [360, 90], [430, 200], [560, 90], [590, 180], [545, 280], [590, 390], [700, 370], [760, 480], [840, 280], [845, 170]],
    waves: [
      [{ t: "goblin", n: 8,  i: 1.1 }],
      [{ t: "lobo",   n: 8,  i: 0.9 }],
      [{ t: "orco",   n: 5,  i: 1.8 }],
      [{ t: "goblin", n: 10, i: 0.8 }, { t: "chaman", n: 2, i: 3.0, d: 4 }],
      [{ t: "orco",   n: 6,  i: 1.6 }, { t: "lobo", n: 6, i: 0.8, d: 5 }],
      [{ t: "lobo",   n: 14, i: 0.6 }],
      [{ t: "orco",   n: 7,  i: 1.4 }, { t: "chaman", n: 3, i: 2.4, d: 3 }],
      [{ t: "goblin", n: 16, i: 0.55 }, { t: "lobo", n: 8, i: 0.7, d: 6 }],
      [{ t: "orco",   n: 9,  i: 1.2 }, { t: "chaman", n: 4, i: 2.0, d: 4 }],
      [{ t: "lobo",   n: 12, i: 0.6 }, { t: "orco", n: 6, i: 1.4, d: 4 }],
      [{ t: "goblin", n: 18, i: 0.5 }, { t: "chaman", n: 4, i: 2.0, d: 5 }, { t: "orco", n: 6, i: 1.4, d: 8 }],
      [{ t: "ogro",   n: 1,  i: 1 },   { t: "orco", n: 6, i: 1.6, d: 3 }, { t: "chaman", n: 3, i: 2.5, d: 6 }],
    ],
  },

  // ---------------- REGIÓN DESIERTO ----------------
  {
    id: 6, name: "La duna ardiente", gold: 380, lives: 20, seed: 66, region: "desierto",
    paths: [
      [[-40, 270], [180, 270], [280, 180], [430, 180], [520, 290], [700, 290], [790, 200], [1010, 200]],
    ],
    spots: [[215, 225], [245, 335], [355, 140], [380, 255], [470, 240], [560, 345], [650, 235], [750, 260]],
    waves: [
      [{ t: "goblin", n: 8, i: 1.0 }],
      [{ t: "lobo", n: 7, i: 0.9 }],
      [{ t: "orco", n: 5, i: 1.7 }],
      [{ t: "escorpion", n: 5, i: 1.6 }],
      [{ t: "murcielago", n: 8, i: 0.8 }],
      [{ t: "escorpion", n: 5, i: 1.5 }, { t: "murcielago", n: 6, i: 0.8, d: 4 }],
      [{ t: "orco", n: 6, i: 1.5 }, { t: "escorpion", n: 4, i: 1.6, d: 5 }],
      [{ t: "murcielago", n: 10, i: 0.6 }, { t: "chaman", n: 3, i: 2.5, d: 3 }],
      [{ t: "escorpion", n: 7, i: 1.3 }, { t: "orco", n: 6, i: 1.5, d: 4 }],
      [{ t: "escorpion", n: 6, i: 1.2 }, { t: "murcielago", n: 8, i: 0.7, d: 3 }, { t: "orco", n: 5, i: 1.5, d: 6 }],
    ],
  },
  {
    id: 7, name: "El oasis perdido", gold: 400, lives: 20, seed: 77, region: "desierto",
    river: { x: 480, w: 60, bridgeY: 250, bridgeH: 60 },
    paths: [
      [[-40, 120], [210, 120], [300, 210], [420, 260], [620, 260], [700, 170], [820, 170], [870, 280], [1010, 280]],
    ],
    spots: [[175, 175], [270, 145], [345, 260], [400, 190], [560, 220], [610, 340], [730, 200], [770, 320], [850, 230]],
    waves: [
      [{ t: "goblin", n: 9, i: 0.9 }],
      [{ t: "escorpion", n: 5, i: 1.5 }],
      [{ t: "murcielago", n: 8, i: 0.75 }],
      [{ t: "momia", n: 3, i: 2.4 }],
      [{ t: "orco", n: 6, i: 1.4 }, { t: "escorpion", n: 4, i: 1.6, d: 4 }],
      [{ t: "momia", n: 4, i: 2.2 }, { t: "murcielago", n: 6, i: 0.8, d: 3 }],
      [{ t: "escorpion", n: 7, i: 1.2 }, { t: "chaman", n: 3, i: 2.5, d: 4 }],
      [{ t: "momia", n: 5, i: 2.0 }, { t: "orco", n: 6, i: 1.4, d: 4 }],
      [{ t: "murcielago", n: 10, i: 0.6 }, { t: "escorpion", n: 6, i: 1.3, d: 3 }],
      [{ t: "momia", n: 6, i: 1.8 }, { t: "murcielago", n: 8, i: 0.7, d: 4 }, { t: "escorpion", n: 5, i: 1.4, d: 7 }],
    ],
  },
  {
    id: 8, name: "Las ruinas olvidadas", gold: 430, lives: 20, seed: 88, region: "desierto",
    paths: [
      [[-40, 150], [200, 150], [330, 220], [480, 280], [620, 300], [780, 300], [880, 380], [1010, 380]],
      [[-40, 480], [220, 480], [360, 410], [480, 350], [620, 300], [780, 300], [880, 380], [1010, 380]],
    ],
    spots: [[170, 210], [280, 150], [300, 290], [430, 220], [260, 420], [380, 480], [430, 350], [560, 270], [560, 390], [700, 260], [720, 390], [830, 330]],
    waves: [
      [{ t: "goblin", n: 6, i: 1.1, p: 0 }, { t: "escorpion", n: 4, i: 1.6, p: 1 }],
      [{ t: "murcielago", n: 6, i: 0.8, p: 0 }, { t: "orco", n: 5, i: 1.6, p: 1, d: 3 }],
      [{ t: "escorpion", n: 5, i: 1.4, p: 1 }, { t: "murcielago", n: 5, i: 0.8, p: 0, d: 4 }],
      [{ t: "momia", n: 4, i: 2.0, p: 0 }, { t: "escorpion", n: 4, i: 1.5, p: 1 }],
      [{ t: "gargola", n: 2, i: 3.0, p: 0 }, { t: "orco", n: 6, i: 1.5, p: 1, d: 2 }],
      [{ t: "murcielago", n: 10, i: 0.6, p: 1 }, { t: "momia", n: 3, i: 2.2, p: 0 }],
      [{ t: "escorpion", n: 7, i: 1.2, p: 0 }, { t: "gargola", n: 2, i: 3.0, p: 1, d: 3 }],
      [{ t: "momia", n: 5, i: 1.8, p: 1 }, { t: "murcielago", n: 8, i: 0.7, p: 0, d: 3 }],
      [{ t: "gargola", n: 3, i: 2.6, p: 0 }, { t: "escorpion", n: 6, i: 1.3, p: 1, d: 3 }],
      [{ t: "momia", n: 6, i: 1.6, p: 0 }, { t: "gargola", n: 3, i: 2.4, p: 1, d: 4 }, { t: "murcielago", n: 8, i: 0.6, p: 1, d: 8 }],
    ],
  },
  {
    id: 9, name: "El paso de los escorpiones", gold: 450, lives: 20, seed: 99, region: "desierto",
    paths: [
      [[430, -40], [430, 130], [300, 210], [180, 300], [300, 400], [520, 400], [640, 300], [560, 200], [700, 130], [860, 210], [860, 390], [1010, 440]],
    ],
    spots: [[370, 160], [490, 160], [250, 270], [255, 370], [385, 350], [470, 470], [590, 360], [600, 250], [690, 210], [790, 290], [800, 430]],
    waves: [
      [{ t: "escorpion", n: 6, i: 1.4 }],
      [{ t: "murcielago", n: 8, i: 0.75 }],
      [{ t: "momia", n: 4, i: 2.0 }],
      [{ t: "escorpion", n: 6, i: 1.3 }, { t: "momia", n: 3, i: 2.2, d: 3 }],
      [{ t: "gargola", n: 3, i: 2.6 }],
      [{ t: "murcielago", n: 12, i: 0.55 }],
      [{ t: "escorpion", n: 8, i: 1.1 }, { t: "gargola", n: 2, i: 2.8, d: 4 }],
      [{ t: "momia", n: 6, i: 1.7 }, { t: "murcielago", n: 8, i: 0.7, d: 4 }],
      [{ t: "escorpion", n: 9, i: 1.0 }, { t: "momia", n: 5, i: 1.8, d: 4 }],
      [{ t: "gargola", n: 4, i: 2.2 }, { t: "escorpion", n: 8, i: 1.1, d: 4 }],
      [{ t: "momia", n: 7, i: 1.5 }, { t: "murcielago", n: 10, i: 0.6, d: 5 }, { t: "escorpion", n: 6, i: 1.2, d: 8 }],
    ],
  },
  {
    id: 10, name: "El vuelo nocturno", gold: 470, lives: 20, seed: 1010, region: "desierto",
    paths: [
      [[-40, 300], [160, 300], [270, 210], [420, 210], [520, 330], [700, 330], [800, 230], [1010, 230]],
    ],
    spots: [[195, 250], [225, 360], [335, 155], [365, 280], [470, 260], [565, 385], [660, 265], [760, 295]],
    waves: [
      [{ t: "murcielago", n: 10, i: 0.7 }],
      [{ t: "escorpion", n: 5, i: 1.5 }],
      [{ t: "gargola", n: 3, i: 2.6 }],
      [{ t: "murcielago", n: 12, i: 0.55 }, { t: "escorpion", n: 4, i: 1.6, d: 3 }],
      [{ t: "gargola", n: 4, i: 2.3 }],
      [{ t: "murcielago", n: 14, i: 0.5 }, { t: "momia", n: 4, i: 2.0, d: 4 }],
      [{ t: "gargola", n: 5, i: 2.0 }, { t: "murcielago", n: 8, i: 0.7, d: 3 }],
      [{ t: "escorpion", n: 8, i: 1.1 }, { t: "gargola", n: 4, i: 2.2, d: 4 }],
      [{ t: "murcielago", n: 16, i: 0.45 }, { t: "gargola", n: 4, i: 2.2, d: 5 }],
      [{ t: "gargola", n: 6, i: 1.8 }, { t: "murcielago", n: 12, i: 0.5, d: 4 }, { t: "escorpion", n: 6, i: 1.3, d: 8 }],
    ],
  },
  {
    id: 11, name: "La tormenta de arena", gold: 500, lives: 20, seed: 1111, region: "desierto",
    paths: [
      [[-40, 130], [200, 130], [330, 200], [480, 260], [620, 300], [780, 300], [880, 380], [1010, 380]],
      [[-40, 460], [220, 460], [360, 390], [480, 330], [620, 300], [780, 300], [880, 380], [1010, 380]],
    ],
    spots: [[170, 190], [280, 130], [300, 270], [430, 200], [260, 400], [380, 460], [430, 330], [560, 250], [560, 370], [700, 240], [720, 370], [830, 310]],
    waves: [
      [{ t: "escorpion", n: 6, i: 1.3, p: 0 }, { t: "murcielago", n: 6, i: 0.8, p: 1 }],
      [{ t: "momia", n: 4, i: 2.0, p: 1 }, { t: "escorpion", n: 5, i: 1.4, p: 0, d: 3 }],
      [{ t: "gargola", n: 3, i: 2.4, p: 0 }, { t: "momia", n: 4, i: 2.0, p: 1, d: 2 }],
      [{ t: "murcielago", n: 12, i: 0.55, p: 1 }, { t: "escorpion", n: 6, i: 1.3, p: 0, d: 3 }],
      [{ t: "gargola", n: 4, i: 2.2, p: 0 }, { t: "gargola", n: 4, i: 2.2, p: 1 }],
      [{ t: "momia", n: 6, i: 1.6, p: 0 }, { t: "murcielago", n: 10, i: 0.6, p: 1, d: 3 }],
      [{ t: "escorpion", n: 8, i: 1.1, p: 1 }, { t: "gargola", n: 4, i: 2.0, p: 0, d: 3 }],
      [{ t: "murcielago", n: 14, i: 0.5, p: 0 }, { t: "momia", n: 6, i: 1.6, p: 1, d: 4 }],
      [{ t: "gargola", n: 6, i: 1.7, p: 1 }, { t: "escorpion", n: 8, i: 1.1, p: 0, d: 4 }],
      [{ t: "momia", n: 8, i: 1.4, p: 0 }, { t: "gargola", n: 5, i: 1.8, p: 1, d: 3 }, { t: "murcielago", n: 12, i: 0.5, p: 1, d: 8 }],
    ],
  },
  {
    id: 12, name: "El trono de la Gárgola Real", gold: 550, lives: 24, seed: 1212, region: "desierto",
    paths: [
      [[-40, 430], [180, 430], [280, 340], [200, 230], [300, 140], [500, 140], [600, 240], [520, 340], [620, 430], [820, 430], [900, 330], [900, 190], [1010, 120]],
    ],
    spots: [[150, 360], [250, 470], [215, 290], [305, 230], [360, 90], [430, 200], [560, 90], [590, 180], [545, 280], [590, 390], [700, 370], [760, 480], [840, 280], [845, 170]],
    waves: [
      [{ t: "escorpion", n: 7, i: 1.2 }],
      [{ t: "murcielago", n: 10, i: 0.65 }],
      [{ t: "momia", n: 5, i: 1.8 }],
      [{ t: "gargola", n: 4, i: 2.2 }],
      [{ t: "escorpion", n: 8, i: 1.1 }, { t: "murcielago", n: 8, i: 0.7, d: 3 }],
      [{ t: "momia", n: 6, i: 1.6 }, { t: "gargola", n: 4, i: 2.0, d: 4 }],
      [{ t: "murcielago", n: 14, i: 0.5 }, { t: "escorpion", n: 7, i: 1.1, d: 3 }],
      [{ t: "gargola", n: 6, i: 1.7 }, { t: "momia", n: 6, i: 1.6, d: 4 }],
      [{ t: "escorpion", n: 10, i: 0.9 }, { t: "murcielago", n: 12, i: 0.55, d: 4 }],
      [{ t: "gargola", n: 7, i: 1.5 }, { t: "momia", n: 7, i: 1.5, d: 4 }, { t: "escorpion", n: 8, i: 1.0, d: 8 }],
      [{ t: "murcielago", n: 16, i: 0.45 }, { t: "gargola", n: 6, i: 1.6, d: 4 }, { t: "momia", n: 6, i: 1.6, d: 8 }],
      [{ t: "gargolaRey", n: 1, i: 1 }, { t: "gargola", n: 6, i: 1.6, d: 3 }, { t: "escorpion", n: 8, i: 1.0, d: 6 }, { t: "murcielago", n: 10, i: 0.6, d: 9 }],
    ],
  },

  // ---------------- REGIÓN MONTAÑA ----------------
  {
    id: 13, name: "El paso helado", gold: 600, lives: 20, seed: 1313, region: "montana",
    paths: [
      [[-40, 300], [180, 300], [280, 200], [430, 200], [520, 320], [700, 320], [800, 220], [1010, 220]],
    ],
    spots: [[215, 225], [245, 335], [355, 140], [380, 255], [470, 240], [560, 345], [650, 235], [750, 260]],
    waves: [
      [{ t: "orco", n: 8, i: 1.1 }],
      [{ t: "escorpion", n: 6, i: 1.3 }],
      [{ t: "chaman", n: 4, i: 2.0 }, { t: "orco", n: 6, i: 1.2, d: 2 }],
      [{ t: "gargola", n: 4, i: 2.2 }],
      [{ t: "murcielago", n: 10, i: 0.65 }, { t: "escorpion", n: 5, i: 1.3, d: 3 }],
      [{ t: "orco", n: 9, i: 1.0 }, { t: "chaman", n: 4, i: 2.0, d: 3 }],
      [{ t: "gargola", n: 5, i: 1.9 }, { t: "murcielago", n: 8, i: 0.7, d: 3 }],
      [{ t: "escorpion", n: 9, i: 1.0 }, { t: "orco", n: 7, i: 1.1, d: 4 }],
      [{ t: "gargola", n: 6, i: 1.7 }, { t: "chaman", n: 5, i: 1.9, d: 4 }],
      [{ t: "murcielago", n: 14, i: 0.5 }, { t: "escorpion", n: 8, i: 1.0, d: 4 }, { t: "orco", n: 8, i: 1.1, d: 8 }],
    ],
  },
  {
    id: 14, name: "La grieta bifurcada", gold: 650, lives: 20, seed: 1414, region: "montana",
    trunk: [[-40, 270], [200, 270], [300, 180]],
    forkOptions: [
      [[450, 180], [600, 180], [700, 270], [1010, 270]],
      [[450, 300], [600, 300], [700, 270], [1010, 270]],
    ],
    spots: [[240, 220], [340, 130], [500, 130], [500, 230], [530, 330], [500, 380], [650, 150], [650, 330], [800, 220], [850, 320]],
    waves: [
      [{ t: "orco", n: 10, i: 1.0 }],
      [{ t: "escorpion", n: 8, i: 1.1 }],
      [{ t: "gargola", n: 5, i: 1.9 }],
      [{ t: "murcielago", n: 12, i: 0.6 }],
      [{ t: "orco", n: 10, i: 0.95 }, { t: "chaman", n: 4, i: 2.0, d: 3 }],
      [{ t: "escorpion", n: 10, i: 0.95 }, { t: "gargola", n: 4, i: 2.0, d: 3 }],
      [{ t: "murcielago", n: 14, i: 0.55 }, { t: "escorpion", n: 8, i: 1.0, d: 4 }],
      [{ t: "gargola", n: 7, i: 1.6 }, { t: "orco", n: 9, i: 1.0, d: 4 }],
      [{ t: "escorpion", n: 12, i: 0.85 }, { t: "murcielago", n: 10, i: 0.6, d: 4 }, { t: "chaman", n: 4, i: 2.0, d: 8 }],
      [{ t: "gargola", n: 8, i: 1.4 }, { t: "orco", n: 12, i: 0.9, d: 4 }, { t: "escorpion", n: 8, i: 1.0, d: 9 }],
    ],
  },
  {
    id: 15, name: "La guarida del Yeti", gold: 720, lives: 22, seed: 1515, region: "montana",
    trunk: [[-40, 270], [180, 270], [280, 270]],
    forkOptions: [
      [[400, 140], [600, 140], [750, 220], [850, 270], [1010, 270]],
      [[400, 270], [600, 270], [750, 270], [850, 270], [1010, 270]],
      [[400, 400], [600, 400], [750, 320], [850, 270], [1010, 270]],
    ],
    spots: [[220, 220], [220, 330], [500, 100], [500, 200], [500, 340], [500, 440], [680, 180], [680, 360], [800, 220], [800, 330]],
    waves: [
      [{ t: "orco", n: 10, i: 0.95 }],
      [{ t: "escorpion", n: 9, i: 1.0 }],
      [{ t: "gargola", n: 6, i: 1.7 }],
      [{ t: "murcielago", n: 14, i: 0.55 }],
      [{ t: "chaman", n: 5, i: 1.9 }, { t: "orco", n: 10, i: 0.9, d: 3 }],
      [{ t: "escorpion", n: 12, i: 0.85 }, { t: "gargola", n: 6, i: 1.6, d: 3 }],
      [{ t: "murcielago", n: 16, i: 0.5 }, { t: "escorpion", n: 10, i: 0.9, d: 4 }],
      [{ t: "gargola", n: 8, i: 1.5 }, { t: "orco", n: 12, i: 0.85, d: 4 }],
      [{ t: "escorpion", n: 14, i: 0.75 }, { t: "murcielago", n: 14, i: 0.5, d: 4 }, { t: "chaman", n: 5, i: 1.8, d: 8 }],
      [{ t: "gargola", n: 10, i: 1.3 }, { t: "orco", n: 14, i: 0.8, d: 4 }, { t: "escorpion", n: 10, i: 0.9, d: 9 }],
      [{ t: "murcielago", n: 18, i: 0.45 }, { t: "gargola", n: 10, i: 1.3, d: 4 }, { t: "escorpion", n: 10, i: 0.9, d: 9 }],
      [{ t: "yeti", n: 1, i: 1 }, { t: "gargola", n: 8, i: 1.4, d: 3 }, { t: "orco", n: 12, i: 0.85, d: 6 }, { t: "escorpion", n: 10, i: 0.9, d: 9 }],
    ],
  },
];
