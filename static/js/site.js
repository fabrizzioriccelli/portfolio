/* Comportamentos globais: cabeçalho, relógio local, menu do celular, copiar e-mail. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  // o conteúdo nunca depende da animação terminar
  setTimeout(() => document.documentElement.classList.add("settled"), 2500);

  // cabeçalho ganha vidro ao rolar
  const header = document.querySelector(".site-header");
  const onScroll = () => header && header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // relógio de São Paulo
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const tick = () => { clock.textContent = "São Paulo · " + fmt.format(new Date()); };
    tick(); setInterval(tick, 30000);
  }

  // menu do celular
  const menu = document.getElementById("mobile-menu");
  const openBtn = document.querySelector("[data-menu-open]");
  if (menu && openBtn) {
    const closeBtn = menu.querySelector("[data-menu-close]");
    const open = () => { menu.hidden = false; openBtn.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; closeBtn.focus(); };
    const close = () => { menu.hidden = true; openBtn.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; openBtn.focus(); };
    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    menu.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { document.body.style.overflow = ""; }));
  }

  // copiar e-mail (com alternativa: seleciona o texto se a área de transferência for negada)
  document.querySelectorAll("[data-copy]").forEach((b) => {
    b.addEventListener("click", async () => {
      const txt = b.dataset.copy, old = b.textContent;
      try { await navigator.clipboard.writeText(txt); b.textContent = "Copiado"; }
      catch (err) {
        const a = b.parentElement.querySelector(".mail-a");
        if (a) { const r = document.createRange(); r.selectNodeContents(a); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        b.textContent = "Selecionado: use Ctrl+C";
      }
      setTimeout(() => { b.textContent = old; }, 2200);
    });
  });
})();
