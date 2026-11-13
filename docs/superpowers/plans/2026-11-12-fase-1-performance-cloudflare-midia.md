# Fase 1 — Performance de Rede (180 ms EUA→BR), Cache no Cloudflare, Mídia e Bundle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir a latência percebida no Brasil (~180 ms RTT até EUA), destravar `bfcache` mobile, enxugar vídeo/imagens/bundle JS e deixar endpoints públicos prontos para cache no PoP brasileiro do Cloudflare Free.

**Architecture:** Hidratação segura no HTML (`__INITIAL_DATA__`) usando cache em RAM já aquecido do ERP/settings; leitura assíncrona de estáticos com `ETag`/`304`; queries públicas `shop.*` enviadas como `GET` individuais sem cookies/Authorization (`splitLink` + `httpLink`) com `Cache-Control: public, max-age=..., s-maxage=..., stale-while-revalidate=...`; pôster LCP `<img fetchPriority="high">` em WebP leve; vídeo mobile re-encodado; variantes `-360w.webp` com `srcSet` local; code-splitting em `App.tsx` e eliminação de `modernPolyfills` de ~134 KB no `vite.config.ts`.

**Tech Stack:** Hono, `@trpc/server` / `@trpc/react-query` 11, TanStack Query 5, React 19, Vite + `@vitejs/plugin-legacy`, Python Pillow + `avconvert` (macOS), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-12-fase-1-performance-cloudflare-midia-design.md`

## Global Constraints

- pnpm `9.15.9`; 2 espaços TypeScript; aliases `@/`, `@contracts`, `@db`.
- Nunca editar `dist/` manualmente; validar com `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build`.
- Preservar `public/images/iphone-*.jpg` (exigidos por `api/lib/vite.ts` / WhatsApp OG crawlers).
- Preservar headers `Cross-Origin-Resource-Policy: cross-origin` e `Access-Control-Allow-Origin: *` em `/images/*` (testes em `api/seo.test.ts` e `api/security.test.ts`).
- Nunca vazar dados internos do ERP nem injetar `__INITIAL_DATA__` em `/admin*`.

---

### Task 1: Cache quente em `api/erp/service.ts` + helpers públicos & `Cache-Control` Edge-Ready em `api/shop.ts`

**Files:**
- Modify: `api/erp/service.ts`, `api/shop.ts`
- Test: `api/performance.test.ts` (create)

- [ ] **Step 1: Escrever testes que falham em `api/performance.test.ts` para `getCachedErpCatalogIfWarm()` e `Cache-Control` em `shop.catalogStatus`, `shop.featured`, `shop.tradeInOptions`, `shop.settings`, `shop.products`, `shop.socialProof` (e ausência de cache público em mutations).**
- [ ] **Step 2: Rodar `pnpm exec vitest run api/performance.test.ts` e confirmar falha.**
- [ ] **Step 3: Em `api/erp/service.ts`, adicionar `getCachedErpCatalogIfWarm()` (síncrono, retorna `ErpFetchResult | null` apenas se cache estiver válido dentro do TTL sem disparar `fetch`) e `warmUpErpCatalog()` (inicia `getErpCatalog()` de forma não-bloqueante capturando erros).**
- [ ] **Step 4: Em `api/shop.ts`, extrair/exportar `getPublicCatalogStatus()`, `getPublicProductsList(input?)`, `getPublicProductById(id)` reutilizando `sanitizePublicProduct`/`sortProductsBackend`, e aplicar `ctx.resHeaders.set("Cache-Control", ...)` com `s-maxage` + `stale-while-revalidate` em todas as queries públicas (`catalogStatus`, `products`, `featured`, `product`, `tradeInOptions`, `settings`, `socialProof`), definindo `no-store` em mutações.**
- [ ] **Step 5: Rodar `pnpm exec vitest run api/performance.test.ts` e verificar que os novos testes passam.**

---

### Task 2: I/O Assíncrono, `ETag` / `304`, Fontes e Middleware `/images/*` em `api/boot.ts`

**Files:**
- Modify: `api/boot.ts`
- Test: `api/performance.test.ts`

- [ ] **Step 1: Adicionar testes em `api/performance.test.ts` cobrindo:**
  - `/images/og-preview.jpg` e `/images/iphones/iphone-17-pro-max-silver.webp`: retorno de `ETag`, resposta `304 Not Modified` quando `If-None-Match` bate, preservação de `Cross-Origin-Resource-Policy: cross-origin` e `Access-Control-Allow-Origin: *`, e `/images/iphones/*` mantendo `max-age=604800` (sem ser sobrescrito por `max-age=86400`).
  - `/fonts/inter-latin.woff2` e `/hero-poster.jpg`: `Cache-Control` longo e `ETag`/`304`.
- [ ] **Step 2: Rodar `pnpm exec vitest run api/performance.test.ts` e confirmar falha nas novas asserções.**
- [ ] **Step 3: Em `api/boot.ts`, criar helper assíncrono `serveStaticAssetWithEtag` usando `fs.promises.stat` + `fs.promises.readFile` com cache em RAM de `{ mtimeMs, size, etag, buffer }`, resposta `304` em `If-None-Match`, e aplicá-lo em `/hero-poster.jpg`, `/hero-poster.webp`, `/images/:file`, `/images/iphones/:file`, `/nfc/*`.**
- [ ] **Step 4: Corrigir a ordem/escopo do middleware `app.use("/images/*", ...)` para não rebaixar o `Cache-Control` mais longo de `/images/iphones/*`, adicionar `app.use("/fonts/*", ...)` com `public, max-age=31536000, immutable` e `ETag`/`Cache-Control` em `streamVideoFile`. Em `if (env.isProduction)`, disparar `void warmUpErpCatalog()` sem bloquear o boot.**
- [ ] **Step 5: Rodar `pnpm exec vitest run api/performance.test.ts api/seo.test.ts api/security.test.ts` e confirmar todos verdes.**

---

### Task 3: Cache de `index.html`, liberação do `bfcache` e Hidratação XSS-safe (`__INITIAL_DATA__`) em `api/lib/vite.ts`

**Files:**
- Modify: `api/lib/vite.ts`
- Test: `api/performance.test.ts`, `api/seo.test.ts`

- [ ] **Step 1: Adicionar testes em `api/performance.test.ts`:**
  - Rota pública `/` retorna `Cache-Control: public, no-cache, must-revalidate` (sem `no-store`) permitindo `bfcache`.
  - Rota `/admin` e `/admin/produtos` preservam `Cache-Control: no-store, no-cache, must-revalidate` e **não** contêm `__INITIAL_DATA__`.
  - Rota `/` com cache ERP quente injeta `<script id="__INITIAL_DATA__">` com `settings`, `catalogStatus` e `products` sanitizados; rota `/produto/:id` injeta `settings` + `product`; nomes de produto com `</script>` ou caracteres HTML saem devidamente escapados (sem quebrar DOM / sem XSS).
  - Modo `trocafacil` (`host: trocafacil.lojinhadocelular.com`) injeta apenas `settings` (não `products`).
- [ ] **Step 2: Rodar `pnpm exec vitest run api/performance.test.ts` e confirmar falha.**
- [ ] **Step 3: Em `api/lib/vite.ts`:**
  - Cachear leitura de `index.html` por `indexPath` em produção (`process.env.NODE_ENV !== "development"`).
  - Implementar `serializeSafeInitialData` (escape `<`, `>`, `&`, `\u2028`, `\u2029`) e injetar antes de `</head>` nas rotas elegíveis.
  - Em `renderEnrichedHtml`, reutilizar helpers públicos sanitizados de `api/shop.ts` (`getPublicCatalogStatus`, `getPublicProductsList`, `sanitizePublicProduct`) e `getShopPublicSettings`.
  - Atualizar `Cache-Control` das respostas HTML (humanos em rotas públicas vs `/admin*` e 404).
- [ ] **Step 4: Rodar `pnpm exec vitest run api/performance.test.ts api/seo.test.ts` e confirmar verde.**

---

### Task 4: Hidratação do `QueryClient` no frontend & `splitLink` sem credenciais em `src/providers/trpc.tsx`

**Files:**
- Create: `src/lib/initialData.ts`
- Modify: `src/providers/trpc.tsx`, `src/pages/Produto.tsx` (se precisar garantir matching da query key com o input), `vitest.config.ts` (se testarmos unitariamente `initialData.ts` — ou testar funções puras importando direto em Vitest!)
- Test: `api/performance.test.ts` (ou teste puro para `initialData.ts` / helper compartilhado)

- [ ] **Step 1: Escrever teste unitário para o parser/deserializador de `__INITIAL_DATA__` (payload válido, inválido/corrompido, ausente, XSS escaped).**
- [ ] **Step 2: Criar `src/lib/initialData.ts` com `InitialDataPayload`, `parseInitialDataJson`, `readInitialDataFromDom()` e `hydrateQueryClientFromInitialData(queryClient, trpc)`.**
- [ ] **Step 3: Em `src/providers/trpc.tsx`, chamar `hydrateQueryClientFromInitialData` após criar `queryClient` e substituir link único por `splitLink`: queries `shop.*` (exceto `tradeInQuote`) usam `httpLink` GET com `credentials: "omit"` e sem header `Authorization` (URLs 100% determinísticas e cacheáveis no Cloudflare mesmo se o lojista abriu o Admin); mutações e `admin.*` mantêm `httpBatchLink` com `Bearer` + `credentials: "include"`.**
- [ ] **Step 4: Rodar `pnpm exec vitest run api/performance.test.ts` e `pnpm check`.**

---

### Task 5: Otimização de Mídia & Script + `HeroBlk.tsx` LCP + `srcSet` WebP em `src/lib/shop.ts`

**Files:**
- Modify: `scripts/optimize_iphone_images.py`, `scripts/sync_to_r2.py`, `src/lib/shop.ts`, `src/components/HeroBlk.tsx`, `api/lib/vite.ts` (se `troca-facil-og` for redimensionada para `1200x630`), `public/*`
- Test: `api/performance.test.ts`

- [ ] **Step 1: Escrever testes em `api/performance.test.ts` para `optimizeImageUrl` e `getImageSrcSet` com URLs locais `/images/iphones/*.webp` e com `R2` base URL (emitindo `-360w.webp 360w, ...webp 612w`) além de URLs externas.**
- [ ] **Step 2: Rodar `pnpm exec vitest run api/performance.test.ts` e confirmar falha nas asserções novas de `srcSet`.**
- [ ] **Step 3: Atualizar `scripts/optimize_iphone_images.py` (gerando `-360w.webp` para os arquivos de `public/images/iphones/`, otimizando `hero-poster.webp`/`hero-poster.jpg`, `troca-facil-og.png`/`troca-facil-og.jpg` `1200x630`, `og-banner.png`, `og-preview.png`, `logo.png` e `logo-nav.webp`) e executar o script.**
- [ ] **Step 4: Re-encodar `public/hero-mobile.mp4` via `avconvert` em resolução portrait mobile mantendo qualidade visual e reduzir peso drasticamente (de 14 MB para <= 3.5 MB), testando o arquivo gerado.**
- [ ] **Step 5: Atualizar `src/lib/shop.ts` (`optimizeImageUrl`, `getImageSrcSet`), `src/components/HeroBlk.tsx` (pôster `<img fetchPriority="high">` WebP, seleção `/hero-mobile.mp4` vs `/hero.mp4`, respeito a `saveData`/`2g`, `preload="metadata"`, cleanup dos 4 listeners), `scripts/sync_to_r2.py` e referências em `api/lib/vite.ts` (`troca-facil-og`).**
- [ ] **Step 6: Rodar `pnpm test` e `pnpm check`.**

---

### Task 6: Code-Splitting (`App.tsx`), Polyfills (`vite.config.ts`), Preloads (`index.html`) e Guia Cloudflare (`docs/cloudflare-cache-setup.md`)

**Files:**
- Modify: `src/App.tsx`, `vite.config.ts`, `index.html`, `src/components/Header.tsx` (se usar `/images/logo-nav.webp` + width/height base se já couber sem sair do escopo)
- Delete: `src/components/HeroCarousel.tsx` (código morto sem importações)
- Create: `docs/cloudflare-cache-setup.md`

- [ ] **Step 1: Em `src/App.tsx`, converter `Produto`, `TradeIn` e `TvMode` para `React.lazy(...)` com `Suspense`, carregar `CartDrawer`, `WhatsAppModal` (`WelcomePopup`) e `CompareBar` sob demanda (apenas quando abertos/com itens), e exportar `prefetchProductRoute()` para uso em links/idle.**
- [ ] **Step 2: Em `vite.config.ts`, desativar `modernPolyfills: true` mantendo `renderLegacyChunks: true` (`nomodule` para iOS antigos) e configurar `modernTargets` explicitamente para browsers modernos + ajustar `manualChunks` (`vendor`, `router`, `query`, `icons`).**
- [ ] **Step 3: Em `index.html`, adicionar `<link rel="preload" as="image" href="/hero-poster.webp?v=ldc9" fetchPriority="high" />` e converter os `preconnect` externos secundários em `dns-prefetch` limpos.**
- [ ] **Step 4: Remover `src/components/HeroCarousel.tsx` (código morto confirmado) e criar `docs/cloudflare-cache-setup.md` com as 2 regras gratuitas do Cloudflare.**
- [ ] **Step 5: Executar `pnpm test`, `pnpm lint`, `pnpm check` e `pnpm build` e registrar comparação antes vs depois dos bundles e mídias.**
