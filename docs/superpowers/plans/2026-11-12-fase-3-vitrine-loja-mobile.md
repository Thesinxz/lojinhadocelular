# Fase 3 — Vitrine & Loja Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a vitrine (`/`), os cards de produto, o hero e o shell da loja (`Header`, `CartDrawer`, `WhatsAppModal`) rápidos, ergonômicos no mobile (`360px–414px`) e livres dos bugs de filtro por preço em centavos, URL `?categoria=`, acúmulo de selos e salto de layout.

**Architecture:** Toda a lógica de filtragem em centavos, busca normalizada, serialização de query string, filtro por unidade (`Jardim` / `Guia Lopes`), prioridade de selos e paginação em lotes fica isolada em módulos puros sem DOM (`src/lib/vitrineFilters.ts` e `src/lib/storeUnit.ts`), testados em Vitest Node (`api/vitrineFilters.test.ts`). Componentes visuais (`HeroBlk`, `ProductCard`, `ProductCardSkeleton`, `Header`, `CartDrawer`, `WhatsAppModal`, `Home`) consomem esses helpers de forma enxuta.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, React Router 7 (`useSearchParams`), Vitest (Node), `lucide-react`.

---

### Task 1: Lógica pura da Vitrine, preferência de unidade e testes unitários (TDD)

**Files:**
- Create: `src/lib/vitrineFilters.ts`
- Create: `src/lib/storeUnit.ts`
- Create: `api/vitrineFilters.test.ts`

- [ ] **Step 1: Escrever os testes unitários em `api/vitrineFilters.test.ts` (TDD RED)**

```ts
import { describe, expect, it } from "vitest";
import {
  VITRINE_BATCH_SIZE,
  buildVitrineSearchParams,
  countSecondaryFilters,
  DEFAULT_VITRINE_FILTER_STATE,
  extractStorageOptions,
  filterAndSortVitrineProducts,
  hasAnyActiveVitrineFilter,
  matchesUnitAvailability,
  parseVitrineSearchParams,
  selectProductCardBadges,
  sliceVitrineBatch,
} from "../src/lib/vitrineFilters";
import {
  getPreferredStoreUnitSnapshot,
  resolveCartUnitFromAvailability,
  setPreferredStoreUnit,
} from "../src/lib/storeUnit";

const SAMPLE_PRODUCTS = [
  {
    id: 1,
    name: "iPhone 16 Pro Max",
    brand: "Apple",
    category: "iphone_lacrado",
    condition: "lacrado",
    featured: true,
    unitAvailability: "jardim" as const,
    variants: [
      {
        id: 11,
        version: "EUA",
        storage: "256GB",
        color: "Titânio Natural",
        priceCash: 749000, // R$ 7.490,00
        available: true,
        unitAvailability: "jardim" as const,
      },
    ],
  },
  {
    id: 2,
    name: "iPhone 13",
    brand: "Apple",
    category: "iphone_seminovo",
    condition: "seminovo",
    featured: false,
    unitAvailability: "guia_lopes" as const,
    variants: [
      {
        id: 21,
        version: "Seminovo",
        storage: "128GB",
        color: "Estelar",
        priceCash: 289000, // R$ 2.890,00
        available: true,
        unitAvailability: "guia_lopes" as const,
      },
    ],
  },
  {
    id: 3,
    name: "Redmi Note 13",
    brand: "Xiaomi",
    category: "android",
    condition: "lacrado",
    featured: true,
    unitAvailability: "ambas" as const,
    variants: [
      {
        id: 31,
        version: "Global",
        storage: "256GB",
        color: "Preto",
        priceCash: 139000, // R$ 1.390,00
        available: true,
        unitAvailability: "ambas" as const,
      },
    ],
  },
  {
    id: 4,
    name: "iPhone 15",
    brand: "Apple",
    category: "iphone_lacrado",
    condition: "lacrado",
    featured: false,
    unitAvailability: "ambas" as const,
    variants: [
      {
        id: 41,
        version: "Global",
        storage: "128GB",
        color: "Azul",
        priceCash: 459000, // R$ 4.590,00
        available: true,
        unitAvailability: "jardim" as const,
      },
      {
        id: 42,
        version: "Global",
        storage: "256GB",
        color: "Preto",
        priceCash: 519000, // R$ 5.190,00
        available: true,
        unitAvailability: "guia_lopes" as const,
      },
    ],
  },
];

describe("vitrineFilters", () => {
  it("filtra faixas de preço corretamente em centavos (corrige bug centavos vs reais)", () => {
    const ate2 = filterAndSortVitrineProducts(SAMPLE_PRODUCTS, {
      ...DEFAULT_VITRINE_FILTER_STATE,
      priceKey: "ate2",
    });
    expect(ate2.map((p) => p.name)).toEqual(["Redmi Note 13"]);

    const faixa2a4 = filterAndSortVitrineProducts(SAMPLE_PRODUCTS, {
      ...DEFAULT_VITRINE_FILTER_STATE,
      priceKey: "2a4",
    });
    expect(faixa2a4.map((p) => p.name)).toEqual(["iPhone 13"]);

    const faixa4a7 = filterAndSortVitrineProducts(SAMPLE_PRODUCTS, {
      ...DEFAULT_VITRINE_FILTER_STATE,
      priceKey: "4a7",
    });
    expect(faixa4a7.map((p) => p.name)).toEqual(["iPhone 15"]);

    const acima7 = filterAndSortVitrineProducts(SAMPLE_PRODUCTS, {
      ...DEFAULT_VITRINE_FILTER_STATE,
      priceKey: "7mais",
    });
    expect(acima7.map((p) => p.name)).toEqual(["iPhone 16 Pro Max"]);
  });

  it("interpreta e serializa parâmetros de URL incluindo iphones e unidade", () => {
    const parsed = parseVitrineSearchParams(
      "?categoria=iphones&unidade=guia_lopes&faixa=2a4&gb=128GB&ordem=menor_preco&q=Estelar",
    );
    expect(parsed).toEqual({
      category: "iphones",
      unit: "guia_lopes",
      priceKey: "2a4",
      storage: "128GB",
      sortBy: "menor_preco",
      search: "Estelar",
    });

    const rebuilt = buildVitrineSearchParams(parsed);
    expect(rebuilt.get("categoria")).toBe("iphones");
    expect(rebuilt.get("unidade")).toBe("guia_lopes");
    expect(rebuilt.get("faixa")).toBe("2a4");
    expect(rebuilt.get("gb")).toBe("128GB");
    expect(rebuilt.get("ordem")).toBe("menor_preco");
    expect(rebuilt.get("q")).toBe("Estelar");

    const clean = buildVitrineSearchParams(DEFAULT_VITRINE_FILTER_STATE);
    expect(clean.toString()).toBe("");
  });

  it("filtra por unidade respeitando produto e variantes disponíveis", () => {
    expect(matchesUnitAvailability(SAMPLE_PRODUCTS[0], "jardim")).toBe(true);
    expect(matchesUnitAvailability(SAMPLE_PRODUCTS[0], "guia_lopes")).toBe(false);
    expect(matchesUnitAvailability(SAMPLE_PRODUCTS[1], "guia_lopes")).toBe(true);
    expect(matchesUnitAvailability(SAMPLE_PRODUCTS[1], "jardim")).toBe(false);
    expect(matchesUnitAvailability(SAMPLE_PRODUCTS[3], "guia_lopes")).toBe(true);
    expect(
      matchesUnitAvailability(
        { unitAvailability: "indisponivel", variants: [] },
        "jardim",
      ),
    ).toBe(false);
  });

  it("busca sem acentos e conta filtros secundários ativos", () => {
    const res = filterAndSortVitrineProducts(SAMPLE_PRODUCTS, {
      ...DEFAULT_VITRINE_FILTER_STATE,
      search: "titanio",
    });
    expect(res.map((p) => p.name)).toEqual(["iPhone 16 Pro Max"]);

    expect(
      countSecondaryFilters({
        ...DEFAULT_VITRINE_FILTER_STATE,
        category: "iphones",
        unit: "jardim",
        priceKey: "2a4",
        storage: "128GB",
      }),
    ).toBe(2);

    expect(
      hasAnyActiveVitrineFilter({
        ...DEFAULT_VITRINE_FILTER_STATE,
        unit: "guia_lopes",
      }),
    ).toBe(true);
  });

  it("limita selos sobre a foto a no máximo 2 e separa etiqueta de unidade", () => {
    const featuredGuia = selectProductCardBadges({
      featured: true,
      isSeminovo: true,
      unitAvailability: "guia_lopes",
    });
    expect(featuredGuia.photoBadges).toEqual([
      { kind: "promo", label: "PROMOÇÃO" },
      { kind: "condition", label: "Seminovo" },
    ]);
    expect(featuredGuia.unitTag).toBe("Guia Lopes");

    const lacradoAmbas = selectProductCardBadges({
      featured: false,
      isSeminovo: false,
      unitAvailability: "ambas",
    });
    expect(lacradoAmbas.photoBadges).toEqual([
      { kind: "condition", label: "Lacrado" },
    ]);
    expect(lacradoAmbas.unitTag).toBe("2 Lojas");
  });

  it("extrai opções de armazenamento ordenadas e fatia lotes de 12 itens", () => {
    expect(extractStorageOptions(SAMPLE_PRODUCTS)).toEqual(["128GB", "256GB"]);
    const many = Array.from({ length: 30 }, (_, i) => i);
    expect(VITRINE_BATCH_SIZE).toBe(12);
    expect(sliceVitrineBatch(many, 12)).toHaveLength(12);
    expect(sliceVitrineBatch(many, 24)).toHaveLength(24);
  });

  it("sincroniza preferência de unidade para sacola com segurança", () => {
    setPreferredStoreUnit("jardim");
    expect(getPreferredStoreUnitSnapshot()).toBe("jardim");
    expect(resolveCartUnitFromAvailability("guia_lopes", "jardim")).toBe("gll");
    expect(resolveCartUnitFromAvailability("ambas", "gll")).toBe("gll");
    setPreferredStoreUnit("gll");
    expect(getPreferredStoreUnitSnapshot()).toBe("gll");
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha (RED)**

Run: `pnpm exec vitest run api/vitrineFilters.test.ts`
Expected: FAIL com erro de módulo não encontrado (`../src/lib/vitrineFilters`).

- [ ] **Step 3: Implementar `src/lib/vitrineFilters.ts` e `src/lib/storeUnit.ts`**

Write `src/lib/vitrineFilters.ts`:

```ts
export type VitrineCategoryValue =
  | "iphone_lacrado"
  | "iphone_seminovo"
  | "android"
  | "acessorio";

export type HomeCategory = VitrineCategoryValue | "iphones";
export type UnitFilter = "todas" | "jardim" | "guia_lopes";
export type VitrineSortOption =
  | "relevancia"
  | "lacrados_primeiro"
  | "modelo_recente"
  | "menor_preco"
  | "maior_preco";

export type PriceRangeKey = "todos" | "ate2" | "2a4" | "4a7" | "7mais";

export interface VitrineFilterState {
  category: HomeCategory | undefined;
  unit: UnitFilter;
  priceKey: PriceRangeKey;
  storage: string;
  sortBy: VitrineSortOption;
  search: string;
}

export const VITRINE_BATCH_SIZE = 12;

export const DEFAULT_VITRINE_FILTER_STATE: VitrineFilterState = {
  category: undefined,
  unit: "todas",
  priceKey: "todos",
  storage: "",
  sortBy: "relevancia",
  search: "",
};

/** Limites em centavos compatíveis com `priceCash` / `minPrice(product)`. */
export const PRICE_RANGES: ReadonlyArray<{
  key: PriceRangeKey;
  label: string;
  minCentavos: number;
  maxCentavos: number;
}> = [
  { key: "todos", label: "Qualquer preço", minCentavos: 0, maxCentavos: Infinity },
  { key: "ate2", label: "Até R$ 2.000", minCentavos: 0, maxCentavos: 200_000 },
  { key: "2a4", label: "R$ 2.000 – 4.000", minCentavos: 200_000, maxCentavos: 400_000 },
  { key: "4a7", label: "R$ 4.000 – 7.000", minCentavos: 400_000, maxCentavos: 700_000 },
  { key: "7mais", label: "Acima de R$ 7.000", minCentavos: 700_000, maxCentavos: Infinity },
];

export const HOME_CATEGORY_PILLS: ReadonlyArray<{
  label: string;
  value: HomeCategory | undefined;
}> = [
  { label: "Todos", value: undefined },
  { label: "iPhones", value: "iphones" },
  { label: "Lacrados", value: "iphone_lacrado" },
  { label: "Seminovos", value: "iphone_seminovo" },
  { label: "Android", value: "android" },
  { label: "Acessórios", value: "acessorio" },
];

export const UNIT_FILTER_PILLS: ReadonlyArray<{
  label: string;
  value: UnitFilter;
}> = [
  { label: "Todas as lojas", value: "todas" },
  { label: "Jardim", value: "jardim" },
  { label: "Guia Lopes", value: "guia_lopes" },
];

const VALID_CATEGORIES = new Set<HomeCategory>([
  "iphones",
  "iphone_lacrado",
  "iphone_seminovo",
  "android",
  "acessorio",
]);

const VALID_UNITS = new Set<UnitFilter>(["todas", "jardim", "guia_lopes"]);
const VALID_PRICE_KEYS = new Set<PriceRangeKey>([
  "todos",
  "ate2",
  "2a4",
  "4a7",
  "7mais",
]);
const VALID_SORT_OPTIONS = new Set<VitrineSortOption>([
  "relevancia",
  "lacrados_primeiro",
  "modelo_recente",
  "menor_preco",
  "maior_preco",
]);

export interface VitrineVariantLike {
  available: boolean;
  priceCash: number;
  storage: string;
  version: string;
  color: string;
  unitAvailability?: string | null;
}

export interface VitrineProductLike {
  id: string | number;
  name: string;
  brand: string;
  category: string;
  condition: string;
  featured?: boolean | number | null;
  unitAvailability?: string | null;
  variants: VitrineVariantLike[];
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function parseVitrineSearchParams(
  input: string | URLSearchParams,
): VitrineFilterState {
  const params =
    typeof input === "string" ? new URLSearchParams(input) : input;

  const rawCat = params.get("categoria");
  const category =
    rawCat && VALID_CATEGORIES.has(rawCat as HomeCategory)
      ? (rawCat as HomeCategory)
      : undefined;

  const rawUnit = params.get("unidade");
  const unit: UnitFilter =
    rawUnit && VALID_UNITS.has(rawUnit as UnitFilter)
      ? (rawUnit as UnitFilter)
      : "todas";

  const rawPrice = params.get("faixa");
  const priceKey: PriceRangeKey =
    rawPrice && VALID_PRICE_KEYS.has(rawPrice as PriceRangeKey)
      ? (rawPrice as PriceRangeKey)
      : "todos";

  const storage = (params.get("gb") || "").trim();

  const rawSort = params.get("ordem");
  const sortBy: VitrineSortOption =
    rawSort && VALID_SORT_OPTIONS.has(rawSort as VitrineSortOption)
      ? (rawSort as VitrineSortOption)
      : "relevancia";

  const search = params.get("q") || "";

  return { category, unit, priceKey, storage, sortBy, search };
}

export function buildVitrineSearchParams(
  state: VitrineFilterState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.category) params.set("categoria", state.category);
  if (state.unit !== "todas") params.set("unidade", state.unit);
  if (state.priceKey !== "todos") params.set("faixa", state.priceKey);
  if (state.storage) params.set("gb", state.storage);
  if (state.sortBy !== "relevancia") params.set("ordem", state.sortBy);
  if (state.search.trim()) params.set("q", state.search.trim());
  return params;
}

export function matchesUnitAvailability(
  product: Pick<VitrineProductLike, "unitAvailability" | "variants">,
  unit: UnitFilter,
): boolean {
  if (unit === "todas") return true;

  const variantsWithUnit = product.variants.filter(
    (v) => v.available && v.unitAvailability,
  );
  if (variantsWithUnit.length > 0) {
    return variantsWithUnit.some(
      (v) => v.unitAvailability === unit || v.unitAvailability === "ambas",
    );
  }

  const prodUnit = product.unitAvailability;
  if (prodUnit === "indisponivel") return false;
  if (prodUnit === "ambas") return true;
  if (!prodUnit) return unit === "jardim";
  return prodUnit === unit;
}

function getMinAvailableCashPrice(product: VitrineProductLike): number | null {
  const prices = product.variants
    .filter((v) => v.available)
    .map((v) => v.priceCash);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export function filterAndSortVitrineProducts<T extends VitrineProductLike>(
  products: readonly T[],
  state: VitrineFilterState,
  sortFn?: (items: T[], sortBy: VitrineSortOption) => T[],
): T[] {
  let list = [...products];

  if (state.category) {
    list =
      state.category === "iphones"
        ? list.filter(
            (p) =>
              p.category === "iphone_lacrado" || p.category === "iphone_seminovo",
          )
        : list.filter((p) => p.category === state.category);
  }

  if (state.unit !== "todas") {
    list = list.filter((p) => matchesUnitAvailability(p, state.unit));
  }

  const range =
    PRICE_RANGES.find((r) => r.key === state.priceKey) ?? PRICE_RANGES[0];
  if (range.key !== "todos") {
    list = list.filter((p) => {
      const price = getMinAvailableCashPrice(p);
      return (
        price != null &&
        price >= range.minCentavos &&
        price < range.maxCentavos
      );
    });
  }

  if (state.storage) {
    list = list.filter((p) =>
      p.variants.some((v) => v.storage === state.storage),
    );
  }

  if (state.search.trim()) {
    const term = normalizeSearchText(state.search);
    list = list.filter(
      (p) =>
        normalizeSearchText(p.name).includes(term) ||
        normalizeSearchText(p.brand).includes(term) ||
        p.variants.some(
          (v) =>
            normalizeSearchText(v.storage).includes(term) ||
            normalizeSearchText(v.version).includes(term) ||
            normalizeSearchText(v.color).includes(term),
        ),
    );
  }

  if (sortFn) {
    return sortFn(list, state.sortBy);
  }

  if (state.sortBy === "menor_preco") {
    return list.sort(
      (a, b) =>
        (getMinAvailableCashPrice(a) ?? 0) - (getMinAvailableCashPrice(b) ?? 0),
    );
  }
  if (state.sortBy === "maior_preco") {
    return list.sort(
      (a, b) =>
        (getMinAvailableCashPrice(b) ?? 0) - (getMinAvailableCashPrice(a) ?? 0),
    );
  }
  return list;
}

function parseStorageSizeMb(storage: string): number {
  const numeric = parseInt(storage, 10) || 0;
  return storage.toUpperCase().includes("TB") ? numeric * 1024 : numeric;
}

export function extractStorageOptions(
  products: readonly Pick<VitrineProductLike, "variants">[],
): string[] {
  const set = new Set<string>();
  for (const p of products) {
    for (const v of p.variants) {
      if (v.storage) set.add(v.storage);
    }
  }
  return [...set].sort((a, b) => parseStorageSizeMb(a) - parseStorageSizeMb(b));
}

export function countSecondaryFilters(state: VitrineFilterState): number {
  let count = 0;
  if (state.priceKey !== "todos") count += 1;
  if (state.storage) count += 1;
  return count;
}

export function hasAnyActiveVitrineFilter(state: VitrineFilterState): boolean {
  return Boolean(
    state.search.trim() ||
      state.category ||
      state.unit !== "todas" ||
      state.priceKey !== "todos" ||
      state.storage,
  );
}

export interface ProductCardBadge {
  kind: "promo" | "condition";
  label: string;
}

/** Garante no máximo 2 selos sobre a foto e move a unidade para tag externa. */
export function selectProductCardBadges(input: {
  featured?: boolean | number | null;
  isSeminovo: boolean;
  unitAvailability?: string | null;
}): {
  photoBadges: ProductCardBadge[];
  unitTag: string | null;
} {
  const photoBadges: ProductCardBadge[] = [];
  if (input.featured) {
    photoBadges.push({ kind: "promo", label: "PROMOÇÃO" });
  }
  photoBadges.push({
    kind: "condition",
    label: input.isSeminovo ? "Seminovo" : "Lacrado",
  });

  const unitTag =
    input.unitAvailability === "guia_lopes"
      ? "Guia Lopes"
      : input.unitAvailability === "ambas"
        ? "2 Lojas"
        : null;

  return {
    photoBadges: photoBadges.slice(0, 2),
    unitTag,
  };
}

export function sliceVitrineBatch<T>(
  items: readonly T[],
  visibleCount: number,
): T[] {
  if (visibleCount <= 0) return [];
  return items.slice(0, visibleCount);
}
```

Write `src/lib/storeUnit.ts`:

```ts
import { useSyncExternalStore } from "react";

export type StoreCartUnit = "jardim" | "gll";

let preferredStoreUnit: StoreCartUnit = "jardim";
const listeners = new Set<() => void>();

export function setPreferredStoreUnit(unit: StoreCartUnit): void {
  if (preferredStoreUnit === unit) return;
  preferredStoreUnit = unit;
  for (const listener of listeners) {
    listener();
  }
}

export function getPreferredStoreUnitSnapshot(): StoreCartUnit {
  return preferredStoreUnit;
}

function subscribePreferredStoreUnit(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function usePreferredStoreUnit(): [StoreCartUnit, (unit: StoreCartUnit) => void] {
  const unit = useSyncExternalStore(
    subscribePreferredStoreUnit,
    getPreferredStoreUnitSnapshot,
    getPreferredStoreUnitSnapshot,
  );
  return [unit, setPreferredStoreUnit];
}

export function resolveCartUnitFromAvailability(
  unitAvailability: string | null | undefined,
  currentUnit: StoreCartUnit,
): StoreCartUnit {
  if (unitAvailability === "guia_lopes") return "gll";
  if (unitAvailability === "jardim") return "jardim";
  return currentUnit;
}
```

- [ ] **Step 4: Rodar testes + TypeScript check para validar GREEN**

Run: `pnpm exec vitest run api/vitrineFilters.test.ts && pnpm check`
Expected: PASS (7/7 testes em `api/vitrineFilters.test.ts`, 0 erros no `tsc -b`).

- [ ] **Step 5: Commit da Task 1**

```bash
git add src/lib/vitrineFilters.ts src/lib/storeUnit.ts api/vitrineFilters.test.ts
git commit -m "feat(vitrine): extrair filtros em centavos, unidade e testes da vitrine"
```

---

### Task 2: Hero compacto mobile + ProductCard enxuto + ProductCardSkeleton

**Files:**
- Modify: `src/components/HeroBlk.tsx`
- Create: `src/components/ProductCardSkeleton.tsx`
- Modify: `src/components/ProductCard.tsx`

- [ ] **Step 1: Criar `src/components/ProductCardSkeleton.tsx`**

Implementar placeholder com `aspect-[4/5] sm:aspect-square`, `rounded-3xl`, e linhas de título/preço/CTA idênticas ao `ProductCard` (`animate-pulse`) para renderizar 6 itens sem CLS durante carregamento inicial.

- [ ] **Step 2: Compactar `src/components/HeroBlk.tsx` no mobile**

Atualizar a classe da `<section>` para `min-h-[430px] sm:min-h-[580px] md:min-h-[680px]` com `py-10 sm:py-16`, ajustar título mobile (`text-[1.85rem] leading-[1.12] sm:text-5xl md:text-6xl lg:text-7xl`) e subtítulo (`text-sm sm:text-lg`) mantendo o visual cinematográfico e botões intactos no desktop.

- [ ] **Step 3: Otimizar `src/components/ProductCard.tsx` (Opção A)**

Atualizações principais:
- Usar `selectProductCardBadges({ featured: product.featured, isSeminovo, unitAvailability: product.unitAvailability })` para renderizar no máximo **2 badges** sobre a foto (`PROMOÇÃO` + `Seminovo`/`Lacrado`);
- Renderizar `unitTag` (`📍 Guia Lopes` / `📍 2 Lojas`) como pill discreta na linha de metadados junto à marca (`Apple · 📍 Guia Lopes`) sem cobrir a imagem do aparelho;
- Manter bolinhas de cores (`colors.slice(0, 4)`);
- Simplificar bloco de preço mobile: `formatBRL(price)`, `"à vista no Pix"` (complemento `" · 12% de desconto aplicado"` só em `sm:inline`), e `"ou ${interestFreeInstallments}x de ${formatBRL(installment12)} sem juros"`;
- Linha única de CTAs na base (`mt-3 flex items-center gap-1.5`):
  - Botão primário `flex-1 min-h-[40px]`: `+ Sacola` (chama `setPreferredStoreUnit(resolveCartUnitFromAvailability(defaultVariant?.unitAvailability ?? product.unitAvailability, getPreferredStoreUnitSnapshot()))` antes de `addItem`) ou `Consultar` (WhatsApp quando `price == null`);
  - Botão compacto de comparação `h-10 w-10 shrink-0 rounded-full border` com `aria-label` descritivo e ícone `Check` / `Scale` (ou `GitCompareArrows`), economizando uma linha inteira por fileira no mobile.

- [ ] **Step 4: Validar build e lint da Task 2**

Run: `pnpm check && pnpm lint`
Expected: 0 erros TS, 0 erros ESLint.

- [ ] **Step 5: Commit da Task 2**

```bash
git add src/components/HeroBlk.tsx src/components/ProductCard.tsx src/components/ProductCardSkeleton.tsx
git commit -m "feat(vitrine): compactar hero mobile, criar skeleton e enxugar ProductCard"
```

---

### Task 3: Acessibilidade e ergonomia mobile no Shell (`Header`, `CartDrawer`, `WhatsAppModal`)

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/components/CartDrawer.tsx`
- Modify: `src/components/WhatsAppModal.tsx`

- [ ] **Step 1: Atualizar `src/components/Header.tsx`**

- Aumentar botão mobile da sacola de `h-8 w-8` para `h-10 w-10`;
- Fechar menu drawer mobile ao pressionar `Escape` (`useEffect` enquanto `open === true`).

- [ ] **Step 2: Atualizar `src/components/CartDrawer.tsx`**

- Trocar `useState<"jardim" | "gll">("jardim")` por `usePreferredStoreUnit()` para que a unidade selecionada na Vitrine ou no produto seja herdada automaticamente pela sacola;
- Adicionar `role="dialog" aria-modal="true" aria-label="Sacola de compras"` e fechar via `Escape` quando `isOpen === true`;
- Aumentar botões de `-` e `+` da quantidade para `h-7 w-7 flex items-center justify-center rounded-full` (alvo tátil limpo sem alterar altura da linha);
- Adicionar `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]` no rodapé do drawer.

- [ ] **Step 3: Atualizar `src/components/WhatsAppModal.tsx`**

- Adicionar `role="dialog" aria-modal="true" aria-label="Falar no WhatsApp"` e fechar via `Escape` quando `isOpen === true`.

- [ ] **Step 4: Validar check e lint**

Run: `pnpm check && pnpm lint`
Expected: 0 erros TS, 0 erros ESLint.

- [ ] **Step 5: Commit da Task 3**

```bash
git add src/components/Header.tsx src/components/CartDrawer.tsx src/components/WhatsAppModal.tsx
git commit -m "fix(mobile): melhorar alvos de toque, ESC e unidade sincronizada no shell da loja"
```

---

### Task 4: Vitrine `Home.tsx` com filtros inteligentes, URL sync, skeletons e paginação em lotes

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Integrar `vitrineFilters.ts` e `ProductCardSkeleton` em `src/pages/Home.tsx`**

Alterações em `src/pages/Home.tsx`:
- Ler/atualizar estado de filtros com `parseVitrineSearchParams` + `buildVitrineSearchParams`:
  - Quando `searchParams` mudar externamente (ex.: clique em link com `?categoria=android`), sincronizar o estado da vitrine (`useEffect` sem loop);
  - Ao usuário alterar categoria, unidade, preço, armazenamento, ordenação ou busca, atualizar `setSearchParams(buildVitrineSearchParams(nextState), { replace: true })` e resetar `visibleCount` para `VITRINE_BATCH_SIZE` (`12`);
  - Quando usuário clicar em `"Jardim"` ou `"Guia Lopes"` na barra de unidade, atualizar também `setPreferredStoreUnit("jardim" | "gll")`.
- Busca com botão `"X"` para limpar rapidamente quando `search.length > 0` (`aria-label="Limpar busca"`);
- Barra de filtros organizada em:
  1. Busca + `<select>` de ordenação (`aria-label="Ordenar produtos"`);
  2. Pílulas horizontais de Categoria (`HOME_CATEGORY_PILLS`);
  3. Linha de Unidade (`UNIT_FILTER_PILLS`) + botão **`Filtros`** (`aria-expanded={showFilters}` com badge contador `countSecondaryFilters(filterState)`) + botão `Limpar filtros` quando `hasAnyActiveVitrineFilter`;
  4. Gaveta expansível (`showFilters`) com `PRICE_RANGES` (em centavos!) e chips de armazenamento (`extractStorageOptions(allProducts)`);
- No loading (`catalogStatusQuery.isLoading || productsQuery.isLoading`), exibir grid com 6 `<ProductCardSkeleton />`;
- No grid pronto, exibir `visibleProducts = sliceVitrineBatch(filteredProducts, visibleCount)` e, se `visibleCount < filteredProducts.length`, botão central **`Ver mais produtos (restam N)`** adicionando `+VITRINE_BATCH_SIZE` (`12`);
- Cards de unidades em `#unidades`: substituir URLs fixas por `waLink(s.whatsappJardim || "5567992086012", ...)` e `waLink(s.whatsappGll || "5567998206533", ...)`;
- Card 1 de SEO local (`src/pages/Home.tsx` ~linha 651): atualizar `"Modelos do iPhone 11 ao iPhone 16 Pro Max com pronta entrega."` para `"Linha completa do iPhone 11 aos lançamentos atuais com pronta entrega."`.

- [ ] **Step 2: Validar testes, typecheck e lint**

Run: `pnpm test && pnpm check && pnpm lint`
Expected: 100% pass, 0 erros TS, 0 erros ESLint.

- [ ] **Step 3: Commit da Task 4**

```bash
git add src/pages/Home.tsx
git commit -m "feat(vitrine): adicionar filtro de unidade, gaveta colapsavel, skeletons e paginacao"
```

---

### Task 5: Verificação final completa e inspeção dos bundles da Fase 3

- [ ] **Step 1: Executar pipeline completa de verificação após a última edição**

Run: `pnpm test && pnpm check && pnpm lint && pnpm build && git status --short`
Expected:
- Todos os testes em `api/**/*.test.ts` passando sem falhas ou skips;
- `tsc -b` 0 erros;
- `eslint .` 0 erros;
- `pnpm build` concluído com sucesso e chunks atualizados em `dist/public/assets/`.
