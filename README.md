# Portfólio · Fabrizzio Riccelli

**Site:** [fabrizzioriccelli.com.br](https://fabrizzioriccelli.com.br)

> **English.** Source of my portfolio site. A static site generator written in standard-library Python turns JSON content into HTML; the front end is vanilla CSS and JavaScript with a hand-written WebGL hero, and the build emits strict security headers for Vercel. Run it with `python3 build.py --serve` (Python 3.11+). The rest of this README is in Portuguese.

Site estático com a identidade **Tessera**: mármore, pedra, tinta e uma única cor viva (cinábrio). O texto usa a San Francisco do sistema Apple, e a inscrição romana (Marcellus SC) aparece só no nome e nos numerais. No topo, um pórtico de colunas romanas em 3D; o site inteiro usa um mesmo material de vidro líquido.

## Por que esta stack

| Decisão | Motivo |
|---|---|
| HTML, CSS e JavaScript sem framework | Um portfólio é conteúdo. Sem runtime de framework, a página carrega rápido e não quebra com atualizações de dependência. |
| Gerador em Python, só com a biblioteca padrão | O conteúdo fica separado da interface (JSON em `content/`) e o build não exige instalar nada. |
| WebGL puro para o pórtico 3D | Alguns milhares de triângulos, sem biblioteca 3D (como three.js). Para de desenhar fora da tela. |
| View Transitions do navegador | Transição suave entre páginas onde o navegador suporta, sem JavaScript extra. |

## Rodar localmente

```bash
python3 build.py --serve
```

Abre em http://localhost:4321. Requer Python 3.11 ou mais recente. Para só gerar `dist/`, rode `python3 build.py`.

## Estrutura

```text
portfolio/
├── build.py                  # gera dist/ (e serve com --serve)
├── content/
│   ├── site.json             # nome, links, universos, página Sobre
│   └── projects/*.json       # um arquivo por case
├── site_src/
│   ├── components.py         # cabeçalho, rodapé, card de projeto, blocos
│   ├── home.py               # página inicial
│   └── pages.py              # universo, case, sobre, 404
└── static/
    ├── css/                  # tokens.css · base.css · components.css · pages.css
    ├── js/                   # site.js · fx.js · columns-gl.js · reel.js · home.js · case.js
    ├── fonts/                # Inter, Marcellus SC, JetBrains Mono (OFL) + licenças
    ├── media/<slug>/         # vídeos, capturas e diagramas de cada case
    └── demos/                # demonstrações interativas (carregam só com um clique)
```

## Adicionar um case

1. Crie `content/projects/<slug>.json` copiando um dos existentes.
2. Coloque a mídia em `static/media/<slug>/`.
3. Rode `python3 build.py`. O build para com erro se faltar algum arquivo citado no JSON.

Campos opcionais (`videos`, `demo`, `gallery`, `diagrams`, `timeline`, `code`, `links`, `embed`, `cover`, `thumb`, `logo`) só aparecem na página quando existem. Para um projeto entrar nos destaques da home, adicione-o em `highlights` no `content/site.json`. Toda página de case mostra o **tipo** (Profissional, Acadêmico, Autoral ou Conceitual) e um aviso sobre os dados.

## Publicar

Recomendado: Vercel (o build gera o `vercel.json` com os cabeçalhos). Em outra hospedagem estática, replique os cabeçalhos da seção Segurança.

- **Build command:** `python3 build.py`
- **Output directory:** `dist`

O `vercel.json` é gerado pelo build com os cabeçalhos de segurança e de cache. Antes de publicar, preencha `base_url` em `content/site.json` com o domínio final. Sem ele, o build não gera `sitemap.xml` nem URLs canônicas.

## Pendências de conteúdo

- [x] `base_url` (domínio final)
- [ ] Currículo para download em `content/site.json` → `links.cv`
- [ ] Três cases conceituais de Design
- [ ] FarmTech: descrição da participação
- [x] Frota Pulse: links dos repositórios das Sprints 1 e 2
- [ ] Imagens de FastCo Money e Select Global, se surgirem

## Desempenho

- **Pórtico romano em 3D no hero** (`static/js/columns-gl.js`): três colunas de mármore (plinto, toro, fuste com êntase e 20 caneluras, equino e ábaco) e uma tessera de vidro cinábrio, em WebGL com geometria rasterizada. Desenha a 30 fps em uso, 12 fps parado, e para fora da tela.
- **Luz de fundo só em CSS:** três manchas que apenas se deslocam (`transform`), sem canvas nem repintura.
- **Contornos de vidro por `background-clip`:** sem máscaras nem pseudo-elementos.
- **Sem trechos que prendem o scroll.** As animações usam só `transform` e `opacity`, com um único loop `requestAnimationFrame` compartilhado (`fx.js`).
- **Textura de grain como fundo da página**, sem camada fixa nem `mix-blend-mode`, que obrigavam o navegador a redesenhar a tela inteira a cada quadro.
- **CSS reduzido e CSS/JS versionados pelo hash do conteúdo** (`?v=…`): cache de 1 ano sem risco de servir arquivo antigo.
- **Vídeos e demos sob demanda:** vídeos com `preload="none"` só tocam visíveis; a demo do Emulador (1,1 MB) só carrega com um clique.
- **Respeito a `prefers-reduced-motion`:** sem cursor, sem animações de entrada e a peça de vidro parada.
- **O texto nunca depende da animação:** se a animação de entrada não rodar, o conteúdo aparece em 2,5 s.

## Segurança

O build gera `vercel.json` com os cabeçalhos abaixo. O servidor local (`--serve`) aplica os mesmos, menos o HSTS.

| Cabeçalho | Valor e motivo |
|---|---|
| `Content-Security-Policy` | Só scripts, estilos, fontes e mídia do próprio domínio; nenhum `unsafe-inline`. Iframes só do próprio site e do Spotify. |
| `frame-ancestors 'none'` e `X-Frame-Options: DENY` | Ninguém consegue embutir o site para clickjacking. |
| `Strict-Transport-Security` | Força HTTPS por 2 anos. |
| `X-Content-Type-Options: nosniff` | O navegador não "adivinha" tipos de arquivo. |
| `Referrer-Policy` e `Permissions-Policy` | Não vaza endereço completo e bloqueia câmera, microfone, localização e pagamento. |
| `Cross-Origin-Opener-Policy` | Isola a janela de páginas abertas por links externos. |

Além disso:
- JSON embutido em `<script>` (JSON-LD e dados do player) é escapado para não fechar a tag.
- A demo interativa roda num iframe com `sandbox` e uma CSP própria e mais restrita para ela.
- O build recusa links que não sejam `https://` e slugs com caracteres inválidos.
- `/.well-known/security.txt` indica o contato para relatos de segurança.
- O servidor local só escuta em `127.0.0.1`.

## Fontes e licenças

- **SF Pro / SF Mono:** usadas a partir do sistema do visitante (Apple). Não são hospedadas, porque a licença da Apple não permite.
- **Inter, Marcellus SC e JetBrains Mono:** SIL Open Font License 1.1. As licenças estão em `static/fonts/`.
- **Mídia do Emulador Report:** gravações e capturas do próprio projeto, com dados fictícios. Publicação autorizada pelo autor.
