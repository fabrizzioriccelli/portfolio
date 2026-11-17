/* Página de case: player com capítulos, demo sob demanda, galeria em tela cheia. */
(function () {
  "use strict";
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── player ─────────────────────────────
  const player = document.querySelector("[data-player]");
  if (player) {
    const video = player.querySelector("video");
    const data = JSON.parse(player.querySelector("script[type='application/json']").textContent);
    const tabs = [...player.querySelectorAll("[data-video]")];
    const list = player.querySelector(".chapters");
    const bar = player.querySelector(".progress i");
    const toggle = player.querySelector("[data-toggle]");
    const sound = player.querySelector("[data-sound]");
    if (sound) sound.addEventListener("click", () => {
      video.muted = !video.muted;
      sound.textContent = video.muted ? "Ativar som" : "Desativar som";
      if (!video.muted) play();
    });
    const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    let current = 0, wantPlay = !REDUCE;

    function renderChapters() {
      list.innerHTML = "";
      data[current].chapters.forEach(([t, label]) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button"; b.dataset.t = t;
        b.innerHTML = '<span class="label"></span><span></span>';
        b.children[0].textContent = fmt(t); b.children[1].textContent = label;
        b.addEventListener("click", () => { video.currentTime = t; play(); });
        li.appendChild(b); list.appendChild(li);
      });
    }
    function load(i) {
      current = i;
      const v = data[i];
      video.poster = v.poster; video.src = v.src;
      tabs.forEach((t, k) => t.setAttribute("aria-pressed", String(k === i)));
      if (sound) { sound.hidden = !v.audio; if (!v.audio) video.muted = true; }
      renderChapters();
      if (wantPlay) play();
    }
    function play() { wantPlay = true; const p = video.play(); if (p && p.catch) p.catch(() => {}); }
    function pause() { wantPlay = false; video.pause(); }
    tabs.forEach((t, k) => t.addEventListener("click", () => load(k)));
    toggle.addEventListener("click", () => (video.paused ? play() : pause()));
    video.addEventListener("play", () => { toggle.textContent = "Pausar"; });
    video.addEventListener("pause", () => { toggle.textContent = "Reproduzir"; });
    video.addEventListener("timeupdate", () => {
      if (video.duration) bar.style.width = (video.currentTime / video.duration) * 100 + "%";
      const t = video.currentTime;
      [...list.querySelectorAll("button")].forEach((b, k, all) => {
        const next = all[k + 1] ? +all[k + 1].dataset.t : Infinity;
        b.classList.toggle("on", t >= +b.dataset.t && t < next);
      });
    });
    // só carrega e toca quando entra na tela
    let loaded = false;
    new IntersectionObserver((es) => {
      const vis = es[0].isIntersecting;
      if (vis && !loaded) { loaded = true; load(0); }
      else if (vis && wantPlay) play();
      else if (!vis) video.pause();
    }, { threshold: 0.35 }).observe(video);
    if (REDUCE) toggle.textContent = "Reproduzir";
  }

  // ── demo sob demanda (o arquivo é pesado; só carrega com um clique) ──
  document.querySelectorAll("[data-demo]").forEach((box) => {
    const btn = box.querySelector("[data-demo-load]");
    btn.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = box.dataset.demo; f.title = box.dataset.title || "Demonstração interativa"; f.loading = "lazy";
      // isolamento: a demo roda com sandbox (sem navegar a página principal nem abrir janelas sem gesto)
      f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-downloads allow-modals allow-popups");
      f.referrerPolicy = "same-origin";
      const frame = box.querySelector(".frame");
      frame.innerHTML = ""; frame.appendChild(f);
      const full = box.querySelector("[data-demo-full]");
      if (full) full.hidden = false;
    });
  });

  // ── galeria em tela cheia ──────────────
  const lb = document.getElementById("lightbox");
  if (lb) {
    const img = lb.querySelector("img"), cap = lb.querySelector(".cap"), count = lb.querySelector("[data-count]");
    const items = [...document.querySelectorAll("[data-lb]")];
    let i = 0, opener = null;
    const show = (k) => {
      i = (k + items.length) % items.length;
      const b = items[i];
      img.src = b.dataset.lb; img.alt = b.dataset.alt || "";
      cap.textContent = b.dataset.cap || ""; count.textContent = (i + 1) + " / " + items.length;
    };
    const close = () => { lb.hidden = true; document.body.style.overflow = ""; if (opener) opener.focus(); };
    items.forEach((b, k) => b.addEventListener("click", () => { opener = b; show(k); lb.hidden = false; document.body.style.overflow = "hidden"; lb.querySelector("[data-close]").focus(); }));
    lb.querySelector("[data-close]").addEventListener("click", close);
    lb.querySelector("[data-prev]").addEventListener("click", () => show(i - 1));
    lb.querySelector("[data-next]").addEventListener("click", () => show(i + 1));
    lb.addEventListener("click", (e) => { if (e.target.classList.contains("stage")) close(); });
    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(i - 1);
      if (e.key === "ArrowRight") show(i + 1);
    });
  }
})();
