/* Home: filtro dos projetos com animação FLIP (os cards deslizam para o novo lugar). */
(function () {
  "use strict";
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const box = document.getElementById("projetos");
  if (!box) return;
  const cards = [...box.querySelectorAll(".gcard")];
  const filtros = [...box.querySelectorAll(".filtro")];
  function apply(f) {
    filtros.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === f)));
    const show = (c) => f === "all" || (c.dataset.u || "").split(" ").includes(f);
    if (REDUCE) { cards.forEach((c) => { c.hidden = !show(c); }); return; }
    const first = new Map(cards.filter((c) => !c.hidden).map((c) => [c, c.getBoundingClientRect()]));
    cards.forEach((c) => { c.hidden = !show(c); });
    cards.forEach((c) => {
      if (c.hidden) return;
      const a = first.get(c), b = c.getBoundingClientRect();
      if (a) {
        const dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)" });
      } else {
        c.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.7,.2,1)" });
      }
    });
  }
  filtros.forEach((b) => b.addEventListener("click", () => apply(b.dataset.f)));
})();
