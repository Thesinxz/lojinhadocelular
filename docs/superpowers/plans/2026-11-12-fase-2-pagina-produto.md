# Fase 2 — Página do Produto (`/produto/:id`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularizar e otimizar `src/pages/Produto.tsx` com abertura instantânea pelo cache da vitrine (`0 ms` na navegação SPA), correção de bugs de estado/SEO/acessibilidade, galeria com miniaturas e lightbox, ficha técnica universal, produtos relacionados e fluxo mobile com barra sticky inferior e WhatsApp desacoplado da sacola (`Opção A`).

**Architecture:** Toda a lógica pura (parsing de slug, lookup em cache, derivação/seleção de variantes, deduplicação de galeria, JSON-LD por unidade e ranking de relacionados) é isolada em `src/lib/productDetail.ts` sem dependência de DOM para ser testada diretamente pelo Vitest Node (`api/productDetail.test.ts`). A interface passa a ser composta por `ProductGallery`, `MobileStickyCta` (coordenado com `CompareBar` via `stickyCtaState.ts`), `SpecSheet` universal e `RelatedProducts`, deixando `src/pages/Produto.tsx` como orquestrador fino (~300 linhas) sem `setState` no corpo do render.

**Tech Stack:** React 19, TypeScript (`tsconfig.app.json` + `tsconfig.server.json`), tRPC v11 + TanStack Query, Tailwind CSS, Vitest v4 Node test runner (`api/**/*.test.ts`).

## Global Constraints

- Vitest roda somente arquivos `api/**/*.test.ts` e `api/**/*.spec.ts` em ambiente `node` (`vitest.config.ts`).
- Helpers em `src/lib/*` importados por testes Node não devem depender de DOM nem de React runtime (`tsconfig.server.json` compila sem lib `"dom"`).
- Preservar todos os comentários/docstrings existentes não relacionados à mudança (`AGENTS.md`).
- Manter separação da Opção A aprovada: clicar em **Pedir agora** abre o WhatsApp com os dados da variante selecionada e dispara apenas `trackInterest()`, sem chamar `handleAddToCart()` nem abrir `CartDrawer`.
- JSON-LD de `LocalBusiness` nunca pode voltar a exibir `"Rua Marechal Rondon, 620"`: usar `"Av. Duque de Caxias, 486"` para Jardim/`ambas` e `"Rua Macias Barbosa, 2185"` para `guia_lopes` (ou endereço configurado em `settings` extraído antes de `" - "`).
- Validar tudo ao final com `pnpm test`, `pnpm check`, `pnpm lint` (`0` erros) e `pnpm build` antes de avançar para a Fase 3.

---

### Task 1: Lógica Pura da Página de Produto & Testes TDD (`src/lib/productDetail.ts`, `api/productDetail.test.ts`)

**Files:**
- Create: `src/lib/productDetail.ts`
- Test: `api/productDetail.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES`, `DEMO_PRODUCTS` (fallback no caller), `resolveProductImage` (`@/lib/iphoneCatalog`), `createProductShareSlug`, `extractProductIdFromShareSlug`, `extractProductUuidPrefixFromShareSlug` (`@/lib/productUrls`), `minPrice` (`@/lib/imageOptimization` não precisa; `minPrice` está em `shop.ts`, mas aqui podemos calcular minCash inline para evitar import circular com `trpc`).
- Produces:
  - `parseProductRouteParams(rawId?: string): ParsedProductRoute`
  - `findProductInCachedCatalog<T extends ProductLike>(list: readonly T[] | undefined, routeId: string): T | undefined`
  - `deriveVariantSelection<V extends VariantLike>(variants: readonly V[], input: VariantSelectionInput): DerivedVariantState<V>`
  - `pickNextStorageVariant<V extends VariantLike>(variants: readonly V[], version: string, storage: string, currentColor: string): VariantPickResult`
  - `pickNextColorVariant<V extends VariantLike>(variants: readonly V[], version: string, color: string, currentStorage: string): VariantPickResult`
  - `buildProductGalleryImages(productName: string, productImageUrl: string | null | undefined, selectedImageUrl: string | null | undefined, selectedColor: string, variants: readonly GalleryVariantLike[]): string[]`
  - `extractStreetAddress(addressSetting: string | undefined, fallback: string): string`
  - `buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> | undefined`
  - `selectRelatedProducts<T extends RelatedProductCandidate>(allProducts: readonly T[] | undefined, currentProduct: RelatedProductCandidate, limit?: number): T[]`

- [ ] **Step 1: Write the failing test (`api/productDetail.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import {
  buildProductGalleryImages,
  buildProductJsonLd,
  deriveVariantSelection,
  extractStreetAddress,
  findProductInCachedCatalog,
  parseProductRouteParams,
  pickNextColorVariant,
  pickNextStorageVariant,
  selectRelatedProducts,
} from "../src/lib/productDetail";

const SAMPLE_VARIANTS = [
  {
    id: 1,
    version: "Anatel",
    storage: "128GB",
    color: "Black",
    colorHex: "#1d1d1f",
    imageUrl: "/images/iphones/iphone-15-black.webp",
    priceCash: 420000,
    quantity: 1,
    available: true,
  },
  {
    id: 2,
    version: "Anatel",
    storage: "256GB",
    color: "Blue",
    colorHex: "#8fb8de",
    imageUrl: "/images/iphones/iphone-15-blue.webp",
    priceCash: 480000,
    quantity: 2,
    available: true,
  },
  {
    id: 3,
    version: "eSIM",
    storage: "128GB",
    color: "Pink",
    colorHex: "#f4c2c2",
    imageUrl: "/images/iphones/iphone-15-pink.webp",
    priceCash: 400000,
    quantity: 1,
    available: true,
  },
  {
    id: 4,
    version: "Anatel",
    storage: "512GB",
    color: "Black",
    colorHex: "#1d1d1f",
    imageUrl: "/images/iphones/iphone-15-black.webp",
    priceCash: 550000,
    quantity: 0,
    available: true,
  },
];

describe("productDetail pure helpers", () => {
  it("parseProductRouteParams identifica IDs numéricos, share slugs numéricos e UUID", () => {
    expect(parseProductRouteParams("iphone-15-id-42")).toMatchObject({
      isValidId: true,
      numericId: 42,
      isUuidOrString: false,
      productQueryId: "42",
    });

    expect(parseProductRouteParams("iphone-15-pro-1234abcd")).toMatchObject({
      isValidId: true,
      isUuidOrString: true,
      productQueryId: "iphone-15-pro-1234abcd",
    });

    expect(parseProductRouteParams("abc-def")).toMatchObject({
      isValidId: true,
      isUuidOrString: true,
      productQueryId: "abc-def",
    });

    expect(parseProductRouteParams("0").isValidId).toBe(false);
  });

  it("findProductInCachedCatalog encontra produto no cache da vitrine sem nova viagem", () => {
    const catalog = [
      { id: 42, name: "iPhone 15", brand: "Apple", category: "iphone_lacrado", variants: SAMPLE_VARIANTS },
      {
        id: "1234abcd-1111-2222-3333-444455556666",
        externalId: "ext-99",
        name: "iPhone 16 Pro",
        brand: "Apple",
        category: "iphone_lacrado",
        variants: SAMPLE_VARIANTS,
      },
    ];

    expect(findProductInCachedCatalog(catalog, "iphone-15-id-42")?.id).toBe(42);
    expect(findProductInCachedCatalog(catalog, "iphone-16-pro-1234abcd")?.name).toBe("iPhone 16 Pro");
    expect(findProductInCachedCatalog(catalog, "ext-99")?.name).toBe("iPhone 16 Pro");
    expect(findProductInCachedCatalog(catalog, "inexistente")).toBeUndefined();
  });

  it("deriveVariantSelection, pickNextStorageVariant e pickNextColorVariant respeitam versão e estoque", () => {
    const state = deriveVariantSelection(SAMPLE_VARIANTS, {
      version: "Anatel",
      storage: "128GB",
      color: "Black",
      selectedVariantId: 1,
    });

    expect(state.versions).toEqual(["Anatel", "eSIM"]);
    expect(state.selected?.id).toBe(1);
    expect(state.storageAvailable("512GB")).toBe(false);
    expect(state.storageAvailable("256GB")).toBe(true);

    // Ao mudar de 128GB Black para 256GB (onde só existe Blue), ajusta a cor automaticamente
    expect(pickNextStorageVariant(SAMPLE_VARIANTS, "Anatel", "256GB", "Black")).toEqual({
      storage: "256GB",
      color: "Blue",
      variantId: 2,
    });

    // Ao mudar para Pink na versão Anatel não há, mas ao trocar para eSIM encontra
    expect(pickNextColorVariant(SAMPLE_VARIANTS, "eSIM", "Pink", "128GB")).toEqual({
      storage: "128GB",
      color: "Pink",
      variantId: 3,
    });
  });

  it("buildProductGalleryImages prioriza imagem ativa e deduplica miniaturas repetidas", () => {
    const gallery = buildProductGalleryImages(
      "iPhone 15",
      "/images/iphones/iphone-15-black.webp",
      "/images/iphones/iphone-15-blue.webp",
      "Blue",
      SAMPLE_VARIANTS,
    );

    expect(gallery[0]).toBe("/images/iphones/iphone-15-blue.webp");
    expect(gallery).toContain("/images/iphones/iphone-15-black.webp");
    expect(gallery).toContain("/images/iphones/iphone-15-pink.webp");
    expect(new Set(gallery).size).toBe(gallery.length);
  });

  it("buildProductJsonLd usa endereço oficial da unidade em vez de Rua Marechal Rondon", () => {
    expect(extractStreetAddress("Av. Duque de Caxias, 486 - Jardim/MS", "Av. Duque de Caxias, 486")).toBe(
      "Av. Duque de Caxias, 486",
    );

    const jardimSchema = buildProductJsonLd({
      productId: 42,
      cleanTitle: "iPhone 15 128GB Black",
      description: "Lacrado com garantia",
      brand: "Apple",
      sku: "B1642",
      priceCash: 420000,
      imageUrl: "/images/iphones/iphone-15-black.webp",
      productUrl: "https://lojinhadocelular.com/produto/iphone-15-id-42",
      isLacrado: true,
      isAvailable: true,
      unitAvailability: "jardim",
      addressJardim: "Av. Duque de Caxias, 486 - Jardim/MS",
      addressGll: "Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS",
      whatsappJardim: "5567992086012",
      whatsappGll: "5567998206533",
    }) as { offers: { seller: { address: { streetAddress: string; addressLocality: string } } } };

    expect(jardimSchema.offers.seller.address.streetAddress).toBe("Av. Duque de Caxias, 486");
    expect(jardimSchema.offers.seller.address.addressLocality).toBe("Jardim");
    expect(JSON.stringify(jardimSchema)).not.toContain("Marechal Rondon");

    const guiaSchema = buildProductJsonLd({
      productId: 42,
      cleanTitle: "iPhone 15 128GB Black",
      description: "Lacrado",
      brand: "Apple",
      sku: "B1642",
      priceCash: 420000,
      imageUrl: "",
      productUrl: "https://lojinhadocelular.com/produto/iphone-15-id-42",
      isLacrado: true,
      isAvailable: true,
      unitAvailability: "guia_lopes",
    }) as { offers: { seller: { address: { streetAddress: string; addressLocality: string; postalCode: string } } } };

    expect(guiaSchema.offers.seller.address.streetAddress).toBe("Rua Macias Barbosa, 2185");
    expect(guiaSchema.offers.seller.address.addressLocality).toBe("Guia Lopes da Laguna");
    expect(guiaSchema.offers.seller.address.postalCode).toBe("79230-000");
  });

  it("selectRelatedProducts exclui produto atual e esgotados, priorizando categoria/marca e preço próximo", () => {
    const items = [
      { id: 1, name: "iPhone 15", brand: "Apple", category: "iphone_lacrado", variants: [{ available: true, quantity: 1, priceCash: 420000 }] },
      { id: 2, name: "iPhone 15 Plus", brand: "Apple", category: "iphone_lacrado", variants: [{ available: true, quantity: 1, priceCash: 450000 }] },
      { id: 3, name: "Cabo USB-C", brand: "Apple", category: "acessorio", variants: [{ available: true, quantity: 1, priceCash: 15000 }] },
      { id: 4, name: "iPhone 16", brand: "Apple", category: "iphone_lacrado", variants: [{ available: true, quantity: 1, priceCash: 490000 }] },
      { id: 5, name: "iPhone 14 Esgotado", brand: "Apple", category: "iphone_lacrado", variants: [{ available: true, quantity: 0, priceCash: 350000 }] },
      { id: 6, name: "iPhone 15 Pro", brand: "Apple", category: "iphone_lacrado", variants: [{ available: true, quantity: 1, priceCash: 540000 }] },
      { id: 7, name: "Redmi Note 13", brand: "Xiaomi", category: "android", variants: [{ available: true, quantity: 1, priceCash: 130000 }] },
    ];

    const related = selectRelatedProducts(items, items[0], 4);
    expect(related).toHaveLength(4);
    expect(related.some((p) => p.id === 1)).toBe(false);
    expect(related.some((p) => p.id === 5)).toBe(false);
    expect(related[0].id).toBe(2);
    expect(related.slice(0, 3).every((p) => p.category === "iphone_lacrado")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run api/productDetail.test.ts`
Expected: FAIL (`Cannot find module '../src/lib/productDetail'`).

- [ ] **Step 3: Write `src/lib/productDetail.ts`**

```ts
import { resolveProductImage } from "./iphoneCatalog";
import {
  extractProductIdFromShareSlug,
  extractProductUuidPrefixFromShareSlug,
} from "./productUrls";

export type ParsedProductRoute = {
  idStr: string;
  productRouteId: string;
  shareSlugUuid: string | null;
  isUuidOrString: boolean;
  numericId: number;
  productQueryId: string;
  isValidId: boolean;
};

export type ProductVariantLike = {
  id?: string | number | null;
  version: string;
  storage: string;
  color: string;
  colorHex?: string | null;
  imageUrl?: string | null;
  priceCash: number;
  quantity?: number | null;
  available: boolean;
};

export type ProductCatalogLike = {
  id: string | number;
  externalId?: string | null;
  alternateIds?: string[] | null;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string | null;
  variants: readonly ProductVariantLike[];
};

export type VariantPickResult = {
  storage?: string;
  color?: string;
  variantId: string | number | null;
};

export type DerivedVariantState<V extends ProductVariantLike> = {
  versions: string[];
  storages: string[];
  colors: string[];
  storageAvailable: (storage: string) => boolean;
  colorAvailable: (color: string) => boolean;
  colorHex: (color: string) => string;
  matchingVariants: V[];
  selected: V | undefined;
};

const STORE_UNITS = {
  jardim: {
    streetAddress: "Av. Duque de Caxias, 486",
    locality: "Jardim",
    postalCode: "79240-000",
    telephone: "+55-67-99208-6012",
  },
  guia_lopes: {
    streetAddress: "Rua Macias Barbosa, 2185",
    locality: "Guia Lopes da Laguna",
    postalCode: "79230-000",
    telephone: "+55-67-99820-6533",
  },
} as const;

export function parseProductRouteParams(rawId?: string): ParsedProductRoute {
  const idStr = rawId ? String(rawId).trim() : "";
  const shareSlugId = extractProductIdFromShareSlug(idStr);
  const shareSlugUuid = extractProductUuidPrefixFromShareSlug(idStr);
  const productRouteId = shareSlugId ?? idStr;
  const isUuidOrString =
    Boolean(shareSlugUuid) ||
    (idStr.length > 0 &&
      (productRouteId.includes("-") || Number.isNaN(Number(productRouteId))));
  const numericId = Number(productRouteId);
  const productQueryId = shareSlugUuid ? idStr : productRouteId;
  const isValidId = isUuidOrString
    ? Boolean(productRouteId)
    : !Number.isNaN(numericId) && numericId > 0;

  return {
    idStr,
    productRouteId,
    shareSlugUuid,
    isUuidOrString,
    numericId,
    productQueryId,
    isValidId,
  };
}

export function findProductInCachedCatalog<T extends ProductCatalogLike>(
  list: readonly T[] | undefined,
  rawId: string,
): T | undefined {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const parsed = parseProductRouteParams(rawId);
  if (!parsed.productRouteId) return undefined;

  const lookup = parsed.productRouteId.toLowerCase();
  const uuidPrefix = parsed.shareSlugUuid?.toLowerCase() ?? null;

  return list.find((item) => {
    const idMatch = String(item.id).trim().toLowerCase() === lookup;
    const extMatch = item.externalId?.trim().toLowerCase() === lookup;
    const altMatch =
      Array.isArray(item.alternateIds) &&
      item.alternateIds.some((alt) => alt.trim().toLowerCase() === lookup);
    const uuidMatch = Boolean(
      uuidPrefix &&
        (String(item.id).toLowerCase().startsWith(uuidPrefix) ||
          item.externalId?.toLowerCase().startsWith(uuidPrefix)),
    );
    return idMatch || extMatch || altMatch || uuidMatch;
  });
}

function isVariantInStock(variant: ProductVariantLike): boolean {
  return Boolean(variant.available) && (variant.quantity ?? 1) > 0;
}

function matchColorForStorage<V extends ProductVariantLike>(
  color: string,
  variants: readonly V[],
  version: string,
  storage: string,
): string {
  if (
    variants.some(
      (v) => v.version === version && v.storage === storage && v.color === color,
    )
  ) {
    return color;
  }
  const availableMatch = variants.find(
    (v) => v.version === version && v.storage === storage && isVariantInStock(v),
  );
  if (availableMatch) return availableMatch.color;
  const fallbackMatch = variants.find(
    (v) => v.version === version && v.storage === storage,
  );
  return fallbackMatch ? fallbackMatch.color : color;
}

export function deriveVariantSelection<V extends ProductVariantLike>(
  variants: readonly V[],
  selection: {
    version: string;
    storage: string;
    color: string;
    selectedVariantId: string | number | null;
  },
): DerivedVariantState<V> {
  const { version, storage, color, selectedVariantId } = selection;
  const versions = [...new Set(variants.map((v) => v.version))];
  const byVersion = variants.filter((v) => v.version === version);
  const storages = [...new Set(byVersion.map((v) => v.storage))];
  const colors = [...new Set(byVersion.map((v) => v.color))];

  const storageAvailable = (targetStorage: string) =>
    byVersion.some((v) => v.storage === targetStorage && isVariantInStock(v));

  const colorAvailable = (targetColor: string) =>
    byVersion.some((v) => v.color === targetColor && isVariantInStock(v));

  const colorHex = (targetColor: string) =>
    byVersion.find((v) => v.color === targetColor)?.colorHex ?? "#111111";

  const matchedColor = matchColorForStorage(color, variants, version, storage);
  const matchingVariants = byVersion.filter(
    (v) => v.storage === storage && v.color === matchedColor,
  );

  const selected =
    matchingVariants.find((v) => v.id === selectedVariantId) ??
    matchingVariants.find(isVariantInStock) ??
    matchingVariants[0] ??
    byVersion.find((v) => v.storage === storage && v.color === color) ??
    variants[0];

  return {
    versions,
    storages,
    colors,
    storageAvailable,
    colorAvailable,
    colorHex,
    matchingVariants,
    selected,
  };
}

export function pickNextVersionVariant<V extends ProductVariantLike>(
  variants: readonly V[],
  nextVersion: string,
): { version: string; storage?: string; color?: string; variantId: string | number | null } {
  const inVersion = variants.filter((v) => v.version === nextVersion);
  const chosen = inVersion.find(isVariantInStock) ?? inVersion[0];
  return {
    version: nextVersion,
    storage: chosen?.storage,
    color: chosen?.color,
    variantId: chosen?.id ?? null,
  };
}

export function pickNextStorageVariant<V extends ProductVariantLike>(
  variants: readonly V[],
  version: string,
  nextStorage: string,
  currentColor: string,
): VariantPickResult {
  const exactInStock = variants.find(
    (v) =>
      v.version === version &&
      v.storage === nextStorage &&
      v.color === currentColor &&
      isVariantInStock(v),
  );
  if (exactInStock) {
    return {
      storage: nextStorage,
      variantId: exactInStock.id ?? null,
    };
  }

  const firstInStock = variants.find(
    (v) => v.version === version && v.storage === nextStorage && isVariantInStock(v),
  );
  if (firstInStock) {
    return {
      storage: nextStorage,
      color: firstInStock.color,
      variantId: firstInStock.id ?? null,
    };
  }

  const fallbackAny = variants.find(
    (v) => v.version === version && v.storage === nextStorage,
  );
  return {
    storage: nextStorage,
    color: fallbackAny?.color,
    variantId: fallbackAny?.id ?? null,
  };
}

export function pickNextColorVariant<V extends ProductVariantLike>(
  variants: readonly V[],
  version: string,
  nextColor: string,
  currentStorage: string,
): VariantPickResult {
  const exactInStock = variants.find(
    (v) =>
      v.version === version &&
      v.storage === currentStorage &&
      v.color === nextColor &&
      isVariantInStock(v),
  );
  if (exactInStock) {
    return {
      storage: currentStorage,
      color: nextColor,
      variantId: exactInStock.id ?? null,
    };
  }

  const firstInStock = variants.find(
    (v) => v.version === version && v.color === nextColor && isVariantInStock(v),
  );
  if (firstInStock) {
    return {
      storage: firstInStock.storage,
      color: nextColor,
      variantId: firstInStock.id ?? null,
    };
  }

  const fallbackAny = variants.find(
    (v) => v.version === version && v.color === nextColor,
  );
  return {
    storage: fallbackAny?.storage ?? currentStorage,
    color: nextColor,
    variantId: fallbackAny?.id ?? null,
  };
}

export function buildProductGalleryImages(
  productName: string,
  productImageUrl: string | null | undefined,
  selectedImageUrl: string | null | undefined,
  selectedColor: string,
  variants: readonly Pick<ProductVariantLike, "color" | "imageUrl">[],
  maxImages = 6,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushUnique = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    ordered.push(trimmed);
  };

  pushUnique(resolveProductImage(productName, selectedImageUrl || productImageUrl, selectedColor));
  if (productImageUrl) {
    pushUnique(resolveProductImage(productName, productImageUrl, selectedColor));
  }
  for (const variant of variants) {
    if (variant.imageUrl || variant.color) {
      pushUnique(resolveProductImage(productName, variant.imageUrl || productImageUrl, variant.color));
    }
    if (ordered.length >= maxImages) break;
  }

  return ordered.slice(0, maxImages);
}

export function extractStreetAddress(
  rawAddress: string | undefined,
  fallback: string,
): string {
  const cleaned = rawAddress?.trim();
  if (!cleaned) return fallback;
  const streetPart = cleaned.split(" - ")[0]?.trim();
  return streetPart || fallback;
}

function formatSchemaPhone(rawPhone: string | undefined, fallback: string): string {
  const digits = (rawPhone || "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    return `+55-${digits.slice(2, 4)}-${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length >= 10) {
    return `+55-${digits.slice(0, 2)}-${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return fallback;
}

export type ProductJsonLdInput = {
  productId: string | number;
  cleanTitle: string;
  description: string;
  brand: string;
  sku: string;
  priceCash: number | null;
  imageUrl?: string;
  productUrl?: string;
  isLacrado: boolean;
  isAvailable: boolean;
  unitAvailability?: string | null;
  addressJardim?: string;
  addressGll?: string;
  whatsappJardim?: string;
  whatsappGll?: string;
};

export function buildProductJsonLd(
  input: ProductJsonLdInput,
): Record<string, unknown> | undefined {
  if (input.priceCash == null) return undefined;

  const isGuia = input.unitAvailability === "guia_lopes";
  const unitDefaults = isGuia ? STORE_UNITS.guia_lopes : STORE_UNITS.jardim;
  const streetAddress = extractStreetAddress(
    isGuia ? input.addressGll : input.addressJardim,
    unitDefaults.streetAddress,
  );
  const telephone = formatSchemaPhone(
    isGuia ? input.whatsappGll : input.whatsappJardim,
    unitDefaults.telephone,
  );

  const absoluteImage = input.imageUrl
    ? input.imageUrl.startsWith("/")
      ? `https://lojinhadocelular.com${input.imageUrl}`
      : input.imageUrl
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.cleanTitle,
    image: absoluteImage,
    description: input.description,
    sku: input.sku || String(input.productId),
    brand: {
      "@type": "Brand",
      name:
        input.brand ||
        (input.cleanTitle.toLowerCase().includes("iphone") ? "Apple" : "Smartphone"),
    },
    offers: {
      "@type": "Offer",
      url: input.productUrl || `https://lojinhadocelular.com/produto/${input.productId}`,
      priceCurrency: "BRL",
      price: (input.priceCash / 100).toFixed(2),
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      itemCondition: input.isLacrado
        ? "https://schema.org/NewCondition"
        : "https://schema.org/UsedCondition",
      availability: input.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "LocalBusiness",
        name: "Lojinha do Celular",
        telephone,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          streetAddress,
          addressLocality: unitDefaults.locality,
          addressRegion: "MS",
          postalCode: unitDefaults.postalCode,
          addressCountry: "BR",
        },
      },
    },
  };
}

function getMinAvailableCashPrice(
  variants: readonly Pick<ProductVariantLike, "available" | "quantity" | "priceCash">[],
): number | null {
  const prices = variants
    .filter((v) => v.available && (v.quantity ?? 1) > 0)
    .map((v) => v.priceCash);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export function selectRelatedProducts<
  T extends Pick<ProductCatalogLike, "id" | "brand" | "category" | "variants">,
>(
  allProducts: readonly T[] | undefined,
  currentProduct: Pick<ProductCatalogLike, "id" | "brand" | "category" | "variants">,
  limit = 4,
): T[] {
  if (!Array.isArray(allProducts) || allProducts.length === 0 || limit <= 0) {
    return [];
  }

  const currentId = String(currentProduct.id);
  const currentMinPrice = getMinAvailableCashPrice(currentProduct.variants);
  const currentBrand = currentProduct.brand.toLowerCase();

  return allProducts
    .map((candidate, index) => {
      const candidatePrice = getMinAvailableCashPrice(candidate.variants);
      return { candidate, candidatePrice, index };
    })
    .filter(
      (entry): entry is { candidate: T; candidatePrice: number; index: number } =>
        String(entry.candidate.id) !== currentId && entry.candidatePrice != null,
    )
    .sort((a, b) => {
      const aSameCategory = a.candidate.category === currentProduct.category ? 0 : 1;
      const bSameCategory = b.candidate.category === currentProduct.category ? 0 : 1;
      if (aSameCategory !== bSameCategory) return aSameCategory - bSameCategory;

      const aSameBrand = a.candidate.brand.toLowerCase() === currentBrand ? 0 : 1;
      const bSameBrand = b.candidate.brand.toLowerCase() === currentBrand ? 0 : 1;
      if (aSameBrand !== bSameBrand) return aSameBrand - bSameBrand;

      if (currentMinPrice != null) {
        const aDiff = Math.abs(a.candidatePrice - currentMinPrice);
        const bDiff = Math.abs(b.candidatePrice - currentMinPrice);
        if (aDiff !== bDiff) return aDiff - bDiff;
      }

      return a.index - b.index;
    })
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run api/productDetail.test.ts && pnpm check`
Expected: PASS (`6 passed`).

- [ ] **Step 5: Commit**

```bash
git add api/productDetail.test.ts src/lib/productDetail.ts
git commit -m "feat(produto): extrair logica pura e testes unitarios da pagina do produto"
```

---

### Task 2: Estado da Barra Sticky & Prevenção de Colisão no `CompareBar` (`src/lib/stickyCtaState.ts`, `src/components/CompareBar.tsx`)

**Files:**
- Create: `src/lib/stickyCtaState.ts`
- Modify: `src/components/CompareBar.tsx:1-39`

**Interfaces:**
- Produces: `setProductStickyCtaVisible(visible: boolean): void`, `useProductStickyCtaVisible(): boolean`.
- Consumes in `CompareBar.tsx`: `useProductStickyCtaVisible()` ajustando `bottom` no mobile para `bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-4`.

- [ ] **Step 1: Extend `api/productDetail.test.ts` for sticky CTA store**

```ts
import {
  getProductStickyCtaVisibleSnapshot,
  setProductStickyCtaVisible,
} from "../src/lib/stickyCtaState";

it("stickyCtaState alterna e notifica visibilidade da barra sticky", () => {
  setProductStickyCtaVisible(false);
  expect(getProductStickyCtaVisibleSnapshot()).toBe(false);
  setProductStickyCtaVisible(true);
  expect(getProductStickyCtaVisibleSnapshot()).toBe(true);
  setProductStickyCtaVisible(false);
  expect(getProductStickyCtaVisibleSnapshot()).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run api/productDetail.test.ts`
Expected: FAIL (`Cannot find module '../src/lib/stickyCtaState'`).

- [ ] **Step 3: Create `src/lib/stickyCtaState.ts` and update `src/components/CompareBar.tsx`**

```ts
// src/lib/stickyCtaState.ts
import { useSyncExternalStore } from "react";

let productStickyCtaVisible = false;
const listeners = new Set<() => void>();

export function setProductStickyCtaVisible(visible: boolean): void {
  if (productStickyCtaVisible === visible) return;
  productStickyCtaVisible = visible;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getProductStickyCtaVisibleSnapshot(): boolean {
  return productStickyCtaVisible;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useProductStickyCtaVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    getProductStickyCtaVisibleSnapshot,
    getServerSnapshot,
  );
}
```

Update `src/components/CompareBar.tsx` wrapper `className`:
```tsx
const stickyCtaVisible = useProductStickyCtaVisible();
const bottomClass = stickyCtaVisible
  ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-4"
  : "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]";
```
Applying `fixed inset-x-0 ${bottomClass} z-40 flex justify-center px-4 pointer-events-none transition-all duration-200`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run api/productDetail.test.ts && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/productDetail.test.ts src/lib/stickyCtaState.ts src/components/CompareBar.tsx
git commit -m "feat(produto): coordenar posicao do CompareBar com a barra sticky mobile"
```

---

### Task 3: Galeria Interativa (`ProductGallery.tsx`) e Ficha Técnica Universal (`SpecSheet.tsx`)

**Files:**
- Create: `src/components/produto/ProductGallery.tsx`
- Modify: `src/components/SpecSheet.tsx:1-77`

**Interfaces:**
- `ProductGalleryProps`:
  `{ productName: string; images: string[]; activeImage: string; onSelectImage: (url: string) => void; mediaTab: "photo" | "video"; onChangeMediaTab: (tab: "photo" | "video") => void; videoEmbed: { type: string; src: string } | null; }`
- `SpecSheetProps`:
  `{ productName: string; brand?: string; categoryLabel?: string; conditionLabel?: string; description?: string | null; notes?: string | null; warranty?: string | null; }`

- [ ] **Step 1: Create `src/components/produto/ProductGallery.tsx`**

Implementar:
- Alternador superior `Foto / Vídeo` preservado quando `videoEmbed` existir.
- Renderização da imagem principal via `optimizeImageUrl(displayImage, 800, 85)` + `getImageSrcSet(displayImage)` + `fetchPriority="high"` + transição suave (`opacity` com fallback automático caso `onError` dispare).
- Botão discreto de ampliar (`ZoomIn`) e clique na imagem abrindo modal Lightbox (`role="dialog"`, `aria-modal="true"`, fecha com `Escape`, backdrop ou botão `X`).
- Tira horizontal de miniaturas (`optimizeImageUrl(url, 360, 80)`) abaixo do quadro principal somente quando `images.length > 1 && mediaTab === "photo"`.

- [ ] **Step 2: Evolve `src/components/SpecSheet.tsx`**

Implementar:
- Manter intacta a renderização completa dos iPhones cobertos por `IPHONE_SPECS` (incluindo `PerformanceBar`).
- Quando `getIphoneSpecs(...)` for `null` (Android, iPad, acessórios, modelos lançados após o catálogo estático): exibir bloco limpo **"Detalhes e procedência"** com os campos reais disponíveis (`Marca`, `Categoria`, `Condição`, `Garantia`, `Observações da variante` se `notes`, além dos selos presenciais reais de checagem/nota/procedência da loja) sem inventar atributos de hardware.

- [ ] **Step 3: Run typecheck and lint on touched components**

Run: `pnpm check && pnpm lint`
Expected: `0` errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/produto/ProductGallery.tsx src/components/SpecSheet.tsx
git commit -m "feat(produto): adicionar galeria com miniaturas/lightbox e ficha tecnica universal"
```

---

### Task 4: Barra Sticky Mobile, Produtos Relacionados e Refatoração de `Produto.tsx`

**Files:**
- Create: `src/components/produto/MobileStickyCta.tsx`
- Create: `src/components/produto/RelatedProducts.tsx`
- Modify: `src/pages/Produto.tsx`

**Interfaces:**
- `MobileStickyCta`: observa `targetRef` via `IntersectionObserver` (`threshold: 0`). Mostra barra fixa `md:hidden` apenas quando `boundingClientRect.top < 0 && !isIntersecting && isAvailable && !isCartOpen`. Sincroniza `setProductStickyCtaVisible` e limpa para `false` no cleanup/unmount. Botão **Pedir** dispara somente `onTrackInterest()` (sem `addItem`).
- `RelatedProducts`: recebe `currentProduct` e consulta `trpc.shop.products.useQuery(undefined, { enabled: !isDemo, staleTime: 60_000 })`, derivando até 4 itens via `selectRelatedProducts(...)` e renderizando com `ProductCard`.
- `Produto.tsx`: wrapper `<Produto>` -> `<ProdutoContent key={parsed.productQueryId || parsed.idStr || "empty"} />`; `trpc.shop.product.useQuery` recebe `initialData: cachedProduct` via `trpc.useUtils().shop.products.getData()`; seletor de versão condicional quando `derived.versions.filter(Boolean).length > 1`; botão `<button type="button" aria-expanded={showAllInstallments}>` para parcelas; botão `Comparar`; descrição visível quando preenchida; **Pedir agora** sem `handleAddToCart()`.

- [ ] **Step 1: Create `src/components/produto/MobileStickyCta.tsx`**

Implementar barra fixa mobile respeitando `pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]` com `Price`, `variantSummary`, botão `+ Sacola` e `<a href={whatsappHref} onClick={onTrackInterest}>Pedir</a>`.

- [ ] **Step 2: Create `src/components/produto/RelatedProducts.tsx`**

Implementar seção `"Quem viu também gostou"` com lista horizontal `snap-x` no mobile e grid de 4 colunas em `lg:`, retornando `null` se `related.length === 0`.

- [ ] **Step 3: Refactor `src/pages/Produto.tsx`**

Substituir a lógica inline por chamadas aos helpers de `src/lib/productDetail.ts` e compor `ProductGallery`, `MobileStickyCta`, `SpecSheet` e `RelatedProducts`, garantindo `0` chamadas `setState` no corpo do render e endereço oficial via `buildProductJsonLd`.

- [ ] **Step 4: Run tests, typecheck and lint**

Run: `pnpm test && pnpm check && pnpm lint`
Expected: `42+` test files pass, `0` TS errors, `0` ESLint errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/produto/MobileStickyCta.tsx src/components/produto/RelatedProducts.tsx src/pages/Produto.tsx
git commit -m "feat(produto): finalizar pagina do produto com abertura instantanea, sticky bar mobile e relacionados"
```

---

### Task 5: Verificação Integrada da Fase 2 & Build de Produção

**Files:**
- Verify: toda a suíte, typecheck, lint e build (`dist/`).

- [ ] **Step 1: Run complete verification pipeline**

Run: `pnpm test && pnpm check && pnpm lint && pnpm build`
Expected: todos os testes passando (`0` falhas), `tsc -b` sem erros, `eslint .` sem erros e `dist/boot.js` + `dist/public/assets/Produto-*.js` gerados.

- [ ] **Step 2: Check mobile chunk size and clean git status**

Run: `ls -lh dist/public/assets/Produto-* dist/public/assets/SpecSheet-* && git status --short`
Expected: chunk `Produto-*.js` continua em lazy-load separado e enxuto; apenas arquivos previstos modificados.

---

## Self-Review Check

1. **Spec coverage:**
   - Fim do `setState` no render -> Task 4 (`<ProdutoContent key={...} />`).
   - Endereço JSON-LD corrigido (`Av. Duque de Caxias, 486` / `Rua Macias Barbosa, 2185`) -> Task 1 & 4.
   - Cache 0ms saindo da vitrine (`shop.products` `initialData`) -> Task 1 & 4.
   - `Pedir agora` desacoplado de `Adicionar à Sacola` -> Task 4.
   - Botão acessível de parcelas (`<button aria-expanded>`) -> Task 4.
   - `ProductGallery` com miniaturas deduplicadas, transição suave e Lightbox -> Task 1 & 3.
   - `MobileStickyCta` + `CompareBar` sem sobreposição -> Task 2 & 4.
   - `SpecSheet` universal + descrição visível -> Task 3 & 4.
   - `RelatedProducts` -> Task 1 & 4.
   - Seletor condicional de `version` + botão `Comparar` -> Task 1 & 4.
2. **Placeholder scan:** Nenhum `TBD`, `TODO`, ou passo vago.
3. **Type consistency:** Assinaturas entre `src/lib/productDetail.ts`, `src/lib/stickyCtaState.ts`, `api/productDetail.test.ts`, componentes e `Produto.tsx` estão alinhadas e compatíveis com Node/Vitest (`tsconfig.server.json`) e Vite (`tsconfig.app.json`).
