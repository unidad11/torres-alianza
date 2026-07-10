# Torres Alianza — hoja de ruta

Juego de torres tipo Kingdom Rush Alliance, como webapp (PWA) para iPhone.
Arte propio dibujado por código (sin copiar gráficos de Ironhide).

## ✅ Fase 1 — Motor + Bosque (hecha 09/07/2026)
- Motor completo: caminos, oleadas, bloqueo cuerpo a cuerpo, proyectiles.
- 4 torres (Arqueros, Cuartel, Magos, Cañón) con 3 niveles de mejora y venta.
- 2 héroes a la vez (Roldán melé + Lyra a distancia) con habilidades automáticas.
- 2 poderes del jugador: Refuerzos y Lluvia de fuego.
- 5 enemigos: goblin, lobo, orco, chamán (cura), ogro (jefe).
- 5 niveles (región Bosque), estrellas, desbloqueo y guardado (localStorage).
- PWA instalable + lanzador `Jugar Torres Alianza.command`.

## ✅ Fase 2 — Desierto (hecha 09/07/2026)
- Región Desierto con decorado propio (arena, dunas, cactus, ruinas) y niveles 6-12.
- Enemigos voladores (murciélago, gárgola, gárgola real jefe): no los bloquean soldados/héroes cuerpo a
  cuerpo, y el cañón no les alcanza — hacen falta arqueros, magos o héroes a distancia.
- Escorpión (acorazado) y momia (se regenera) como enemigos terrestres nuevos.
- Ramas de especialización al nivel máximo de cada torre (Arqueros → Francotirador/Mosquetero,
  Magos → Archimago/Piromante, Cuartel → Veteranos/Asalto, Cañón → Mortero/Metralla).
- 2 héroes nuevos (Amir, espadachín rápido; Zahra, lanza dagas) desbloqueados al llegar al nivel 6.
- Pantalla de elección de escuadra (2 héroes) antes de cada batalla.
- Mapa con pestañas Bosque / Desierto.

## ✅ Fase 3 — Progresión permanente + Montaña (hecha 09/07/2026)
- Motor: caminos que se bifurcan a mitad de recorrido (antes solo había caminos paralelos completos).
- 3 torres nuevas: Hielo (ralentiza), Eléctrica (rayo en cadena) y Apoyo (aura de mejora, no ataca).
- Segundo nivel de rama en cada torre (más recorrido tras Fase 2).
- Puntos de Alianza: moneda permanente que se gana al ganar una batalla (según estrellas/dificultad),
  guardada entre partidas.
- Árbol de talento propio por cada héroe (mejoras permanentes compradas con Puntos de Alianza).
- Árbol de tecnología global (daño/alcance/velocidad de torres y héroes, comprado con Puntos de Alianza).
- 2 héroes nuevos (total 6).
- Región Montaña (niveles 13-15): nieve, enemigos con más resistencia mágica.
- Logros y modo difícil (más vida/daño a los enemigos, más Puntos de Alianza a cambio).

## Fase 4 — Infierno (niveles 16+) y jefe final
- Demonios, lava, jefe final con fases.
- Sonidos y música (WebAudio).

## Notas técnicas
- Todo vanilla JS, sin dependencias. Lienzo lógico 960x540.
- Datos de equilibrio en `js/data.js` (niveles/oleadas incluidos).
- Servidor local: puerto 8619 (`.claude/launch.json` → torres-alianza).
