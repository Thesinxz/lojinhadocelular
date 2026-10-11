# Pedido para o Codex — correções de segurança e erro 500 no ERP (`old_gestao`)

> Cole o bloco abaixo (de "Contexto" até "Entrega") no Codex, com o diretório em `/Users/marlon/Documents/old_gestao`.
> **Antes:** `git checkout main && git pull`, depois `git checkout -b fix/vitrine-e-blacklist-imei`.
> **Importante:** o Coolify do backend publica a `main` por webhook. **Nada de push na `main`**; só na branch.
> Esta branch **não tem migration**. Rode ela **antes** de `feat/social-proof` (um agente por vez no ERP).

---

## Contexto

ERP Gestão Celular (NestJS + Prisma em `backend/`), em produção. **Antes de qualquer alteração:** leia `AGENTS.md`,
rode `git status` e `git diff`, não reverta trabalho existente, não refatore fora do escopo, não toque em `.env` nem em dados de produção.

Dois defeitos já diagnosticados pela leitura do código (confirme antes de mexer):

### Defeito 1 — `GET /api/storefront/:slug` responde 500 (e `POST /api/storefront/:slug/appointments` tem o mesmo risco)

`backend/src/modules/storefront/storefront.service.ts`:
- `getStorefrontBySlug` usa `this.prisma.storefrontConfig.findUnique(...)`.
- `createAppointment` usa `this.prisma.appointment.create(...)`.

`StorefrontConfig` e `Appointment` são modelos **de tenant** (não estão em `GLOBAL_MODELS` do `PrismaService`). Rotas públicas
(`@PublicRoute()`) não têm `tenantStorage`, então a extensão do `PrismaService` lança
`[PrismaService] Consulta ao modelo "..." sem contexto de tenant definido`, que vira 500.
O catálogo (`/catalog`) funciona porque usa `this.prisma.getTenantClient(tenant.id)`.

**Correção esperada:** nessas duas funções, resolver o tenant por `slug` (modelo global `tenant`, como já é feito) e usar
`const tenantClient = this.prisma.getTenantClient(tenant.id)` para `storefrontConfig` e `appointment` — o mesmo padrão do catálogo.
Verifique também `serviceType` (já usa `tenantClient`) e qualquer outro acesso a modelo de tenant nesse módulo.
Se `service_type_id` do agendamento vier de fora, garanta que o tipo de serviço pertence ao tenant do slug (não aceitar ID de outro tenant).

### Defeito 2 — rotas de blacklist de IMEI sem permissão

`backend/src/modules/tools/tools-imei.controller.ts`:
- `POST /api/tools/imei/blacklist` e `DELETE /api/tools/imei/blacklist/:imei` **não têm `@Permissions(...)`**. Qualquer usuário autenticado
  (inclusive perfis operacionais) consegue incluir/remover IMEI da blacklist do tenant.
- O `DELETE` usa `req.user.tenant_id`; o `POST` e o `consultar` usam `req.user.tenantId`. O `JwtStrategy` expõe os dois campos
  (`jwt.strategy.ts`), então **funciona** e a busca é limitada ao tenant pela chave composta `tenant_id_imei`. A única lacuna é de **autorização**.
  Padronize para `tenantId` por consistência, sem mudar comportamento.
- Tokens de API já são negados por padrão nessas rotas (deny-by-default sem `@ApiTokenScope`); **mantenha assim**.

**Correção esperada:**
1. Padronizar `req.user.tenantId` no `DELETE` (apenas consistência).
2. Proteger `POST`/`DELETE` blacklist com `@Permissions(...)` usando **uma permissão já existente** em `shared/constants/default-roles.ts`
   que, na prática, só ADMIN e GERENTE possuam (não VENDEDOR, CAIXA, TÉCNICO). Se nenhuma existente servir, **pare e relate** as opções;
   não crie permissão nova sem aprovar.
3. Teste: perfil sem permissão recebe 403; ADMIN/GERENTE passam; `DELETE` não remove IMEI de outro tenant (teste de isolamento);
   token de API continua negado; `consultar` continua acessível como está (`@ApiTokenScope('aquisicoes:criar')`).

## Regras

- Produção: nada de migration, nada de apagar dados, nada de alterar `.env`.
- Mudanças pequenas e revisáveis; um commit por defeito (`fix(vitrine): ...`, `fix(imei): ...`).
- Testes: para o Defeito 1, um teste de integração/serviço que **reproduza** o 500 (rota pública sem `tenantStorage`) e passe após a correção,
  no mesmo estilo do teste que já cobre `ApiToken` sem contexto de tenant.
- Rode lint, testes e build do backend. **Não aplique nada em banco.** Commits locais na branch, **sem push**, e mostre o diff final.
- Se algo no código contradisser este pedido, **pare e relate** em vez de adivinhar.

## Entrega

Responda com: arquivos alterados por defeito; a causa confirmada de cada um (cole a linha do erro reproduzido); a permissão escolhida para a
blacklist e quais perfis a possuem; resultados de lint/test/build; qualquer decisão diferente do pedido e o motivo.
