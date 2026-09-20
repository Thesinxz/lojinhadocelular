# Fix GSC Soft 404 & Canonical Tag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Google Search Console "Erro soft 404" and "Página alternativa com tag canônica adequada" by enforcing true HTTP 404 status codes, injecting static `<link rel="canonical">` tags, cleaning sitemap.xml, and issuing 301 redirects for aliases.

**Architecture:** 
- In Hono backend (`api/lib/vite.ts`, `api/boot.ts`), render HTTP 404 with `<meta name="robots" content="noindex, nofollow" />` for missing products and unrecognized routes, inject exact `<link rel="canonical">` in SSR/prerender HTML, issue 301 redirects for legacy/alias routes (`/catalogo`, `/termos`), and sanitize `sitemap.xml`.
- In React frontend (`src/components/SEO.tsx`, `src/pages/Produto.tsx`, `src/pages/NotFound.tsx`, `src/App.tsx`, `index.html`), provide a dedicated 404 page, sanitize canonical URLs against fragments (`#`) and query params, and set `noindex` on error states.

**Tech Stack:** Hono, TypeScript, React 19, React Router, Vitest.

---

### Task 1: Canonical Link Injection & HTTP 404 for Missing Products in Server (`api/lib/vite.ts`)

**Files:**
- Modify: `api/lib/vite.ts`
- Test: `api/seo.test.ts`

- [ ] **Step 1: Write the failing tests in `api/seo.test.ts`**
  - Test that `replaceOrInjectMeta` injects `<link rel="canonical" href="..." />`.
  - Test that accessing `/produto/id-inexistente` returns HTTP 404 status with `noindex` and does not return 200.
  - Test that accessing an unknown route like `/pagina-inexistente-123` returns HTTP 404.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Update `api/lib/vite.ts`**
  - In `replaceOrInjectMeta`, strip existing `<link rel="canonical">` and inject `<link rel="canonical" href="${safeUrl}" />`.
  - In `renderEnrichedHtml`, check if path is `/produto/:id`. If `foundProduct` is null, set HTTP status to 404, title to "Produto não encontrado — Lojinha do Celular", and inject `<meta name="robots" content="noindex, nofollow" />`.
  - Recognize valid SPA routes (`/`, `/avaliacao`, `/troca`, `/privacidade`, `/termos`, `/admin`, `/tv`, `/produto/:id`). If a request does not match any valid route, return HTTP 404 with `noindex`.
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**
  - `git commit -m "fix(seo): inject canonical tag and return 404 for missing products and unknown routes"`

---

### Task 2: HTTP 301 Redirects & `sitemap.xml` Hygiene (`api/boot.ts`)

**Files:**
- Modify: `api/boot.ts`
- Test: `api/seo.test.ts`

- [ ] **Step 1: Write failing tests in `api/seo.test.ts`**
  - Test that GET `/catalogo` returns HTTP 301 redirect to `/#vitrine` (or `/`).
  - Test that GET `/termos`, `/lgpd`, `/cookies` return HTTP 301 redirect to `/privacidade`.
  - Test that `/sitemap.xml` does NOT contain `/catalogo` and does NOT contain `/termos`.
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Update `api/boot.ts`**
  - Add 301 redirects in Hono:
    - `/catalogo` -> `301` to `/#vitrine`
    - `/termos`, `/termos-e-privacidade`, `/lgpd`, `/cookies` -> `301` to `/privacidade`
    - `/troca` -> `301` to `/avaliacao`
  - In `/sitemap.xml`, remove `/catalogo` and `/termos` from `staticPaths`, keeping only canonical 200 pages (`/`, `/avaliacao`, `/privacidade`) and active products.
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**
  - `git commit -m "fix(seo): clean sitemap.xml and add 301 redirects for aliases"`

---

### Task 3: Client-side Canonical Sanitization, Dedicated 404 Page & Noindex (`src/`)

**Files:**
- Modify: `src/components/SEO.tsx`
- Modify: `src/pages/Produto.tsx`
- Create: `src/pages/NotFound.tsx`
- Modify: `src/App.tsx`
- Modify: `index.html`

- [ ] **Step 1: Update `src/components/SEO.tsx`**
  - Support `noindex?: boolean`. If true, set `<meta name="robots" content="noindex, nofollow" />`.
  - Strip fragments (`#...`) from canonical URL calculation (`href.split("#")[0].split("?")[0]`).
- [ ] **Step 2: Create `src/pages/NotFound.tsx`**
  - Render an elegant 404 page with "Página não encontrada", button to return to vitrine (`/#vitrine`), and `<SEO title="Página não encontrada (404)" noindex={true} />`.
- [ ] **Step 3: Update `src/App.tsx`**
  - Replace `<Route path="*" element={<Home />} />` with `<Route path="*" element={<NotFound />} />`.
- [ ] **Step 4: Update `src/pages/Produto.tsx`**
  - When product is not found or ID is invalid, render `<SEO title="Produto não encontrado (404)" noindex={true} />`.
- [ ] **Step 5: Update `index.html`**
  - Add `<link rel="canonical" href="https://lojinhadocelular.com/" />` to default head.
- [ ] **Step 6: Run full verification (`pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build`)**
- [ ] **Step 7: Commit**
  - `git commit -m "feat(seo): add NotFound 404 page, sanitize client canonical URLs, and support noindex"`
