# Catálogo & Vitrine BLK Store — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a experiência inicial da Lojinha do Celular em uma vitrine de alta conversão inspirada na BLK Store, com tema dark refinado estilo Apple, vídeo cinematográfico no Hero, prova social contínua, vitrine integrada na Home com busca e pílulas de categorias, cards modernos e compra direta pelo WhatsApp.

**Architecture:** A Home (`src/pages/Home.tsx`) torna-se a vitrine centralizada, integrando o Hero com vídeo silencioso em loop e marquee de clientes (`src/components/HeroBlk.tsx`), barra de busca e ordenação em tempo real com chips de categoria, grid de produtos dark (`src/components/ProductCard.tsx`) e página de detalhes (`src/pages/Produto.tsx`) otimizada para simulação de parcelas e checkout no WhatsApp. Header e Footer são alinhados ao tema escuro.

**Tech Stack:** React 19, Vite, Tailwind CSS, Lucide React, tRPC, TypeScript, Hono.

## Global Constraints

- Manter compatibilidade com os tipos compartilhados em `@contracts/types.ts`.
- Preservar as rotas existentes (`/admin`, `/tv`, `/avaliacao`, `/troca`, `/produto/:id`).
- Fundo escuro principal `#0a0a0a` com superfícies `#121212` e `#18181b` e bordas sutis `border-white/10`.
- O vídeo do Hero deve rodar em loop silencioso sem travar no iOS Safari (`playsInline`, `muted`, `autoPlay`) com poster fallback.
- Testes automatizados com Vitest e validação com `pnpm check` e `pnpm lint`.

---

### Task 1: Assets do Hero (Vídeo e Poster) e Dados de Demonstração

**Files:**
- Create: `public/hero.mp4` (baixar loop cinematográfico demonstrativo)
- Create: `public/hero-poster.jpg` (poster de fallback em alta resolução)
- Create: `src/lib/catalogDemo.ts` (dados complementares de modelos Apple e clientes para o marquee)
- Test: `api/catalog.test.ts`

**Interfaces:**
- Produces: `DEMO_PRODUCTS: ProductWithVariants[]`, `DEMO_CLIENTS: { id: string; name: string; bought: string; avatarUrl: string }[]`

- [ ] **Step 1: Baixar ou preparar os assets de vídeo e poster no diretório `public/`**

Executar comando para baixar o vídeo cinematográfico demonstrativo e o poster:
```bash
curl -s -L https://blkstore.com.br/hero.mp4 -o public/hero.mp4
curl -s -L https://blkstore.com.br/hero-poster.jpg -o public/hero-poster.jpg
```

- [ ] **Step 2: Criar arquivo de dados demonstrativos e clientes (`src/lib/catalogDemo.ts`)**

Criar lista de clientes para a prova social (marquee) e catálogo complementar com fotos em alta definição dos iPhones 13 a 16 Pro Max.

```typescript
export interface ClientReview {
  id: string;
  name: string;
  bought: string;
  avatarUrl: string;
}

export const DEMO_CLIENTS: ClientReview[] = [
  {
    id: "1",
    name: "Lucas Moreira",
    bought: "iPhone 15 Pro Max 256GB",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "2",
    name: "Mariana Souza",
    bought: "iPhone 13 128GB Estelar",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "3",
    name: "Carlos Eduardo",
    bought: "iPhone 14 Pro 128GB Roxo",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "4",
    name: "Beatriz Lima",
    bought: "iPhone 15 128GB Rosa",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "5",
    name: "Rafael Mendes",
    bought: "iPhone 16 Pro 256GB Titânio",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
  },
];
```

- [ ] **Step 3: Criar teste para validar a integridade dos dados demonstrativos**

Arquivo `api/catalog.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { DEMO_CLIENTS } from "../src/lib/catalogDemo";

describe("Catalog Demo Data", () => {
  it("deve carregar a lista de clientes para a prova social", () => {
    expect(DEMO_CLIENTS.length).toBeGreaterThanOrEqual(3);
    DEMO_CLIENTS.forEach((c) => {
      expect(c.name).toBeTruthy();
      expect(c.bought).toBeTruthy();
      expect(c.avatarUrl).toBeTruthy();
    });
  });
});
```

- [ ] **Step 4: Rodar o teste e validar**

Run: `pnpm test api/catalog.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/hero.mp4 public/hero-poster.jpg src/lib/catalogDemo.ts api/catalog.test.ts
git commit -m "feat(catalog): adiciona assets do hero e dados de demonstracao e clientes"
```

---

### Task 2: Componente HeroBlk com Vídeo de Fundo e Marquee

**Files:**
- Create: `src/components/HeroBlk.tsx`
- Modify: `src/index.css` (adicionar animação de marquee contínuo se necessário)

**Interfaces:**
- Consumes: `DEMO_CLIENTS` de `@/lib/catalogDemo`, `useShopSettings` de `@/lib/shop`
- Produces: `<HeroBlk />` para ser renderizado no topo da Home

- [ ] **Step 1: Adicionar estilos de animação para o Marquee no `src/index.css`**

Inserir classe `@keyframes marquee` no CSS para rolagem suave ininterrupta:
```css
@keyframes marquee {
  0% { transform: translateX(0%); }
  100% { transform: translateX(-50%); }
}
.animate-marquee {
  display: flex;
  width: max-content;
  animation: marquee 25s linear infinite;
}
.animate-marquee:hover {
  animation-play-state: paused;
}
```

- [ ] **Step 2: Implementar o componente `src/components/HeroBlk.tsx`**

Inclui:
- Player de `<video>` com `autoPlay`, `muted`, `loop`, `playsInline`, `poster="/hero-poster.jpg"`.
- Event listeners para garantir reprodução em primeiro toque/scroll no iOS Safari.
- Gradiente escuro de sobreposição: `bg-gradient-to-b from-black/75 via-black/45 to-[#0a0a0a]`.
- Título em display grande, subtítulo nítido.
- 3 botões de ação:
  1. `Ver vitrine ↓` (link para `#vitrine`).
  2. `Falar no WhatsApp` (link para o WhatsApp oficial da Lojinha).
  3. `Avaliar meu iPhone` (link para `/avaliacao`).
- Faixa de Prova Social com os clientes de `DEMO_CLIENTS` em pílulas translúcidas com blur.

- [ ] **Step 3: Verificar visualização e build**

Run: `pnpm check`  
Expected: Sem erros de tipagem.

- [ ] **Step 4: Commit**

```bash
git add src/components/HeroBlk.tsx src/index.css
git commit -m "feat(hero): cria componente HeroBlk com video de fundo, acoes e marquee de clientes"
```

---

### Task 3: Card de Produtos Estilo BLK Store

**Files:**
- Modify: `src/components/ProductCard.tsx`

**Interfaces:**
- Consumes: `ProductWithVariants`, `FeeTable`, `installmentsMax`
- Produces: `<ProductCard />` com design Dark Mode Apple

- [ ] **Step 1: Atualizar `src/components/ProductCard.tsx`**

- Alterar o fundo do card para `#141414`, borda sutil `border-white/10`, hover `hover:border-white/25 hover:scale-[1.01]`.
- Container da foto: fundo limpo com contraste suave (`bg-white/[0.03]`), proporção quadrada, cantos arredondados.
- Selos superiores discretos com fundo escuro e borda fina:
  - `✨ Lacrado` ou `🔄 Seminovo`.
  - `🔋 Saúde 100%` ou porcentagem real da variante.
  - `🛡️ 1 Ano`.
- Bolinhas com paleta de cores reais do modelo.
- Preço com destaque:
  - Tag `"PIX"` ou `"% OFF no Pix"`.
  - Valor à vista em tipografia grande e branca.
  - Linha de parcelamento: `ou 12x de R$ ... no cartão`.

- [ ] **Step 2: Verificar validação com TypeScript**

Run: `pnpm check`  
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProductCard.tsx
git commit -m "feat(ui): moderniza ProductCard para o estilo dark mode premium da BLK Store"
```

---

### Task 4: Storefront Integrada na Home com Busca e Pílulas

**Files:**
- Modify: `src/pages/Home.tsx`

**Interfaces:**
- Consumes: `HeroBlk`, `ProductCard`, `trpc.shop.products`, `DEMO_PRODUCTS`
- Produces: Vitrine completa e interativa na rota raiz (`/`)

- [ ] **Step 1: Atualizar `src/pages/Home.tsx`**

- Renderizar `<HeroBlk />` no topo.
- Criar a seção `#vitrine` logo abaixo com fundo `#0a0a0a`:
  - Barra de busca arredondada (`rounded-full bg-[#18181b] border border-white/10 text-white placeholder:text-neutral-500`) com ícone de lupa.
  - Seletor de ordenação: *Menor preço*, *Maior preço*, *Novidades / Lançamentos*.
  - Pílulas de filtro de categorias:
    - *Todos*
    - *iPhones Lacrados* (`iphone_lacrado`)
    - *iPhones Seminovos* (`iphone_seminovo`)
    - *Xiaomi & Android* (`android`)
    - *Acessórios* (`acessorio`)
- Grid de produtos exibindo o inventário do banco de dados + produtos demonstrativos integrados.
- Estado de busca vazia elegante com convite direto para falar no WhatsApp.
- Seções de apoio mantidas no final com visual dark integrado: Nossas Unidades (`#unidades`) e Serviços de Assistência Técnica (`#servicos`).

- [ ] **Step 2: Verificar build e tipagem**

Run: `pnpm check`  
Expected: Sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat(storefront): integra vitrine com busca, filtros em pilulas e grid na Home"
```

---

### Task 5: Página de Detalhes do Produto no Padrão BLK Store

**Files:**
- Modify: `src/pages/Produto.tsx`

**Interfaces:**
- Consumes: `trpc.shop.product`, `useShopSettings`
- Produces: Página de produto (`/produto/:id`) com tema dark Apple e checkout direto no WhatsApp

- [ ] **Step 1: Atualizar `src/pages/Produto.tsx`**

- Container principal com fundo escuro `#0a0a0a` e texto branco.
- Botão de voltar sutil: `← Loja` voltando para a vitrine.
- Box da foto do aparelho: container arredondado limpo (`rounded-3xl bg-white p-6 md:p-8 flex items-center justify-center`) para valorizar o produto.
- Badges claros de condição, bateria e garantia.
- Seletores visuais de capacidade (botões pílula ativos/inativos) e seleção de cor.
- Bloco de preço:
  - Selo verde de desconto Pix.
  - Preço grande à vista.
  - Simulação de parcelas no cartão com expansor para visualizar todas as parcelas de 1x a 12x/18x.
- Botão largo de WhatsApp:
  - Fundo verde `#25D366` com ícone do WhatsApp.
  - Mensagem automática gerada com todos os dados: modelo, capacidade, cor, condição e preço.
- Botão secundário de Trade-In: `Avaliar meu aparelho na troca` (link para `/avaliacao`).

- [ ] **Step 2: Verificar validação TypeScript**

Run: `pnpm check`  
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Produto.tsx
git commit -m "feat(produto): reformula pagina de detalhes com design dark Apple e checkout WhatsApp"
```

---

### Task 6: Header e Footer em Dark Mode Sofisticado

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Footer.tsx`
- Modify: `src/App.tsx` (ajustar fundo base para `bg-[#0a0a0a]`)

**Interfaces:**
- Produces: Cabeçalho e Rodapé perfeitamente integrados com a vitrine escura

- [ ] **Step 1: Atualizar `src/components/Header.tsx`**

- Fundo escuro com blur: `bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10`.
- Textos dos links em branco e cinza claro com hover elegante.
- Botão de WhatsApp estilo pílula verde ou translúcida.

- [ ] **Step 2: Atualizar `src/components/Footer.tsx`**

- Fundo `#050505` com divisor sutil `border-t border-white/10`.
- Endereços das unidades de Jardim-MS e Guia Lopes da Laguna organizados com tipografia refinada.
- Links rápidos e redes sociais.

- [ ] **Step 3: Ajustar container principal em `src/App.tsx`**

- Trocar `bg-white` por `bg-[#0a0a0a] text-white`.

- [ ] **Step 4: Verificar validação e lint**

Run: `pnpm check && pnpm lint`  
Expected: Sem erros ou avisos impeditivos.

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/components/Footer.tsx src/App.tsx
git commit -m "feat(theme): unifica Header, Footer e base da aplicacao no tema dark premium"
```

---

### Task 7: Verificação Geral, Testes e Polimento

**Files:**
- Test: Vitest + TypeScript + Build

- [x] **Step 1: Rodar os testes da suíte**

Run: `pnpm test`  
Expected: Todos os testes passando com sucesso.

- [x] **Step 2: Rodar build de produção**

Run: `pnpm build`  
Expected: Build concluído sem falhas no diretório `dist/`.

- [x] **Step 3: Commit final**

```bash
git commit --allow-empty -m "chore: finaliza integracao da vitrine no padrao blk store"
```
