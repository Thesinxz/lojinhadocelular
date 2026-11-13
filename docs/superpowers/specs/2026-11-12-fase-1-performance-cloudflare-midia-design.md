# Design Doc — Fase 1: Performance de Rede (180 ms EUA→BR), Cache no Cloudflare, Mídia e Bundle

**Data:** 2026-11-12  
**Contexto:** Servidor Node/Hono hospedado nos EUA (~180 ms de RTT até clientes no Brasil), com Cloudflare Proxy (plano Free, sem regras customizadas ou R2 ativos no momento).  
**Abordagem escolhida:** Código otimizado auto-suficiente no deploy + cabeçalhos e rotas compatíveis com a borda do Cloudflare Free no Brasil (sem cachear HTML público na borda para evitar vazamento entre `lojinhadocelular.com` e `trocafacil` ou preços defasados).

---

## 1. Arquitetura de Rede, Servidor e Hidratação (Cortando RTTs nos EUA)

### 1.1 Template HTML em RAM & Fim do `no-store` público (`bfcache`)
- **Problema atual:** `api/lib/vite.ts` lê `index.html` do disco via `fs.readFileSync` em toda requisição e responde com `Cache-Control: no-cache, no-store, must-revalidate` + `Pragma: no-cache` + `Expires: 0` para visitantes humanos. O `no-store` impede que Chrome e Safari mobile usem o *Back-Forward Cache* (`bfcache`), forçando novo download quando o cliente aperta "Voltar" de um produto para a vitrine.
- **Solução:**
  - Cachear o conteúdo lido de `dist/public/index.html` em memória em produção (em dev/Vite segue lendo do disco para manter HMR).
  - Para rotas públicas (`/`, `/produto/:id`, `/avaliacao`, `/comparar`, `/privacidade`), retornar `Cache-Control: public, no-cache, must-revalidate` (sem `no-store`, `Pragma: no-cache` ou `Expires`).
  - Para `/admin` e `/admin/*`, preservar estritamente `Cache-Control: no-store, no-cache, must-revalidate`.

### 1.2 Hidratação Inicial no HTML (0 RTT extra de API no 1º acesso)
- **Warm-up em background:** Na inicialização de `api/boot.ts` (fora de ambiente de teste), disparar pré-aquecimento assíncrono não-bloqueante do catálogo ERP (`getErpCatalog()`).
- **Injeção segura (`window.__INITIAL_DATA__` / `<script id="__INITIAL_DATA__" type="application/json">`):**
  - Nunca injetar em `/admin*` ou em resposta que contenha credenciais/dados privados.
  - Serializar payload JSON (ou compatível com `superjson`) com escape obrigatório de `<`, `>`, `&`, `\u2028`, `\u2029` para prevenir XSS em conteúdo vindo do ERP/settings.
  - Em `/` (apenas domínio principal da loja, nunca modo `trocafacil`): incluir `settings` + `catalogStatus` + `products` **somente se** o catálogo ERP já estiver quente em RAM no servidor (`0 ms`, nunca bloqueia o HTML se o ERP estiver lento).
  - Em `/produto/:id`: aproveitar o catálogo/produto já resolvido pelo fluxo existente de OpenGraph/meta em `api/lib/vite.ts` e incluir `settings` + `product` (e `products` se disponível em cache).
  - Em `/avaliacao` (ou modo `trocafacil`): incluir apenas `settings`.
- **Consumo no cliente (`src/providers/trpc.tsx`):**
  - Ao montar o `QueryClient`, ler `<script id="__INITIAL_DATA__">` com `try/catch` defensivo e semear imediatamente o cache usando `getQueryKey` oficial do `@trpc/react-query` (`shop.settings`, `shop.products`, `shop.catalogStatus`, `shop.product`), definindo `initialDataUpdatedAt` coerente para respeitar o `staleTime`.

### 1.3 I/O Assíncrono, `ETag`/304 e Headers de Borda (`api/boot.ts` e `api/shop.ts`)
- **Arquivos estáticos em `api/boot.ts`:**
  - Substituir `fs.existsSync` + `fs.readFileSync` síncronos nas rotas `/hero-poster.*`, `/images/:file`, `/images/iphones/:file` e `/nfc/*` por leitura assíncrona (`fs.promises.readFile`) com cache leve de metadados em memória (`mtimeMs`, `size`, `etag`).
  - Responder `304 Not Modified` quando o cabeçalho `If-None-Match` coincidir com o `ETag`.
  - Preservar `Cross-Origin-Resource-Policy: cross-origin` e `Access-Control-Allow-Origin: *` em `/images/*` (compatibilidade com WhatsApp/OG crawlers e testes em `api/seo.test.ts` e `api/security.test.ts`).
  - Configurar explicitamente para `/fonts/*`: `Cache-Control: public, max-age=31536000, immutable` (e `Vary: Accept-Encoding`).
  - Configurar para `/hero.mp4`, `/hero-mobile.mp4`, `/hero-poster.*`: `Cache-Control: public, max-age=2592000` + `ETag`, preservando suporte a HTTP `Range 206`.
- **Queries públicas tRPC em `api/shop.ts` e `src/providers/trpc.tsx`:**
  - Em `api/shop.ts`, padronizar `Cache-Control` via header nas respostas públicas (queries GET):
    - `shop.products`, `shop.product`, `shop.featured`, `shop.catalogStatus`: `public, max-age=30, s-maxage=120, stale-while-revalidate=300`
    - `shop.settings`, `shop.socialProof`, `shop.tradeInOptions`: `public, max-age=120, s-maxage=300, stale-while-revalidate=600`
  - Em `src/providers/trpc.tsx`, rotear com `splitLink` para que queries públicas (`type === "query"` e path iniciando em `shop.`) usem `httpBatchLink` (ou `httpLink` para queries críticas cacheadas) exclusivamente com GET e separadas de mutações (`trackView`, `trackInterest`, `submitEvaluation`), maximizando a taxa de acerto (*cache hit*) no PoP brasileiro do Cloudflare quando a Cache Rule estiver ativa.

---

## 2. Pipeline de Mídia (Hero Vídeo, Pôster LCP, Imagens Responsivas & R2)

### 2.1 Hero LCP & Vídeo Adaptativo (`src/components/HeroBlk.tsx`, `index.html`, `public/`)
- **Pôster LCP real:**
  - Gerar `public/hero-poster.webp` otimizado (meta `< 60 KB`) e recomprimir `public/hero-poster.jpg` (`< 120 KB`) como fallback.
  - Precarregar `/hero-poster.webp?v=ldc9` no `<head>` de `index.html` com `<link rel="preload" as="image" href="/hero-poster.webp?v=ldc9" fetchPriority="high" />`.
  - Trocar a camada CSS `backgroundImage` em `HeroBlk.tsx` por um `<img src="/hero-poster.webp?v=ldc9" fetchPriority="high" decoding="async" ...>` real dentro do container do hero.
- **Vídeo leve para celular:**
  - Re-encodar `public/hero-mobile.mp4` (atualmente `14 MB`, 3045 kbps, idêntico ao desktop) para versão mobile H.264/AVC otimizada com *faststart* (meta `<= 2.5–3.5 MB`), sem faixa de áudio.
  - Em `HeroBlk.tsx`, selecionar `/hero-mobile.mp4?v=ldc9` em viewports `< 768px` (`matchMedia`) e `/hero.mp4?v=ldc9` no desktop, mudando `preload` inicial para `metadata`.
  - Se `navigator.connection?.saveData === true` ou `effectiveType` for `2g`/`slow-2g`, manter apenas o pôster sem baixar o `.mp4` automaticamente (exibindo botão discreto de play se aplicável, ou respeitando o play ao toque).
  - Remover os 4 event listeners globais (`touchstart`, `touchend`, `scroll`, `click` em `window`) imediatamente assim que o evento `playing` ocorrer ou na desmontagem do componente.

### 2.2 Imagens Locais Responsivas (`-360w.webp`), `wsrv.nl` e Ativos Pesados
- **Miniaturas `-360w.webp`:**
  - Atualizar `scripts/optimize_iphone_images.py` para gerar variantes `<arquivo>-360w.webp` (360px de largura, mantendo proporção e canal alpha) para todos os `.webp` em `public/images/iphones/` e opcionalmente converter em `.webp` local as imagens externas Apple CDN listadas em `src/lib/iphoneCatalog.ts` (SE 2ª/3ª, MagSafe, AirPods) caso acessíveis ou mantendo mapeamento limpo.
  - Em `src/lib/shop.ts`, atualizar `optimizeImageUrl(url, width)` e `getImageSrcSet(url)`:
    - Quando a URL apontar para `/images/iphones/<nome>.webp` (local ou sob `VITE_CLOUDFLARE_R2_URL`), retornar `-360w.webp` para `width <= 400` e emitir `srcSet` real (`"<base>-360w.webp 360w, <base>.webp 612w"`).
    - Para URLs externas vindas do ERP, manter `wsrv.nl` apenas como otimizador de terceiros (e suportar fallback para a URL original no `onError` dos componentes consumidores nas próximas etapas/ajuste leve agora onde necessário).
- **Compactação de ativos de marca e OG:**
  - Otimizar `public/images/troca-facil-og.png` (`1.8 MB` → versão otimizada `< 250 KB`, preferencialmente gerando também `troca-facil-og.jpg` `1200x630` para WhatsApp/OG em `api/lib/vite.ts` mantendo `/images/troca-facil-og.png` compacto).
  - Otimizar `public/images/og-banner.png` (`318 KB`), `public/images/og-preview.png` (`318 KB`) e redimensionar/comprimir `public/images/logo.png` (`1702x1542`, `100 KB` → tamanho apropriado para uso web mantendo fallback `/images/logo.png`, além de gerar `public/images/logo-nav.webp` ultraleve para Header/Footer).
  - **Regra de preservação:** Manter todos os `public/images/iphone-*.jpg` (usados por `api/lib/vite.ts` / commit `363b41a` para OpenGraph de WhatsApp).
  - Atualizar `scripts/sync_to_r2.py` para enviar também `*-360w.webp`, `hero-poster.*` e `hero*.mp4` quando R2 for configurado.

---

## 3. Bundle JS/CSS, Code-Splitting, Polyfills & Fontes

- **Code-splitting em `src/App.tsx`:**
  - Mover `Produto`, `TradeIn` e `TvMode` para `React.lazy(...)` dentro de `<Suspense>`.
  - Carregar `CartDrawer`, `WhatsAppModal`/`WelcomePopup` e `CompareBar` sob demanda (apenas quando abertos ou houver itens na sacola/comparador), retirando peso do chunk principal da Home.
  - Adicionar *prefetch* discreto de rota para `Produto` ao focar/tocar links de produto ou em `requestIdleCallback` (respeitando `saveData`).
  - Remover `src/components/HeroCarousel.tsx` (código morto sem importações em todo o repositório).
- **Enxugamento de Polyfills em `vite.config.ts`:**
  - Ajustar `@vitejs/plugin-legacy`: manter `renderLegacyChunks: true` (`nomodule` para Safari/iOS antigos caso necessário) mas remover `modernPolyfills: true` e configurar `modernTargets` explicitamente para browsers modernos (eliminando `polyfills-*.js` de ~134 KB para a grande maioria dos aparelhos atuais).
  - Organizar `manualChunks` separando bibliotecas pesadas (`vendor`, `router`, `query`, `icons`).
- **Preloads e `<head>` em `index.html`:**
  - Adicionar `<link rel="preload" as="image" href="/hero-poster.webp?v=ldc9" fetchPriority="high" />`.
  - Manter apenas os preloads das 2 fontes principais (`inter-latin.woff2` e `space-grotesk-latin.woff2`).
  - Trocar `preconnect` de terceiros secundários (`wsrv.nl`, `i.ibb.co`, `store.storeimages.cdn-apple.com`, `images.unsplash.com`) por `dns-prefetch` limpo, evitando contenção de conexões no boot mobile.

---

## 4. Documentação do Cloudflare Free & Critérios de Aceitação

- Criar guia curto e direto em `docs/cloudflare-cache-setup.md` com as 2 configurações gratuitas recomendadas no painel do Cloudflare (Cache Rule para `GET /api/trpc/shop.*` com *Use cache-control header if present* + Bypass para `/admin*` e `POST`; e toggles gratuitos: Brotli, HTTP/3, 0-RTT, Early Hints).
- **Critérios de verificação da Fase 1:**
  - `pnpm test` verde cobrindo: hidratação `__INITIAL_DATA__` sem XSS e ausente em `/admin`, headers `Cache-Control`/`s-maxage` nas queries `shop.*`, ausência de `no-store` no HTML público e presença em `/admin`, `ETag`/`304 Not Modified` em imagens estáticas preservando CORS/CORP, e geração de `srcSet` `-360w.webp` em `src/lib/shop.ts`.
  - `pnpm lint`, `pnpm check` e `pnpm build` sem erros.
  - Comparativo mensurado dos tamanhos antes vs depois em `public/` e `dist/public/assets/`.
