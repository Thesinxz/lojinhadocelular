# Fase 3 — Vitrine & Loja Mobile Design Spec

**Data:** 2026-11-12
**Objetivo:** Otimizar velocidade percebida, ergonomia touch mobile (`360px–414px`), conversão e higiene de código da página inicial (`/`), vitrine de produtos, cards e shell da loja (`Header`, `CartDrawer`, `WhatsAppModal`) para usuários no Mato Grosso do Sul em redes móveis com ~180 ms RTT até o servidor nos EUA.

---

## 1. Diagnóstico e Escolhas Aprovadas (Opções A)

Durante a auditoria de `src/pages/Home.tsx`, `src/components/ProductCard.tsx`, `src/components/HeroBlk.tsx`, `src/components/Header.tsx`, `src/components/CartDrawer.tsx` e `src/components/WhatsAppModal.tsx`, identificamos os principais gargalos:

1. **Bug silencioso em faixas de preço (`Home.tsx`):** `minPrice(p)` retorna valores em **centavos** (`priceCash`, ex.: `339000` para R$ 3.390,00), mas `PRICE_RANGES` comparava contra `2000`, `4000`, `7000` reais — fazendo `"Até R$ 2.000"`, `"R$ 2.000 – 4.000"` e `"R$ 4.000 – 7.000"` retornarem 0 celulares, enquanto `"Acima de R$ 7.000"` aceitava qualquer item acima de R$ 70,00.
2. **Hero mobile alto demais (`HeroBlk.tsx`):** `min-h-[580px]` + header ocupam quase toda a viewport inicial no celular, escondendo `#vitrine`.
3. **Densidade excessiva em `ProductCard` (`grid-cols-2`):** até 3 selos empilhados no canto da foto (`PROMOÇÃO`, `Lacrado`/`Seminovo`, `📍 Unidade`), texto longo de preço/parcelamento quebrando em várias linhas e 2 botões full-width empilhados (`+ Adicionar` + `Comparar`).
4. **DOM pesado e barra de filtros limitada (`Home.tsx`):** toda `filteredProducts` monta de uma vez no DOM sem lotes; carregamento mostra apenas texto simples causando salto de layout; não há filtro por unidade (`Jardim` / `Guia Lopes`), limpeza rápida na busca nem botão colapsável para preço/capacidade; `?categoria=iphones` não é reconhecido pela leitura da URL e seleções não atualizam os search params; cards das unidades usam números WhatsApp fixos em texto no lugar de `settings`; copy desatualizada (`"iPhone 11 ao iPhone 16 Pro Max"`).
5. **Acessibilidade/touch no shell (`Header`, `CartDrawer`, `WhatsAppModal`):** alvos menores que 40px no botão da sacola no header e nos botões `-`/`+` da sacola; ausência de fechamento via tecla `Escape` e semântica `role="dialog"`.

Decisões confirmadas pelo usuário:
- **Cards e Hero (Opção A):** hero mais compacto no mobile, máximo 2 selos na foto do card, parcelamento conciso, **1 CTA principal (`+ Sacola`) + botão compacto de Comparar ao lado**.
- **Filtros e Catálogo (Opção A):** pílulas principais visíveis (**Categoria** + **Unidade**), botão colapsável **`Filtros (N)`** para faixa de preço e armazenamento (`GB`), sincronização na URL (`?categoria=`, `?unidade=`, etc.), grid com skeletons no loading e carregamento em lotes (`"Ver mais"` de 12 em 12).

---

## 2. Arquitetura e Módulos

### 2.1 Lógica pura & testável (`src/lib/vitrineFilters.ts` + `api/vitrineFilters.test.ts`)

Módulo puro TypeScript (compatível com Vitest Node em `tsconfig.server.json`, sem globais de DOM):

- **`VITRINE_BATCH_SIZE = 12`** (divisível por 2, 3 e 4 colunas — evita buracos assimétricos no final das linhas em todos os breakpoints).
- **`PRICE_RANGES` em centavos:**
  - `todos`: `0` .. `Infinity`
  - `ate2`: `0` .. `200_000` (Até R$ 2.000)
  - `2a4`: `200_000` .. `400_000` (R$ 2.000 – R$ 4.000)
  - `4a7`: `400_000` .. `700_000` (R$ 4.000 – R$ 7.000)
  - `7mais`: `700_000` .. `Infinity` (Acima de R$ 7.000)
- **URL Search Params (`parseVitrineSearchParams`, `buildVitrineSearchParams`):**
  - Parâmetros suportados: `categoria` (`iphones`, `iphone_lacrado`, `iphone_seminovo`, `android`, `acessorio`), `unidade` (`jardim`, `guia_lopes`), `faixa` (`ate2`, `2a4`, `4a7`, `7mais`), `gb`, `ordem` (`menor_preco`, `maior_preco`, `modelo_recente`), `q`.
  - Valores padrão são omitidos ao serializar URL.
- **Filtro por Unidade (`matchesUnitAvailability(product, unit)`):**
  - Se `unit === "todas"`, retorna `true`.
  - Se há variantes disponíveis com `unitAvailability` definido: aceita se alguma variante disponível tiver `v.unitAvailability === unit || v.unitAvailability === "ambas"`.
  - Caso contrário, avalia `product.unitAvailability`: `"ambas"` casa com qualquer unidade; `"indisponivel"` nunca casa; `undefined` faz fallback seguro para `"jardim"`.
- **Busca e filtragem unificadas (`filterVitrineProducts`, `extractStorageOptions`, `countSecondaryFilters`):**
  - Busca normalizada sem acentos (`NFD`) em `name`, `brand`, `storage`, `version` e `color`.
  - `countSecondaryFilters(state)` soma filtros ativos dentro da gaveta colapsável (`faixa !== "todos"` e `gb !== ""`).
- **Priorização de selos e lotes (`selectProductCardBadges`, `sliceVitrineBatch`):**
  - `selectProductCardBadges(product)` separa:
    - `photoBadges` (máx. **2** dentro da imagem): `PROMOÇÃO` (quando `featured`) + condição (`Seminovo` ou `Lacrado`).
    - `unitTag`: `"Guia Lopes"` (quando `unitAvailability === "guia_lopes"`) ou `"2 Lojas"` (quando `unitAvailability === "ambas"`), exibido fora da foto na faixa de metadados do card.

### 2.2 Hero e Vitrine (`src/components/HeroBlk.tsx`, `src/pages/Home.tsx`)

- **`HeroBlk.tsx`:** altura mínima ajustada no mobile (`min-h-[430px] sm:min-h-[580px] md:min-h-[680px]`), `py-10 sm:py-16` e espaçamentos responsivos mais justos para revelar `#vitrine` mais cedo sem cortar o conteúdo nem perder contraste sobre o poster/vídeo.
- **`Home.tsx`:**
  - Lê estado inicial via `parseVitrineSearchParams(searchParams)` e mantém sincronia ao navegar por links externos (`searchParams`) e ao alterar filtros (`setSearchParams(..., { replace: true })`), preservando o padrão visual atual.
  - Campo de busca recebe botão claro `"X"` quando preenchido.
  - Linha 1 de chips: **Categorias** (`Todos`, `iPhones`, `Lacrados`, `Seminovos`, `Android`, `Acessórios`).
  - Linha 2 de chips: **Unidades** (`Todas`, `Jardim`, `Guia Lopes`) + botão **`Filtros (N)`** (`aria-expanded`, abre faixa de preço e armazenamento `GB` em linha separada e legível sem cortar à direita) + **`Limpar filtros`** visível sempre que houver filtro ativo.
  - Carregamento: renderiza 6 `ProductCardSkeleton` no mesmo grid `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.
  - Paginação local: exibe `visibleCount` (inicial 12, reseta para 12 ao mudar filtro/busca/ordenação) com botão **`Ver mais produtos (restam N)`**.
  - Cards de unidades (`#unidades`): usam `waLink(s.whatsappJardim || "5567992086012", ...)` e `waLink(s.whatsappGll || "5567998206533", ...)` em vez de números fixos no código.
  - Guia local (Card 1): atualiza copy `"Modelos do iPhone 11 ao iPhone 16 Pro Max com pronta entrega"` para texto abrangente atual (`"Linha completa do iPhone 11 aos lançamentos atuais com pronta entrega"`).

### 2.3 ProductCard e Skeleton (`src/components/ProductCard.tsx`, `src/components/ProductCardSkeleton.tsx`)

- Máx. 2 selos no canto superior esquerdo da foto (`PROMOÇÃO`, `Seminovo`/`Lacrado`).
- Linha superior de metadados traz Marca + chip compacto de Unidade (`📍 Guia Lopes` / `📍 2 Lojas`) ou bolinhas de cor sem disputar espaço com o aparelho.
- Preço Pix em destaque (`formatBRL(price)` + `à vista no Pix`, complemento `· 12% de desconto aplicado` apenas `sm:inline`), e linha curta de cartão (`ou {N}x de {valor} sem juros`).
- Ações alinhadas na base em linha única:
  - CTA principal `flex-1` (`+ Sacola` / `Consultar`);
  - Botão compacto `Comparar` (`w-10 h-10` com ícone + estado visual ativo/lotado e `aria-label` acessível) ao lado direito, reduzindo altura total do card no mobile em ~44 px.

### 2.4 Shell da Loja (`Header.tsx`, `CartDrawer.tsx`, `WhatsAppModal.tsx`)

- **`Header.tsx`:** hit-area mobile do botão de sacola aumentada para `h-10 w-10`; menu mobile fecha ao pressionar `Escape`.
- **`CartDrawer.tsx`:** fecha com `Escape`, `role="dialog" aria-modal="true"`, botões de quantidade `-`/`+` com área mínima confortável (`h-7 w-7`), `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]` no rodapé e pré-seleção inicial da unidade (`jardim` / `gll`) respeitando `?unidade=guia_lopes` caso o usuário abra a sacola enquanto filtra pela loja de Guia Lopes.
- **`WhatsAppModal.tsx`:** fecha com `Escape` e `role="dialog" aria-modal="true"`.

---

## 3. Verificação e Não-Escopo

- **Testes automatizados (Vitest Node):** `api/vitrineFilters.test.ts` cobrindo centavos de `PRICE_RANGES`, parse/build de search params (incluindo `iphones` e `unidade`), filtro de unidade por produto e variante, busca sem acentos, contagem de filtros secundários, regras de máx. 2 badges + tag de unidade, e slicing de lotes de 12 itens.
- **Verificação completa antes de concluir a fase:** `pnpm test && pnpm check && pnpm lint && pnpm build`.
- **Fora de escopo nesta fase:** painel `/admin` (Fase 4), backend ERP (`api/shop.ts`, `api/erp/`), subdomínio Troca Fácil (`TradeIn.tsx`).
