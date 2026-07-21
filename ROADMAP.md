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

## ✅ Equilibrado y sonido (hecho 10/07/2026)
- Sonido: música de fondo y efectos de combate con Web Audio API (sin archivos), botón de silencio.
- Reequilibrado completo tras detectar que se ganaba solo con héroes, sin construir torres:
  - Identidades de resistencia más marcadas (armadura/resistencia mágica más extremas) para que
    algunos enemigos necesiten sí o sí torres físicas y otros mágicas.
  - Resistencia a la ralentización del Hielo (`slowRes`/`slowImmune`): los jefes y bestias grandes
    apenas la notan; los enemigos ligeros y rápidos sí.
  - 4 enemigos nuevos con identidad clara: Coloso (físico extremo, inmune al hielo), Espectro Alado
    (volador resistente a la magia), Enjambre (frágil y rapidísimo), Berserker (rápido y golpea fuerte).
  - Modo difícil ahora sube vida, daño, armadura/resistencia mágica Y velocidad a la vez (como el
    modo Imposible de Kingdom Rush), no solo la vida.
  - Más oleadas y más enemigos por oleada en los 15 niveles, llegando más rápido, para que dos
    héroes solos no puedan aguantar el ritmo sin ayuda de torres.
  - Validado con simulaciones automáticas: sin torres se pierde siempre; con una buena
    combinación de torres (rama + maestría) se puede ganar, incluido el nivel final.

## ✅ Repaso gráfico (hecho 10/07/2026)
- Degradados y un brillo superior sutil en todas las formas del juego (héroes, enemigos, torres,
  decorado): da sensación de volumen sin dejar de ser el mismo estilo dibujado por código.
- Sombras del decorado proyectadas con ángulo en vez de una elipse plana debajo.
- Viñeta sutil en los bordes del campo de batalla para dar profundidad.
- Partículas ambientales según la región (hojas en el Bosque, arena en el Desierto, nieve en la
  Montaña) y chispazos al golpear en cualquier combate, no solo en explosiones de área.
- Menús: transición suave al cambiar de pantalla, botones con pulsación más viva, nubes con
  parallax lento en la pantalla de título.
- Techo real de esta técnica: sigue siendo un estilo vectorial dibujado por código (sin imágenes
  ni 3D). Para un salto mayor (iluminación dinámica, brillos, muchas más partículas) habría que
  pasar el renderizado de Canvas 2D a WebGL — se aborda en la fase siguiente.

## 🚧 Migración a 3D (en curso, rama `migracion-3d`)

Reemplaza el render de Canvas 2D por Three.js con estilo cartoon (sombreado plano + contorno).
**No está publicado**: `main` sigue sirviendo el juego 2D en GitHub Pages. Se fusionará cuando el
3D esté al nivel visual del 2D.

Hecho:
- Motor de render 3D (`js/render3d.js`), las 7 torres con sus 3 niveles, los 15 enemigos y los
  6 héroes modelados.
- Terreno con relieve por región y camino con borde que lo sigue. Todo (terreno, camino, decorado,
  torres, unidades) consulta la misma función de altura, `R3.groundY`, para que no se descuadren.
- Decorado de las tres regiones, con el mismo reparto procedural que el juego 2D.
- Huecos de construcción, círculo de alcance y banderín de reunión, que el port se había dejado.
- Los huecos se apartan del camino en el motor (`layoutSpots`), no en los datos, así que vale
  también para niveles nuevos. Las torres crecen en altura y poco a lo ancho, para no invadirlo.
- Barras de vida de enemigos, héroes y soldados.
- Flecha roja de entrada y banderín azul de salida del camino.
- Los ocho tipos de efecto del motor: chispazos, humo al morir y clima por región.

- Puente de madera sobre el río, viñeta de los bordes y reloj de reaparición del héroe caído.

- Encuadre de cámara que se adapta a la pantalla (en móvil gana un 36% de tamaño).

Probado en iPhone: tocar las torres altas funciona bien, no hace falta arreglarlo.

Pendiente — **decisión abierta: el juego se ve lejano**:
En 2D se distinguían las caras de los héroes; en 3D no. Los modelos son casi del mismo tamaño
(héroe 32 px contra 40 en 2D), así que el problema es la proyección: con la cámara a 50° sobre el
horizonte todo lo vertical se acorta, y el ancho del campo ya ocupa el 96% de la pantalla, así que
no se puede acercar más sin recortar. Medido que mover el ángulo empeora en ambos sentidos.
Quedan dos salidas, sin decidir:
  1. Agrandar héroes y enemigos un 30-40%. Rápido y reversible, pero quedan grandes respecto al
     camino y las torres.
  2. Zoom con dos dedos, como Kingdom Rush en móvil. Más trabajo, no sacrifica nada.

- Jugarlo de verdad unos niveles antes de fusionar a `main`.

Equilibrio: comprobado con `node tools/simular-equilibrio.js`, que juega los 15 niveles en seco y
compara los huecos actuales contra los originales. Con 12 repeticiones por nivel: ningún nivel
cambia de resultado, la peor caída de aguante es del 2,3% y la media es -0,34%. O sea, apartar las
torres del camino no ha movido el equilibrio.

Notas de trabajo:
- Al cambiar cualquier fichero del juego hay que subir **dos** números y dejarlos iguales:
  `CACHE` en `sw.js` y el `?v=` de los `<script>` y el `<link>` de `index.html`. Son dos cachés
  distintas: la primera es la del juego instalado, la segunda es lo único que obliga al navegador
  a soltar su copia del JavaScript. Olvidar el `?v=` significa seguir viendo código viejo sin
  enterarte — costó tres rondas de "esto sigue sin estar arreglado" cuando ya lo estaba.

## Fase 4 — Infierno (niveles 16+) y jefe final
- Demonios, lava, jefe final con fases.
- Sonidos y música (WebAudio).

## Notas técnicas
- Todo vanilla JS, sin dependencias. Lienzo lógico 960x540.
- Datos de equilibrio en `js/data.js` (niveles/oleadas incluidos).
- Servidor local: puerto 8619 (`.claude/launch.json` → torres-alianza).
