# Design Doc: Painel Admin v2 (usuários, navegação, avaliações e dashboard)

## 1. Visão Geral

Transformar o painel `/admin` (hoje: senha única + 3 abas) em um painel profissional multiusuário, usado por **dono e vendedores**, em **computador e celular**, nas duas unidades (**Jardim** e **Guia Lopes da Laguna**).

Abordagem: **evoluir o painel atual em 4 etapas**, cada uma entregável sozinha:

1. Usuários, níveis de acesso e histórico de ações
2. Novo layout (menu lateral / barra inferior) com rotas próprias
3. Avaliações do Troca Fácil melhoradas (lista melhorada, não kanban)
4. Dashboard

Fora de escopo (fases futuras): rastreio de cliques no WhatsApp, métricas da vitrine, IA, redesign da vitrine pública.

## 2. Etapa 1 — Usuários, níveis e histórico

### 2.1 Dados

Tabela `admin_users`:

| coluna | tipo | notas |
|---|---|---|
| id | INT UNSIGNED PK AI | |
| username | VARCHAR(40) UNIQUE | minúsculo, `[a-z0-9._-]`, 3–40 |
| name | VARCHAR(80) | nome exibido |
| password_hash | VARCHAR(255) | `scrypt:` via `hashPassword` existente |
| role | ENUM('dono','vendedor') | |
| unit | VARCHAR(10) NULL | `jardim` \| `gll` \| NULL (= todas) |
| can_edit_prices | BOOLEAN default false | só relevante para vendedor |
| active | BOOLEAN default true | |
| last_login_at | TIMESTAMP NULL | |
| created_at | TIMESTAMP default now | |

Tabela `audit_logs`:

| coluna | tipo |
|---|---|
| id | INT UNSIGNED PK AI |
| user_id | INT UNSIGNED NULL |
| user_name | VARCHAR(80) |
| action | VARCHAR(60) — ex. `product.update`, `evaluation.status`, `user.create`, `auth.login` |
| entity_type | VARCHAR(30) — `product`, `erp_product`, `evaluation`, `user`, `settings` |
| entity_id | VARCHAR(60) NULL |
| summary | TEXT — frase legível em PT-BR, ex. "Preço 128GB Preto: R$ 3.200 → R$ 3.000" |
| created_at | TIMESTAMP default now, índice |

Tabelas criadas pelo padrão existente `ensureTables()` (CREATE TABLE IF NOT EXISTS + `ensureColumnExists`) e espelhadas em `db/schema.ts`.

**Persistência testável:** `api/services/userStore.ts` e `api/services/auditLog.ts` expõem funções assíncronas; quando `NODE_ENV === "test"` ou sem `DATABASE_URL`, usam armazenamento **em memória** (com `reset…ForTesting()`), seguindo o mesmo espírito do `settingsStore`.

### 2.2 Autenticação

- Login por **usuário + senha** (`admin.login({ username, password })`).
- Token HMAC novo: payload `v2.<userId>.<exp>` assinado com `APP_SECRET` (7 dias). Tokens antigos (`admin.<exp>`) deixam de valer → todos fazem login de novo uma vez.
- A cada requisição, `requireUser(ctx)` valida o token **e recarrega o usuário** do store; usuário inativo/inexistente → `UNAUTHORIZED`. Assim, desativar ou mudar nível vale na hora.
- **Migração/bootstrap:** se não houver nenhum usuário, cria automaticamente `username: "dono"`, `name: "Dono"`, `role: "dono"`, `unit: null`, com `password_hash` = senha atual de `admin_password` (se já for hash `scrypt:` reaproveita; senão faz hash do valor/padrão). A senha única deixa de ser usada para login.
- `admin.me` retorna `{ id, username, name, role, unit, canEditPrices }`.
- `admin.changeOwnPassword({ currentPassword, newPassword })` (mín. 6).
- Rate-limit simples de login em memória: 10 tentativas / 15 min por IP+username.

### 2.3 Permissões (aplicadas no servidor)

Módulo puro `api/permissions.ts`:

```ts
type Role = "dono" | "vendedor";
interface SessionUser { id: number; username: string; name: string; role: Role; unit: Unit | null; canEditPrices: boolean; }
type Capability =
  | "evaluations.manage"     // todos
  | "products.editMedia"     // todos: fotos, vídeos, bateria, observações, disponível/quantidade, ocultar/mostrar
  | "products.editPrice"     // dono, ou vendedor com canEditPrices
  | "products.manage"        // dono: criar, excluir, destacar, nome/marca/categoria/condição/garantia/descrição, adicionar/remover variantes
  | "settings.manage"        // dono
  | "users.manage"           // dono
  | "reports.team";          // dono: ranking por vendedor
function can(user: SessionUser, cap: Capability): boolean;
function assertCan(user: SessionUser, cap: Capability): void; // TRPCError FORBIDDEN "Sem permissão"
```

Edição de produto por vendedor — função pura `checkProductUpdate(user, before, after): string | null` (retorna mensagem de erro ou null):
- Criar (sem `before`) ou excluir → exige `products.manage`.
- Campos de produto `name, brand, category, condition, warranty, description, featured` alterados → exige `products.manage`. `imageUrl, videoUrl, active` → `products.editMedia`.
- Variantes: conjunto de ids diferente (adição/remoção) → `products.manage`. Por variante, `version, storage, color, colorHex, sku, warranty, condition` → `products.manage`; `priceCash` → `products.editPrice`; `imageUrl, videoUrl, batteryHealth, notes, quantity, available` → `products.editMedia`.
- ERP override (`saveErpOverride`): `imageUrl, videoUrl, batteryHealth, description, active` → `products.editMedia`; `featured, category, customName, warranty` → `products.manage`.
- `toggleFeatured` → `products.manage`; `toggleActive` → `products.editMedia`.

### 2.4 Histórico

`logAction(user, { action, entityType, entityId, summary })` é chamado em: login, upsert/delete de produto (resumo inclui mudanças de preço com valor antigo → novo), toggles, override ERP, settings, criação/edição/desativação de usuário, ações de avaliação (Etapa 3). Falha no log nunca derruba a ação (try/catch + console.error).

`admin.auditLog({ limit, entityType?, entityId? })`: dono vê tudo; vendedor vê apenas entradas de avaliações.

### 2.5 Gestão de usuários (dono)

Endpoints: `users.list`, `users.create({ username, name, password, role, unit, canEditPrices })`, `users.update({ id, name, role, unit, canEditPrices, active })`, `users.resetPassword({ id, password })`.
Regras: não pode desativar/rebaixar a si mesmo; deve sempre existir ≥1 dono ativo; username único.

## 3. Etapa 2 — Layout e navegação

### 3.1 Rotas (React Router, `src/pages/admin/`)

| rota | página | acesso |
|---|---|---|
| `/admin` | Dashboard | todos |
| `/admin/avaliacoes` | Lista de avaliações | todos |
| `/admin/avaliacoes/:id` | Detalhe da avaliação | todos |
| `/admin/produtos` | Lista de produtos (atual) | todos |
| `/admin/usuarios` | Usuários | dono |
| `/admin/configuracoes` | Configurações (atual + SLA + modelos de mensagem) | dono |
| `/admin/conta` | Trocar a própria senha | todos |

Sem sessão → tela de login (usuário + senha). Rota sem permissão → estado "Sem permissão".

`App.tsx`: caminhos `/admin*` renderizam `AdminApp` **fora** do layout da loja (sem Header/Footer/Carrinho/Popup/CookieBanner), como já ocorre com `/tv`. A edição de produto atual (`editing` em `Admin.tsx`) continua funcionando dentro de `/admin/produtos` (estado local; rota `/admin/produtos/:id` opcional não é necessária).

### 3.2 Layout

- **Desktop (≥1024px):** sidebar fixa (componente `@/components/ui/sidebar` já existente ou equivalente simples): logo, itens com ícones lucide (Início, Avaliações com badge de pendentes, Produtos, Usuários*, Configurações*), rodapé com nome, nível, unidade, link Modo TV e Sair. Topbar com título da página e **filtro de unidade** (Todas / Jardim / Guia Lopes).
- **Mobile:** topbar compacta com título + filtro de unidade; **barra inferior fixa** com Início, Avaliações (badge), Produtos, Mais. "Mais" abre `Sheet` com Usuários*, Configurações*, Minha conta, Modo TV, Sair. Alvos de toque ≥ 44px, `pb-[env(safe-area-inset-bottom)]`.
- Itens marcados com * só aparecem para o dono.
- Filtro de unidade: estado em contexto `AdminUnitContext`, persistido em `safeStorage` (`admin_unit_filter`); padrão = unidade do usuário (ou "todas" se null).
- Feedback: `sonner` (`toast`) substitui `alert()` nas telas tocadas; skeletons nos carregamentos.
- Estilo: manter a paleta Apple-like atual (`#1d1d1f`, `#f5f5f7`, `#e5e5e7`, `#86868b`, `rounded-xl/2xl`).

### 3.3 Sessão no cliente

`src/lib/adminSession.tsx`: `AdminSessionProvider` usa `trpc.admin.me`; expõe `{ user, can(cap), login, logout }`. Token continua em `safeStorage("admin_token")`. Resposta 401 → limpa token e volta ao login. `can()` usa a mesma tabela de capacidades (arquivo compartilhado `contracts/permissions.ts`, importado por `api/permissions.ts`).

## 4. Etapa 3 — Avaliações melhoradas

### 4.1 Dados (novas colunas em `evaluations`)

| coluna | tipo |
|---|---|
| unit | VARCHAR(10) DEFAULT '' (`jardim` \| `gll` \| '') |
| assigned_user_id | INT UNSIGNED NULL |
| assigned_user_name | VARCHAR(80) DEFAULT '' |
| assigned_at | TIMESTAMP NULL |
| first_response_at | TIMESTAMP NULL — primeira vez que alguém pega ou muda o status |
| status_changed_at | TIMESTAMP NULL |
| offered_value | INT NULL (centavos) |
| closed_value | INT NULL (centavos) |
| refusal_reason | VARCHAR(30) DEFAULT '' |

Nova tabela `evaluation_notes`: `id, evaluation_id (idx), user_id, user_name, body TEXT, created_at`.

Motivos de recusa (constante em `contracts/types.ts`): `preco` (Preço não agradou), `defeito` (Aparelho com defeito/peças), `sem_resposta` (Cliente não respondeu), `desistiu` (Cliente desistiu), `outro` (Outro).

### 4.2 Unidade no Troca Fácil

Nova pergunta no funil `TradeIn.tsx` antes do resumo: **"Qual loja fica melhor pra você?"** — Jardim / Guia Lopes da Laguna (auto-advance, mesmo estilo das outras micro-etapas). `submitEvaluation` aceita `unit` opcional (`jardim|gll`). A mensagem de WhatsApp gerada para o cliente e a notificação usam a unidade escolhida quando houver.

### 4.3 Regras (funções puras em `api/evaluationWorkflow.ts`)

- `claim`: atribui ao usuário atual; se status `pendente` → `atendimento`; preenche `assigned_at`, `first_response_at` (se nulo). Se já atribuída a outro, só o dono pode reatribuir (`assignTo`), vendedor recebe erro "Já está com <nome>".
- `setStatus(status, { refusalReason?, closedValue? })`: `recusado` exige `refusalReason`; `concluido` aceita `closedValue` opcional; atualiza `status_changed_at` e `first_response_at` se nulo.
- `setValues({ offeredValue?, closedValue? })`: inteiros ≥ 0 em centavos.
- `addNote(body)`: 1–2000 chars.
- Todas registram `audit_logs` (`evaluation.claim|status|values|note|unit`).
- `setUnit(unit)` para avaliações antigas/sem unidade.
- **Atraso:** `isLate(evaluation, now, slaHours)` = status `pendente` e `now - created_at > slaHours`. SLA em setting `evaluation_sla_hours` (padrão `2`), editável pelo dono.

### 4.4 Endpoints

`evaluationsPage` ganha filtros `unit?`, `assigned?: "me" | "none" | "any"`, `late?: boolean`; retorna também os novos campos e `isLate`. Novos: `evaluationDetail({ id })` (com notas), `evaluationClaim`, `evaluationAssign` (dono), `evaluationSetStatus`, `evaluationSetValues`, `evaluationAddNote`, `evaluationSetUnit`. Os endpoints antigos usados pela UI são substituídos; `updateEvaluationStatus` passa a delegar a `evaluationSetStatus`.

### 4.5 UI

**Lista (`/admin/avaliacoes`)** — mantém o estilo atual de lista, melhorada:
- Chips de status com contadores; filtros: unidade (do topo), "Minhas / Sem responsável / Todas", "Atrasadas"; busca.
- Cada item: nome, modelo + GB + cor, unidade, tempo desde envio ("há 3 h") com selo vermelho **Atrasada**, responsável (avatar com iniciais ou "Sem responsável"), valores (oferecido/fechado), status. Botão rápido **Pegar** quando sem responsável.
- Clique abre `/admin/avaliacoes/:id`.

**Detalhe (`/admin/avaliacoes/:id`)**:
- Cabeçalho: cliente, WhatsApp, unidade (editável), status, responsável (Pegar / Reatribuir para dono).
- Bloco "Aparelho" com as respostas do funil e galeria de fotos (reaproveitar componentes de foto/lightbox existentes de `AdminEvaluations.tsx`, extraídos para `src/components/admin/evaluations/`).
- Bloco "Negociação": valor oferecido, valor fechado, status com motivo de recusa obrigatório ao recusar.
- Bloco "Anotações": timeline (nome, data/hora, texto) + campo para nova anotação.
- Bloco "Mensagens prontas": botões que abrem `wa.me/<cliente>?text=` com o modelo preenchido.
- Histórico de ações da avaliação (do `audit_logs`).

### 4.6 Mensagens prontas

Setting `whatsapp_templates` (JSON array `{ id, label, body }`), editável pelo dono em Configurações. Placeholders: `{nome}`, `{modelo}`, `{loja}`, `{endereco}`, `{vendedor}`, `{valor_oferecido}`. Padrões:

1. **Recebemos sua avaliação** — "Olá {nome}! Aqui é {vendedor} da Lojinha do Celular {loja}. Recebemos a avaliação do seu {modelo} e já estamos analisando. Em instantes te passo a proposta 😊"
2. **Proposta** — "Olá {nome}! Analisamos seu {modelo}. Conseguimos oferecer {valor_oferecido} na troca, sujeito à conferência presencial. Podemos agendar sua visita?"
3. **Convite para a loja** — "{nome}, te esperamos na Lojinha do Celular {loja}: {endereco}. É só trazer o aparelho para a conferência final!"
4. **Pedir mais fotos** — "Olá {nome}! Para fechar a avaliação do seu {modelo}, pode nos enviar mais algumas fotos da tela e da traseira?"

Função pura `renderTemplate(body, vars)` (em `src/lib/whatsappTemplates.ts`, testada a partir de `api/`): placeholders sem valor viram string vazia; `{loja}` = "Jardim"/"Guia Lopes da Laguna"; `{endereco}` vem das settings `address_jardim/address_gll`.

## 5. Etapa 4 — Dashboard (`/admin`)

Endpoint `admin.dashboard({ unit?: "jardim" | "gll" })`, cálculo em função pura `computeDashboard(evaluations, now, slaHours)` (`api/dashboard.ts`), mês = mês corrente no fuso `America/Campo_Grande`:

1. **Avaliações agora:** pendentes, atrasadas, atendidas hoje (`first_response_at` hoje).
2. **Troca Fácil no mês:** recebidas, concluídas, recusadas, taxa de fechamento = concluídas / (concluídas + recusadas), total comprado = soma de `closed_value` das concluídas, tempo médio de resposta = média de `first_response_at - created_at` (formatado "1 h 20 min").
3. **Ranking por vendedor (somente dono):** por `assigned_user_name`: atendimentos no mês, concluídas, total fechado; ordenado por concluídas.
4. **Pendências da vitrine:** produtos visíveis sem foto (`imageUrl` vazio no produto e nas variantes), seminovos sem bateria informada, visíveis mas esgotados (todas variantes indisponíveis/quantidade 0). Lista com link para Produtos. Calculado em `computeCatalogIssues(products)`.
5. **Status do ERP:** reaproveita `catalogStatus`; adicionar `cachedAt` (última sincronização) ao retorno de `getErpCatalog`/endpoint.
6. **Atividade recente:** últimas 15 entradas do `audit_logs` (vendedor: só de avaliações).

Layout: cartões de números no topo (grid 2 col mobile / 4 col desktop), depois "Precisa de atenção" (atrasadas + pendências), ranking e atividade. Cada cartão clicável leva à lista filtrada.

## 6. Testes

Vitest (Node) em `api/`:
- `permissions.test.ts`: `can` por nível; `checkProductUpdate` (vendedor muda foto ✅, muda preço ❌/✅ com flag, muda nome ❌, adiciona variante ❌, cria ❌); overrides ERP.
- `users.test.ts`: bootstrap do dono a partir da senha antiga (hash e texto), login ok/errado/inativo, token v2 válido/forjado/expirado, token legado rejeitado, regras "≥1 dono ativo" e "não desativar a si mesmo".
- `auditLog.test.ts`: registro e filtros; resumo de mudança de preço.
- `evaluationWorkflow.test.ts`: claim, conflito de responsável, recusa exige motivo, `first_response_at`, `isLate`.
- `whatsappTemplates.test.ts`: placeholders.
- `dashboard.test.ts`: números do mês, taxa, tempo médio, ranking, pendências da vitrine.
- Ajustar `auth.test.ts` para o novo token/login.

Antes de cada entrega: `pnpm test`, `pnpm lint` (0 erros), `pnpm check`, `pnpm build`.

## 7. Decisões padrão tomadas sem consulta (revisáveis)

- Login por usuário (sem e-mail); usuário inicial `dono` com a senha atual.
- SLA de atraso padrão **2 horas**.
- Vendedor pode ocultar/mostrar produto (para marcar vendido em aparelho do ERP); destacar é só do dono.
- Vendedor vê o histórico apenas das avaliações.
- Motivos de recusa fixos (lista acima) + "Outro".
