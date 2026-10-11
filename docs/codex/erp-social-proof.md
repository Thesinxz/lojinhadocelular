# Pedido para o Codex — "Quem já comprou com a gente" (prova social), na pasta do ERP (`old_gestao`)

> Cole o bloco abaixo (de "Contexto" até "Entrega") no Codex, com o diretório em `/Users/marlon/Documents/old_gestao`.
> **Antes:** `git checkout main && git pull`, depois `git checkout -b feat/social-proof`.
> **Importante:** o Coolify do backend publica a `main` por webhook e roda `prisma migrate deploy` ao subir. **Nada de push na `main`**; só na branch.

---

## Contexto

ERP Gestão Celular (NestJS + Prisma em `backend/`, Next.js em `frontend/`), em produção. **Antes de qualquer alteração:** leia `AGENTS.md`,
rode `git status` e `git diff`, não reverta trabalho existente, não refatore fora do escopo, não toque em `.env` nem em dados de produção.

O site da loja (projeto separado) quer exibir uma faixa de **prova social** com **clientes reais**: primeiro nome, inicial do
sobrenome e o celular que compraram, por exemplo "Andressa B. · iPhone 11".

Decisão do dono da loja: **não será exigida autorização individual** (a exibição é só primeiro nome + inicial + modelo). Para continuar protegendo
o cliente, existe **opt-out**: qualquer pedido de remoção deve ser atendido na hora. Regras inegociáveis:
- **Todo cliente elegível aparece por padrão**, **exceto** quem estiver marcado como "não divulgar". Padrão de todos os clientes existentes: **não marcado**.
- **Dado mínimo:** nada de CPF, telefone, e-mail, ID, datas exatas, valores, IMEI, unidade nem número de venda.
- Marcar "não divulgar" faz a pessoa **sumir do endpoint** imediatamente (respeitando só o cache curto) e o marcador **nunca** é desfeito automaticamente.

Fatos do código (já verificados — confirme antes de usar):
- `Customer` (`backend/prisma/schema.prisma`): `nome_completo`, `tipo`, `cpf`, `cnpj`, `deleted_at`, relação `sales`.
- `Sale`: `status` (cancelada = `CANCELADA` ou `CANCELADO`), `customer_id`, `created_at`, `items SaleItem[]`.
- `SaleItem`: `snapshot_brand`, `snapshot_model`, `snapshot_name`, `snapshot_imei`, `snapshot_storage_capacity` (o modelo "congelado" no momento da venda).
- Respostas passam por `TransformResponseInterceptor` → `{ success, data }`; `ValidationPipe` global com `forbidNonWhitelisted`.
- Já existem rotas públicas de vitrine em `modules/storefront` (`GET /api/storefront/:slug/catalog`), com `@PublicRoute()` e `@Throttle`.
- O `backend/Dockerfile` roda `npx prisma migrate deploy` ao iniciar: a migration **precisa ser aditiva**.

## Tarefa 1 — Marcador "não divulgar" no cadastro do cliente (opt-out)

**Backend**
1. Migration **aditiva** e modelo Prisma em `Customer`:
   `oculta_divulgacao_compra Boolean @default(false)`, `oculta_divulgacao_em DateTime?`, `oculta_divulgacao_por String?` (id do usuário que registrou).
2. Aceitar `oculta_divulgacao_compra?: boolean` nos DTOs de criar/atualizar cliente. Ao mudar o valor, preencher `oculta_divulgacao_em` (agora) e
   `oculta_divulgacao_por` (usuário logado). Registrar a mudança no módulo `audit` (quem, quando, valor novo, cliente — sem dados sensíveis).
3. Devolver os três campos no detalhe do cliente.

**Frontend** (cadastro/edição do cliente)
4. Checkbox: **"Não exibir este cliente na faixa “quem já comprou” do site (a pedido do cliente)"**, desmarcado por padrão. Se marcado, mostrar
   "Ocultado em <data> por <usuário>".

## Tarefa 2 — Endpoint público mínimo

`GET /api/storefront/:slug/compras-recentes?limit=20`

- `@PublicRoute()`, `@Throttle` público (ex.: 30/min por IP), **cache de 5 minutos** (use o mecanismo de cache/Redis já existente) e `limit` padrão 20, máximo 30.
- Resposta (dentro do envelope padrão):
  ```json
  { "success": true, "data": { "items": [ { "first_name": "Andressa", "last_initial": "B", "model": "iPhone 11", "brand": "Apple" } ] } }
  ```
  `last_initial` é opcional (omitir se o cliente tiver um nome só). Documente o DTO de resposta no Swagger.
- Regras de seleção (todas obrigatórias):
  - tenant = o do `slug`; cliente com `oculta_divulgacao_compra = false`, `deleted_at = null`, **pessoa física** (tem `cpf`, não tem `cnpj`; confira como `tipo` distingue PF/PJ);
  - venda **não cancelada** (`CANCELADA`/`CANCELADO`) e finalizada, dos **últimos 365 dias**;
  - considerar só itens que sejam **celular**: `snapshot_imei` preenchido e `snapshot_model` (ou, na falta, `snapshot_name`) não vazio. Acessórios ficam de fora;
  - **um item por cliente** (a compra mais recente), ordenado da mais recente para a mais antiga;
  - `first_name`: primeiro nome em Title Case (máx. 20 caracteres; ignorar se tiver menos de 2 letras);
  - `last_initial`: primeira letra do **último sobrenome relevante**, em maiúscula, ignorando partículas (`de`, `da`, `do`, `das`, `dos`, `e`);
  - `model`: o modelo do aparelho **sem** capacidade, cor, IMEI ou número longo (máx. 40 caracteres). Descarte o item se sobrar vazio ou com 8+ dígitos seguidos;
  - nunca devolver: id, CPF, telefone, e-mail, datas, valores, IMEI, unidade, número da venda.

## Testes e entrega

- Testes: cliente marcado "não divulgar" não aparece (e volta a não aparecer logo após marcar, descontado o cache); venda cancelada, cliente PJ, cliente apagado, acessório e venda com mais de 365 dias ficam de fora;
  um item por cliente; formatação de nome (partículas, nome único, acentos); `limit` respeitado e limitado a 30; isolamento entre tenants; resposta **sem** campos extras.
- Rode lint, testes e build do backend e do frontend. Mostre a migration (SQL) **antes** de qualquer aplicação; **não aplique em banco nenhum**.
- Faça commits locais na branch `feat/social-proof`, **sem push**. Mostre o diff final para revisão.
- Se algo no código contradisser este pedido, **pare e relate** em vez de adivinhar.

## Entrega

Responda com: arquivos alterados; o SQL da migration; o formato exato da resposta do endpoint (um exemplo real do teste); como marcar o "não divulgar"
pela tela; resultados de lint/test/build; qualquer decisão diferente do pedido e o motivo.
