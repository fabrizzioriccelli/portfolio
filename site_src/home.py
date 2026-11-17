"""Página inicial pensada para quem recruta: quem é → o que fez → trajetória → contato."""
from __future__ import annotations

from .components import e, footer, header, logo, project_card, roman, safe_json, split_words


def home(site, projects, root, year):
    unis = [u for u in site["universes"] if u["id"] != "sobre"]
    a = site["about"]

    # ── 1. quem é: frase, linha de apoio e credenciais verificáveis ──
    creds = "".join(f"<li>{e(c)}</li>" for c in site.get("credentials", []))
    li = site["links"].get("linkedin")
    hero = f"""<section class="hero-v" id="intro" aria-labelledby="impacto">
  <div class="intro-stage">
    <div class="vitrum" aria-hidden="true"><canvas id="vitrum"></canvas><div class="vitrum-fallback glass"></div></div>
    <div class="wrap grid hero-grid">
      <div class="hero-copy">
        <span class="label kicker"><span class="dot" aria-hidden="true"></span>Portfólio · {e(site['city'])} · {roman(year)}</span>
        <h1 class="impact" id="impacto" aria-label="{e(site['impact'])}">{split_words(site['impact'], accent_last_char=True)}</h1>
        <p class="lede hero-lede">{e(site['impact_sub'])}</p>
        <ul class="creds" aria-label="Resumo profissional">{creds}</ul>
        <div class="btns hero-ctas"><a class="btn magnetic" href="#projetos">Ver projetos <span aria-hidden="true">↓</span></a>{f'<a class="btn ghost magnetic" href="{e(li)}" target="_blank" rel="me noopener noreferrer">LinkedIn ↗</a>' if li else ''}</div>
      </div>
    </div>
    <div class="inscription" aria-hidden="true"><span class="label">Entre pelo pórtico</span><span class="ins-t">Projetos</span><span class="label">{roman(year)}</span></div>
    <span class="intro-cue label" aria-hidden="true">Role para entrar</span>
  </div>
</section>"""

    # ── 1b. destaques: imagens que se abrem com o scroll, uma por cima da outra (estilo Apple) ──
    bys = {p["slug"]: p for p in projects}
    slides = []
    for i, h in enumerate(site.get("highlights", [])):
        p = bys.get(h["slug"])
        if not p:
            continue
        u = next(x for x in site["universes"] if x["id"] == p["universe"])
        m = f"{root}static/media/{p['slug']}/"
        if h.get("video"):
            media = f'<video muted loop playsinline preload="none" poster="{m}{e(h["poster"])}" data-src="{m}{e(h["video"])}" aria-hidden="true"></video>'
        else:
            media = f'<img src="{m}{e(h["image"])}" alt="" decoding="async" fetchpriority="low">'
        slides.append(f'''<article class="st-slide" data-i="{i}">
      <div class="st-media">{media}</div>
      <div class="st-text glass"><span class="label">{e(p["kind"])} · {e(u["short"])}{(" · " + e(p["year"])) if p.get("year") else ""}</span>
        <h3>{e(p["title"])}</h3><p>{e(h["line"])}</p><a class="btn small" href="{root}{u["id"]}/{p["slug"]}/">Ver o case →</a></div>
    </article>''')
    reel = ""
    if slides:
        n = len(slides)
        reel = f"""<section class="story" id="reel" aria-label="Projetos em destaque">
  <div class="story-head wrap"><span class="label">Em destaque</span><h2 data-split>Role para ver os projetos ganharem vida.</h2></div>
  <div class="story-track">
    <div class="story-stage">{"".join(slides)}
      <div class="story-progress" aria-hidden="true">{"".join("<i></i>" for _ in range(n))}</div>
    </div>
  </div>
</section>"""

    # ── 2. o que fez: todos os projetos, direto, em cards de vidro ──
    idx = {u["id"]: str(i) for i, u in enumerate(site["universes"])}
    cards = "".join(project_card(site, p, root, data_u=" ".join(idx[x] for x in [p["universe"], *p.get("also", [])])) for p in projects)
    counts = {u["id"]: sum(1 for p in projects if p["universe"] == u["id"] or u["id"] in p.get("also", [])) for u in unis}
    filtros = f'<button class="filtro" type="button" data-f="all" aria-pressed="true">Todos <span class="c">{len(projects)}</span></button>' + "".join(
        f'<button class="filtro" type="button" data-f="{idx[u["id"]]}" aria-pressed="false">{e(u["short"])} <span class="c">{counts[u["id"]]}</span></button>'
        for u in unis if counts[u["id"]])
    projetos = f"""<section class="work" id="projetos" aria-labelledby="projetos-t">
  <div class="glows" aria-hidden="true"><i></i><i></i></div>
  <div class="wrap">
    <div class="work-head"><h2 id="projetos-t">Projetos</h2><div class="filtros" role="group" aria-label="Filtrar projetos">{filtros}</div></div>
    <div class="cards-grid" aria-live="polite">{cards}</div>
  </div>
</section>"""

    # ── 3. trajetória em uma linha por empresa ──
    rows = "".join(
        f'<li>{logo(root, o.get("logo"), o.get("mono", ""), alt=o["org"])}<span class="t-org">{e(o["org"])}</span><span class="role">{e(o["roles"][0]["title"])}</span><span class="label">{e(o["period"])}</span></li>'
        for o in a.get("experience", []))
    trajetoria = f"""<section class="block" aria-labelledby="traj-t">
  <div class="wrap">
    <div class="simple-head"><h2 id="traj-t">Trajetória</h2><a class="btn small ghost" href="{root}sobre/">Ver completa →</a></div>
    <ul class="traj">{rows}</ul>
  </div>
</section>"""

    # ── 4. contato ──
    from .pages import contact_block
    fecho = f"""<section class="block closing" aria-labelledby="fecho-t">
  <div class="wrap">
    <h2 class="closing-t" id="fecho-t">{split_words("Vamos conversar?", accent_last_char=True)}</h2>
    {contact_block(site, root)}
  </div>
</section>"""

    return f"""{header(site, root)}
<main id="conteudo">
{hero}
{reel}
{projetos}
{trajetoria}
{fecho}
</main>
{footer(site, root, year)}"""
