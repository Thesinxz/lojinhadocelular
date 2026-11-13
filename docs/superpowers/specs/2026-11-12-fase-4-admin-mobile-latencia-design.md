# Fase 4 — Painel Admin Mobile & Latência Design Spec

**Data:** 2026-11-12
**Objetivo:** Eliminar apertos de layout no celular (`360px–414px`), colisão de barras fixas, bundles pesados na abertura de `/admin/produtos` e esperas de rede (~180 ms RTT EUA–MS) em toggles/navegação nas telas operacionais e administrativas de `/admin/*`.

---

## 1. Diagnóstico e Escolhas Aprovadas (Opções A)

Na auditoria de `src/pages/admin/AdminLayout.tsx`, `ProductsPage.tsx`, `EvaluationsPage.tsx`, `EvaluationDetailPage.tsx`, `UsersPage.tsx`, `DashboardPage.tsx`, `AdminProductEditor.tsx` e `AdminSettings.tsx`:

1. **Topo mobile espremido (`AdminLayout.tsx`):** em telas de 360 px, título + Busca + Sininho + Som + Seletor de unidade dividem `h-14`, sobrando ~40 px para o título da página.
2. **Barras sticky colidindo com menu fixo inferior:** `ProductsPage` (`sticky bottom-3`), `EvaluationsPage` (`sticky bottom-3`) e `AdminSettings` (`sticky bottom-0`) encostam/entram atrás da barra inferior mobile (`fixed inset-x-0 bottom-0`).
3. **Cards apertados e bundle pesado em `ProductsPage.tsx`:**
   - A linha do produto coloca checkbox + imagem + 3 botões horizontais (`Editar Vitrine`, `ERP`, `Vitrine ↗`) na mesma fileira do título em telas `< sm`, espremendo o nome do aparelho;
   - `AdminProductEditor` (~70 KB) e `AdminErpProductEditor` (~22 KB) são importados estaticamente mesmo quando o operador só quer visualizar/alternar status;
   - `trpc.admin.products.useQuery` não define `staleTime` (refetch repetido ao trocar de aba) e toda a lista renderiza de uma vez sem lotes;
   - Toggles rápidos (`Visível`, `Em Promoção`, lote) esperam o roundtrip completo sem resposta otimista.
4. **Latência em Avaliações e Configurações:** falta prefetch de rota + detalhe ao tocar/passar o cursor em `EvaluationListItem`, `detailQuery` sem `staleTime`, mudanças rápidas (`claim`, `setStatus`, `setUnit`) sem cache otimista, cabeçalho de `EvaluationsPage` sem `flex-wrap`, e ausência de `staleTime` em `AdminSettings` / `UsersPage` / `AdminProductEditor`.

Decisões confirmadas pelo usuário:
- **Escopo (Opção A):** pacote completo de responsividade + resposta instantânea across `/admin`.
- **Topbar mobile (Opção A):** manter `Título + Buscar + Unidade` no topo mobile (`sm:`/`lg:` preservam `Avisos` e `Som` no cabeçalho), movendo os controles de **Avisos do navegador** e **Som** no mobile para dentro da gaveta **Mais** (`Sheet`).

---

## 2. Arquitetura e Módulos

### 2.1 Lógica pura otimista & filtragem (`src/lib/adminOptimistic.ts` + `api/adminOptimistic.test.ts`)

Módulo puro TypeScript sem globais de DOM (testável sob Vitest Node em `tsconfig.server.json`):

- **`ADMIN_PRODUCTS_BATCH_SIZE = 24`** + `sliceAdminBatch(items, visibleCount)`.
- **`filterAdminProducts(products, { issueIds, statusFilter, search })`:** retorna `filtered`, `counts: { all, visible, hidden, featured }` com busca sem acentos (`NFD`) em nome, categoria, SKU e capacidade.
- **`applyOptimisticProductToggle(products, targetId, patch)`** e **`applyOptimisticBulkProducts(products, targetIds, patch)`:** aplicam atualização imediata de `active` / `featured` combinando por `id` ou `externalId` sem mutar o array em cache.
- **`applyOptimisticEvaluationClaim(pageData, id, currentUser)`:** marca avaliação na lista paginada como atribuída ao usuário imediatamente no clique de `"Pegar"`.
- **`applyOptimisticEvaluationDetailPatch(detail, patch)`:** aplica atualização otimista de `status` / `unit` diretamente em `evaluationDetail`.

### 2.2 Prefetch client-side (`src/lib/adminPrefetch.ts`)

- Prefetch idempotente dos chunks lazy mais acessados (`EvaluationDetailPage`, `AdminProductEditor`, `AdminErpProductEditor`, `EvaluationsPage`, `ProductsPage`) ao focar/tocar/passar o mouse nos gatilhos do admin.

### 2.3 Topo Mobile & Gaveta `Mais` (`src/pages/admin/AdminLayout.tsx`)

- No topo (`<header>`): botões de `Avisos do navegador` e `Som` ficam visíveis a partir de `sm:` (`hidden sm:flex`), mantendo `Buscar (h-10 w-10)` + `UnitSelect` + título largo legível no mobile (`360px+`).
- Na gaveta `Mais` (`Sheet`, `< lg`): exibe seção rápida de alertas com toggles de **Avisos do navegador** e **Som de nova avaliação** com mesmo estado e feedback toast.
- Nos itens do menu e barra inferior mobile (`bottomItems`), dispara prefetch do módulo da rota em `onTouchStart` / `onMouseEnter`.

### 2.4 Produtos Admin (`src/pages/admin/ProductsPage.tsx`)

- `AdminProductEditor` e `AdminErpProductEditor` convertidos para `React.lazy` com `<Suspense fallback={...} />` e prefetch no hover/toque de edição/criação.
- `trpc.admin.products.useQuery(undefined, { retry: 1, staleTime: 60_000 })` (igual em `AdminProductEditor.tsx`).
- Updates otimistas completos (`onMutate` + `cancel()` + rollback em `onError` + `invalidate` em `onSettled`) para `toggleActiveMutation`, `toggleFeaturedMutation` e `bulkMutation`.
- Layout responsivo do item: `flex-col sm:flex-row sm:items-center`, colocando a fila de ações (`Editar Vitrine`, `ERP`, `Vitrine ↗`, `Editar`, `Excluir`) com folga e altura mínima confortável (`min-h-10`) abaixo do cabeçalho no `< sm:`.
- Botão limpar (`X`) na busca de produtos, renderização em lotes de **24** (`Ver mais produtos`) resetada ao trocar filtro/busca, e barra sticky em `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-3`.

### 2.5 Avaliações & Detalhe (`EvaluationsPage.tsx`, `EvaluationListItem.tsx`, `EvaluationDetailPage.tsx`)

- `EvaluationsPage.tsx`: `flex-wrap` no cabeçalho superior para nunca estourar 360 px; `claimMutation` com update otimista em `evaluationsPage`; barra sticky em `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-3`.
- `EvaluationListItem.tsx`: ao passar o mouse/focar/tocar no link, executa `prefetchEvaluationDetailRoute()` + `utils.admin.evaluationDetail.prefetch({ id: item.id }, { staleTime: 15_000 })`.
- `EvaluationDetailPage.tsx`: `detailQuery` com `staleTime: 15_000`; `setStatus`, `setUnit`, `claim` e `assign` com updates otimistas imediatos em `evaluationDetail` + rollback no `onError`.

### 2.6 Configurações & Demais Telas (`AdminSettings.tsx`, `UsersPage.tsx`)

- `AdminSettings.tsx`: `staleTime: 60_000` em `admin.getSettings`; barra sticky de salvar elevada para `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-3`.
- `UsersPage.tsx`: `staleTime: 60_000` em `admin.users.list` (alinhando com os demais consumers de `users.list`).

---

## 3. Verificação e Não-Escopo

- **Testes automatizados (Vitest Node):** `api/adminOptimistic.test.ts` cobrindo filtragem/contadores sem acento, updates otimistas de produto (`active`, `featured`, lote, match por `externalId`), claim otimista na lista de avaliações, patch de detalhe e lotes de 24 itens.
- **Validação final da fase:** `pnpm test && pnpm check && pnpm lint && pnpm build` com verificação dos chunks gerados (redução do chunk inicial `ProductsPage`).
- **Fora de escopo:** alterações no backend ERP/tRPC (`api/adminRouter.ts`, `api/erp/`), TV Mode (`/tv`), ou páginas públicas (já finalizadas nas Fases 1–3).
