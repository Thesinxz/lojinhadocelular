import { describe, it, expect } from "vitest";
import {
  parsePriceToCents,
  parseStockQuantity,
  parseBatteryHealth,
  inferBrandAndCategory,
  extractBatteryFromName,
  adaptErpProduct,
  adaptErpCatalog,
  adaptErpCatalogResponse,
} from "./erp/adapter";
import { applyOverridesToProducts } from "./erp/overrides";
import type { ErpRawProduct, ShopProduct } from "./erp/types";

describe("Gestão Celular ERP Adapter", () => {
  describe("parsePriceToCents", () => {
    it("deve converter valores numéricos em reais para centavos", () => {
      expect(parsePriceToCents(5499.9)).toBe(549990);
      expect(parsePriceToCents(1200)).toBe(120000);
      expect(parsePriceToCents(49.99)).toBe(4999);
    });

    it("deve preservar valores numéricos que já estão em centavos", () => {
      expect(parsePriceToCents(549900)).toBe(549900);
      expect(parsePriceToCents(120000)).toBe(120000);
    });

    it("deve converter strings em formato monetário brasileiro", () => {
      expect(parsePriceToCents("5.499,00")).toBe(549900);
      expect(parsePriceToCents("R$ 4.290,50")).toBe(429050);
      expect(parsePriceToCents("349,90")).toBe(34990);
    });

    it("deve converter strings em formato decimal padrão", () => {
      expect(parsePriceToCents("5499.00")).toBe(549900);
      expect(parsePriceToCents("2999")).toBe(299900);
    });

    it("deve retornar 0 para valores vazios ou inválidos", () => {
      expect(parsePriceToCents(undefined)).toBe(0);
      expect(parsePriceToCents(null)).toBe(0);
      expect(parsePriceToCents("")).toBe(0);
      expect(parsePriceToCents("invalido")).toBe(0);
    });
  });

  describe("parseStockQuantity", () => {
    it("deve converter corretamente números e strings de estoque", () => {
      expect(parseStockQuantity(5)).toBe(5);
      expect(parseStockQuantity("3")).toBe(3);
      expect(parseStockQuantity(" 10 ")).toBe(10);
      expect(parseStockQuantity(0)).toBe(0);
      expect(parseStockQuantity("0")).toBe(0);
      expect(parseStockQuantity(-1)).toBe(0);
      expect(parseStockQuantity(undefined)).toBe(0);
    });
  });

  describe("parseBatteryHealth", () => {
    it("deve normalizar a saúde da bateria com símbolo de porcentagem", () => {
      expect(parseBatteryHealth("100%")).toBe("100%");
      expect(parseBatteryHealth("88")).toBe("88%");
      expect(parseBatteryHealth(92)).toBe("92%");
      expect(parseBatteryHealth("Bateria 85%")).toBe("85%");
    });

    it("deve retornar null se a saúde não estiver informada ou for 0", () => {
      expect(parseBatteryHealth(undefined)).toBeNull();
      expect(parseBatteryHealth(null)).toBeNull();
      expect(parseBatteryHealth("")).toBeNull();
      expect(parseBatteryHealth(0)).toBeNull();
    });
  });

  describe("inferBrandAndCategory", () => {
    it("deve inferir Apple e iphone_lacrado para iPhone novo/lacrado", () => {
      const res = inferBrandAndCategory({
        name: "iPhone 16 Pro Max 256GB Desert Titanium",
        condition: "lacrado",
      });
      expect(res.brand).toBe("Apple");
      expect(res.category).toBe("iphone_lacrado");
      expect(res.condition).toBe("lacrado");
    });

    it("deve inferir Apple e iphone_seminovo para iPhone seminovo", () => {
      const res = inferBrandAndCategory({
        name: "iPhone 13 128GB Estelar",
        condition: "seminovo",
      });
      expect(res.brand).toBe("Apple");
      expect(res.category).toBe("iphone_seminovo");
      expect(res.condition).toBe("seminovo");
    });

    it("deve inferir Xiaomi e android para celulares Xiaomi", () => {
      const res = inferBrandAndCategory({
        name: "Xiaomi Redmi Note 13 Pro 256GB",
      });
      expect(res.brand).toBe("Xiaomi");
      expect(res.category).toBe("android");
    });

    it("deve inferir Samsung e android para smartphones Galaxy", () => {
      const res = inferBrandAndCategory({
        name: "Samsung Galaxy S24 Ultra 512GB",
      });
      expect(res.brand).toBe("Samsung");
      expect(res.category).toBe("android");
    });

    it("deve inferir acessório para capinhas, cabos e carregadores", () => {
      const res = inferBrandAndCategory({
        name: "Carregador 20W USB-C Apple Original",
      });
      expect(res.category).toBe("acessorio");
    });

    it("deve inferir Apple e iphone_seminovo para nomes do ERP como 'Aparelho 14 PRO MAX 128 - ROXO (A) - Seminovo'", () => {
      const res = inferBrandAndCategory({
        name: "Aparelho 14 PRO MAX 128 - ROXO (A) - Seminovo",
        condition: "seminovo",
      });
      expect(res.brand).toBe("Apple");
      expect(res.category).toBe("iphone_seminovo");
    });

    it("deve inferir Apple para nomes como 'Aparelho 15 128 - PRETO (B)'", () => {
      const res = inferBrandAndCategory({
        name: "Aparelho 15 128 - PRETO (B)",
        condition: "seminovo",
      });
      expect(res.brand).toBe("Apple");
      expect(res.category).toBe("iphone_seminovo");
    });
  });

  describe("applyOverridesToProducts", () => {
    it("deve aplicar personalizações de foto, vídeo, bateria, garantia e destaque sobre o produto do ERP", async () => {
      const { applyOverridesToProducts } = await import("./erp/overrides");

      const baseProduct = {
        id: "erp-uuid-1",
        source: "erp" as const,
        externalId: "erp-uuid-1",
        name: "Aparelho 14 PRO MAX 128",
        brand: "Apple",
        category: "iphone_seminovo" as const,
        condition: "seminovo",
        description: null,
        imageUrl: "/fallback.png",
        videoUrl: null,
        warranty: "6 meses",
        featured: false,
        active: true,
        createdAt: new Date(),
        variants: [
          {
            id: "erp-uuid-1-1",
            productId: "erp-uuid-1",
            version: "",
            storage: "128GB",
            color: "Roxo",
            colorHex: "#594f63",
            imageUrl: "/fallback.png",
            videoUrl: null,
            sku: "ERP-123",
            batteryHealth: null,
            warranty: "6 meses",
            condition: "seminovo",
            notes: null,
            priceCash: 450000,
            quantity: 1,
            available: true,
          },
        ],
      };

      const overrides = {
        "erp-uuid-1": {
          imageUrl: "https://meusite.com/foto-real-14promax.jpg",
          videoUrl: "https://youtube.com/shorts/demo123",
          batteryHealth: "89%",
          warranty: "1 ano de garantia Apple",
          featured: true,
          active: true,
          customName: "iPhone 14 Pro Max 128GB Roxo Impecável",
        },
      };

      const merged = applyOverridesToProducts([baseProduct], overrides);
      expect(merged.length).toBe(1);

      const p = merged[0];
      expect(p.name).toBe("iPhone 14 Pro Max 128GB Roxo Impecável");
      expect(p.imageUrl).toBe("https://meusite.com/foto-real-14promax.jpg");
      expect(p.videoUrl).toBe("https://youtube.com/shorts/demo123");
      expect(p.warranty).toBe("1 ano de garantia Apple");
      expect(p.featured).toBe(true);

      const v = p.variants[0];
      expect(v.imageUrl).toBe("https://meusite.com/foto-real-14promax.jpg");
      expect(v.videoUrl).toBe("https://youtube.com/shorts/demo123");
      expect(v.batteryHealth).toBe("89%");
      expect(p.batteryHealth).toBe("89%");
      expect(v.warranty).toBe("1 ano de garantia Apple");
    });

    it("deve aplicar override de bateria mesmo quando o produto estiver em alternateIds", () => {
      const baseProduct: ShopProduct = {
        id: "erp-uuid-primary",
        externalId: "erp-uuid-primary",
        alternateIds: ["erp-uuid-secondary", "69d9d2c4-bfa8-4c9e-b3f2-1d317e57a0d0"],
        source: "erp",
        name: "APPLE CEL IPHONE 15 PRO 515GB BLUE TITANIUM",
        brand: "Apple",
        category: "iphone_seminovo",
        condition: "seminovo",
        description: null,
        imageUrl: null,
        videoUrl: null,
        warranty: "6 meses",
        featured: false,
        active: true,
        createdAt: new Date(),
        variants: [
          {
            id: "erp-uuid-primary-1",
            productId: "erp-uuid-primary",
            version: "",
            storage: "512GB",
            color: "BLUE TITANIUM",
            colorHex: "#3b4454",
            imageUrl: null,
            videoUrl: null,
            sku: "ERP-15PRO",
            batteryHealth: null,
            warranty: "6 meses",
            condition: "seminovo",
            notes: null,
            priceCash: 414999,
            quantity: 1,
            available: true,
          },
        ],
      };

      const overrides = {
        "69d9d2c4-bfa8-4c9e-b3f2-1d317e57a0d0": {
          batteryHealth: "80%",
        },
      };

      const merged = applyOverridesToProducts([baseProduct], overrides);
      expect(merged[0].variants[0].batteryHealth).toBe("80%");
      expect(merged[0].batteryHealth).toBe("80%");
    });

    it("deve normalizar batteryHealth de número puro '85' para '85%' com símbolo de porcentagem", () => {
      const baseProduct: ShopProduct = {
        id: "erp-uuid-num",
        externalId: "erp-uuid-num",
        source: "erp",
        name: "APPLE CEL IPHONE 14 128GB",
        brand: "Apple",
        category: "iphone_seminovo",
        condition: "seminovo",
        description: null,
        imageUrl: null,
        videoUrl: null,
        warranty: "6 meses",
        featured: false,
        active: true,
        createdAt: new Date(),
        variants: [
          {
            id: "erp-uuid-num-1",
            productId: "erp-uuid-num",
            version: "",
            storage: "128GB",
            color: "Azul",
            colorHex: "#3b4454",
            imageUrl: null,
            videoUrl: null,
            sku: "ERP-14",
            batteryHealth: null,
            warranty: "6 meses",
            condition: "seminovo",
            notes: null,
            priceCash: 350000,
            quantity: 1,
            available: true,
          },
        ],
      };

      const overrides = {
        "erp-uuid-num": {
          batteryHealth: "85",
        },
      };

      const merged = applyOverridesToProducts([baseProduct], overrides);
      expect(merged[0].variants[0].batteryHealth).toBe("85%");
      expect(merged[0].batteryHealth).toBe("85%");
    });
  });

  describe("extractBatteryFromName", () => {
    it("deve extrair saúde da bateria a partir do título do produto quando informado", () => {
      expect(extractBatteryFromName("iPhone 15 Pro 512GB Blue Titanium Bat 80%")).toBe("80%");
      expect(extractBatteryFromName("APPLE CEL IPHONE 13 128GB BATERIA 85%")).toBe("85%");
      expect(extractBatteryFromName("iPhone 14 Pro Max 256GB - 91% Bateria")).toBe("91%");
      expect(extractBatteryFromName("iPhone 15 Pro 515GB Blue Titanium")).toBeNull();
    });
  });

  describe("adaptErpProduct & Estoque Zero", () => {
    const mockErpItem: ErpRawProduct = {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "iPhone 15 Pro Max 256GB Titânio Natural",
      brand: "Apple",
      condition: "seminovo",
      price_cash: "5.790,00",
      stock: 2,
      battery_health: "94%",
      color: "Titânio Natural",
      storage: "256GB",
      warranty: "1 ano de garantia",
    };

    it("deve adaptar produto com estoque positivo preservando UUID e campos oficiais", () => {
      const adapted = adaptErpProduct(mockErpItem);
      expect(adapted).not.toBeNull();
      if (!adapted) return;

      expect(adapted.id).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
      expect(adapted.externalId).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
      expect(adapted.source).toBe("erp");
      expect(adapted.name).toBe("iPhone 15 Pro Max 256GB Titânio Natural");
      expect(adapted.brand).toBe("Apple");
      expect(adapted.category).toBe("iphone_seminovo");
      expect(adapted.condition).toBe("seminovo");
      expect(adapted.variants.length).toBe(1);

      const v = adapted.variants[0];
      expect(v.priceCash).toBe(579000);
      expect(v.quantity).toBe(2);
      expect(v.available).toBe(true);
      expect(v.batteryHealth).toBe("94%");
      expect(v.storage).toBe("256GB");
      expect(v.color).toBe("Titânio Natural");
      expect(v.colorHex).toBe("#bebaa7");
    });

    it("deve DESCARTAR produto quando estoque for zero (Requisito 3)", () => {
      const outOfStockItem: ErpRawProduct = {
        ...mockErpItem,
        id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        stock: 0,
        quantity: 0,
        saldo: "0",
      };

      const adapted = adaptErpProduct(outOfStockItem);
      expect(adapted).toBeNull();
    });

    it("deve descartar variantes com estoque zero e manter apenas variantes com estoque", () => {
      const itemWithVariants: ErpRawProduct = {
        id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
        name: "iPhone 14 128GB",
        brand: "Apple",
        variants: [
          {
            id: "var-1",
            color: "Estelar",
            storage: "128GB",
            stock: 0,
            price: 3890,
          },
          {
            id: "var-2",
            color: "Meia-noite",
            storage: "128GB",
            stock: 3,
            price: 3890,
          },
        ],
      };

      const adapted = adaptErpProduct(itemWithVariants);
      expect(adapted).not.toBeNull();
      if (!adapted) return;

      expect(adapted.variants.length).toBe(1);
      expect(adapted.variants[0].color).toBe("Meia-noite");
      expect(adapted.variants[0].quantity).toBe(3);
    });
    it("deve identificar disponibilidade por unidade (Jardim vs Guia Lopes vs Ambas)", () => {
      const matrizId = "dd89c64c-5188-4f14-a32b-a915e8e3b9b3";
      const guiaId = "71e3305a-b48b-4026-b953-7bdd3217648b";

      // 1. Exclusivo de Guia Lopes
      const guiaOnly: ErpRawProduct = {
        id: "guia-prod-1",
        name: "iPhone 14 256GB Roxo",
        price: 2150,
        stocks: [
          { unit_id: matrizId, available: 0 },
          { unit_id: guiaId, available: 1 },
        ],
      };
      const adaptedGuia = adaptErpProduct(guiaOnly, "all");
      expect(adaptedGuia).not.toBeNull();
      expect(adaptedGuia?.unitAvailability).toBe("guia_lopes");
      expect(adaptedGuia?.stockJardim).toBe(0);
      expect(adaptedGuia?.stockGuiaLopes).toBe(1);

      // Se o filtro for Matriz (Jardim), deve ser descartado
      const adaptedGuiaFilteredMatriz = adaptErpProduct(guiaOnly, matrizId);
      expect(adaptedGuiaFilteredMatriz).toBeNull();

      // 2. Exclusivo de Jardim (Matriz)
      const jardimOnly: ErpRawProduct = {
        id: "jardim-prod-1",
        name: "iPhone 15 128GB Preto",
        price: 2899,
        stocks: [
          { unit_id: matrizId, available: 2 },
          { unit_id: guiaId, available: 0 },
        ],
      };
      const adaptedJardim = adaptErpProduct(jardimOnly, "all");
      expect(adaptedJardim).not.toBeNull();
      expect(adaptedJardim?.unitAvailability).toBe("jardim");
      expect(adaptedJardim?.stockJardim).toBe(2);
      expect(adaptedJardim?.stockGuiaLopes).toBe(0);

      // 3. Produto com estoque na matriz e espelhado na filial pelo ERP
      const ambas: ErpRawProduct = {
        id: "ambas-prod-1",
        name: "iPhone 13 128GB Meia-noite",
        price: 2100,
        stocks: [
          { unit_id: matrizId, available: 1 },
          { unit_id: guiaId, available: 1 },
        ],
      };
      const adaptedAmbas = adaptErpProduct(ambas, "all");
      expect(adaptedAmbas).not.toBeNull();
      // Não duplica quantidade física
      expect(adaptedAmbas?.variants[0].quantity).toBe(1);
      expect(adaptedAmbas?.unitAvailability).toBe("jardim");
      expect(adaptedAmbas?.stockJardim).toBe(1);
      expect(adaptedAmbas?.stockGuiaLopes).toBe(1);
    });

    it("deve DESCARTAR modelos inexistentes / fictícios de teste do ERP como iPhone 17+", () => {
      const fakeIphone17: ErpRawProduct = {
        id: "fake-17",
        name: "CEL IPHONE 17 PRO MAX SILVER 256GB",
        price: 7219,
        stock: 1,
        stocks: [{ unit_id: "71e3305a-b48b-4026-b953-7bdd3217648b", available: 1 }],
      };
      expect(adaptErpProduct(fakeIphone17)).toBeNull();
    });
  });

  describe("adaptErpCatalogResponse", () => {
    it("deve mesclar produtos duplicados idênticos somando quantidades e agrupando estoque", () => {
      const matrizId = "dd89c64c-5188-4f14-a32b-a915e8e3b9b3";
      const guiaId = "71e3305a-b48b-4026-b953-7bdd3217648b";

      const duplicates: ErpRawProduct[] = [
        {
          id: "dup-1",
          name: "iPhone 15 Pro Max 512GB Azul",
          condition: "USED",
          storage_capacity: "512GB",
          color: "Azul",
          price: 4199,
          stocks: [{ unit_id: matrizId, available: 1 }, { unit_id: guiaId, available: 0 }],
        },
        {
          id: "dup-2",
          name: "iPhone 15 Pro Max 512GB Azul",
          condition: "USED",
          storage_capacity: "512GB",
          color: "Azul",
          price: 4199,
          stocks: [{ unit_id: matrizId, available: 0 }, { unit_id: guiaId, available: 1 }],
        },
      ];

      const res = adaptErpCatalog(duplicates, "all");
      expect(res.length).toBe(1);
      expect(res[0].id).toBe("dup-1");
      expect(res[0].alternateIds).toContain("dup-2");
      expect(res[0].variants[0].quantity).toBe(2);
      expect(res[0].stockJardim).toBe(1);
      expect(res[0].stockGuiaLopes).toBe(1);
      expect(res[0].unitAvailability).toBe("jardim");
    });

    it("deve processar arrays e envelopes de dados da API", () => {
      const rawList: ErpRawProduct[] = [
        {
          id: "uuid-1",
          name: "iPhone 13 128GB Rosa",
          stock: 1,
          price: 2999,
        },
        {
          id: "uuid-2",
          name: "iPhone 11 64GB Preto",
          stock: 0,
          price: 1899,
        },
      ];

      const res1 = adaptErpCatalogResponse(rawList);
      expect(res1.length).toBe(1);
      expect(res1[0].id).toBe("uuid-1");

      const res2 = adaptErpCatalogResponse({ data: rawList });
      expect(res2.length).toBe(1);
      expect(res2[0].id).toBe("uuid-1");

      const res3 = adaptErpCatalogResponse({ products: rawList });
      expect(res3.length).toBe(1);
      expect(res3[0].id).toBe("uuid-1");

      const res4 = adaptErpCatalogResponse({
        success: true,
        data: {
          sucesso: true,
          dados: {
            products: [
              {
                ...rawList[0],
                stock: undefined,
                available_quantity: 2,
                stocks: [
                  {
                    unit_id: "dd89c64c-5188-4f14-a32b-a915e8e3b9b3",
                    available_quantity: 2,
                  },
                ],
              },
            ],
          },
        },
      });
      expect(res4.length).toBe(1);
      expect(res4[0].id).toBe("uuid-1");
      expect(res4[0].variants[0].quantity).toBe(2);
    });
  });

  describe("getErpCatalog Service & Cache", () => {
    it("deve retornar do cache em memória se a chamada for recente (< 45s)", async () => {
      const { setErpCacheForTesting, getErpCatalog } = await import("./erp/service");
      const { env } = await import("./lib/env");
      
      const prevEnabled = env.erpCatalogEnabled;
      const prevSlug = env.erpStoreSlug;

      try {
        env.erpCatalogEnabled = true;
        env.erpStoreSlug = "minha-loja-teste";

        const dummyProduct = {
          id: "cached-uuid-1",
          source: "erp" as const,
          externalId: "cached-uuid-1",
          name: "iPhone em Cache",
          brand: "Apple",
          category: "iphone_lacrado" as const,
          condition: "lacrado",
          description: null,
          imageUrl: null,
          warranty: "1 ano",
          featured: false,
          active: true,
          createdAt: new Date(),
          variants: [],
        };

        setErpCacheForTesting([dummyProduct], Date.now());

        const result = await getErpCatalog();
        expect(result.status).toBe("ok");
        expect(result.products.length).toBe(1);
        expect(result.products[0].id).toBe("cached-uuid-1");
      } finally {
        env.erpCatalogEnabled = prevEnabled;
        env.erpStoreSlug = prevSlug;
      }
    });

    it("deve acusar config_error quando ERP_STORE_SLUG for inválido ou ausente", async () => {
      const { clearErpCache, getErpCatalog } = await import("./erp/service");
      const { env } = await import("./lib/env");

      const prevEnabled = env.erpCatalogEnabled;
      const prevSlug = env.erpStoreSlug;

      try {
        clearErpCache();
        env.erpCatalogEnabled = true;
        env.erpStoreSlug = "<slug-da-empresa>";

        const result = await getErpCatalog();
        expect(result.status).toBe("config_error");
        expect(result.products.length).toBe(0);
      } finally {
        env.erpCatalogEnabled = prevEnabled;
        env.erpStoreSlug = prevSlug;
      }
    });

    it("nunca deve retornar dados obsoletos se o ERP estiver fora do ar", async () => {
      const { clearErpCache, getErpCatalog } = await import("./erp/service");
      const { env } = await import("./lib/env");

      const prevEnabled = env.erpCatalogEnabled;
      const prevSlug = env.erpStoreSlug;
      const prevUrl = env.erpApiUrl;

      try {
        clearErpCache();
        env.erpCatalogEnabled = true;
        env.erpStoreSlug = "loja-teste-offline";
        // URL inexistente que causará falha de conexão
        env.erpApiUrl = "http://127.0.0.1:59999";

        const result = await getErpCatalog();
        expect(result.status).toBe("offline");
        expect(result.products.length).toBe(0);
      } finally {
        env.erpCatalogEnabled = prevEnabled;
        env.erpStoreSlug = prevSlug;
        env.erpApiUrl = prevUrl;
      }
    });
  });

  describe("Conexão Real com Gestão Celular ERP", () => {
    it("deve carregar os produtos reais da Lojinha do Celular quando configurado", async () => {
      const { clearErpCache, getErpCatalog } = await import("./erp/service");
      const { env } = await import("./lib/env");

      const prevEnabled = env.erpCatalogEnabled;
      const prevSlug = env.erpStoreSlug;
      const prevUrl = env.erpApiUrl;
      const prevCat = env.erpCategorySlug;

      try {
        clearErpCache();
        env.erpCatalogEnabled = true;
        env.erpApiUrl = "https://api.gestaocelular.com.br";
        env.erpStoreSlug = "lojinha-do-celular-mplnk5d6";
        env.erpCategorySlug = "aparelhos-celulares";

        const result = await getErpCatalog();
        expect(result.status).toBe("ok");
        expect(result.products.length).toBeGreaterThanOrEqual(10);

        // Verifica se todos os produtos retornados possuem estoque > 0
        result.products.forEach((p) => {
          expect(p.source).toBe("erp");
          expect(p.id).toBeTruthy();
          expect(p.name).toBeTruthy();
          const totalStock = p.variants.reduce((acc, v) => acc + v.quantity, 0);
          expect(totalStock).toBeGreaterThan(0);
        });

        // Verifica especificamente se o iPhone 15 Pro Azul Titânio reflete a saúde da bateria de 80%
        const iphone15Pro = result.products.find(
          (p) =>
            p.externalId === "69d9d2c4-bfa8-4c9e-b3f2-1d317e57a0d0" ||
            p.alternateIds?.includes("69d9d2c4-bfa8-4c9e-b3f2-1d317e57a0d0"),
        );
        if (iphone15Pro) {
          expect(iphone15Pro.variants[0].batteryHealth).toBe("80%");
          expect(iphone15Pro.batteryHealth).toBe("80%");
        }
      } finally {
        env.erpCatalogEnabled = prevEnabled;
        env.erpStoreSlug = prevSlug;
        env.erpApiUrl = prevUrl;
        env.erpCategorySlug = prevCat;
      }
    });
  });
});
