"""Páginas internas: universo, case, sobre e 404. A home está em home.py."""
from __future__ import annotations

import re
from urllib.parse import quote

from .components import e, footer, header, highlight, logo, project_card, roman, safe_json
from .home import home  # noqa: F401  (reexportada para o build)


def _uni(site, uid):
    return next(u for u in site["universes"] if u["id"] == uid)


def _section(title, body, extra_cls=""):
    """Seção de conteúdo com título simples e direto."""
    return f'<section class="cs {extra_cls}"><div class="wrap"><h2 class="sh">{e(title)}</h2>{body}</div></section>'


# ── UNIVERSO ─────────────────────────────────────────────────────────────────

def universe(site, u, projects, root, year):
    mine = [p for p in projects if p["universe"] == u["id"] or u["id"] in p.get("also", [])]
    cards = "".join(project_card(site, p, root) for p in mine)
    return f"""{header(site, root, current=u['id'])}
<main id="conteudo">
  <section class="work work-page">
    <div class="glows" aria-hidden="true"><i></i><i></i></div>
    <div class="wrap">
      <div class="page-head"><span class="label">{len(mine)} projeto{'s' if len(mine) != 1 else ''}</span><h1>{e(u['title'])}</h1><p class="lede muted">{e(u['lede'])}</p></div>
      <h2 class="sr-only">Projetos</h2>
      <div class="cards-grid">{cards}</div>
    </div>
  </section>
</main>
{footer(site, root, year)}"""


# ── CASE ─────────────────────────────────────────────────────────────────────

def _player(p, m):
    vids = [{"src": m + v["src"], "poster": m + v["poster"], "chapters": v["chapters"], "audio": bool(v.get("audio"))} for v in p["videos"]]
    multi = len(p["videos"]) > 1 or len(p["videos"][0]["chapters"]) > 1
    tabs = "".join(f'<button class="filtro" type="button" data-video="{i}" aria-pressed="{str(i == 0).lower()}">{e(v["title"])} · {v["duration"]}s</button>' for i, v in enumerate(p["videos"]))
    sound = '<button type="button" data-sound hidden>Ativar som</button>' if any(v.get("audio") for v in p["videos"]) else ""
    first = p["videos"][0]
    side = (f'<div class="side"><span class="label">Vídeos</span><div class="vtabs">{tabs}</div><span class="label">Capítulos</span><ol class="chapters"></ol></div>'
            if multi else '<ol class="chapters" hidden></ol>')
    return f"""<div class="player{'' if multi else ' solo'}" data-player>
    <div class="screen"><video muted loop playsinline preload="none" poster="{m}{first['poster']}" aria-label="Vídeo do projeto {e(p['title'])}"></video>
      <div class="ctrl">{sound}<button type="button" data-toggle>Pausar</button></div><div class="progress"><i></i></div></div>
    {side}
    <script type="application/json">{safe_json(vids)}</script>
  </div>"""


def case(site, p, projects, root, year, svg_size):
    u = _uni(site, p["universe"])
    m = f"{root}static/media/{p['slug']}/"

    # ── topo em vidro: o que é, minha parte, período ──
    yr = p.get("year") or ""
    m4 = re.findall(r"\b(20\d\d)\b", yr)
    pairs = [("Período", f"{yr} · {roman(m4[-1])}" if m4 else yr), ("Contexto", p["context"]), *[(k, v) for k, v in p.get("facts", [])]]
    meta = "".join(f'<div><dt class="label">{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in pairs if v)
    chips = "".join(f'<span class="chip">{e(s)}</span>' for s in p["stack"])
    if p.get("videos"):
        media = _player(p, m)
    elif p.get("cover"):
        cv = p["cover"]
        small = " small" if cv.get("small") else ""
        media = f'<figure class="cover{small}"><img src="{m}{cv["src"]}" alt="Peça do projeto {e(p["title"])}" width="{cv["w"]}" height="{cv["h"]}" fetchpriority="high"></figure>'
    else:
        media = ""
    top = f"""<section class="case-top">
  <div class="glows" aria-hidden="true"><i></i><i></i></div>
  <div class="wrap">
    <a class="back" href="{root}#projetos"><span aria-hidden="true">←</span> Todos os projetos</a>
    <div class="case-glass glass">
      <div class="cg-head">{logo(root, p.get('logo'), alt='') if p.get('logo') else ''}<span class="st tipo">{e(p['kind'])}</span><a class="label" href="{root}{u['id']}/">{e(u['title'])}</a></div>
      <h1>{e(p['title'])}</h1>
      <p class="lede">{e(p['summary'])}</p>
      <div class="mypart"><span class="label">Minha parte</span><p>{e(p['role'])}</p></div>
      <dl class="meta-row">{meta}</dl>
      <div class="chips">{chips}</div>
    </div>
    {f'<div class="case-media vt-{p["slug"]}">{media}</div>' if media else ''}
    <p class="notice">{e(p['notice'])}</p>
  </div>
</section>"""

    blocks = []
    glance = "".join(f'<div><span class="label">{e(g["label"])}</span><p>{e(g["text"])}</p></div>' for g in p["glance"])
    blocks.append(_section("Resumo", f'<div class="glance">{glance}</div>'))

    if p.get("embed"):
        em_ = p["embed"]
        blocks.append(_section("Ouça", f'<div class="embed"><iframe src="{e(em_["src"])}" title="{e(em_["title"])}" height="{em_.get("height", 352)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe></div>'))

    for s in p.get("sections", []):
        body = "".join(f"<p>{e(x)}</p>" for x in s.get("paragraphs", []))
        if s.get("list"):
            body += "<ul>" + "".join(f"<li>{e(x)}</li>" for x in s["list"]) + "</ul>"
        blocks.append(_section(s["title"], f'<div class="prose">{body}</div>'))

    if p.get("demo"):
        d = p["demo"]
        poster = p["gallery"][0]["src"] if p.get("gallery") else None
        img = f'<img src="{m}{poster}" alt="" loading="lazy">' if poster else ""
        src = f"{root}static/demos/{d['src']}"
        blocks.append(_section("Demonstração interativa", f"""<div class="device" data-demo="{src}" data-title="{e(d['label'])}">
    <div class="chrome"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="label">{e(d['label'])}</span>
      <a class="btn small ghost" href="{src}" target="_blank" rel="noopener" data-demo-full hidden>Tela cheia ↗</a></div>
    <div class="frame"><div class="poster">{img}<button class="btn" type="button" data-demo-load>Abrir a demonstração</button></div></div>
  </div>"""))

    if p.get("gallery"):
        figs = "".join(
            f'<figure><button type="button" data-lb="{m}{g["src"]}" data-cap="{e(g["caption"])}" data-alt="{e(g["caption"])}" aria-label="Ampliar: {e(g["caption"])}">'
            f'<img src="{m}{g["src"]}" alt="{e(g["caption"])}" loading="lazy" decoding="async" width="{g["w"]}" height="{g["h"]}"></button><figcaption>{e(g["caption"])}</figcaption></figure>'
            for g in p["gallery"])
        blocks.append(_section("Imagens", f'<div class="gallery">{figs}</div>'))

    if p.get("diagrams"):
        figs = []
        for dgm in p["diagrams"]:
            w, h = svg_size(p["slug"], dgm["src"])
            figs.append(f'<figure><div class="box"><img src="{m}{dgm["src"]}" alt="{e(dgm["caption"])}" loading="lazy" width="{w}" height="{h}"></div><figcaption>{e(dgm["caption"])}</figcaption></figure>')
        blocks.append(_section("Como funciona", f'<div class="diagrams">{"".join(figs)}</div>'))

    if p.get("timeline"):
        lis = "".join(f'<li><span class="label">{e(a)}</span><span class="t">{e(b)}</span></li>' for a, b in p["timeline"])
        note = f'<p class="muted note">{e(p["timeline_note"])}</p>' if p.get("timeline_note") else ""
        blocks.append(_section("Linha do tempo", f'<ol class="timeline">{lis}</ol>{note}'))

    c = p.get("contribution")
    if c:
        dl = "".join(f"<div><dt>{e(a)}</dt><dd>{e(b)}</dd></div>" for a, b in c["items"])
        blocks.append(_section("Minha contribuição", f'<div class="contrib"><p class="lead">{e(c["lead"])}</p><dl>{dl}</dl></div>'))

    if p.get("code"):
        cd = p["code"]
        blocks.append(_section("Código", f'<figure class="code"><div class="bar"><span class="label">{e(cd["file"])}</span><span class="label">{e(cd["lang"])}</span></div><pre><code>{highlight(cd["snippet"])}</code></pre></figure><p class="muted code-cap">{e(cd["caption"])}</p>'))

    if p.get("links"):
        ls = "".join(f'<a class="btn ghost" href="{e(url)}" target="_blank" rel="noopener noreferrer">{e(label)} ↗</a>' for label, url in p["links"])
        blocks.append(_section("Links", f'<div class="btns">{ls}</div>'))

    order = sorted(projects, key=lambda x: (x["universe"] != p["universe"], x["order"]))
    nxt = order[(order.index(p) + 1) % len(order)] if len(order) > 1 else None
    next_html = ""
    if nxt:
        nu = _uni(site, nxt["universe"])
        next_html = f'<div class="wrap"><a class="next" href="{root}{nu["id"]}/{nxt["slug"]}/"><span><span class="label">Próximo projeto</span><h2>{e(nxt["title"])}</h2></span><span class="arrow" aria-hidden="true">→</span></a></div>'

    lb = """<div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Imagem ampliada">
  <div class="top"><span class="label" data-count></span><div class="btns"><button class="btn small ghost" type="button" data-prev>← Anterior</button><button class="btn small ghost" type="button" data-next>Próxima →</button><button class="btn small" type="button" data-close>Fechar</button></div></div>
  <div class="stage"><img alt=""></div><p class="cap"></p></div>""" if p.get("gallery") else ""

    return f"""{header(site, root, current=u['id'])}
<main id="conteudo">
{top}
{"".join(blocks)}
{next_html}
</main>
{lb}
{footer(site, root, year)}"""


# ── SOBRE ────────────────────────────────────────────────────────────────────

def contact_block(site, root):
    """E-mail (abre uma mensagem pronta) + perfis. Usado no Sobre e no fim da home."""
    mail = site.get("email")
    tpl = site.get("email_template") or {}
    # mailto com assunto e mensagem prontos: abre o programa de e-mail padrão de quem clica (Outlook, Mail, Gmail...)
    q = "&".join(f"{k}={quote(v, safe='')}" for k, v in (("subject", tpl.get("subject", "")), ("body", tpl.get("body", ""))) if v)
    href = f"mailto:{mail}" + (f"?{q}" if q else "")
    mail_html = (f'<div class="mail glass"><span class="label">E-mail</span><a class="mail-a" href="{e(href)}">{e(mail)}</a>'
                 f'<div class="btns"><a class="btn magnetic" href="{e(href)}">Enviar e-mail <span aria-hidden="true">↗</span></a>'
                 f'<button class="btn small ghost" type="button" data-copy="{e(mail)}">Copiar endereço</button></div></div>') if mail else ""
    links = "".join(
        f'<a class="pf glass" href="{e(url)}" target="_blank" rel="me noopener noreferrer"><span class="label">{label}</span><span class="pf-n">{label} ↗</span></a>'
        for key, label in [("linkedin", "LinkedIn"), ("github", "GitHub"), ("behance", "Behance"), ("cv", "Currículo")]
        if (url := site["links"].get(key)))
    return f'<div class="contact">{mail_html}<div class="pfs">{links}</div></div>'


def about(site, root, year):
    a = site["about"]
    ph = a.get("photo")
    photo = (f'<figure class="portrait glass" data-tilt><img src="{root}static/media/about/{e(ph["src"])}" alt="{e(ph["alt"])}" width="{ph["w"]}" height="{ph["h"]}" fetchpriority="high"></figure>') if ph else ""
    summary = "".join(f'<div class="sum glass"><h3>{e(t)}</h3><p>{e(x)}</p></div>' for t, x in a.get("summary", []))
    paras = "".join(f"<p>{e(x)}</p>" for x in a["paragraphs"])
    exp = []
    for org in a.get("experience", []):
        roles = "".join(
            f'<li><div class="role-h"><b>{e(r["title"])}</b><span class="label">{e(r["period"])}</span></div>'
            f'<ul>{"".join(f"<li>{e(i)}</li>" for i in r["items"])}</ul></li>' for r in org["roles"])
        exp.append(f'<article class="org glass"><header class="org-h">{logo(root, org.get("logo"), org.get("mono", ""), alt=org["org"])}'
                   f'<div><h3>{e(org["org"])}</h3><span class="label">{e(org["period"])}</span></div></header><ol class="roles">{roles}</ol></article>')
    skills = "".join(f'<div class="sk"><h3>{e(g["group"])}</h3><div class="chips">{"".join(f"<span class=\"chip\">{e(i)}</span>" for i in g["items"])}</div></div>' for g in a["skills"])
    edu = "".join(f'<div class="edu-c glass">{logo(root, x.get("logo"), alt=x["place"])}<div><b>{e(x["title"])}</b><span>{e(x["place"])}</span><span class="label">{e(x["status"])}</span></div></div>' for x in a["education"])
    certs = "".join(f'<span class="chip">{e(c)}</span>' for c in a.get("certifications", []))
    langs = "".join(f'<span class="chip">{e(l)} · {e(n)}</span>' for l, n in a.get("languages", []))
    return f"""{header(site, root, current='sobre')}
<main id="conteudo">
  <section class="about-top">
    <div class="glows" aria-hidden="true"><i></i><i></i></div>
    <div class="wrap grid">
      {photo}
      <div class="about-intro">
        <span class="label">{e(a.get('headline', ''))}</span>
        <h1>Sobre</h1>
        <p class="about-lead">{e(a.get('lead', ''))}</p>
        <div class="about-more">{paras}</div>
        <div class="btns"><a class="btn magnetic" href="#contato">Entrar em contato</a></div>
      </div>
    </div>
  </section>
  <div class="wrap">
    <section class="cs"><h2 class="sh plain">Em resumo</h2><div class="sums">{summary}</div></section>
    <section class="cs"><h2 class="sh plain">Experiência</h2><div class="exp">{"".join(exp)}</div></section>
    <section class="cs"><h2 class="sh plain">Competências</h2><div class="skills">{skills}</div></section>
    <section class="cs"><h2 class="sh plain">Formação</h2><div class="edus">{edu}</div>
      <div class="extras"><div><span class="label">Certificações</span><div class="chips">{certs}</div></div><div><span class="label">Idiomas</span><div class="chips">{langs}</div></div></div></section>
    <section class="cs" id="contato"><h2 class="sh plain">Contato</h2>{contact_block(site, root)}</section>
  </div>
</main>
{footer(site, root, year)}"""


def not_found(site, root, year):
    return f"""{header(site, root)}
<main id="conteudo"><div class="wrap notfound"><span class="numeral">CDIV</span><h1>Esta página não existe.</h1><p class="lede muted">CDIV é 404 em numerais romanos. O endereço pode ter mudado.</p><a class="btn" href="{root}">Voltar ao início</a></div></main>
{footer(site, root, year)}"""
