# Troca Fácil BLK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a nova experiência interativa e mobile-friendly de 16 etapas do Troca Fácil BLK na rota `/avaliacao` e com suporte direto ao subdomínio `https://trocafacil.blkstore.com.br/avaliacao` (e raiz `trocafacil.*`), preservando o seletor visual avançado de iPhone e enriquecendo o registro no banco de dados e WhatsApp.

**Architecture:** Frontend React SPA com Hono + tRPC no backend e Drizzle ORM no MySQL. O funil `/avaliacao` adota navegação estilo micro-quiz com transições fluidas e auto-advance para opções objetivas, capturando diagnóstico técnico detalhado do iPhone e abrindo o WhatsApp com os dados estruturados.

**Tech Stack:** React 19, Tailwind CSS, Lucide React, Hono, tRPC, Drizzle ORM, TypeScript.

## Global Constraints

- Preservar as rotas existentes (`/`, `/catalogo`, `/produto/:id`, `/admin`, `/tv`, `/avaliacao`, `/troca`).
- No subdomínio `trocafacil.blkstore.com.br`, exibir diretamente o funil do Troca Fácil, mesmo se o usuário acessar a raiz `/`.
- Manter o seletor de modelo atual que já possui render do aparelho, seleção de capacidade e cores oficiais da Apple.
- Executar `pnpm check` e `pnpm test` ao final para garantir integridade.

---

### Task 1: Schema do Banco de Dados & Endpoints da API

**Files:**
- Modify: `db/schema.ts:72-93`
- Modify: `api/shop.ts:278-314`
- Modify: `api/admin.ts:213-245`

**Interfaces:**
- Consumes: Drizzle ORM mysqlTable, Zod inputs.
- Produces: Novos campos na tabela `evaluations`:
  - `purchaseLocation`: `varchar(100)`
  - `targetModel`: `varchar(120)`
  - `faceId`: `varchar(30)`
  - `screenOriginal`: `varchar(30)`
  - `batteryOriginal`: `varchar(30)`
  - `camerasOk`: `varchar(30)`
  - `audioOk`: `varchar(30)`
  - `chargingPortOk`: `varchar(30)`
  - `openedBefore`: `varchar(30)`
  - `hasBox`: `varchar(30)`
  - `visualCondition`: `varchar(100)`

- [ ] **Step 1: Atualizar schema da tabela evaluations em `db/schema.ts`**
Adicionar as novas colunas com valores opcionais/default para compatibilidade com registros existentes.

- [ ] **Step 2: Atualizar endpoint `submitEvaluation` em `api/shop.ts`**
Expandir o schema Zod para aceitar e persistir os novos campos.

- [ ] **Step 3: Testar compilação do backend**
Executar `pnpm check` para garantir que tipos e schema do tRPC estão válidos.

- [ ] **Step 4: Commit das alterações do backend**
`git commit -m "feat(api): expande schema e endpoint de avaliacoes com diagnostico completo"`

---

### Task 2: Suporte a Multi-domínio e Roteamento Inteligente

**Files:**
- Modify: `src/App.tsx:32-63`
- Modify: `api/boot.ts:114-123`

**Interfaces:**
- Consumes: `window.location.hostname` e React Router `useLocation()`.
- Produces: Ativação automática do modo Troca Fácil quando acessado via `trocafacil.blkstore.com.br` ou rotas `/avaliacao` e `/troca`.

- [ ] **Step 1: Atualizar detecção em `src/App.tsx`**
Reconhecer hostnames contendo `trocafacil` para que a raiz `/` renderize o `TradeIn` em vez da Home da loja, garantindo que `https://trocafacil.blkstore.com.br/` ou `/avaliacao` funcione como landing page dedicada.

- [ ] **Step 2: Verificar `api/boot.ts` para SEO e cabeçalhos**
Garantir que o servidor atenda requisições vindas de `trocafacil.blkstore.com.br` e que o sitemap liste `/avaliacao`.

- [ ] **Step 3: Commit das alterações de domínio**
`git commit -m "feat(routing): adiciona suporte ao subdominio trocafacil"`

---

### Task 3: Reformulação Completa da Página Troca Fácil (`src/pages/TradeIn.tsx`)

**Files:**
- Modify: `src/pages/TradeIn.tsx`

**Interfaces:**
- Consumes: `trpc.shop.submitEvaluation`, `useShopSettings`, `IPHONE_CATALOG`.
- Produces: 16 etapas interativas com auto-advance, barra de progresso suave, nosso seletor rico de iPhones, slider de bateria dinâmico, diagnóstico de 8 itens, 5 slots de fotos e revisão com envio para WhatsApp.

- [ ] **Step 1: Definir constantes e tipos de estado expandidos**
Incluir os estados para todas as etapas:
`name`, `whatsapp`, `model`, `storage`, `color`, `purchaseLocation`, `batteryPercent`, `targetModel`, `faceId`, `screenOriginal`, `batteryOriginal`, `camerasOk`, `audioOk`, `chargingPortOk`, `openedBefore`, `hasBox`, `visualCondition`, `photos` (slots 1 a 5).

- [ ] **Step 2: Implementar componente de Auto-Advance para opções de toque único**
Criar componente de opção com feedback de seleção instantâneo e avanço automático (180ms) + botão Voltar.

- [ ] **Step 3: Refinar o Seletor de Modelo (Etapa 2 - Nosso Modelo)**
Manter e estilizar o componente rico existente (busca/chips, visualizador realista com foto do iPhone, ano, tamanho de tela, chips de capacidade e cores oficiais com swatches). Personalizar com título "*Prazer, {nome}! Qual é o seu iPhone?*".

- [ ] **Step 4: Implementar o Slider de Bateria (Etapa 4)**
Criar componente de slider de 50% a 100% com indicador grande e rótulo dinâmico ("*90% - Bateria ótima*").

- [ ] **Step 5: Implementar o Seletor do iPhone Desejado (Etapa 5)**
Grade com os modelos de iPhone mais desejados + botão para "Apenas vender meu aparelho (sem troca)".

- [ ] **Step 6: Implementar as Telas de Diagnóstico Sim/Não/Não sei (Etapas 6 a 13)**
Telas dedicadas para Face ID, Tela original, Bateria original, Câmeras, Áudio, Conector de carga, Aparelho já aberto e Tem caixa.

- [ ] **Step 7: Implementar Seleção de Conservação Visual (Etapa 14)**
Opções: Parece novo, Pouquíssimas marcas, Marcas normais, Riscos/amassados, Trinco na tela/tampa.

- [ ] **Step 8: Implementar Upload com 5 Slots de Fotos (Etapa 15)**
Slots para: Frente (essencial), Traseira (essencial), Laterais, Saúde da bateria e Tela ligada, com preview de arquivo.

- [ ] **Step 9: Implementar Tela de Resumo & Botão WhatsApp (Etapa 16)**
Tabela de conferência com visual Apple/BLK STORE e botão "Enviar para avaliação BLK", que salva no banco e abre a mensagem no WhatsApp.

- [ ] **Step 10: Commit das alterações da página TradeIn**
`git commit -m "feat(tradein): reformula fluxo completo com 16 etapas interativas e auto-advance"`

---

### Task 4: Atualização do Painel Administrativo (`AdminEvaluations.tsx`)

**Files:**
- Modify: `src/components/admin/AdminEvaluations.tsx`

**Interfaces:**
- Consumes: `trpc.admin.evaluations`.
- Produces: Exibição detalhada de todas as respostas técnicas do novo funil de avaliação para o atendente.

- [ ] **Step 1: Exibir novos campos nas avaliações do Admin**
Adicionar badges e blocos para: iPhone desejado, Origem da compra, Bateria %, Diagnóstico técnico (Face ID, Tela, Áudio, Câmeras, etc.), Caixa e Estado visual.

- [ ] **Step 2: Commit do painel admin**
`git commit -m "feat(admin): exibe detalhes completos do novo fluxo de avaliacao no painel"`

---

### Task 5: Validação, Verificação e Instruções de DNS

**Files:**
- Executar: `pnpm check`, `pnpm test`, `pnpm build`.

- [ ] **Step 1: Rodar TypeScript check (`pnpm check`)**
- [ ] **Step 2: Rodar Vitest tests (`pnpm test`)**
- [ ] **Step 3: Rodar Build de produção (`pnpm build`)**
- [ ] **Step 4: Documentar configurações de DNS necessárias para `trocafacil.blkstore.com.br`**
