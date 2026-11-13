# Guia de Configuração Cloudflare (Plano Free) — Brasil Edge (~25 ms vs ~180 ms EUA)

O servidor já envia os cabeçalhos `Cache-Control`, `s-maxage`, `stale-while-revalidate`, `ETag` e separa consultas públicas de vitrine (`GET` sem cookies/Authorization) das rotas administrativas. As regras abaixo instruem os PoPs brasileiros do Cloudflare (GRU / GIG / CWB / FOR) a respeitarem esses cabeçalhos sem exigir plano pago.

---

## 1. Por que **não** colocar "Cache Everything" no HTML (`/`, `/produto/*`)

- O mesmo backend responde para `lojinhadocelular.com` e `trocafacil.lojinhadocelular.com` com canonical, título e OG distintos por hostname.
- O HTML público já injeta `<script id="__INITIAL_DATA__">` com os dados aquecidos da vitrine no momento da resposta.
- Com o servidor nos EUA e `Cache-Control: public, no-cache, must-revalidate`, o celular já aproveita `bfcache` ao voltar para trás sem correr risco de misturar domínios ou servir HTML com preço vencido no Edge.

---

## 2. Cache Rules (Cloudflare Dashboard -> Caching -> Cache Rules)

### Regra 1 — Cachear API pública `shop.*` respeitando a origem

- **Nome sugerido:** `API Vitrine Publica (Honrar Origem)`
- **Incoming requests match (Custom filter expression):**
  ```text
  (http.request.method eq "GET" and starts_with(http.request.uri.path, "/api/trpc/shop."))
  ```
- **Cache eligibility:** `Eligible for cache`
- **Edge TTL:** `Use cache-control header if present, bypass cache if not`
- **Cache Key -> Query string:** Padrão (`Cache key includes query string` — obrigatório porque tRPC GET usa `?input=...`)

**O que a origem já controla sozinha com essa regra:**
- `shop.settings`, `shop.socialProof` -> cache Edge 300s (`s-maxage=300, stale-while-revalidate=600`)
- `shop.products`, `shop.featured`, `shop.catalogStatus`, `shop.tradeInOptions` -> cache Edge 60s (`s-maxage=60, stale-while-revalidate=120`)
- `shop.product` encontrado -> cache Edge 45s (`s-maxage=45, stale-while-revalidate=90`)
- `shop.product` inexistente e `shop.tradeInQuote` -> **nunca** cacheados (`Cache-Control: no-store`)

### Regra 2 — Cachear ativos estáticos, fontes e imagens

- **Nome sugerido:** `Assets, Fontes e Imagens Estáticas`
- **Incoming requests match (Custom filter expression):**
  ```text
  (http.request.method eq "GET" and (starts_with(http.request.uri.path, "/assets/") or starts_with(http.request.uri.path, "/fonts/") or starts_with(http.request.uri.path, "/images/")))
  ```
- **Cache eligibility:** `Eligible for cache`
- **Edge TTL:** `Use cache-control header if present, bypass cache if not`

> **Importante sobre vídeos (`/hero.mp4` e `/hero-mobile.mp4`):**
> **Não** inclua `.mp4` na Regra 2 no Plano Free. O servidor envia intencionalmente `Cloudflare-CDN-Cache-Control: no-store` para os vídeos continuarem atendendo requisições `206 Partial Content` (Byte-Ranges) exigidas pelo iOS Safari sem serem achatadas para `200 OK` na borda.

### Regra 3 — Garantir Bypass em Admin e Mutações (acima ou explicitamente ativa)

- **Nome sugerido:** `Bypass Admin e Mutações`
- **Incoming requests match:**
  ```text
  (starts_with(http.request.uri.path, "/admin") or starts_with(http.request.uri.path, "/api/trpc/admin") or http.request.method ne "GET")
  ```
- **Cache eligibility:** `Bypass cache`

---

## 3. Otimizações gratuitas de rede e protocolo

No painel Cloudflare da zona (`lojinhadocelular.com`):

1. **Speed -> Optimization -> Content Optimization**
   - **Brotli:** `On`
   - **Early Hints:** `On` (acelera os `preload` de fontes WOFF2 e `/hero-poster.webp`)
   - **Rocket Loader:** **`Off`** (obrigatório manter desligado para não atrasar módulos ES/React)
2. **Network**
   - **HTTP/2:** `On`
   - **HTTP/3 (with QUIC):** `On` (melhora 4G/5G instável com perda de pacotes em latência 180ms)
   - **0-RTT Connection Resumption:** `On`

---

## 4. Passo opcional futuro — Offload total de mídia para Cloudflare R2

Quando quiser tirar imagens `/images/iphones/*`, `hero-poster.*` e os vídeos `hero-mobile.mp4` / `hero.mp4` da origem nos EUA:

1. Crie um bucket R2 público no Cloudflare (ex.: domínio customizado `https://cdn.lojinhadocelular.com`).
2. Configure no ambiente de deploy/upload as variáveis:
   - `R2_ENDPOINT` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
   - `VITE_CLOUDFLARE_R2_URL=https://cdn.lojinhadocelular.com`
3. Rode o script atualizado (já envia `-360w.webp`, `.webp` 612px, `.jpg` OG e vídeos/poster do hero):
   ```bash
   python3 scripts/sync_to_r2.py
   ```
4. Reconstrua o app (`pnpm build`) para que o frontend passe a apontar automaticamente para `VITE_CLOUDFLARE_R2_URL`.
