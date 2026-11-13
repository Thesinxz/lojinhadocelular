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
