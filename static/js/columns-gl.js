/* Porticus — três colunas romanas em mármore e uma tessera de vidro cinábrio, em 3D (WebGL, sem bibliotecas).
   Geometria rasterizada (alguns milhares de triângulos): muito mais leve que raymarching.
   Colunas: perfil torneado (plinto quadrado, toro, fuste com êntase e 20 caneluras, equino, ábaco).
   Interação: o mouse orbita a câmera; o scroll faz a câmera subir e atravessar o pórtico; arrastar gira.
   Custo: desenha só quando algo muda (mouse, scroll, arrasto, entrada) e, parado, a 12 fps para a tessera flutuar;
   pausa fora da tela e com a aba oculta. Com movimento reduzido, um quadro só. */
(function () {
  "use strict";
  const cv = document.getElementById("vitrum");
  if (!cv) return;
  const wrap = cv.closest(".vitrum");
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = cv.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) { wrap.classList.add("no-gl"); return; }

  // ── matemática mínima (mat4 coluna-maior) ──
  const M = {
    persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]; },
    look(e, c, u) {
      let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map((v) => v / l);
      let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x = x.map((v) => v / l);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
    },
    mul(a, b) { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
    trs(tx, ty, tz, ry, rx, s) {
      const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      return [cy * s, 0, -sy * s, 0, sy * sx * s, cx * s, cy * sx * s, 0, sy * cx * s, -sx * s, cy * cx * s, 0, tx, ty, tz, 1];
    },
  };

  // ── geometria ──
  function smoothNormals(pos, idx) {
    const n = new Float32Array(pos.length);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
    }
    for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
    return n;
  }
  // perfil da coluna: [altura, raio, caneluras?]
  const PROFILE = [];
  const add = (y, r, fl) => PROFILE.push([y, r, fl ? 1 : 0]);
  add(0.20, 0.0); add(0.20, 0.56);                                   // topo do plinto (o plinto é uma caixa)
  for (let i = 0; i <= 8; i++) { const t = i / 8; add(0.20 + t * 0.16, 0.50 + Math.sin(t * Math.PI) * 0.07); }   // toro
  add(0.37, 0.47); add(0.40, 0.45);
  for (let i = 0; i <= 26; i++) { const t = i / 26; add(0.42 + t * 3.0, 0.43 - 0.05 * t * t + 0.012 * Math.sin(t * Math.PI), true); } // fuste com êntase
  add(3.44, 0.40); add(3.48, 0.42); add(3.52, 0.40);                 // colarinho
  for (let i = 0; i <= 8; i++) { const t = i / 8; add(3.54 + t * 0.20, 0.42 + 0.20 * Math.sin(t * Math.PI / 2)); } // equino
  add(3.74, 0.0);
  function column() {
    const SEG = 80, FL = 20, pos = [], idx = [];
    PROFILE.forEach(([y, r, fl]) => {
      for (let s = 0; s <= SEG; s++) {
        const a = (s / SEG) * Math.PI * 2;
        const flute = fl ? Math.pow(Math.max(0, Math.cos(a * FL)), 3) * 0.03 : 0;
        const rr = Math.max(0, r - flute);
        pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      }
    });
    const W = SEG + 1;
    for (let i = 0; i < PROFILE.length - 1; i++) for (let s = 0; s < SEG; s++) {
      const a = i * W + s, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    // plinto e ábaco: caixas
    const box = (cx, cy, cz, hx, hy, hz) => {
      const o = pos.length / 3;
      const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
      // vértices duplicados por face para normais retas
      const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
      F.forEach((f) => { f.forEach((k) => pos.push(cx + v[k][0] * hx, cy + v[k][1] * hy, cz + v[k][2] * hz)); });
      for (let i = 0; i < 6; i++) { const q = o + i * 4; idx.push(q, q + 2, q + 1, q, q + 3, q + 2); }
    };
    box(0, 0.10, 0, 0.64, 0.10, 0.64);
    box(0, 3.84, 0, 0.66, 0.10, 0.66);
    const P = new Float32Array(pos), I = new Uint16Array(idx);
    return { P, N: smoothNormals(P, I), I };
  }
  function cube() {   // a tessera: cubo com cantos levemente arredondados (normais suavizadas)
    const pos = [], idx = [], S = 6;
    const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
    faces.forEach(([n, u, v]) => {
      const o = pos.length / 3;
      for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) {
        let p = [0, 1, 2].map((k) => n[k] + u[k] * (i / S * 2 - 1) + v[k] * (j / S * 2 - 1));
        const l = Math.hypot(...p), q = p.map((c) => c / l), rnd = 0.25;   // mistura cubo/esfera = cantos arredondados
        p = p.map((c, k) => c * (1 - rnd) + q[k] * rnd * 1.35);
        pos.push(...p.map((c) => c * 0.5));
      }
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const a = o + j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    });
    const P = new Float32Array(pos), I = new Uint16Array(idx);
    return { P, N: smoothNormals(P, I), I };
  }
  function entablature() {
    const pos = [], idx = [];
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
    const box = (cx, cy, cz, hx, hy, hz) => { const o = pos.length / 3; F.forEach((f) => f.forEach((k) => pos.push(cx + v[k][0] * hx, cy + v[k][1] * hy, cz + v[k][2] * hz))); for (let i = 0; i < 6; i++) { const q = o + i * 4; idx.push(q, q + 2, q + 1, q, q + 3, q + 2); } };
    box(0, 4.20, 0, 3.55, 0.26, 0.74);     // arquitrave
    box(0, 4.52, 0, 3.70, 0.07, 0.84);     // cornija
    box(0, 4.66, 0, 3.60, 0.07, 0.78);
    const P = new Float32Array(pos), I = new Uint16Array(idx);
    return { P, N: smoothNormals(P, I), I };
  }
  const quad = { P: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), N: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), I: new Uint16Array([0, 2, 1, 0, 3, 2]) };

  // ── shaders ──
  const VS = `attribute vec3 aP; attribute vec3 aN; uniform mat4 uPV; uniform mat4 uM;
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main(){ vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vL = aP; vN = mat3(uM) * aN; gl_Position = uPV * w; }`;
  const FS = `precision mediump float;
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    uniform vec3 uEye; uniform int uMode; uniform float uA;
    void main(){
      vec3 n = normalize(vN), v = normalize(uEye - vW);
      vec3 L1 = normalize(vec3(-0.5, 0.9, 0.6)), L2 = normalize(vec3(0.8, 0.2, -0.3));
      if (uMode == 2) {            // sombra no chão: elipse suave
        float d = length(vL.xz);
        gl_FragColor = vec4(0.09, 0.08, 0.06, (1.0 - smoothstep(0.0, 1.0, d)) * 0.22 * uA); return;
      }
      float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
      if (uMode == 1) {            // tessera de vidro cinábrio
        vec3 c = vec3(0.886, 0.259, 0.122);
        float dif = max(dot(n, L1), 0.0);
        vec3 col = c * (0.55 + 0.45 * dif) + vec3(1.0, 0.75, 0.62) * fr * 0.9 + pow(max(dot(reflect(-L1, n), v), 0.0), 40.0) * 0.9;
        gl_FragColor = vec4(col, (0.78 + fr * 0.2) * uA); return;
      }
      // mármore: base clara, veios suaves, luz quente + contraluz cinábrio nas bordas
      float vein = sin(vL.x * 6.0 + vL.y * 2.3 + sin(vL.z * 5.0 + vL.y * 1.7) * 2.2);
      vec3 base = mix(vec3(0.95, 0.94, 0.92), vec3(0.83, 0.81, 0.78), smoothstep(0.92, 1.0, abs(vein)) * 0.6);
      float dif = max(dot(n, L1), 0.0) * 0.6 + max(dot(n, L2), 0.0) * 0.18;
      float occ = smoothstep(0.0, 0.6, vL.y) * 0.15 + 0.85;
      vec3 col = base * (0.5 + dif) * occ + vec3(1.0, 0.55, 0.42) * fr * 0.28;
      gl_FragColor = vec4(col, uA);
    }`;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  let pr;
  try { pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw 0; }
  catch (e) { wrap.classList.add("no-gl"); return; }
  gl.useProgram(pr);
  const A = { P: gl.getAttribLocation(pr, "aP"), N: gl.getAttribLocation(pr, "aN") };
  const U = {}; ["uPV", "uM", "uEye", "uMode", "uA"].forEach((k) => (U[k] = gl.getUniformLocation(pr, k)));
  function upload(m) {
    const b = { p: gl.createBuffer(), n: gl.createBuffer(), i: gl.createBuffer(), count: m.I.length };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.bufferData(gl.ARRAY_BUFFER, m.P, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.bufferData(gl.ARRAY_BUFFER, m.N, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.I, gl.STATIC_DRAW);
    return b;
  }
  const COL = upload(column()), CUBE = upload(cube()), QUAD = upload(quad), ENT = upload(entablature());
  function draw(b, model, mode, alpha) {
    gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.enableVertexAttribArray(A.P); gl.vertexAttribPointer(A.P, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.enableVertexAttribArray(A.N); gl.vertexAttribPointer(A.N, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i);
    gl.uniformMatrix4fv(U.uM, false, model); gl.uniform1i(U.uMode, mode); gl.uniform1f(U.uA, alpha);
    gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
  }
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // ── cena ──
  const COLS = [[-2.7, 0], [-0.95, 0], [0.95, 0], [2.7, 0]];   // pórtico de quatro colunas
  const hero = cv.closest(".hero-v") || document.body;
  const copy = hero.querySelector(".hero-copy"), ins = hero.querySelector(".inscription"), cue = hero.querySelector(".intro-cue");
  const wide = window.matchMedia("(min-width: 861px)");
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  // roteiro da câmera: plano aberto (pórtico à direita) → de frente (inscrição) → atravessa entre as colunas
  const SHOTS = [
    { at: 0.00, eye: [-6.5, 3.2, 15.5], tgt: [-4.1, 2.2, 0] },   // plano aberto: pórtico à direita do texto
    { at: 0.30, eye: [-2.6, 2.7, 10.5], tgt: [-1.2, 2.4, 0] },
    { at: 0.62, eye: [0.0, 2.3, 6.4], tgt: [0.0, 2.6, 0] },     // de frente: a inscrição aparece
    { at: 1.00, eye: [0.0, 1.55, 3.3], tgt: [0.0, 3.0, -1.0] },  // chega ao vão e olha a tessera, com as colunas emoldurando
  ];
  function shot(p) {
    if (!wide.matches) return [[0, 2.8 + p * 0.6, 15.5 - p * 5], [0, 2.3, 0]];   // celular: pórtico centralizado inteiro
    for (let i = 0; i < SHOTS.length - 1; i++) {
      const a = SHOTS[i], b = SHOTS[i + 1];
      if (p <= b.at) { const k = sstep(a.at, b.at, p); return [lerp3(a.eye, b.eye, k), lerp3(a.tgt, b.tgt, k)]; }
    }
    const z = SHOTS[SHOTS.length - 1]; return [z.eye, z.tgt];
  }
  function progress() {
    if (!wide.matches) return REDUCE ? 0 : Math.min(1, Math.max(0, scrollY / ((hero.offsetHeight || 800) * 0.9))) * 0.35;
    const r = hero.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
  }
  const st = { mx: 0, my: 0, tmx: 0, tmy: 0, spin: 0, vs: 0, drag: false, lx: 0 };
  let W = 0, H = 0, raf = 0, last = 0, t0 = performance.now(), visible = true, active = performance.now();

  function size() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, wide.matches ? 1.25 : 1.5);
    W = cv.width = Math.max(1, Math.round(r.width * dpr)); H = cv.height = Math.max(1, Math.round(r.height * dpr));
    gl.viewport(0, 0, W, H);
  }
  function render(now) {
    const t = (now - t0) / 1000;
    const intro = REDUCE ? 1 : Math.min(1, t / 1.8), ei = 1 - Math.pow(1 - intro, 3);
    const sc = REDUCE ? 0 : progress();
    st.mx += (st.tmx - st.mx) * 0.1; st.my += (st.tmy - st.my) * 0.1;
    if (!st.drag) { st.spin += st.vs; st.vs *= 0.94; }
    let [eye, tgt] = shot(sc);
    // mouse e arrasto: pequena órbita em torno do alvo (some quando a câmera entra no pórtico)
    const orb = (st.mx * 0.5 + st.spin) * (1 - sstep(0.5, 0.8, sc));
    const dx = eye[0] - tgt[0], dz = eye[2] - tgt[2], c = Math.cos(orb), s2 = Math.sin(orb);
    eye = [tgt[0] + dx * c - dz * s2, eye[1] + st.my * 0.4 * (1 - sc), tgt[2] + dx * s2 + dz * c];
    const PV = M.mul(M.persp(0.62, W / H, 0.1, 60), M.look(eye, tgt, [0, 1, 0]));
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uPV, false, PV); gl.uniform3fv(U.uEye, eye);
    const land = COLS.map((_, i) => { const k = Math.min(1, Math.max(0, ei * 1.7 - i * 0.18)); return 1 - Math.pow(1 - k, 3); });
    const beam = (() => { const k = Math.min(1, Math.max(0, ei * 1.7 - 0.75)); return 1 - Math.pow(1 - k, 3); })();
    // sombras no chão (crescem conforme a coluna pousa)
    gl.depthMask(false);
    COLS.forEach(([x, z], i) => draw(QUAD, M.trs(x, 0.001, z, 0, 0, 1.15), 2, land[i]));
    gl.depthMask(true);
    // colunas descem do céu e pousam; a viga vem por último
    COLS.forEach(([x, z], i) => draw(COL, M.trs(x, 7.5 * (1 - land[i]), z, i * 0.3, 0, 1), 0, 1));
    if (beam > 0) draw(ENT, M.trs(0, 6.5 * (1 - beam), 0, 0, 0, 1), 0, 1);
    // tessera flutua acima da passagem central
    const fy = 3.35 + Math.sin(t * 0.9) * 0.08 * (REDUCE ? 0 : 1);
    draw(CUBE, M.trs(0, fy + (1 - beam) * 4.0, 0.15, t * 0.35 + sc * 2.5, 0.6 + t * 0.2, 0.5), 1, beam);
    // texto do hero sai; a inscrição aparece quando o pórtico fica de frente; some ao atravessar
    if (wide.matches && !REDUCE) {
      const out = sstep(0.06, 0.26, sc);
      copy.style.opacity = (1 - out).toFixed(3); copy.style.transform = out ? "translate3d(0," + (-50 * out).toFixed(1) + "px,0)" : "";
      copy.style.visibility = out >= 1 ? "hidden" : "";
      const inA = sstep(0.42, 0.56, sc), inB = sstep(0.80, 0.96, sc);
      ins.style.opacity = (inA * (1 - inB)).toFixed(3);
      ins.style.transform = "translate3d(-50%,-50%,0) scale(" + (0.92 + inA * 0.08 + inB * 0.5).toFixed(3) + ")";
      cue.style.opacity = (1 - sstep(0.02, 0.1, sc)).toFixed(3);
    }
    return intro < 1;
  }
  function frame(now) {
    raf = 0;
    const idle = now - active > 1500 && !st.drag && Math.abs(st.vs) < 0.0005 && Math.abs(st.tmx - st.mx) + Math.abs(st.tmy - st.my) < 0.002;
    if (now - last >= (idle ? 83 : 33)) { last = now; render(now); }   // 30 fps em uso, 12 fps parado
    if (visible && !document.hidden && !REDUCE) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    st.tmx = (e.clientX / innerWidth - 0.5) * 2; st.tmy = (e.clientY / innerHeight - 0.5) * 2; active = performance.now();
  }, { passive: true });
  cv.addEventListener("pointerdown", (e) => { st.drag = true; st.lx = e.clientX; st.vs = 0; active = performance.now(); cv.setPointerCapture(e.pointerId); wrap.classList.add("grabbing"); });
  cv.addEventListener("pointermove", (e) => { if (!st.drag) return; const d = (e.clientX - st.lx) * -0.01; st.spin += d; st.vs = d; st.lx = e.clientX; active = performance.now(); });
  const end = () => { st.drag = false; wrap.classList.remove("grabbing"); };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  addEventListener("scroll", () => { active = performance.now(); kick(); }, { passive: true });
  document.addEventListener("visibilitychange", kick);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(cv);
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { size(); render(performance.now()); }, 120); });
  size();
  if (REDUCE) render(performance.now()); else kick();
  wrap.classList.add("ready");
})();
