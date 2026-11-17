"""Componentes HTML reutilizáveis. Cada função devolve uma string já escapada."""
from __future__ import annotations

import json
import re
from html import escape as _esc


def e(s) -> str:
    return _esc(str(s), quote=True)


def safe_json(obj) -> str:
    """JSON para embutir em <script>: escapa <, > e & para não fechar a tag nem abrir comentário."""
    return (json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
            .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026"))


_ROMAN = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]


def roman(n) -> str:
    n = int(n); out = ""
    for v, r in _ROMAN:
        while n >= v:
            out += r; n -= v
    return out


def split_words(text: str, accent_last_char: bool = False) -> str:
    """Envolve cada palavra para a animação de entrada (atraso por :nth-child no CSS)."""
    words = text.split()
    out = []
    for i, w in enumerate(words):
        if accent_last_char and i == len(words) - 1 and w[-1] in ".?!":
            inner = f'{e(w[:-1])}<i class="stop">{e(w[-1])}</i>'
        else:
            inner = e(w)
        out.append(f'<span class="w" aria-hidden="true"><span>{inner}</span></span>')
    return " ".join(out)


# ── documento ────────────────────────────────────────────────────────────────

def document(*, site, title, description, body, root, path, scripts=(), og_image=None, jsonld=None, page_class="") -> str:
    base = site.get("base_url")
    canonical = f'<link rel="canonical" href="{e(base.rstrip("/") + path)}">' if base else ""
    og_url = f'<meta property="og:url" content="{e(base.rstrip("/") + path)}">' if base else ""
    og_img = ""
    if og_image and base:
        og_img = f'<meta property="og:image" content="{e(base.rstrip("/") + "/" + og_image)}">'
    ld = f'<script type="application/ld+json">{safe_json(jsonld)}</script>' if jsonld else ""
    js = "".join(f'<script src="{root}static/js/{s}" defer></script>' for s in ("site.js", "fx.js", *scripts))
    return f"""<!doctype html>
<html lang="{e(site['lang'])}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<meta name="theme-color" content="#F7F6F3">
<meta name="color-scheme" content="light">
{canonical}
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="{e(site['name'])}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
{og_url}
{og_img}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{root}static/favicon.svg" type="image/svg+xml">
<link rel="preload" href="{root}static/fonts/marcellus-sc-latin-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{root}static/css/tokens.css">
<link rel="stylesheet" href="{root}static/css/base.css">
<link rel="stylesheet" href="{root}static/css/components.css">
<link rel="stylesheet" href="{root}static/css/pages.css">
<link rel="stylesheet" href="{root}static/css/vt.css">
{ld}
{js}
</head>
<body class="{e(page_class)}">
<div class="scroll-bar" aria-hidden="true"></div>
<div class="glass-light" aria-hidden="true"><i></i><i></i><i></i></div>
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
{body}
</body>
</html>
"""


# ── cabeçalho e rodapé ───────────────────────────────────────────────────────

def header(site, root, current=None) -> str:
    items = "".join(
        f'<li><a href="{root}{u["id"]}/"{" aria-current=\"page\"" if current == u["id"] else ""}>'
        f'<span class="numeral">{u["numeral"]}</span>{e(u["short"])}</a></li>'
        for u in site["universes"]
    )
    mob = "".join(
        f'<li><a href="{root}{u["id"]}/"><span class="numeral">{u["numeral"]}</span>{e(u["title"])}</a></li>'
        for u in site["universes"]
    )
    gh = site["links"].get("github")
    return f"""<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="{root}" aria-label="{e(site['name'])}, página inicial"><span class="tess" aria-hidden="true"></span>{e(site['name'])}</a>
    <nav class="main-nav" aria-label="Universos"><ul>{items}</ul></nav>
    <div class="header-end">
      <span class="label clock" data-clock>São Paulo</span>
      <a class="btn small" href="{root}sobre/#contato">Contato</a>
      <button class="menu-btn" type="button" data-menu-open aria-expanded="false" aria-controls="mobile-menu">Menu</button>
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu" hidden role="dialog" aria-modal="true" aria-label="Menu">
  <div class="top"><a class="brand" href="{root}"><span class="tess" aria-hidden="true"></span>{e(site['name'])}</a><button class="menu-btn show" type="button" data-menu-close>Fechar</button></div>
  <ul>{mob}</ul>
  <div class="foot"><a class="btn" href="{root}sobre/#contato">Contato</a>{f'<a class="btn ghost" href="{e(gh)}" rel="me noopener" target="_blank">GitHub ↗</a>' if gh else ""}</div>
</div>"""


LINK_LABELS = [("github", "GitHub"), ("linkedin", "LinkedIn"), ("behance", "Behance"), ("cv", "Currículo")]


def link_items(site, root) -> str:
    out = []
    for key, label in LINK_LABELS:
        url = site["links"].get(key)
        if url:
            out.append(f'<li><a href="{e(url)}" rel="me noopener" target="_blank">{label}<span aria-hidden="true">↗</span></a></li>')
    return "".join(out)


def footer(site, root, year) -> str:
    return f"""<footer class="site-footer">
  <div class="guilloche" aria-hidden="true"></div>
  <div class="wrap">
    <div class="grid">
      <div class="sign"><span class="inscricao">{e(site['first'])}<br>{e(site['last'])}<i class="stop">.</i></span><span class="label">{e(site['tagline'])}</span></div>
      <ul class="links" aria-label="Links">{link_items(site, root)}</ul>
    </div>
    <div class="bottom"><span class="label">© {year} {e(site['name'])} · {e(site['city'])}</span><a class="label" href="#conteudo">Voltar ao topo ↑</a></div>
  </div>
</footer>"""


# ── peças ────────────────────────────────────────────────────────────────────


# ── realce de código (mínimo, sem dependências) ──────────────────────────────

_TOKEN = re.compile(r'(/\*.*?\*/|//[^\n]*)|("(?:\\.|[^"\\])*")|\b(function|return|if|var|const|let|else|new)\b', re.S)


def highlight(code: str) -> str:
    out, pos = [], 0
    for m in _TOKEN.finditer(code):
        out.append(e(code[pos:m.start()]))
        cls = "c" if m.group(1) else "s" if m.group(2) else "k"
        out.append(f'<span class="{cls}">{e(m.group(0))}</span>')
        pos = m.end()
    out.append(e(code[pos:]))
    return "".join(out)


# ── card de projeto (vidro) ──────────────────────────────────────────────────

def _thumb(p):
    """Imagem do card: pôster do vídeo, capa ou primeira imagem. Sem imagem, sem placeholder."""
    if p.get("thumb"):
        return p["thumb"]
    if p.get("videos"):
        return p["videos"][0]["poster"]
    if p.get("cover") and not p["cover"].get("small"):
        return p["cover"]["src"]
    if p.get("gallery"):
        return p["gallery"][0]["src"]
    if p.get("cover"):
        return p["cover"]["src"]
    return None


def project_card(site, p, root, data_u="") -> str:
    u = next(x for x in site["universes"] if x["id"] == p["universe"])
    href = f"{root}{u['id']}/{p['slug']}/"
    th = _thumb(p)
    vid = f' data-video="{root}static/media/{p["slug"]}/{p["videos"][0]["src"]}"' if p.get("videos") else ""
    img = (f'<div class="gthumb vt-{p["slug"]}"{vid}><img src="{root}static/media/{p["slug"]}/{th}" alt="" loading="lazy" decoding="async" width="1280" height="800"></div>'
           if th else "")
    summary = "" if th else f'<p class="gsum">{e(p["summary"])}</p>'
    meta = " · ".join(x for x in [u["short"], p.get("year")] if x)
    du = f' data-u="{e(data_u)}"' if data_u else ""
    brand = logo(root, p["logo"], alt="", cls="sm") if p.get("logo") else ""
    return (f'<article class="gcard{" text-only" if not th else ""}"{du}><a class="gcard-in glass" href="{href}" data-tilt>'
            f'{img}<div class="gbody"><div class="gmeta"><span class="gm-l">{brand}<span class="st tipo">{e(p["kind"])}</span></span><span class="label">{e(meta)}</span></div>'
            f'<h3>{e(p["title"])}</h3>{summary}<p class="grole"><span class="label">Minha parte</span>{e(p["role"])}</p>'
            f'<span class="gcta">Ver projeto <span aria-hidden="true">→</span></span></div></a></article>')


def logo(root, file=None, mono="", alt="", cls="") -> str:
    """Logo em moldura arredondada; sem arquivo, um monograma tipográfico."""
    if file:
        return f'<span class="logo {cls}"><img src="{root}static/media/logos/{e(file)}" alt="{e(alt)}" width="40" height="40" loading="lazy" decoding="async"></span>'
    return f'<span class="logo mono {cls}" aria-hidden="true">{e(mono)}</span>'
