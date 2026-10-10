# Pedido para o Codex — rodar na pasta do ERP (`old_gestao`)

> Cole o bloco abaixo (de "Contexto" até "Entrega") no Codex, com o diretório de trabalho em
> `/Users/marlon/Documents/old_gestao`.

---

## Contexto

Este é o ERP Gestão Celular (NestJS + Prisma no `backend/`, Next.js no `frontend/`), em produção.
**Antes de qualquer alteração:** leia `AGENTS.md`, rode `git status` e `git diff`, não reverta trabalho
existente, não refatore fora do escopo e não toque em `.env`, em dados de produção nem em migrações já aplicadas.

Um site externo (loja de celulares, projeto separado) precisa conversar com este ERP de forma
**profissional e segura**. Hoje a única forma é logar com e-mail/senha de um usuário real
(`POST /api/auth/login`, limitado a 5/min). Isso é frágil: a senha do usuário fica guardada no servidor
do site, o acesso não pode ser limitado por escopo e não dá para revogar sem trocar a senha.

A aba **Configurações › Comunicação › Integrações de API › Tokens de API** é hoje um espaço reservado
desativado (`frontend/src/app/(dashboard)/configuracoes/integracoes/page.tsx`, aba `tokens`, com o texto
"Tokens pessoais ainda não estão disponíveis para uso externo"). Não existe modelo, serviço nem guard de
token de API no backend.

Fatos do código que você deve respeitar (já verificados):
- Autenticação: `JwtAuthGuard` (passport `jwt`, `backend/src/shared/guards` e `modules/auth/guards`) + `JwtStrategy`
  (`modules/auth/strategies/jwt.strategy.ts`), que carrega o usuário, checa status do usuário/tenant, trial e
  `senha_alterada_em`. Permissões por `RolesGuard` + `@Permissions('dominio:acao')` (suporta `dominio:*` e `*:*`);
  `req.user.permissions` vem das roles (`shared/constants/default-roles.ts`).
- Respostas passam por `TransformResponseInterceptor` → `{ success, data }`.
- `ValidationPipe` global com `forbidNonWhitelisted: true` (`main.ts`): payloads com campo extra dão 400.
- Há throttler (`@Throttle`), `TenantGuard`, módulo `audit`, Redis (`RedisService`) e Swagger (`@ApiBearerAuth`).
- Rotas que a integração precisa (e as permissões atuais): `GET /api/clientes` (`clientes:ler`),
  `GET /api/clientes/:id/historico-atendimento` (`clientes:ler`), `POST /api/products/entrada-seminovo`
  (`aquisicoes:criar`), `POST /api/tools/imei/consultar` (**sem `@Permissions` hoje**), `GET /api/products` (`produtos:ler`).
- `ProductsController.entradaSeminovo` usa `req.user.id` como `usuarioId` (auditoria/FKs), então a requisição
  por token precisa ter um usuário real associado.

## Tarefa 1 — Tokens de API de verdade (prioridade máxima)

**Backend**
1. Modelo Prisma `ApiToken` (migração **aditiva**, sem alterar tabelas existentes): `id`, `tenant_id`, `user_id`
   (usuário ao qual o token está vinculado: é com a identidade dele que a ação é auditada), `name`, `prefix`
   (indexado, parte não secreta), `token_hash` (sha256 do segredo; **nunca** guardar o token em claro),
   `scopes String[]`, `expires_at?`, `revoked_at?`, `last_used_at?`, `last_used_ip?`, `created_by`, `created_at`.
2. Formato do token: `gcl_<prefix>_<segredo-aleatório-32-bytes-base64url>`. Mostrar o valor completo **uma única
   vez**, na criação.
3. Módulo `api-tokens` com rotas sob `/api/configuracoes/api-tokens`: `POST` (criar), `GET` (listar, sem o segredo),
   `DELETE /:id` (revogar). Só quem tem `configuracoes:atualizar` (idealmente apenas ADMIN) cria/revoga.
   Valide `scopes` contra uma **lista de permitidos** e recuse `*:*`, `dominio:*` e qualquer escopo de
   `usuarios`, `financeiro`, `nfe`, `configuracoes`, `roles`. Escopos iniciais permitidos:
   `clientes:ler`, `clientes:criar`, `aquisicoes:criar`, `produtos:ler`, `estoque:ler`, `vendas:ler`.
4. Autenticação: aceitar `Authorization: Bearer gcl_...` **e** `X-API-Key: gcl_...` no guard de autenticação
   existente (estendendo `JwtAuthGuard`/estratégia, sem quebrar o fluxo JWT atual). Para token de API:
   buscar por `prefix`, comparar o hash em tempo constante (`crypto.timingSafeEqual`), recusar se revogado,
   expirado, usuário vinculado inativo ou tenant suspenso/cancelado. Montar `req.user` como o usuário vinculado
   **com `permissions` = interseção entre as permissões da role dele e os `scopes` do token**, e marcar
   `req.user.viaApiToken = { id, name }`. Assim `RolesGuard`, multitenant e auditoria continuam funcionando.
5. Segurança: nunca logar o token; atualizar `last_used_at/ip` no máximo 1x por minuto por token (evitar escrita a
   cada requisição); rate limit por token (ex.: 120/min); registrar criação/revogação/uso negado no módulo `audit`;
   token de API **não** pode acessar rotas de gestão de tokens, usuários, senha nem `auth/*`.
6. `POST /api/tools/imei/consultar` e as demais rotas de `tools-imei.controller.ts` hoje não têm `@Permissions`.
   Adicione `@Permissions('aquisicoes:criar')` à consulta e confira que ADMIN, GERENTE e VENDEDOR continuam com acesso.

**Frontend** (`integracoes/page.tsx`, aba `tokens`)
7. Substituir o aviso de "desativado" por uma tela real: listar tokens (nome, prefixo, escopos, último uso,
   expiração, status), botão "Criar token" (nome, escopos com explicação em português, validade opcional), exibir o
   token completo uma vez com botão copiar e aviso "não será mostrado novamente", e revogar com confirmação.
   Incluir um **modelo pronto "Integração do site (Troca Fácil)"** que marca `clientes:ler`, `aquisicoes:criar`,
   `produtos:ler`.

**Testes e documentação**
8. Testes unitários: hash/verificação, escopos (permitido/negado), revogado, expirado, usuário inativo, tenant
   suspenso, isolamento entre tenants, token não acessa rotas proibidas. Rode lint, testes e build do backend e do frontend.
9. Documentar no Swagger (`addApiKey`/`@ApiSecurity`) e em `docs/` o formato do token, o header e os escopos.

## Tarefa 2 — Endpoint mínimo de fidelidade (menor privilégio)

Hoje, para saber se um cliente já comprou, o site precisa listar clientes e ler o histórico (muitos dados pessoais).
Criar `GET /api/clientes/fidelidade?cpf_cnpj=...` (permissão `clientes:ler`, throttle baixo) que devolve **somente**:
`{ found: boolean, customer_id?: string, completed_sales_count: number, last_sale_at?: string }`, contando apenas
vendas **não** `CANCELADA`/`CANCELADO`, filtrado pelo tenant, buscando por CPF/CNPJ com e sem máscara (reaproveite a
lógica de `CustomersService.findAll`). Sem nome, telefone, endereço nem valores. Documentar no Swagger com DTO de resposta.

## Tarefa 3 — Documentação do que já existe (somente leitura + relatório)

Sem alterar comportamento: (a) liste os eventos do módulo `webhooks` (o que dispara, payload, assinatura/segredo) e
diga se existe evento de **mudança de estoque** e de **mudança de preço de produto**; (b) tipe no Swagger as respostas
de `POST /api/trade-in/public/{slug}/evaluations`, `PATCH /api/trade-in/evaluations/{id}/review`,
`POST /api/trade-in/evaluations/{id}/convert` e `POST /api/products/entrada-seminovo` (hoje o Swagger mostra
corpo/resposta vazios). Se faltar evento de estoque/preço, **proponha** (não implemente) o desenho.

## Regras

- Produção: nada de migração destrutiva, nada de apagar dados, nada de alterar `.env`.
- Mudanças pequenas e revisáveis; um commit por tarefa (`feat(api-tokens): ...`, `feat(clientes): ...`).
- Se algo no código contradisser este pedido, **pare e relate** em vez de adivinhar.

## Entrega

Ao terminar, responda com: lista de arquivos alterados por tarefa; formato exato do token e do header; como criar um
token pela tela; comandos de teste e resultados (lint/test/build); qualquer decisão que você tomou diferente do pedido e por quê.

---

## Depois que o ERP tiver tokens (lado do site — já preparado)

O site (`lojinhadocelular`) passa a usar `ERP_API_TOKEN` (com `Authorization: Bearer`) em vez de e-mail/senha, e a
consulta de fidelidade passa a usar `GET /api/clientes/fidelidade`. Quando o Codex terminar, traga a resposta da
"Entrega" para ajustarmos o site ao formato final.
