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

export function areVitrineFiltersEqual(
  a: VitrineFilterState,
  b: VitrineFilterState,
): boolean {
  return (
    a.category === b.category &&
    a.unit === b.unit &&
    a.priceKey === b.priceKey &&
    a.storage === b.storage &&
    a.sortBy === b.sortBy &&
    a.search === b.search
  );
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
