# Painel Admin v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Painel admin multiusuário (dono/vendedor), com navegação responsiva, avaliações com fluxo de atendimento e dashboard.

**Architecture:** Evolução incremental do painel atual. Backend Hono + tRPC (`api/admin.ts`) ganha sessão por usuário, permissões puras testáveis e stores com fallback em memória para testes. Frontend ganha `AdminApp` com rotas `/admin/*` em `src/pages/admin/`, reaproveitando os editores atuais.

**Tech Stack:** React 19, React Router 7, tRPC 11, TanStack Query, Tailwind 3 + shadcn/ui, Hono, Drizzle + mysql2, Vitest, zod 4, sonner, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-04-painel-admin-v2-design.md` (fonte da verdade para regras, campos e textos).

## Global Constraints

- pnpm 9.15.9; não adicionar dependências novas (tudo necessário já está instalado).
- TypeScript, 2 espaços, aliases `@/`, `@contracts`, `@db`.
- Textos de UI em português do Brasil.
- Valores monetários sempre em **centavos (int)** no banco/API.
- Migrações via `ensureTables()`/`ensureColumnExists()` em `api/queries/connection.ts` **e** espelho em `db/schema.ts`.
- Stores novos: em memória quando `process.env.NODE_ENV === "test"` ou sem `DATABASE_URL`.
- Toda checagem de permissão no servidor; UI apenas esconde.
- Falha ao gravar `audit_logs` nunca quebra a ação.
- Ao final de cada task: `pnpm test`, `pnpm check`, `pnpm lint` (0 erros) verdes; commit Conventional Commit em PT-BR (ex. `feat(admin): ...`).
- Não editar `dist/`.

---

## ETAPA 1 — Usuários, níveis e histórico

### Task 1: Permissões compartilhadas (puro)

**Files:**
- Create: `contracts/permissions.ts`, `api/permissions.ts`
- Test: `api/permissions.test.ts`

**Interfaces (Produces):**
```ts
// contracts/permissions.ts
export type AdminRole = "dono" | "vendedor";
export type StoreUnit = "jardim" | "gll";
export const STORE_UNITS: { value: StoreUnit; label: string }[]; // Jardim, Guia Lopes da Laguna
export interface SessionUser { id: number; username: string; name: string; role: AdminRole; unit: StoreUnit | null; canEditPrices: boolean; }
export type Capability = "evaluations.manage" | "products.editMedia" | "products.editPrice" | "products.manage" | "settings.manage" | "users.manage" | "reports.team";
export function can(user: SessionUser | null | undefined, cap: Capability): boolean;
// api/permissions.ts
export function assertCan(user: SessionUser, cap: Capability): void; // TRPCError FORBIDDEN "Sem permissão para esta ação"
export function checkProductUpdate(user: SessionUser, before: ProductLike | null, after: ProductLike | null): string | null;
export function checkErpOverrideUpdate(user: SessionUser, changedKeys: string[]): string | null;
// ProductLike = { name, brand, category, condition, warranty?, description?, featured, active, imageUrl?, videoUrl?, variants: VariantLike[] }
// VariantLike = { id?, version?, storage, color, colorHex?, sku?, warranty?, condition?, priceCash, imageUrl?, videoUrl?, batteryHealth?, notes?, quantity?, available }
```
Regras exatas: spec §2.3. Normalizar `undefined`/`null`/`""` como iguais ao comparar. Variante casada por `id`; se `after` tem variante sem `id` ou faltam ids → mudança estrutural (`products.manage`).

- [ ] Escrever testes: dono pode tudo; vendedor `evaluations.manage` e `products.editMedia` sim, `products.editPrice` só com `canEditPrices`, `products.manage`/`settings.manage`/`users.manage`/`reports.team` não; `can(null, …)` false. `checkProductUpdate`: vendedor troca `imageUrl` da variante → null; troca `priceCash` sem flag → mensagem; com flag → null; troca `name` → mensagem; adiciona variante → mensagem; `before=null` (criar) → mensagem; `after=null` (excluir) → mensagem; dono tudo null. `checkErpOverrideUpdate(vendedor, ["imageUrl","batteryHealth"])` null; `["featured"]` mensagem.
- [ ] Rodar `pnpm exec vitest run api/permissions.test.ts` → falha.
- [ ] Implementar.
- [ ] Rodar → passa. Commit `feat(admin): adiciona modelo de permissoes dono/vendedor`.

### Task 2: Store de usuários, token v2, bootstrap e histórico

**Files:**
- Modify: `db/schema.ts` (tabelas `adminUsers`, `auditLogs`), `api/queries/connection.ts` (CREATE TABLE), `api/auth.ts`
- Create: `api/services/userStore.ts`, `api/services/auditLog.ts`
- Test: `api/users.test.ts`, `api/auditLog.test.ts`, ajustar `api/auth.test.ts`

**Interfaces (Produces):**
```ts
// userStore.ts
export interface AdminUserRecord extends SessionUser { passwordHash: string; active: boolean; lastLoginAt: Date | null; createdAt: Date; }
export async function listUsers(): Promise<AdminUserRecord[]>;
export async function getUserById(id: number): Promise<AdminUserRecord | null>;
export async function getUserByUsername(username: string): Promise<AdminUserRecord | null>;
export async function createUser(input: { username; name; password; role; unit; canEditPrices }): Promise<AdminUserRecord>; // erro se username existe/ inválido
export async function updateUser(actor: SessionUser, id: number, patch: { name?; role?; unit?; canEditPrices?; active? }): Promise<AdminUserRecord>; // regras ≥1 dono ativo, não auto-desativar/rebaixar
export async function setUserPassword(id: number, password: string): Promise<void>;
export async function touchLastLogin(id: number): Promise<void>;
export async function ensureBootstrapOwner(): Promise<void>; // spec §2.2
export function toSessionUser(r: AdminUserRecord): SessionUser;
export function resetUserStoreForTesting(): void;
// auth.ts (novo/alterado)
export function createToken(userId: number, ttlMs?: number): string; // payload v2.<id>.<exp>
export function verifyToken(token: string): { userId: number } | null;
export async function authenticate(username: string, password: string): Promise<AdminUserRecord | null>; // chama ensureBootstrapOwner; rejeita inativo
export async function getSessionUser(req: Request): Promise<SessionUser | null>;
export function checkLoginRateLimit(key: string): boolean; export function resetLoginRateLimitForTesting(): void;
// auditLog.ts
export interface AuditEntry { id: number; userId: number | null; userName: string; action: string; entityType: string; entityId: string | null; summary: string; createdAt: Date; }
export async function logAction(user: Pick<SessionUser,"id"|"name"> | null, e: { action: string; entityType: string; entityId?: string | number | null; summary: string }): Promise<void>;
export async function listAudit(opts: { limit?: number; entityType?: string; entityId?: string }): Promise<AuditEntry[]>;
export function summarizeProductChanges(before: ProductLike | null, after: ProductLike): string; // ex: "Preço 15 Pro 128GB Preto: R$ 3.200,00 → R$ 3.000,00; foto alterada"
export function resetAuditLogForTesting(): void;
```
Manter `hashPassword`, `verifyPasswordHash`, `secret`, `tokenFromRequest`. `checkPassword` pode ser removida se não houver mais usos (atualizar testes).

- [ ] Testes `users.test.ts`: bootstrap cria `dono` usando `admin_password` em hash scrypt salvo via `saveSingleSetting`, e também com valor em texto; `authenticate` certo/errado/inativo; `createToken`→`verifyToken` ok; token adulterado null; expirado null (`ttlMs=-1`); token legado `admin.<exp>.<sig>` null; `updateUser` impede remover o último dono ativo e auto-desativação; username duplicado rejeitado; rate limit bloqueia na 11ª tentativa.
- [ ] Testes `auditLog.test.ts`: `logAction`+`listAudit` ordem desc, filtro por `entityType/entityId`; `summarizeProductChanges` descreve mudança de preço com `R$`.
- [ ] Atualizar `auth.test.ts` para nova API (remover/adaptar o teste de `checkPassword`).
- [ ] Rodar → falha; implementar; rodar → passa. Commit `feat(admin): usuarios individuais, token por usuario e historico de acoes`.

### Task 3: Aplicar sessão/permissões/histórico em `api/admin.ts` + endpoints de usuários

**Files:**
- Modify: `api/admin.ts`, `api/middleware.ts` (opcional: `adminProcedure` que injeta `ctx.user`)
- Create: `api/adminUsers.ts` (sub-router `users`) se `admin.ts` ficar grande
- Test: `api/adminRouter.test.ts` (usando `appRouter.createCaller({ req, resHeaders })`)

Mudanças:
- `adminProcedure = publicQuery.use(async ({ ctx, next }) => { const user = await getSessionUser(ctx.req); if (!user) throw UNAUTHORIZED; return next({ ctx: { ...ctx, user } }); })`. Substituir todos `requireAdmin(ctx.req)`.
- `login({ username, password })` → `{ token, user }` + rate limit (chave `ip|username`) + `logAction(auth.login)` + `touchLastLogin`.
- `me` → `SessionUser`. `changeOwnPassword({ currentPassword, newPassword })`.
- Remover `changePassword` antigo (ou fazer delegar ao usuário atual).
- `upsertProduct`/`deleteProduct`: carregar `before` (do DB) e chamar `checkProductUpdate`; FORBIDDEN com a mensagem. Log com `summarizeProductChanges`.
- `saveErpOverride`: `checkErpOverrideUpdate(user, Object.keys(data))`; log.
- `toggleActive` → `products.editMedia`; `toggleFeatured` → `products.manage`; `getSettings/updateSettings` → `settings.manage` (log com chaves alteradas, sem valores sensíveis).
- `users.list/create/update/resetPassword` → `users.manage`, com log.
- `auditLog({ limit, entityType?, entityId? })`: vendedor forçado a `entityType: "evaluation"`.
- Avaliações: apenas exigir sessão (Etapa 3 adiciona o resto).

- [ ] Testes via caller: sem token → UNAUTHORIZED em `products`; vendedor → FORBIDDEN em `updateSettings`, `users.create`, `toggleFeatured`; vendedor `toggleActive` em id ERP permitido (usar `saveErpOverride` em modo arquivo/teste como já faz `security.test.ts`); login devolve token utilizável em `me`; `auditLog` de vendedor só retorna `evaluation`.
- [ ] Implementar; `pnpm test && pnpm check && pnpm lint`. Commit `feat(admin): aplica permissoes por usuario no servidor`.

---

## ETAPA 2 — Layout e navegação

### Task 4: Sessão no cliente, rotas `/admin/*` e layout responsivo

**Files:**
- Create: `src/lib/adminSession.tsx`, `src/lib/adminUnit.tsx`, `src/pages/admin/AdminApp.tsx`, `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/LoginPage.tsx`, `src/pages/admin/ProductsPage.tsx`, `src/pages/admin/SettingsPage.tsx`, `src/pages/admin/AccountPage.tsx`, `src/pages/admin/UsersPage.tsx`, `src/pages/admin/EvaluationsPage.tsx` (provisório: renderiza `AdminEvaluations` atual), `src/pages/admin/DashboardPage.tsx` (provisório: boas-vindas + atalhos), `src/pages/admin/NoPermission.tsx`
- Modify: `src/App.tsx` (bloco `isAdmin` como `isTv`, lazy `AdminApp`, rota `/admin/*`), `src/pages/Admin.tsx` (remover ou reduzir a reexport de `AdminApp`), `api/boot.ts`/`api/lib/vite.ts` só se o fallback SPA não cobrir `/admin/*` (verificar; garantir `noindex` para `/admin`).

Detalhes:
- `AdminSessionProvider`: `trpc.admin.me.useQuery` habilitado se há token; `login(username,password)` salva token em `safeStorage("admin_token")`, invalida `me`; `logout` remove token, `queryClient.clear()`. Hook `useAdminSession(): { user, isLoading, can(cap), login, logout }`.
- `AdminUnitProvider`: `{ unit: StoreUnit | "todas", setUnit }`, persistido em `safeStorage("admin_unit_filter")`, padrão = `user.unit ?? "todas"`.
- `LoginPage`: usuário + senha, erro via toast, estilo do login atual (`Admin.tsx` linhas ~160-230).
- `AdminLayout`: spec §3.2 (sidebar desktop `lg:`; barra inferior mobile com 4 itens + `Sheet` "Mais"; badge de pendentes usando `trpc.admin.evaluationSummary`; filtro de unidade no topo; `<Outlet/>`). Rota guard: componente `RequireCap cap=…`.
- `ProductsPage`: mover a lista de produtos e o fluxo `editing` atuais de `Admin.tsx` sem mudar comportamento; esconder "Adicionar produto", excluir e destacar sem `products.manage`; trocar `alert()` por `toast`.
- `AdminProductEditor`/`AdminErpProductEditor`: receber `user` via hook; campos fora da permissão ficam `disabled` com dica "Apenas o dono pode alterar"; preço `disabled` sem `products.editPrice`; esconder adicionar/remover variante sem `products.manage`.
- `SettingsPage`: `AdminSettings` atual; remover dali a troca da senha única (vai para `AccountPage`).
- `AccountPage`: `changeOwnPassword`.
- `UsersPage`: tabela/lista (cards no mobile) com nome, usuário, nível, unidade, "Pode editar preços", ativo, último acesso; dialog criar/editar; redefinir senha; toasts.
- Atalho Modo TV preservado.

- [ ] Implementar; `pnpm check && pnpm lint && pnpm test && pnpm build`.
- [ ] Verificar no navegador (pnpm dev) em 1280px e 390px: login, navegação, guarda de rota do vendedor. Commit `feat(admin): novo layout com menu lateral, barra inferior e rotas proprias`.

---

## ETAPA 3 — Avaliações melhoradas

### Task 5: Backend do fluxo de atendimento

**Files:**
- Modify: `db/schema.ts`, `api/queries/connection.ts` (colunas + `evaluation_notes`), `contracts/types.ts` (`REFUSAL_REASONS`, `SETTING_KEYS.evaluationSlaHours = "evaluation_sla_hours"` default `"2"`, `SETTING_KEYS.whatsappTemplates = "whatsapp_templates"` default JSON da spec §4.6), `api/admin.ts` (ou novo `api/adminEvaluations.ts`), `api/shop.ts` (`submitEvaluation` aceita `unit`), `mapEvaluationSqlRow`
- Create: `api/evaluationWorkflow.ts`, `api/services/evaluationNotes.ts` (memória em teste), `src/lib/whatsappTemplates.ts`
- Test: `api/evaluationWorkflow.test.ts`, `api/whatsappTemplates.test.ts`

**Interfaces:**
```ts
// evaluationWorkflow.ts (puro)
export type EvaluationStatus = "pendente" | "atendimento" | "concluido" | "recusado";
export interface WorkflowState { status; assignedUserId: number | null; assignedUserName: string; assignedAt: Date | null; firstResponseAt: Date | null; statusChangedAt: Date | null; offeredValue: number | null; closedValue: number | null; refusalReason: string; createdAt: Date; }
export function applyClaim(s: WorkflowState, user: SessionUser, now: Date, opts?: { force?: boolean }): WorkflowState; // throws Error("Já está com <nome>") se de outro e !force
export function applyStatus(s: WorkflowState, status: EvaluationStatus, now: Date, extra?: { refusalReason?: string; closedValue?: number | null }): WorkflowState; // recusado sem motivo válido → Error
export function applyValues(s: WorkflowState, v: { offeredValue?: number | null; closedValue?: number | null }): WorkflowState;
export function isLate(s: Pick<WorkflowState,"status"|"createdAt">, now: Date, slaHours: number): boolean;
// whatsappTemplates.ts
export interface WhatsappTemplate { id: string; label: string; body: string; }
export const DEFAULT_WHATSAPP_TEMPLATES: WhatsappTemplate[];
export function parseTemplates(raw: string | undefined): WhatsappTemplate[]; // fallback padrão se inválido
export function renderTemplate(body: string, vars: Partial<Record<"nome"|"modelo"|"loja"|"endereco"|"vendedor"|"valor_oferecido", string>>): string;
export function buildWhatsappLink(phone: string, text: string): string; // normaliza para 55 + dígitos
```
Endpoints (todos `evaluations.manage`, com `logAction`): `evaluationsPage` (+`unit`, `assigned`, `late`; itens com campos novos e `isLate`), `evaluationDetail({id})` (+ `notes`, + `audit` da avaliação), `evaluationClaim({id})`, `evaluationAssign({id,userId})` (dono), `evaluationSetStatus({id,status,refusalReason?,closedValue?})`, `evaluationSetValues({id,offeredValue?,closedValue?})`, `evaluationAddNote({id,body})`, `evaluationSetUnit({id,unit})`. `evaluationSummary` aceita `unit?` e retorna também `late`. `updateEvaluationStatus` delega a `applyStatus`.

- [ ] Testes de workflow (spec §6) e templates; implementar; verde. Commit `feat(avaliacoes): responsavel, valores, motivo de recusa, anotacoes e SLA`.

### Task 6: Pergunta de unidade no Troca Fácil

**Files:** Modify `src/pages/TradeIn.tsx`, `api/shop.ts` (zod `unit: z.enum(["jardim","gll"]).optional()` e gravação), teste em `api/valuation.test.ts` ou novo `api/tradeinUnit.test.ts` validando que o input aceita/rejeita unidade.

- Nova micro-etapa "Qual loja fica melhor pra você?" com as duas opções (rótulos de `STORE_UNITS`), auto-advance 180ms, antes do resumo; mostrar no resumo; enviar no `submitMutation`; a mensagem de WhatsApp do cliente usa o número da unidade escolhida (`whatsapp_jardim`/`whatsapp_gll`) quando houver.
- [ ] Implementar; verde; conferir funil no navegador. Commit `feat(tradein): cliente escolhe a unidade da loja`.

### Task 7: UI — lista melhorada e página de detalhe

**Files:**
- Create: `src/components/admin/evaluations/` (`EvaluationListItem.tsx`, `EvaluationFilters.tsx`, `EvaluationPhotos.tsx` + lightbox extraídos de `AdminEvaluations.tsx`, `NegotiationCard.tsx`, `NotesTimeline.tsx`, `WhatsappTemplatesCard.tsx`, `AssigneeBadge.tsx`), `src/pages/admin/EvaluationDetailPage.tsx`
- Modify: `src/pages/admin/EvaluationsPage.tsx` (lista nova), `src/pages/admin/AdminApp.tsx` (rota `:id`), `src/pages/admin/SettingsPage.tsx` (SLA + editor de modelos), remover `AdminEvaluations.tsx` quando nada mais o usar.
- Spec §4.5. Usar unidade do `AdminUnitProvider`. Valores digitados em reais com máscara (`R$ 1.234,56`) e convertidos para centavos. Ao escolher "Recusado", abrir select de motivo obrigatório. Funções de foto existentes (adicionar/remover foto, migrar para S3, reenviar notificação) preservadas no detalhe.
- [ ] Implementar; `pnpm check/lint/test/build`; verificar no navegador desktop e mobile. Commit `feat(admin): nova lista e detalhe de avaliacoes`.

---

## ETAPA 4 — Dashboard

### Task 8: Backend do dashboard

**Files:** Create `api/dashboard.ts`; Modify `api/erp/service.ts` (expor `cachedAt` no resultado), `api/admin.ts` (`dashboard({unit?})`, `catalogStatus` com `lastSyncAt`); Test `api/dashboard.test.ts`.

```ts
export interface DashboardData {
  now: { pending: number; late: number; respondedToday: number };
  month: { received: number; concluded: number; refused: number; closeRate: number | null; totalClosedCents: number; avgResponseMinutes: number | null };
  ranking: { userName: string; handled: number; concluded: number; totalClosedCents: number }[] | null; // null p/ vendedor
  catalogIssues: { noPhoto: IssueItem[]; noBattery: IssueItem[]; soldOutVisible: IssueItem[] }; // IssueItem = { id: string; name: string }
  erp: { enabled: boolean; status: string; count: number; lastSyncAt: string | null };
  activity: AuditEntry[];
}
export function computeEvaluationStats(rows: EvalRow[], now: Date, slaHours: number, tz = "America/Campo_Grande"): Pick<DashboardData,"now"|"month"> & { ranking: DashboardData["ranking"] & {} };
export function computeCatalogIssues(products: ProductLike & { id: string|number; category: string }[]): DashboardData["catalogIssues"];
```
- [ ] Testes com datas fixas (mês corrente vs anterior, taxa, média, ranking ordenado, pendências). Implementar. Verde. Commit `feat(admin): dados do dashboard`.

### Task 9: UI do dashboard

**Files:** Modify `src/pages/admin/DashboardPage.tsx`; Create `src/components/admin/dashboard/` (`StatCard.tsx`, `AttentionList.tsx`, `TeamRanking.tsx`, `ActivityFeed.tsx`, `ErpStatusCard.tsx`).
- Spec §5 layout; cartões clicáveis navegam para `/admin/avaliacoes?status=pendente`, `?late=1`, `/admin/produtos?filtro=sem-foto` (EvaluationsPage/ProductsPage leem `useSearchParams`). Ranking só se `can("reports.team")`. Skeletons.
- [ ] Implementar; check/lint/test/build; verificar no navegador. Commit `feat(admin): dashboard com indicadores, pendencias e atividade`.

### Task 10: Revisão final

- [ ] Revisão de todo o diff vs spec; `pnpm test && pnpm check && pnpm lint && pnpm build`.
- [ ] Atualizar `README.md` com seção "Painel admin" (usuário inicial `dono`, níveis, variáveis de ambiente).
- [ ] Commit `docs: documenta painel admin v2`.
