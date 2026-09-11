# Redesign do Rodapé (Apple Clean Flagship) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformular completamente o rodapé do site da Lojinha do Celular para o padrão visual Apple Clean Flagship, com barra de benefícios, cards e contatos das unidades físicas, banner de pagamento oficial com bandeiras e Pix, gaveta retrátil de SEO local e conformidade jurídica/CNPJ.

**Architecture:** Modificação integral de `src/components/Footer.tsx` preservando os dados dinâmicos do hook `useShopSettings()`, integrando a imagem oficial `/images/payment-methods.png` e estruturando uma gaveta interativa com estado React (`useState`) para os termos de SEO.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React (`ShieldCheck`, `PackageCheck`, `CreditCard`, `MessageCircle`, `MapPin`, `Phone`, `Clock`, `Instagram`, `ChevronDown`), Vite.

## Global Constraints

- Manter 2 espaços de indentação e seguir convenções do ESLint/Prettier do projeto.
- Utilizar os aliases `@/` e `@contracts` conforme diretrizes em `AGENTS.md`.
- Garantir que todos os termos de busca (iPhone Lacrado, Seminovo, Assistência, cidades do MS) continuem no DOM para indexação pelo Google.
- Preservar responsividade fluida em Mobile, Tablet e Desktop.

---

### Task 1: Implementar o novo componente `Footer.tsx`

**Files:**
- Modify: `src/components/Footer.tsx`
- Reference Asset: `public/images/payment-methods.png`
- Reference Asset: `public/images/logo-icon.png`

**Interfaces:**
- Consumes: `useShopSettings()`, `waLink()` de `@/lib/shop`
- Produces: Default export `<Footer />` para uso no layout em `src/App.tsx`

- [ ] **Step 1: Implementar a nova estrutura de `src/components/Footer.tsx`**
  - Adicionar estado `isSeoOpen` via `useState(false)` para controlar a gaveta retrátil de cidades e marcas.
  - Implementar a barra de benefícios superior com ícones Lucide.
  - Implementar as 4 colunas principais (Marca, Unidade Jardim, Unidade Guia Lopes, Departamentos).
  - Implementar a faixa de pagamentos com `/images/payment-methods.png`, selo SSL e CNPJ.
  - Implementar a gaveta colapsável de SEO e o sub-footer de copyright.

- [ ] **Step 2: Verificar compilação TypeScript**
  Run: `pnpm check`
  Expected: PASS sem erros de tipos.

- [ ] **Step 3: Verificar linting do projeto**
  Run: `pnpm lint`
  Expected: PASS sem avisos ou erros.

- [ ] **Step 4: Executar build de produção do Vite**
  Run: `pnpm build`
  Expected: Build concluído com sucesso em `dist/`.

- [ ] **Step 5: Commit das alterações do componente**
  ```bash
  git add src/components/Footer.tsx
  git commit -m "feat(ui): implementa novo rodape apple clean flagship com selos e gaveta seo"
  ```

---

### Task 2: Verificação visual e validação do rodapé em funcionamento

**Files:**
- Test Artifact: `/Users/marlon/.gemini/antigravity/brain/380af6f7-4d0a-40e4-a963-2a82e984381b/footer_final_validation.png`

- [ ] **Step 1: Iniciar servidor Vite de pré-visualização ou dev em background**
  Run: `pnpm build` e `pnpm preview` (ou renderização direta)

- [ ] **Step 2: Capturar screenshot da página com o novo rodapé aplicado**
  Run: Headless Chrome screenshot do rodapé renderizado na aplicação

- [ ] **Step 3: Inspecionar o screenshot e confirmar proporções, alinhamentos e contraste**
  Verificar se `/images/payment-methods.png` carrega perfeitamente e os textos estão legíveis.
