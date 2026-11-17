#!/usr/bin/env python3
"""Gera o site estático em dist/ a partir de content/ e static/.

Uso:
    python3 build.py            # gera dist/
    python3 build.py --serve    # gera e serve em http://localhost:4321

Só usa a biblioteca padrão do Python (3.11+). O build:
- valida o conteúdo e a mídia citada nos JSON;
- versiona CSS e JS pelo hash do conteúdo (cache de 1 ano sem servir arquivo velho);
- reduz HTML e CSS;
- gera sitemap.xml, robots.txt e os cabeçalhos de segurança (vercel.json);
- copia sem alterar os arquivos de raiz/ para a raiz do site.
"""
from __future__ import annotations

import argparse
import datetime as dt
import functools
import hashlib
import http.server
import json
import re
import shutil
import socketserver
from pathlib import Path

from site_src import pages
from site_src.components import document

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
STATIC = ROOT / "static"
RAIZ = ROOT / "raiz"  # arquivos copiados sem alteração para a raiz do site (ex.: verificação do Google)
DIST = ROOT / "dist"

# ── segurança ────────────────────────────────────────────────────────────────
# CSP sem 'unsafe-inline': nenhum script ou estilo embutido é executado.
# (blocos <script type="application/ld+json"> e "application/json" são dados, não código.)
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "media-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self' https://open.spotify.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
])
# As demos interativas são arquivos únicos com script embutido: rodam isoladas, num iframe com sandbox.
CSP_DEMO = "; ".join([
    "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "media-src 'self' data: blob:", "font-src 'self' data:",
    "connect-src 'self'", "frame-ancestors 'self'", "base-uri 'none'", "form-action 'none'", "object-src 'none'",
])
SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-Frame-Options": "DENY",
}


def load():
    site = json.loads((CONTENT / "site.json").read_text("utf-8"))
    projects = [json.loads(p.read_text("utf-8")) for p in sorted((CONTENT / "projects").glob("*.json"))]
    projects.sort(key=lambda p: p["order"])
    ids = {u["id"] for u in site["universes"]}
    slugs = set()
    for p in projects:
        assert p["universe"] in ids, f"{p['slug']}: universo desconhecido {p['universe']}"
        assert re.fullmatch(r"[a-z0-9-]+", p["slug"]), f"slug inválido: {p['slug']}"
        assert p["slug"] not in slugs, f"slug repetido: {p['slug']}"
        slugs.add(p["slug"])
        for _, url in p.get("links", []):
            assert url.startswith("https://"), f"{p['slug']}: link precisa ser https ({url})"
    for k, url in site["links"].items():
        assert url is None or url.startswith("https://"), f"link {k} precisa ser https"
    return site, projects


@functools.cache
def svg_size(slug: str, name: str) -> tuple[int, int]:
    txt = (STATIC / "media" / slug / name).read_text("utf-8", errors="ignore")[:3000]
    m = re.search(r'viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"', txt)
    return (round(float(m.group(1))), round(float(m.group(2)))) if m else (1200, 700)


# ── otimização ───────────────────────────────────────────────────────────────

def minify_css(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};,>])\s*", r"\1", css)
    return css.replace(";}", "}").strip()


_KEEP = re.compile(r"(<pre[\s\S]*?</pre>|<script[\s\S]*?</script>|<textarea[\s\S]*?</textarea>)", re.I)


def minify_html(html: str) -> str:
    parts = _KEEP.split(html)
    for i in range(0, len(parts), 2):  # fora de pre/script/textarea
        parts[i] = re.sub(r"\n\s*", "\n", parts[i])
        parts[i] = re.sub(r"\n+", "\n", parts[i])
    return "".join(parts).strip() + "\n"


ASSET_VERSIONS: dict[str, str] = {}


def version_assets():
    for f in sorted((DIST / "static").rglob("*")):
        if f.suffix in (".css", ".js") and f.is_file() and "demos" not in f.parts:
            if f.suffix == ".css":
                f.write_text(minify_css(f.read_text("utf-8")), "utf-8")
            ASSET_VERSIONS[f.relative_to(DIST).as_posix()] = hashlib.sha256(f.read_bytes()).hexdigest()[:10]


def apply_versions(html: str) -> str:
    def sub(m):
        path = m.group(2)
        v = ASSET_VERSIONS.get(path)
        return f'{m.group(1)}{path}?v={v}"' if v else m.group(0)
    return re.sub(r'((?:href|src)="(?:\.\./)*/?)(static/(?:css|js)/[\w.-]+)"', sub, html)


def write(rel: str, html: str):
    out = DIST / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(minify_html(apply_versions(html)), "utf-8")


def meta_desc(text: str, limit: int = 158) -> str:
    """Descrição para buscadores: até ~158 caracteres, cortando em fim de frase ou de palavra."""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    if end >= 90:
        return cut[:end + 1]
    return cut[:cut.rfind(" ")].rstrip(",;:") + "…"


def root_for(rel: str) -> str:
    return "../" * rel.count("/")


def person_ld(site):
    a = site.get("about", {})
    return {"@context": "https://schema.org", "@type": "Person", "name": site["name"],
            "jobTitle": "Analista de Marketing", "description": site["description"],
            "sameAs": [u for u in site["links"].values() if u],
            "address": {"@type": "PostalAddress", "addressLocality": site["city"], "addressCountry": "BR"},
            "alumniOf": [{"@type": "CollegeOrUniversity", "name": e["place"]} for e in a.get("education", [])],
            "knowsLanguage": [l for l, _ in a.get("languages", [])]}


def check_media(projects):
    missing = []
    for p in projects:
        names = [v["src"] for v in p.get("videos", [])] + [v["poster"] for v in p.get("videos", [])]
        names += [g["src"] for g in p.get("gallery", [])] + [d["src"] for d in p.get("diagrams", [])]
        if p.get("cover"):
            names.append(p["cover"]["src"])
        for n in names:
            if not (STATIC / "media" / p["slug"] / n).exists():
                missing.append(f"{p['slug']}/{n}")
        if p.get("demo") and not (STATIC / "demos" / p["demo"]["src"]).exists():
            missing.append(f"demos/{p['demo']['src']}")
    if missing:
        raise SystemExit("Arquivos de mídia ausentes:\n  " + "\n  ".join(missing))


def write_vercel_config():
    hdr = lambda d: [{"key": k, "value": v} for k, v in d.items()]
    cfg = {
        "$schema": "https://openapi.vercel.sh/vercel.json",
        "buildCommand": "python3 build.py",
        "outputDirectory": "dist",
        "trailingSlash": True,
        "headers": [
            {"source": "/(.*)", "headers": hdr({**SECURITY_HEADERS, "Content-Security-Policy": CSP})},
            {"source": "/static/demos/(.*)", "headers": hdr({"Content-Security-Policy": CSP_DEMO, "X-Frame-Options": "SAMEORIGIN"})},
            {"source": "/static/(css|js|fonts)/(.*)", "headers": hdr({"Cache-Control": "public, max-age=31536000, immutable"})},
            {"source": "/static/media/(.*)", "headers": hdr({"Cache-Control": "public, max-age=604800"})},
        ],
    }
    (ROOT / "vercel.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", "utf-8")


def build():
    site, projects = load()
    check_media(projects)
    year = dt.date.today().year
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(STATIC, DIST / "static")
    # transição compartilhada card → case: um nome por projeto (CSS gerado, sem estilo inline)
    (DIST / "static" / "css" / "vt.css").write_text("".join(
        f".vt-{p['slug']}{{view-transition-name:p-{p['slug']}}}" for p in projects), "utf-8")
    version_assets()
    urls = []

    def page(rel, path, title, desc, body_fn, scripts=(), og=None, ld=None, cls=""):
        root = root_for(rel)
        write(rel, document(site=site, title=title, description=meta_desc(desc), body=body_fn(root), root=root, path=path,
                            scripts=scripts, og_image=og, jsonld=ld, page_class=cls))
        urls.append(path)

    name = site["name"]
    page("index.html", "/", name, site["description"],
         lambda r: pages.home(site, projects, r, year), scripts=("columns-gl.js", "reel.js", "home.js"),
         og="static/media/emulador-report/overview.jpg", ld=person_ld(site), cls="home")

    for u in site["universes"]:
        if u["id"] == "sobre":
            page("sobre/index.html", "/sobre/", f"Sobre · {name}", f"Trajetória, competências, formação e contato de {name}: designer de formação com mais de 4 anos em marketing digital, dados e IA.",
                 lambda r: pages.about(site, r, year), ld=person_ld(site))
            continue
        page(f"{u['id']}/index.html", f"/{u['id']}/", f"{u['title']} · {name}", f"{u['lede']} Projetos de {name}: trabalhos profissionais, acadêmicos e autorais.",
             lambda r, u=u: pages.universe(site, u, projects, r, year))

    for p in projects:
        og = None
        if p.get("videos"):
            og = f"static/media/{p['slug']}/{p['videos'][0]['poster']}"
        elif p.get("cover"):
            og = f"static/media/{p['slug']}/{p['cover']['src']}"
        ld = {"@context": "https://schema.org", "@type": "CreativeWork", "name": p["title"], "abstract": p["summary"],
              "author": {"@type": "Person", "name": name}, "keywords": ", ".join(p.get("keywords") or p["stack"])}
        if p.get("year"):
            ld["dateCreated"] = p["year"]
        page(f"{p['universe']}/{p['slug']}/index.html", f"/{p['universe']}/{p['slug']}/", f"{p['title']} · {name}", p["summary"],
             lambda r, p=p: pages.case(site, p, projects, r, year, svg_size), scripts=("case.js",), og=og, ld=ld)

    write("404.html", document(site=site, title=f"Página não encontrada · {name}", description=meta_desc(site["description"]),
                               body=pages.not_found(site, "/", year), root="/", path="/404.html"))

    base = site.get("base_url")
    if base:
        base = base.rstrip("/")
        today = dt.date.today().isoformat()
        xml = "".join(f"<url><loc>{base}{u}</loc><lastmod>{today}</lastmod></url>" for u in urls)
        (DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{xml}</urlset>\n', "utf-8")
        (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /static/demos/\n\nSitemap: {base}/sitemap.xml\n", "utf-8")
    else:
        (DIST / "robots.txt").write_text("User-agent: *\nAllow: /\nDisallow: /static/demos/\n", "utf-8")
        print("Aviso: base_url vazio em content/site.json; sitemap.xml e URLs canônicas não foram gerados.")
    (DIST / ".well-known").mkdir(exist_ok=True)
    (DIST / ".well-known" / "security.txt").write_text(
        f"Contact: {site['links'].get('linkedin') or site['links']['github']}\nPreferred-Languages: pt, en\n"
        f"Expires: {(dt.date.today() + dt.timedelta(days=365)).isoformat()}T00:00:00Z\n", "utf-8")
    if RAIZ.is_dir():
        for f in RAIZ.iterdir():
            if f.is_file() and not f.name.startswith("."):
                shutil.copy2(f, DIST / f.name)
    write_vercel_config()
    size = sum(f.stat().st_size for f in DIST.rglob("*.html") if "demos" not in f.parts) // 1024
    print(f"OK: {len(urls)} páginas em {DIST.relative_to(ROOT)}/ ({size} KB de HTML)")


class _Handler(http.server.SimpleHTTPRequestHandler):
    """Servidor local com os mesmos cabeçalhos de segurança da produção (sem HSTS)."""

    def end_headers(self):
        demo = self.path.startswith("/static/demos/")
        self.send_header("Content-Security-Policy", (CSP_DEMO if demo else CSP).replace("; upgrade-insecure-requests", ""))
        for k, v in SECURITY_HEADERS.items():
            if k == "Strict-Transport-Security" or (demo and k == "X-Frame-Options"):
                continue
            self.send_header(k, v)
        if demo:
            self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


def serve(port=4321):
    handler = functools.partial(_Handler, directory=str(DIST))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Servindo em http://localhost:{port}")
        httpd.serve_forever()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--serve", action="store_true", help="servir dist/ depois de gerar")
    ap.add_argument("--port", type=int, default=4321)
    a = ap.parse_args()
    build()
    if a.serve:
        serve(a.port)
