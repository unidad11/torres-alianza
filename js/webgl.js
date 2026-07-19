/* ============================================================
   TORRES ALIANZA — capa de luz (WebGL)
   La escena se sigue dibujando en 2D como siempre, en un lienzo
   oculto; aquí se pinta en pantalla añadiendo luces dinámicas
   (explosiones, proyectiles, gemas de torres) por GPU.
   Si WebGL no está disponible, el juego funciona igual sin luces.
   ============================================================ */
"use strict";
(function () {
  const W = TA.webgl = {};
  const MAX_LIGHTS = 16;

  let gl = null, tex = null, uLoc = {};
  let firstUpload = true;

  W.init = function (canvas) {
    try {
      gl = canvas.getContext("webgl", { alpha: false, antialias: false });
    } catch (e) { gl = null; }
    if (!gl) return false;

    const vs = "attribute vec2 aPos; varying vec2 vUV;" +
      "void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";
    const fs =
      "precision mediump float;\n" +
      "varying vec2 vUV;\n" +
      "uniform sampler2D uTex;\n" +
      "uniform vec2 uRes;\n" +
      "uniform int uCount;\n" +
      "uniform vec3 uPos[" + MAX_LIGHTS + "];\n" +   // x, y (desde abajo), radio
      "uniform vec3 uColor[" + MAX_LIGHTS + "];\n" +
      "uniform float uInt[" + MAX_LIGHTS + "];\n" +
      "void main(){\n" +
      "  vec4 base = texture2D(uTex, vUV);\n" +
      "  vec2 px = vUV * uRes;\n" +
      "  vec3 add = vec3(0.0);\n" +
      "  for (int i = 0; i < " + MAX_LIGHTS + "; i++) {\n" +
      "    if (i >= uCount) break;\n" +
      "    float d = distance(px, uPos[i].xy);\n" +
      "    float a = 1.0 - smoothstep(0.0, uPos[i].z, d);\n" +
      "    add += uColor[i] * (a * a) * uInt[i];\n" +
      "  }\n" +
      "  gl_FragColor = vec4(base.rgb * 0.97 + add, 1.0);\n" +
      "}";

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    const v = compile(gl.VERTEX_SHADER, vs);
    const f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) { gl = null; return false; }

    const prog = gl.createProgram();
    gl.attachShader(prog, v);
    gl.attachShader(prog, f);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    uLoc = {
      res: gl.getUniformLocation(prog, "uRes"),
      count: gl.getUniformLocation(prog, "uCount"),
      pos: gl.getUniformLocation(prog, "uPos"),
      color: gl.getUniformLocation(prog, "uColor"),
      inten: gl.getUniformLocation(prog, "uInt"),
    };
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uLoc.res, canvas.width, canvas.height);
    firstUpload = true;
    return true;
  };

  // pinta el lienzo 2D en pantalla con las luces encima
  W.composite = function (srcCanvas, lights) {
    if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (firstUpload) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
      firstUpload = false;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
    }

    const n = Math.min(lights.length, MAX_LIGHTS);
    const pos = new Float32Array(MAX_LIGHTS * 3);
    const col = new Float32Array(MAX_LIGHTS * 3);
    const inten = new Float32Array(MAX_LIGHTS);
    for (let i = 0; i < n; i++) {
      const L = lights[i];
      pos[i * 3] = L.x;
      pos[i * 3 + 1] = TA.H - L.y; // WebGL mide la Y desde abajo
      pos[i * 3 + 2] = L.r;
      col[i * 3] = L.c[0]; col[i * 3 + 1] = L.c[1]; col[i * 3 + 2] = L.c[2];
      inten[i] = L.i;
    }
    gl.uniform1i(uLoc.count, n);
    gl.uniform3fv(uLoc.pos, pos);
    gl.uniform3fv(uLoc.color, col);
    gl.uniform1fv(uLoc.inten, inten);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // recoge las luces de la partida, de más a menos llamativas
  W.collectLights = function (game, t) {
    const out = [];
    if (!game) return out;

    for (const fx of game.effects) {
      if (fx.kind === "boom") {
        const k = 1 - fx.age / fx.dur;
        out.push({ x: fx.x, y: fx.y, r: fx.r * 2.5 + 40, c: [1.0, 0.6, 0.25], i: 0.9 * k });
      }
      if (out.length >= MAX_LIGHTS) return out;
    }

    for (const p of game.projectiles) {
      if (p.delay > 0) continue;
      if (p.kind === "meteoro") out.push({ x: p.x, y: p.y, r: 85, c: [1.0, 0.55, 0.2], i: 0.8 });
      else if (p.kind === "rayo") out.push({ x: p.x, y: p.y, r: 55, c: [0.45, 0.75, 1.0], i: 0.5 });
      else if (p.kind === "rayo_cadena") out.push({ x: p.x, y: p.y, r: 55, c: [1.0, 0.95, 0.5], i: 0.55 });
      else if (p.kind === "hielo") out.push({ x: p.x, y: p.y, r: 45, c: [0.6, 0.9, 1.0], i: 0.4 });
      if (out.length >= MAX_LIGHTS) return out;
    }

    for (const tw of game.towers) {
      if (tw.type === "magos") out.push({ x: tw.x, y: tw.y - 45, r: 55, c: [0.5, 0.8, 1.0], i: 0.2 + Math.sin(t * 4) * 0.07 });
      else if (tw.type === "electrica") out.push({ x: tw.x, y: tw.y - 40, r: 55, c: [1.0, 0.95, 0.55], i: 0.24 + Math.sin(t * 9) * 0.09 });
      else if (tw.type === "hielo") out.push({ x: tw.x, y: tw.y - 40, r: 45, c: [0.65, 0.9, 1.0], i: 0.16 });
      else if (tw.type === "apoyo") out.push({ x: tw.x, y: tw.y - 30, r: 60, c: [1.0, 0.85, 0.4], i: 0.14 });
      if (out.length >= MAX_LIGHTS) return out;
    }

    return out;
  };
})();
