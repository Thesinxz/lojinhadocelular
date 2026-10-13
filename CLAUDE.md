# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Repository conventions (structure, style, commit/PR format) live in `AGENTS.md`; product/admin overview and env vars in `README.md`. Project content (UI text, docs, specs) is in Brazilian Portuguese.

## Commands

Uses pnpm 9.15.9.

- `pnpm dev` — Vite + API together on port 3000 (the Hono app is mounted in Vite via `@hono/vite-dev-server`; only `/api/*` goes to Hono)
- `pnpm test` — Vitest once (Node env, `api/**/*.test.ts` only; there are no frontend tests)
- Single test: `pnpm exec vitest run api/valuation.test.ts` or `pnpm exec vitest run -t "name"`
- `pnpm lint` / `pnpm check` (`tsc -b`) / `pnpm build` / `pnpm start` (runs `dist/boot.js`)
- `pnpm db:generate | db:migrate | db:push` — Drizzle (MySQL)

## Architecture

**Single deployable**: React 19 SPA (`src/`, React Router 7, TanStack Query, shadcn/ui) + Hono server (`api/boot.ts`) exposing tRPC at `/api`. `pnpm build` emits the SPA to `dist/public` and bundles `api/boot.ts` with esbuild into `dist/boot.js`, which also serves the static files, images, and security/CORS headers. Aliases `@/`, `@contracts`, `@db` are shared by Vite, Vitest, and tsconfig.

**tRPC**: `api/router.ts` combines `shopRouter` (`api/shop.ts`, public: catalog, cart, Troca Fácil submissions, rate-limited) and `adminRouter` (`api/admin.ts`, plus `admin*.ts` modules). Admin procedures use `adminProcedure` (`api/middleware.ts`), which re-loads the user from the token on every request. Permissions (dono / vendedor / "pode editar preços") are enforced **server-side** via `contracts/permissions.ts` + `api/permissions.ts`; the UI only hides things. Transformer is superjson.

**`contracts/`** holds types/errors/rules shared by `src/` and `api/` (permissions, valuation types, loyalty, catalog issues, BR docs). Put anything both sides need here.

**Valuation (Troca Fácil) runs on the server**: `api/valuation/` (`engine.ts`, `tables.ts`, `config.ts`, `priceList.ts`) computes trade-in estimates; price tables and rules must not ship to the browser (see `valuationSecurity.test.ts`). The engine imports a few helpers from `src/lib/iphoneKeys.ts` / `iphoneCatalog.ts`. The site does the pre-evaluation; the ERP does the in-store conferência (no price-table sync to the ERP).

**Data layer**: Drizzle schema in `db/schema.ts`. Tables are also auto-created/altered at startup by `ensureTables()` in `api/queries/connection.ts`, so **schema changes must be mirrored in both** `db/schema.ts` and `ensureTables()` (not only via drizzle migrations). Without `DATABASE_URL`, stores such as `api/services/settingsStore.ts` and the user/evaluation stores fall back to in-memory/file data (dev only) — services are written to work in both modes and tests rely on that.

**Catalog**: the Gestão Celular ERP (`api/erp/`) is the read-only official catalog source; local overrides live in `db/erp_overrides.json` / `api/erp/overrides.ts`. The same ERP client handles optional seminovo acquisition entry and loyalty bonus (needs `ERP_API_TOKEN` or service credentials; disabled otherwise). See `docs/codex/` for ERP notes and `docs/plano-de-acao-gestao-celular.md` for the roadmap.

**Services** (`api/services/`): evaluation store/notes/photos (private S3/R2 via presigned URLs), notifications (webhook > Evolution API > WhatsApp Cloud), auto/batch messages, retention (LGPD data deletion), audit log (`audit_logs`), catalog history.

**Frontend routing** (`src/App.tsx`): public pages in `src/pages/`, admin panel lazy-loaded from `src/pages/admin/AdminApp`; `/tv*` is Modo TV; a hostname containing `trocafacil` switches the site into Troca Fácil mode. Admin session handling is in `src/lib/adminSession.ts`.

## Scope

The system is exclusive to Lojinha do Celular. Don't build white-label/multi-tenant; just avoid adding new hardcoded store values (use settings/config).

`dist/`, `scratch/`, and the root `.mp4` are not source; don't edit or commit `.env`.
