# Lojinha do Celular

Site da Lojinha do Celular (Jardim/MS e Guia Lopes da Laguna/MS): vitrine de aparelhos, **Troca Fácil** (avaliação online de usados), Modo TV e painel administrativo para a equipe.

## Stack

- **Frontend:** React 19, React Router 7, Tailwind CSS 3 + shadcn/ui, TanStack Query, tRPC
- **Backend:** Hono + tRPC (`api/`), Drizzle ORM + MySQL
- **Integrações:** Gestão Celular ERP (catálogo somente leitura), Cloudflare R2/S3 (fotos), webhook/WhatsApp Cloud API (aviso de novas avaliações)
- **Testes:** Vitest (`api/**/*.test.ts`)

## Comandos

```bash
pnpm install       # dependências (pnpm 9.15.9)
pnpm dev           # servidor de desenvolvimento (Vite + API) na porta 3000
pnpm test          # testes
pnpm lint          # ESLint
pnpm check         # TypeScript (tsc -b)
pnpm build         # build de produção em dist/
pnpm start         # roda o build de produção
```

## Variáveis de ambiente

Copie `.env.example` para `.env`. As principais:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | MySQL. Sem ela, usuários, histórico e anotações ficam apenas em memória (somente desenvolvimento). |
| `APP_SECRET` | Assina os tokens de login do painel. **Obrigatória em produção, mínimo de 32 caracteres.** |
| `ERP_API_URL`, `ERP_STORE_SLUG`, `ERP_CATEGORY_SLUG`, `ERP_CATALOG_ENABLED` | Catálogo oficial do Gestão Celular. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Fotos privadas das avaliações. |
| `VITE_CLOUDFLARE_R2_URL`, `CLOUDFLARE_R2_URL` | CDN de imagens dos aparelhos. |
| `EVALUATION_NOTIFICATION_WEBHOOK_URL`, `WHATSAPP_CLOUD_*` | Aviso automático de novas avaliações. |

As tabelas e colunas novas são criadas automaticamente na inicialização (`ensureTables()` em `api/queries/connection.ts`), espelhando `db/schema.ts`.

## Painel administrativo (`/admin`)

### Primeiro acesso

Na primeira inicialização é criado automaticamente o usuário **`dono`**, com a **mesma senha do painel antigo**. Entre com ele, troque a senha em **Minha conta** e cadastre a equipe em **Usuários**.

### Níveis de acesso

| Ação | Dono | Vendedor | Vendedor com "Pode editar preços" |
|---|:-:|:-:|:-:|
| Avaliações: pegar, atender, anotar, status, valores | ✅ | ✅ | ✅ |
| Produtos: fotos, vídeos, bateria, observações, disponibilidade, ocultar | ✅ | ✅ | ✅ |
| Alterar preço | ✅ | ❌ | ✅ |
| Criar, excluir ou destacar produto; nome, categoria, garantia, variantes | ✅ | ❌ | ❌ |
| Reatribuir avaliação para outro vendedor | ✅ | ❌ | ❌ |
| Configurações, usuários, ranking da equipe | ✅ | ❌ | ❌ |

As permissões são verificadas **no servidor** (`contracts/permissions.ts` e `api/permissions.ts`). A interface apenas esconde ou bloqueia o que não é permitido.

### Unidades

Cada vendedor pode pertencer a uma unidade (Jardim ou Guia Lopes da Laguna). O filtro de unidade no topo do painel começa na unidade do usuário e vale para o dashboard, a lista de avaliações e o contador de pendentes. O cliente escolhe a loja no Troca Fácil.

### Telas

- **Início:** avaliações pendentes, atrasadas e atendidas hoje; números do mês (fechadas, taxa de fechamento, total comprado, tempo médio de resposta); "Precisa de atenção" (atrasadas, produtos sem foto, seminovos sem bateria, esgotados visíveis); ranking da equipe (dono); status do ERP; atividade recente.
- **Avaliações:** lista com filtros (status, minhas/sem responsável, atrasadas, busca) e página de detalhe com responsável, negociação (valor oferecido/fechado, motivo de recusa), anotações internas, mensagens prontas de WhatsApp e histórico.
- **Produtos:** catálogo (ERP ou banco local) com editor que respeita as permissões.
- **Usuários** e **Configurações** (dono): equipe, dados da loja, prazo de resposta (SLA) e modelos de mensagem.
- **Histórico:** toda alteração relevante fica registrada (quem, o quê, quando) na tabela `audit_logs`.

## Estrutura

```
src/pages/          telas públicas (Home, Produto, TradeIn, TvMode…)
src/pages/admin/    telas do painel (AdminApp, AdminLayout, Dashboard…)
src/components/     componentes (admin/, ui/ shadcn)
api/                backend Hono + tRPC, serviços e testes
contracts/          tipos e regras compartilhadas (permissões, pendências)
db/                 schema Drizzle e seed
docs/superpowers/   especificações e planos de implementação
```
