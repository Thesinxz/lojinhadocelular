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
      {
        id: 42,
        name: "iPhone 15",
        brand: "Apple",
        category: "iphone_lacrado",
        variants: SAMPLE_VARIANTS,
      },
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
    expect(findProductInCachedCatalog(catalog, "iphone-16-pro-1234abcd")?.name).toBe(
      "iPhone 16 Pro",
    );
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

    // Ao mudar para Pink na versão eSIM encontra combinação exata em estoque
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
    expect(
      extractStreetAddress("Av. Duque de Caxias, 486 - Jardim/MS", "Av. Duque de Caxias, 486"),
    ).toBe("Av. Duque de Caxias, 486");

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
    }) as {
      offers: { seller: { address: { streetAddress: string; addressLocality: string } } };
    };

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
    }) as {
      offers: {
        seller: { address: { streetAddress: string; addressLocality: string; postalCode: string } };
      };
    };

    expect(guiaSchema.offers.seller.address.streetAddress).toBe("Rua Macias Barbosa, 2185");
    expect(guiaSchema.offers.seller.address.addressLocality).toBe("Guia Lopes da Laguna");
    expect(guiaSchema.offers.seller.address.postalCode).toBe("79230-000");
  });

  it("selectRelatedProducts exclui produto atual e esgotados, priorizando categoria/marca e preço próximo", () => {
    const items = [
      {
        id: 1,
        name: "iPhone 15",
        brand: "Apple",
        category: "iphone_lacrado",
        variants: [{ available: true, quantity: 1, priceCash: 420000 }],
      },
      {
        id: 2,
        name: "iPhone 15 Plus",
        brand: "Apple",
        category: "iphone_lacrado",
        variants: [{ available: true, quantity: 1, priceCash: 450000 }],
      },
      {
        id: 3,
        name: "Cabo USB-C",
        brand: "Apple",
        category: "acessorio",
        variants: [{ available: true, quantity: 1, priceCash: 15000 }],
      },
      {
        id: 4,
        name: "iPhone 16",
        brand: "Apple",
        category: "iphone_lacrado",
        variants: [{ available: true, quantity: 1, priceCash: 490000 }],
      },
      {
        id: 5,
        name: "iPhone 14 Esgotado",
        brand: "Apple",
        category: "iphone_lacrado",
        variants: [{ available: true, quantity: 0, priceCash: 350000 }],
      },
      {
        id: 6,
        name: "iPhone 15 Pro",
        brand: "Apple",
        category: "iphone_lacrado",
        variants: [{ available: true, quantity: 1, priceCash: 540000 }],
      },
      {
        id: 7,
        name: "Redmi Note 13",
        brand: "Xiaomi",
        category: "android",
        variants: [{ available: true, quantity: 1, priceCash: 130000 }],
      },
    ];

    const related = selectRelatedProducts(items, items[0], 4);
    expect(related).toHaveLength(4);
    expect(related.some((p) => p.id === 1)).toBe(false);
    expect(related.some((p) => p.id === 5)).toBe(false);
    expect(related[0].id).toBe(2);
    expect(related.slice(0, 3).every((p) => p.category === "iphone_lacrado")).toBe(true);
  });
});
