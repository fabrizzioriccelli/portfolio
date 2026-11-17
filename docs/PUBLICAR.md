# Como publicar o portfólio

Roteiro do zero até o site no ar com o seu nome no link. Leva cerca de 30 minutos, mais o tempo de propagação do domínio.

## 1. Criar o repositório no GitHub

1. Acesse [github.com/new](https://github.com/new), logado na conta `fabrizzioriccelli`.
2. **Repository name:** `portfolio`.
3. **Público ou privado:** os dois funcionam com a Vercel. Público serve como amostra do seu código para quem avalia tecnologia; privado esconde o código, mas o site continua público.
4. **Não marque** "Add a README", ".gitignore" nem "license": o projeto já tem os seus.
5. Clique em **Create repository**.

## 2. Enviar o código

No Terminal, dentro da pasta do projeto:

```bash
cd ~/Documents/portfolio-fabrizzio-riccelli
```

```bash
git remote add origin https://github.com/fabrizzioriccelli/portfolio.git
```

```bash
git push -u origin main
```

Se o Git pedir login, o macOS abre a autenticação do GitHub no navegador.

## 3. Publicar na Vercel

1. Acesse [vercel.com/signup](https://vercel.com/signup) e entre com **Continue with GitHub**.
2. **Add New → Project** e escolha o repositório `portfolio` (em **Import**).
3. **Framework Preset:** `Other`. Não precisa mudar mais nada: o `vercel.json` já define o build (`python3 build.py`), a pasta de saída (`dist`) e os cabeçalhos de segurança.
4. Clique em **Deploy**. Em cerca de 1 minuto o site está no ar em `portfolio-xxxx.vercel.app`.
5. Para um subdomínio grátis com o seu nome: **Settings → Domains → Add** `fabrizzioriccelli.vercel.app` (se estiver livre).

## 4. Domínio próprio (opcional, recomendado)

1. Registre `fabrizzioriccelli.com.br` em [registro.br](https://registro.br) (ou um `.com` em outro registrador).
2. Na Vercel: **Settings → Domains → Add**, digite o domínio e adicione também a versão com `www`.
3. A Vercel mostra os registros de DNS a criar (normalmente um registro **A** para o domínio e um **CNAME** para o `www`). Copie exatamente os valores que ela mostrar.
4. No registro.br: **Domínio → DNS → Editar zona** (modo avançado) e crie esses registros.
5. Em minutos ou algumas horas, a Vercel marca o domínio como **Valid** e ativa o HTTPS sozinha.

## 5. Informar o domínio ao projeto

Abra `content/site.json` e troque:

```json
"base_url": null,
```

por:

```json
"base_url": "https://fabrizzioriccelli.com.br",
```

Depois envie a mudança:

```bash
git commit -am "Domínio final" && git push
```

A Vercel publica de novo sozinha. Agora o site gera `sitemap.xml`, URLs canônicas e imagens de compartilhamento com endereço completo.

## 6. Aparecer no Google

1. Acesse o [Google Search Console](https://search.google.com/search-console) e adicione o domínio.
2. Verifique a propriedade com o registro **TXT** que o Google mostrar (no mesmo lugar do DNS do passo 4).
3. Em **Sitemaps**, envie `https://fabrizzioriccelli.com.br/sitemap.xml`.

## 7. Divulgar

- LinkedIn: campo **Site** do perfil, seção **Destaques** e um post de lançamento.
- GitHub: link no perfil e no repositório.
- Behance: link no perfil.

## Atualizar o site depois

Edite o conteúdo em `content/` (ou a mídia em `static/media/`), confira com:

```bash
python3 build.py --serve
```

e publique:

```bash
git add -A && git commit -m "Atualiza portfólio" && git push
```

A Vercel publica cada `push` automaticamente.

## Antes de divulgar

- O repositório `emulador-report` está público com a pasta `kit/` e um histórico que o próprio README dele diz que não deveriam estar públicos. Resolva isso antes de o portfólio levar recrutadores até lá.
- Abra o site publicado no computador e no celular e teste o botão **Enviar e-mail**.
