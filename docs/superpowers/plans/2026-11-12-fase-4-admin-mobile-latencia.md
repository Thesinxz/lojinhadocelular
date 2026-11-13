# Fase 4 — Painel Admin Mobile & Latência Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar apertos de layout no celular (`360px–414px`), colisão de barras sticky com a navegação inferior fixa, bundles pesados ao abrir `/admin/produtos` e esperas de rede (~180 ms RTT) em toggles, filtros e abertura de detalhes do painel administrativo.

**Architecture:** As transformações imutáveis de cache React Query e a lógica pura de filtragem do catálogo ficam em `src/lib/adminOptimistic.ts` (sem DOM, testado em Vitest Node em `api/adminOptimistic.test.ts`). Prefetch idempotente de chunks fica em `src/lib/adminPrefetch.ts`. Componentes do painel (`AdminLayout`, `ProductsPage`, `EvaluationsPage`, `EvaluationListItem`, `EvaluationDetailPage`, `AdminSettings`, `UsersPage`, `AdminProductEditor`) aplicam layout mobile-first sem colisões, `React.lazy`, `staleTime` e updates otimistas com rollback.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, tRPC + React Query (`useUtils`), Vitest (Node), `lucide-react`.

---

### Task 1: Lógica pura otimista, filtragem do catálogo admin e testes (TDD)

**Files:**
- Create: `src/lib/adminOptimistic.ts`
- Create: `src/lib/adminPrefetch.ts`
- Create: `api/adminOptimistic.test.ts`

- [ ] **Step 1: Escrever testes unitários em `api/adminOptimistic.test.ts` (TDD RED)**

```ts
import { describe, expect, it } from "vitest";
import {
  ADMIN_PRODUCTS_BATCH_SIZE,
  applyOptimisticBulkProducts,
  applyOptimisticEvaluationClaim,
  applyOptimisticEvaluationDetailPatch,
  applyOptimisticProductToggle,
  filterAdminProducts,
  sliceAdminBatch,
} from "../src/lib/adminOptimistic";

const SAMPLE_ADMIN_PRODUCTS = [
  {
    id: 10,
    externalId: null,
    name: "iPhone 16 Pro Max",
    category: "iphone_lacrado",
    active: true,
    featured: true,
    variants: [{ sku: "B1610", storage: "256GB" }],
  },
  {
    id: "erp-1",
    externalId: "abc-99",
    name: "iPhone 13 Estelar",
    category: "iphone_seminovo",
    active: false,
    featured: false,
    variants: [{ sku: "ERP-ABC99", storage: "128GB" }],
  },
  {
    id: 12,
    externalId: null,
    name: "Redmi Note 14",
    category: "android",
    active: true,
    featured: false,
    variants: [{ sku: "XIA14", storage: "256GB" }],
  },
];

describe("adminOptimistic", () => {
  it("filtra catálogo admin sem acentos e calcula contadores corretos", () => {
    const res = filterAdminProducts(SAMPLE_ADMIN_PRODUCTS, {
      statusFilter: "todos",
      search: "256gb",
    });
    expect(res.counts).toEqual({
      all: 3,
      visible: 2,
      hidden: 1,
      featured: 1,
    });
    expect(res.filtered.map((p) => p.name)).toEqual([
      "iPhone 16 Pro Max",
      "Redmi Note 14",
    ]);

    const ocultos = filterAdminProducts(SAMPLE_ADMIN_PRODUCTS, {
      statusFilter: "ocultos",
      search: "estelar",
    });
    expect(ocultos.filtered.map((p) => p.id)).toEqual(["erp-1"]);
  });

  it("aplica update otimista em toggle unitário por id ou externalId sem mutar o original", () => {
    const next = applyOptimisticProductToggle(SAMPLE_ADMIN_PRODUCTS, "abc-99", {
      active: true,
      featured: true,
    });
    expect(next[1].active).toBe(true);
    expect(next[1].featured).toBe(true);
    expect(SAMPLE_ADMIN_PRODUCTS[1].active).toBe(false);

    const bulk = applyOptimisticBulkProducts(
      SAMPLE_ADMIN_PRODUCTS,
      ["10", "abc-99"],
      { featured: false },
    );
    expect(bulk[0].featured).toBe(false);
    expect(bulk[1].featured).toBe(false);
    expect(bulk[2].featured).toBe(false);
  });

  it("aplica claim otimista na lista de avaliações e patch no detalhe", () => {
    const pageData = {
      items: [
        { id: 5, assignedUserId: null, assignedUserName: null, status: "pendente" },
        { id: 6, assignedUserId: 2, assignedUserName: "Ana", status: "atendimento" },
      ],
      total: 2,
      hasMore: false,
    };
    const claimed = applyOptimisticEvaluationClaim(pageData, 5, {
      id: 9,
      name: "Marlon",
    });
    expect(claimed?.items[0].assignedUserId).toBe(9);
    expect(claimed?.items[0].assignedUserName).toBe("Marlon");
    expect(pageData.items[0].assignedUserId).toBeNull();

    const detail = {
      evaluation: {
        id: 5,
        status: "pendente",
        unit: "jardim",
        assignedUserId: null as number | null,
        assignedUserName: null as string | null,
      },
      notes: [],
    };
    const patched = applyOptimisticEvaluationDetailPatch(detail, {
      status: "concluido",
      unit: "gll",
    });
    expect(patched?.evaluation.status).toBe("concluido");
    expect(patched?.evaluation.unit).toBe("gll");
    expect(detail.evaluation.status).toBe("pendente");
  });

  it("fatia lotes de produtos admin de 24 itens", () => {
    expect(ADMIN_PRODUCTS_BATCH_SIZE).toBe(24);
    const rows = Array.from({ length: 60 }, (_, idx) => idx);
    expect(sliceAdminBatch(rows, 24)).toHaveLength(24);
    expect(sliceAdminBatch(rows, 48)).toHaveLength(48);
  });
});
```

- [ ] **Step 2: Confirmar falha TDD RED**

Run: `pnpm exec vitest run api/adminOptimistic.test.ts`
Expected: FAIL (`Cannot find module '../src/lib/adminOptimistic'`).

- [ ] **Step 3: Implementar `src/lib/adminOptimistic.ts` e `src/lib/adminPrefetch.ts`**

Implementar todas as funções puras tipadas de `adminOptimistic.ts` + helpers idempotentes em `adminPrefetch.ts`.

- [ ] **Step 4: Validar testes e TypeScript check (GREEN)**

Run: `pnpm exec vitest run api/adminOptimistic.test.ts && pnpm check`
Expected: PASS (4/4 testes, 0 erros TS).

- [ ] **Step 5: Commit da Task 1**

```bash
git add src/lib/adminOptimistic.ts src/lib/adminPrefetch.ts api/adminOptimistic.test.ts
git commit -m "feat(admin): adicionar helpers puros otimistas, prefetch e testes"
```

---

### Task 2: Topbar limpa no mobile + alertas na gaveta Mais + prefetch (`AdminLayout.tsx`)

**Files:**
- Modify: `src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: Atualizar header mobile e drawer Mais**

- Aplicar `hidden sm:flex` nos botões de **Avisos do navegador** e **Som** do `<header>` superior (liberando ~130 px extras para o título no mobile `360px` enquanto mantém acesso rápido 1-clique a partir de `sm:`); ajustar altura dos ícones do header para `h-10 w-10`;
- Dentro da gaveta **Mais** (`Sheet`), incluir seção de alertas com botões claros para ligar/desligar **Avisos do navegador** (quando suportado) e **Som de nova avaliação**;
- Adicionar prefetch de rota nos links do menu (`onMouseEnter` / `onFocus` / `onTouchStart`) via `prefetchAdminRoute(item.to)`.

- [ ] **Step 2: Validar check e lint**

Run: `pnpm check && pnpm lint`

- [ ] **Step 3: Commit da Task 2**

```bash
git add src/pages/admin/AdminLayout.tsx
git commit -m "feat(admin): limpar topbar mobile e mover controles de alerta para gaveta Mais"
```

---

### Task 3: `/admin/produtos` leve, responsivo e com updates otimistas (`ProductsPage.tsx`, `AdminProductEditor.tsx`)

**Files:**
- Modify: `src/pages/admin/ProductsPage.tsx`
- Modify: `src/components/admin/AdminProductEditor.tsx`

- [ ] **Step 1: Lazy-load dos editores, cache, busca limpa e updates otimistas**

- Converter `AdminProductEditor` e `AdminErpProductEditor` em `React.lazy` com `<Suspense>` fallback; acionar prefetch em hover/toque dos botões de criação/edição;
- Configurar `staleTime: 60_000` em `trpc.admin.products.useQuery` (em `ProductsPage.tsx` e `AdminProductEditor.tsx`);
- Aplicar `onMutate` + rollback + `onSettled` em `toggleActiveMutation`, `toggleFeaturedMutation` e `bulkMutation` usando `applyOptimisticProductToggle` / `applyOptimisticBulkProducts`;
- Substituir filtragem manual por `filterAdminProducts` + botão limpar `"X"` no campo de busca;
- Paginar lista visível com `ADMIN_PRODUCTS_BATCH_SIZE` (24 por lote) e botão `"Ver mais produtos"`;
- Ajustar cards para `flex-col sm:flex-row sm:items-center` e elevar barra sticky de lote para `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-3`.

- [ ] **Step 2: Validar check e lint**

Run: `pnpm check && pnpm lint`

- [ ] **Step 3: Commit da Task 3**

```bash
git add src/pages/admin/ProductsPage.tsx src/components/admin/AdminProductEditor.tsx
git commit -m "feat(admin): otimizar ProductsPage mobile com lazy editors, lotes e toggles otimistas"
```

---

### Task 4: Avaliações, Detalhe e Configurações sem colisão e com resposta instantânea

**Files:**
- Modify: `src/pages/admin/EvaluationsPage.tsx`
- Modify: `src/components/admin/evaluations/EvaluationListItem.tsx`
- Modify: `src/pages/admin/EvaluationDetailPage.tsx`
- Modify: `src/components/admin/AdminSettings.tsx`
- Modify: `src/pages/admin/UsersPage.tsx`

- [ ] **Step 1: Atualizar `EvaluationsPage.tsx`, `EvaluationListItem.tsx` e `EvaluationDetailPage.tsx`**

- `EvaluationsPage.tsx`: `flex-wrap` na faixa de resumo superior, barra sticky em `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-3` e update otimista no `claimMutation`;
- `EvaluationListItem.tsx`: prefetch da rota + query `admin.evaluationDetail` ao passar mouse/tocar/focar;
- `EvaluationDetailPage.tsx`: `staleTime: 15_000` no `detailQuery` e updates otimistas de `setStatus` e `setUnit` via `applyOptimisticEvaluationDetailPatch`.

- [ ] **Step 2: Atualizar `AdminSettings.tsx` e `UsersPage.tsx`**

- `AdminSettings.tsx`: `staleTime: 60_000` em `getSettings` e barra sticky de salvar em `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-3`;
- `UsersPage.tsx`: `staleTime: 60_000` em `users.list`.

- [ ] **Step 3: Validar check e lint**

Run: `pnpm check && pnpm lint`

- [ ] **Step 4: Commit da Task 4**

```bash
git add src/pages/admin/EvaluationsPage.tsx src/components/admin/evaluations/EvaluationListItem.tsx src/pages/admin/EvaluationDetailPage.tsx src/components/admin/AdminSettings.tsx src/pages/admin/UsersPage.tsx
git commit -m "feat(admin): otimizar avaliacoes, detalhes e barras sticky no mobile"
```

---

### Task 5: Verificação final completa

- [ ] **Step 1: Executar pipeline completa após todas as edições**

Run: `pnpm test && pnpm check && pnpm lint && pnpm build && git status --short`
Expected: 100% pass, 0 erros TS/ESLint, build limpo com redução verificada do chunk `ProductsPage`.
