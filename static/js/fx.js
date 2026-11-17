/* Camada de interação: cursor de vidro (com vídeo sobre projetos), botões magnéticos,
   títulos palavra a palavra, entrada dos blocos em cascata e inclinação 3D.
   Regras: só transform/opacity (GPU), um único loop rAF compartilhado, nada roda
   com prefers-reduced-motion ou em telas de toque. */
(function () {
  "use strict";
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  // ── títulos palavra a palavra ──
  function split(el) {
    if (el.dataset.done) return; el.dataset.done = "1";
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach((w, i) => {
      const o = document.createElement("span"); o.className = "w";
      const s = document.createElement("span"); s.textContent = w;
      o.appendChild(s); el.appendChild(o);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  }
  const splitEls = [...document.querySelectorAll("[data-split]")];
  const closing = [...document.querySelectorAll(".closing-t")];
  if (!REDUCE && "IntersectionObserver" in window) {
    splitEls.forEach(split);
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px" });
    [...splitEls, ...closing].forEach((el) => io.observe(el));
    // segunda garantia: se o observer atrasar, a rolagem revela o que já está na tela
    let pending = [...splitEls, ...closing], tick = 0;
    const check = () => {
      tick = 0;
      pending = pending.filter((el) => {
        if (el.classList.contains("in")) return false;
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight * 0.95 && r.bottom > 0) { el.classList.add("in"); return false; }
        return true;
      });
      if (!pending.length) removeEventListener("scroll", onS);
    };
    const onS = () => { if (!tick) tick = requestAnimationFrame(check); };
    addEventListener("scroll", onS, { passive: true });
    setTimeout(check, 1200);
  } else {
    closing.forEach((el) => el.classList.add("in"));
  }

  // ── entrada em cascata dos blocos no decorrer da página ──
  const RV = ".gcard, .glance > div, .timeline li, .sum, .exp .org, .edu-c, .pf, .mail, .traj li, .gallery figure, .diagrams figure, .contrib, .cs .prose, .device, .code, .next, .skills .sk, .player, .embed, .case-media";
  const rvEls = [...document.querySelectorAll(RV)].filter((el) => el.getBoundingClientRect().top > innerHeight * 0.92);
  if (!REDUCE && "IntersectionObserver" in window && rvEls.length) {
    const sib = new Map();
    rvEls.forEach((el) => {
      const k = el.parentElement; const n = sib.get(k) || 0; sib.set(k, n + 1);
      el.classList.add("rv"); el.style.transitionDelay = (n % 4) * 70 + "ms";
    });
    let left = rvEls.slice();
    const reveal = (el) => { el.classList.add("in"); left = left.filter((x) => x !== el); setTimeout(() => { el.style.transitionDelay = ""; }, 1300); };
    const rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { reveal(e.target); rio.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    rvEls.forEach((el) => rio.observe(el));
    // garantia: se o observer atrasar, a rolagem revela; e nada fica escondido depois de 4 s parado na tela
    let t2 = 0;
    const chk = () => { t2 = 0; left.slice().forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) reveal(el); }); if (!left.length) removeEventListener("scroll", onS2); };
    const onS2 = () => { if (!t2) t2 = requestAnimationFrame(chk); };
    addEventListener("scroll", onS2, { passive: true });
  }

  if (REDUCE) return;

  // ── loop compartilhado ──
  const tasks = new Set();
  let raf = 0;
  const loop = (t) => { raf = 0; tasks.forEach((fn) => fn(t)); if (tasks.size) raf = requestAnimationFrame(loop); };
  const add = (fn) => { tasks.add(fn); if (!raf) raf = requestAnimationFrame(loop); };
  const remove = (fn) => tasks.delete(fn);

  if (!FINE) return;

  // ── cursor-tessera ──
  const cur = document.createElement("div");
  cur.className = "cursor"; cur.setAttribute("aria-hidden", "true");
  cur.innerHTML = "<b>Ver</b>";
  document.body.appendChild(cur);
  const c = { x: -100, y: -100, tx: -100, ty: -100 };
  const moveCursor = () => {
    c.x = lerp(c.x, c.tx, 0.22); c.y = lerp(c.y, c.ty, 0.22);
    cur.style.transform = "translate3d(" + c.x.toFixed(1) + "px," + c.y.toFixed(1) + "px,0)";
    if (Math.abs(c.tx - c.x) + Math.abs(c.ty - c.y) < 0.2) remove(moveCursor);
  };
  window.addEventListener("pointermove", (e) => {
    c.tx = e.clientX; c.ty = e.clientY; add(moveCursor);
    const t = e.target.closest ? e.target.closest("a, button, [data-tilt], .vitrum canvas") : null;
    cur.classList.toggle("grab", !!(e.target.closest && e.target.closest(".vitrum canvas")));
    const view = e.target.closest && e.target.closest(".gcard-in, .gallery button");
    cur.classList.toggle("view", !!view);
    cur.classList.toggle("link", !!t && !view);
  }, { passive: true });
  document.addEventListener("pointerleave", () => { c.tx = c.ty = -100; add(moveCursor); });

  // ── botões magnéticos ──
  document.querySelectorAll(".magnetic, .btn").forEach((b) => {
    let st = { x: 0, y: 0, tx: 0, ty: 0 };
    const step = () => {
      st.x = lerp(st.x, st.tx, 0.2); st.y = lerp(st.y, st.ty, 0.2);
      b.style.transform = "translate3d(" + st.x.toFixed(2) + "px," + st.y.toFixed(2) + "px,0)";
      if (Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) < 0.05) { remove(step); if (!st.tx && !st.ty) b.style.transform = ""; }
    };
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      st.tx = (e.clientX - r.left - r.width / 2) * 0.28; st.ty = (e.clientY - r.top - r.height / 2) * 0.35; add(step);
    });
    b.addEventListener("pointerleave", () => { st.tx = st.ty = 0; add(step); });
  });

  // ── cursor-bolinha com vídeo: sobre um projeto com gravação, o cursor toca o vídeo dele ──
  const cv = document.createElement("video");
  cv.muted = true; cv.loop = true; cv.playsInline = true; cv.preload = "none"; cv.setAttribute("aria-hidden", "true");
  cur.prepend(cv);
  document.querySelectorAll(".gthumb[data-video]").forEach((th) => {
    const card = th.closest(".gcard-in");
    card.addEventListener("pointerenter", () => {
      if (cv.getAttribute("src") !== th.dataset.video) { cv.src = th.dataset.video; }
      const p = cv.play(); if (p && p.catch) p.catch(() => {});
      cur.classList.add("video");
    });
    card.addEventListener("pointerleave", () => { cur.classList.remove("video"); cv.pause(); });
  });

  // ── inclinação 3D com reflexo ──
  document.querySelectorAll("[data-tilt]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.transform = "perspective(900px) rotateX(" + ((0.5 - py) * 6).toFixed(2) + "deg) rotateY(" + ((px - 0.5) * 8).toFixed(2) + "deg)";
      el.style.setProperty("--gx", (px * 100).toFixed(1) + "%"); el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
})();
