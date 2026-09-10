# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the React frontend: route-level screens live in `src/pages/`, reusable UI in `src/components/`, shared browser logic in `src/lib/` and `src/hooks/`, and global styles in `src/index.css`.
- `api/` contains the Hono backend, including auth, middleware, shop/admin handlers, and API tests. Shared request/response types and errors are in `contracts/`.
- `db/` contains the Drizzle schema, relations, seed data, and generated migrations. Static assets belong in `public/images/`; demo mockups are in `public/mockups/`.
- `vite.config.ts`, `vitest.config.ts`, `tailwind.config.js`, and `eslint.config.js` define the development toolchain. Do not edit `dist/` by hand.

## Build, Test, and Development Commands

Use pnpm (the project pins pnpm `9.15.9`) and install dependencies with `pnpm install`.

- `pnpm dev` — start the Vite development server with HMR.
- `pnpm build` — build the frontend and bundle `api/boot.ts` into `dist/`.
- `pnpm start` — run the production bundle after a successful build.
- `pnpm lint` — run ESLint across the repository.
- `pnpm check` — run TypeScript project checks (`tsc -b`).
- `pnpm test` — run Vitest tests once; use `pnpm exec vitest` for watch mode.
- `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:push` — generate, apply, or push Drizzle schema changes as appropriate.

## Coding Style & Naming Conventions

Write TypeScript with 2-space indentation and follow the existing Prettier/ESLint configuration. Use `PascalCase` for React components and page files, `camelCase` for functions, hooks, and variables, and descriptive lowercase migration names. Prefer the configured aliases (`@/`, `@contracts`, `@db`) over fragile relative imports. Keep UI components composable and preserve existing Tailwind utility conventions.

## Testing Guidelines

Vitest runs Node-based tests matching `api/**/*.test.ts` or `api/**/*.spec.ts`. Name tests after the behavior they cover and group cases with `describe` blocks, as in `api/auth.test.ts`. Run `pnpm test`, `pnpm lint`, and `pnpm check` before submitting changes. No coverage threshold is currently configured.

## Commit & Pull Request Guidelines

Use concise Conventional Commit-style subjects, optionally scoped, such as `feat(seo): ...`, `fix(deploy): ...`, or `fix(compatibility): ...`. Pull requests should explain the user or operational impact, list validation commands, link related issues, and call out database or configuration changes. Include screenshots or recordings for visible frontend changes and document any required environment variables; never commit secrets.
