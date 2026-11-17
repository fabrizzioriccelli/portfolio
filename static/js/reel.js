/* Destaques (estilo Apple): a primeira imagem cresce de um card ao centro; as seguintes sobem como cortina,
   conforme o scroll, por cima da anterior. Por quadro, só clip-path e transform de no
   máximo duas peças. Vídeo toca só no destaque atual. No celular e com movimento reduzido,
   cada peça abre sozinha quando aparece, sem prender o scroll. */
(function () {
  "use strict";
  const sec = document.getElementById("reel");
  if (!sec) return;
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mq = window.matchMedia("(min-width: 861px)");
  const slides = [...sec.querySelectorAll(".st-slide")];
  const bars = [...sec.querySelectorAll(".story-progress i")];
  const track = sec.querySelector(".story-track"), stage = sec.querySelector(".story-stage");
  const N = slides.length;
  track.style.setProperty("--n", N);
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  let current = -1, visible = false;

  const vidOf = (s) => s.querySelector("video");
  function playOnly(i) {
    slides.forEach((s, k) => {
      const v = vidOf(s); if (!v) return;
      if (k === i && visible) { if (!v.src) v.src = v.dataset.src; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      else v.pause();
    });
  }
  function setCurrent(i) {
    if (i === current) return;
    current = i;
    slides.forEach((s, k) => s.classList.toggle("on", k === i));
    bars.forEach((b, k) => b.classList.toggle("on", k <= i));
    playOnly(i);
  }

  new IntersectionObserver((es) => { visible = es[0].isIntersecting; playOnly(current); }, { rootMargin: "100px 0px" }).observe(sec);

  // celular / movimento reduzido: cada peça abre ao aparecer
  const simple = () => !mq.matches || REDUCE;
  const sio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!simple()) return;
    if (e.isIntersecting) { e.target.classList.add("open"); setCurrent(+e.target.dataset.i); }
  }), { threshold: 0.35 });
  slides.forEach((s) => sio.observe(s));

  // desktop: scroll conduz a abertura
  let raf = 0, lastP = -1;
  function frame() {
    raf = 0;
    if (simple()) {
      // garantia pela rolagem: abre o que já entrou na tela, mesmo se o observer atrasar
      slides.forEach((s) => {
        s.style.clipPath = ""; s.firstElementChild.style.transform = "";
        const b = s.getBoundingClientRect();
        if (!s.classList.contains("open") && b.top < innerHeight * 0.75 && b.bottom > 0) { s.classList.add("open"); setCurrent(+s.dataset.i); }
      });
      return;
    }
    const r = track.getBoundingClientRect(), h = stage.offsetHeight;
    const p = Math.min(0.9999, Math.max(0, -r.top / Math.max(1, r.height - h)));
    if (Math.abs(p - lastP) < 0.0005) return;
    lastP = p;
    const pos = p * N;                       // 0..N
    slides.forEach((s, i) => {
      const local = pos - i;                 // <0 ainda não chegou, 0..1 abrindo, >1 aberta
      if (local < -0.05) { s.style.visibility = "hidden"; return; }
      s.style.visibility = "";
      const k = ease(Math.min(1, local / 0.6));
      // a primeira peça cresce de um card estreito no centro; as outras sobem de baixo, como cortina
      if (k >= 1) s.style.clipPath = "none";
      else if (i === 0) s.style.clipPath = "inset(" + (24 * (1 - k)).toFixed(2) + "% " + (34 * (1 - k)).toFixed(2) + "% round 28px)";
      else s.style.clipPath = "inset(" + (100 * (1 - k)).toFixed(2) + "% 0% 0% 0% round 28px)";
      s.firstElementChild.style.transform = "scale(" + (1.22 - 0.22 * k).toFixed(4) + ")";
    });
    setCurrent(Math.min(N - 1, Math.floor(pos)));
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", () => { lastP = -1; kick(); });
  if (mq.addEventListener) mq.addEventListener("change", () => { lastP = -1; kick(); });
  kick();
})();
