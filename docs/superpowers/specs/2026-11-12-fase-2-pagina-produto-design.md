# Fase 2 — Design Spec: Otimização, Conversão Mobile e Modularização da Página do Produto

**Data:** 2026-11-12
**Escopo:** Refatoração modular da página `/produto/:id` (`src/pages/Produto.tsx`), correção de bugs de estado/SEO/acessibilidade, abertura instantânea a partir do cache da vitrine (`shop.products`), galeria interativa com zoom e miniaturas, separação de fluxo WhatsApp vs Sacola, barra sticky mobile (`Opção A`) e exibição de produtos relacionados com cobertura de testes unitários.
**Pré-requisito concluído:** Fase 1 (`3a8b9d4`), incluindo `hydrateQueryClientFromInitialData`, chunks lazy de `/produto/:id` e imagens `-360w.webp` / `srcSet`.

---

## 1. Diagnóstico do estado atual (`src/pages/Produto.tsx`)

1. **`Produto.tsx` com 1.012 linhas:** Concentra parsing de rota/slug, seleção de variantes, geração de mensagens WhatsApp, JSON-LD, tabela de parcelas, vídeo embed, galeria e layout completo no mesmo componente.
2. **Bug de `setState` no corpo do render (linhas 88–97):** Ao navegar entre `/produto/A` e `/produto/B`, o componente executa múltiplos `setState` síncronos durante o render.
3. **Endereço desatualizado no JSON-LD (linha 389):** Emite `"streetAddress": "Rua Marechal Rondon, 620"` em desacordo com o endereço oficial em `index.html` (`"Av. Duque de Caxias, 486"` para Jardim e `"Rua Macias Barbosa, 2185"` para Guia Lopes).
4. **Latência evitável ao sair da vitrine:** Mesmo com `shop.products` já em cache no TanStack Query (e injetado na Home via `__INITIAL_DATA__`), `Produto.tsx` exibe skeleton completo enquanto aguarda o retorno de `shop.product` (~180–350 ms EUA ↔ Brasil).
5. **Acoplamento no botão `Pedir agora` (linhas 875–878):** Clicar em `Pedir agora` chama `handleAddToCart()` junto com `trackInterest()`, adicionando item silenciosamente na sacola e abrindo o `CartDrawer` por baixo da conversa de WhatsApp.
6. **Acessibilidade e conversão mobile:**
   - Alternador de parcelas usa `<p onClick=...>` (inoperável por teclado e sem `aria-expanded`).
   - Em celulares, ao rolar para conferir parcelas, descrição ou especificações, os botões `Adicionar à Sacola` e `Pedir agora` saem da tela.
   - `product.description` não é exibido no corpo da página e `SpecSheet` retorna `null` para Android, iPad, acessórios e iPhones sem ficha em `IPHONE_SPECS`.
   - `versions` (ex.: variantes com mais de uma `version`) não possui seletor na UI quando > 1 opção existe.
   - Falta ação de comparar produto, zoom na foto, miniaturas multi-imagem e seção de produtos relacionados.

---

## 2. Arquitetura Modular Proposta

Separar responsabilidades em 4 arquivos novos e 3 atualizações pontuais:

| Arquivo | Papel |
|---|---|
| `src/lib/productDetail.ts` *(novo)* | Helpers puros sem dependência de DOM/React (compiláveis em Node/Vitest e Vite): parsing seguro de rota/slug, lookup de cache em `shop.products`, derivação/seleção de versão-capacidade-cor, deduplicação de galeria multi-imagens, formatação de parcelas/mensagens, schema JSON-LD por unidade e seleção de até 4 produtos relacionados. |
| `src/lib/stickyCtaState.ts` *(novo)* | Store mínimo com `useSyncExternalStore` informando quando a barra sticky mobile de `/produto/*` está visível, permitindo que `CompareBar` ajuste sua altura inferior sem colisão. |
| `src/components/produto/ProductGallery.tsx` *(novo)* | Coluna visual esquerda: alternador `Foto / Vídeo`, transição suave de imagem ao trocar de cor (sem flash em branco), tira de miniaturas quando houver > 1 imagem única, e modal lightbox acessível para zoom no toque/clique. |
| `src/components/produto/MobileStickyCta.tsx` *(novo)* | Barra fixa inferior (`md:hidden`) controlada por `IntersectionObserver` sobre o container inline de CTAs: exibe preço Pix + resumo curto + botão `+ Sacola` + botão `Pedir` (WhatsApp direto), respeitando `env(safe-area-inset-bottom)` e ocultando-se quando `CartDrawer` estiver aberto ou produto indisponível. |
| `src/components/produto/RelatedProducts.tsx` *(novo)* | Seção "Quem viu também gostou" com até 4 aparelhos disponíveis do cache `shop.products`, usando scroll horizontal com snap no mobile e grid de 4 colunas no desktop, reutilizando `ProductCard`. |
| `src/components/SpecSheet.tsx` *(atualizar)* | Mantém a ficha técnica Apple quando existir em `IPHONE_SPECS`; quando ausente (Android, iPad, JBL, acessórios, modelos novos), renderiza bloco limpo "Detalhes e procedência" com dados reais (`brand`, `category`, `condition`, `description`, `notes`, garantia e verificação técnica da loja) sem inventar especificações não verificadas. |
| `src/components/CompareBar.tsx` *(atualizar)* | Escuta `useProductStickyCtaVisible()` e aplica deslocamento inferior maior no mobile (`bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-4`) enquanto a sticky bar estiver visível. |
| `src/pages/Produto.tsx` *(refatorar)* | Enxugado (~280–340 linhas): renderiza `<ProdutoContent key={routeKey} />` eliminando o `setState` durante render, usa cache de `shop.products` como `initialData` para abertura em `0 ms`, separa `Pedir agora` de `Adicionar à Sacola`, adiciona seletor condicional de `version`, botão de comparar e `<button aria-expanded>` nas parcelas. |
| `api/productDetail.test.ts` *(novo)* | Suíte Vitest Node cobrindo toda a lógica pura de `src/lib/productDetail.ts`. |

---

## 3. Fluxo de Dados, Seleção e Desempenho

### 3.1 Hidratação instantânea em navegação SPA
- Antes da query `trpc.shop.product.useQuery`, consultar `trpc.useUtils().shop.products.getData()` e localizar o item via `findProductInCachedCatalog(cachedList, idStr)`.
- Quando encontrado em cache e `!isDemo`:
  - Passar `initialData: cachedMatch` e `initialDataUpdatedAt: productsQueryUpdatedAt` para `trpc.shop.product.useQuery(..., { staleTime: 30_000 })`.
  - Resultado: ao tocar em um card da vitrine, `/produto/:id` abre imediatamente sem skeleton; se o usuário abrir link direto (WhatsApp/Google), o HTML da Fase 1 já entrega `__INITIAL_DATA__` hidratado (e `fallback` de loading/404 continua preservado para IDs inexistentes).

### 3.2 Eliminação de `setState` no render
- `Produto` extrai `idStr` via `useParams()` e renderiza `<ProdutoContent key={idStr || "invalid"} routeId={idStr} />`.
- Ao navegar para outro produto, o React remonta `ProdutoContent` com estado inicial limpo (`userVersion`, `userStorage`, `userColor`, `userVariantId`, `showAllInstallments`, `mediaTab`, `activeImageIndex`, `zoomOpen`), sem efeitos colaterais no render.

### 3.3 Seleção condicional de Versão, Capacidade e Cor
- `deriveVariantSelection(variants, { version, storage, color, selectedVariantId })` calcula:
  - `versions` únicas; caso `versions.filter(Boolean).length > 1`, a UI exibe chips de versão (`Anatel`, `eSIM`, etc.) acima de Capacidade. Quando houver `<= 1` versão, não exibe o bloco.
  - `storages` e `colors` filtradas pela versão ativa, priorizando variantes com `available && (quantity ?? 1) > 0` em `pickStorage` e `pickColor` (testadas unitariamente).
  - Ao escolher uma cor diferente, `ProductGallery` prioriza a imagem daquela cor/variante antes de eventuais imagens secundárias da lista deduplicada.

### 3.4 Separação `Pedir agora` vs `Adicionar à Sacola` (Opção A)
- **Botão `Adicionar à Sacola`:** Chama `addItem(...)` e abre o `CartDrawer` para compra combinada (ex.: iPhone + capa/carregador).
- **Botão `Pedir agora` (inline e na barra sticky mobile):** Abre `wa.me/<targetWhatsapp>?text=...` com a mensagem do produto/variante e dispara apenas `trackInterest()` — **não** adiciona na sacola nem abre o `CartDrawer`.
- **Botão secundário `Comparar`:** Usa `useCompare().toggle(product.id)` junto ao bloco de ações/compartilhamento, respeitando o limite máximo de 3 itens (`isFull` desabilita com rótulo informativo claro quando atingir 3 outros itens).

---

## 4. Galeria, Ficha Técnica Universal, Sticky Bar Mobile e Relacionados

### 4.1 `ProductGallery`
- `buildProductGalleryImages(product, selectedVariant, selectedColor)`:
  - Coloca a imagem resolvida da variante/cor ativa primeiro (`resolveProductImage(...)`).
  - Acrescenta demais URLs distintas das outras variantes/produto (deduplicadas pela URL normalizada, até o máximo de 6 miniaturas) para permitir inspeção de variações/fotos adicionais sem duplicar `360w`/`612w` equivalentes.
- Transição de troca de cor sem flicker branco: mantém a imagem anterior visível ou usa transição suave de opacidade com `onError` limpando `srcSet` em caso de falha de fallback externo.
- Toque/clique na foto abre modal lightbox fullscreen (`role="dialog"`, `aria-modal="true"`, fechamento por botão `X`, backdrop ou `Escape`).

### 4.2 `MobileStickyCta` & `CompareBar`
- `MobileStickyCta` recebe `ctaContainerRef` (div dos botões inline), `isAvailable`, `isCartOpen`, `cleanTitle`, `variantSummary`, `formattedPrice`, `whatsappHref`, `onAddToCart` e `onTrackInterest`.
- `IntersectionObserver` (`threshold: 0`) detecta quando o container inline saiu acima da tela (`boundingClientRect.top < 0 && !entry.isIntersecting`).
- Exibe a barra apenas quando `scrolledPastInlineCta && isAvailable && !isCartOpen`, usando `md:hidden` e `pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]`.
- Sempre limpa `setProductStickyCtaVisible(false)` no unmount para que outras rotas com `CompareBar` permaneçam na posição padrão.

### 4.3 `SpecSheet` & Descrição do Produto
- Exibir bloco discreto de `product.description` acima da tabela/especificações quando houver texto não vazio.
- Em `SpecSheet`:
  - iPhones presentes em `IPHONE_SPECS`: exibe ficha técnica completa atual (chip, RAM, tela, câmeras, bateria, conector, barra de desempenho).
  - Demais produtos (Android, iPad, acessórios ou iPhones ainda sem entrada em `IPHONE_SPECS`): renderiza card "Detalhes e procedência" exibindo apenas informações reais existentes no produto (`Marca`, `Categoria`, `Observações da versão` quando `selected.notes` existir, `Garantia` e selo de verificação presencial da loja), garantindo ausência de dados inventados.

### 4.4 `RelatedProducts`
- `selectRelatedProducts(allProducts, currentProduct, limit = 4)`:
  - Filtra apenas produtos com estoque disponível (`minPrice(p) != null`), excluindo `currentProduct.id`.
  - Ordena por afinidade: mesma categoria > mesma marca > menor distância de preço > ordem original do catálogo.
  - Renderiza somente quando houver ao menos 1 relacionado encontrado; no mobile usa carrossel horizontal leve (`flex overflow-x-auto snap-x gap-3 -mx-4 px-4 pb-2`) e no `md+` usa `grid grid-cols-2 lg:grid-cols-4 gap-4`.

---

## 5. SEO Local & JSON-LD

- `buildProductJsonLd(...)`:
  - `streetAddress`:
    - Se `unitAvailability === "guia_lopes"`: usa `settings.addressGll` (normalizado) ou fallback `"Rua Macias Barbosa, 2185"`, `addressLocality: "Guia Lopes da Laguna"`, `postalCode: "79230-000"`, `telephone: "+55-67-99820-6533"`.
    - Caso contrário (`jardim` ou `ambas`): usa `settings.addressJardim` ou fallback `"Av. Duque de Caxias, 486"`, `addressLocality: "Jardim"`, `postalCode: "79240-000"`, `telephone: "+55-67-99208-6012"`.

---

## 6. Critérios de Aceite & Testes

1. **Testes unitários novos (`api/productDetail.test.ts`):**
   - Lookup de cache em `shop.products` por ID numérico, UUID e share slug (`nome-id-12` e `nome-1234abcd`).
   - Seleção de versão/armazenamento/cor respeitando estoque e trocas válidas (`pickStorage`, `pickColor`).
   - Deduplicação da galeria mantendo imagem ativa em primeiro lugar.
   - `buildProductJsonLd` gerando `Av. Duque de Caxias, 486` para Jardim/`ambas` e `Rua Macias Barbosa, 2185` para `guia_lopes` (nunca `"Rua Marechal Rondon, 620"`).
   - Ranking de relacionados excluindo o item atual, ignorando esgotados e respeitando limite de 4.
2. **Checagens obrigatórias:** `pnpm test`, `pnpm check`, `pnpm lint` (`0` erros), `pnpm build`.
3. **Integridade funcional:**
   - Zero `setState` síncrono em render em `Produto.tsx`.
   - Botão de parcelas é `<button type="button" aria-expanded={...}>`.
   - Clicar em `Pedir agora` não adiciona item à sacola.
   - Barra sticky mobile não sobrepõe `CompareBar` nem o `CartDrawer`.
