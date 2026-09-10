import { describe, it, expect } from "vitest";
import { DEMO_CLIENTS, DEMO_PRODUCTS } from "../src/lib/catalogDemo";

describe("Catalog Demo Data", () => {
  it("deve carregar a lista de clientes para a prova social", () => {
    expect(DEMO_CLIENTS.length).toBeGreaterThanOrEqual(3);
    DEMO_CLIENTS.forEach((c) => {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.bought).toBeTruthy();
      expect(c.avatarUrl).toBeTruthy();
    });
  });

  it("deve conter produtos de demonstracao validos com variantes de preco e estoque", () => {
    expect(DEMO_PRODUCTS.length).toBeGreaterThanOrEqual(3);
    DEMO_PRODUCTS.forEach((p) => {
      expect(p.id).toBeGreaterThan(0);
      expect(p.name).toBeTruthy();
      expect(p.brand).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.variants.length).toBeGreaterThan(0);
      p.variants.forEach((v) => {
        expect(v.priceCash).toBeGreaterThan(0);
        expect(v.storage).toBeTruthy();
        expect(v.color).toBeTruthy();
      });
    });
  });

  it("deve carregar a base completa de iPhones com especificações oficiais", async () => {
    const { IPHONE_CATALOG, detectIphoneModel, getIphoneModelColorImage } = await import(
      "../src/lib/iphoneCatalog"
    );
    expect(IPHONE_CATALOG.length).toBeGreaterThanOrEqual(45);

    // Teste de detecção de modelos recentes
    const m17 = detectIphoneModel("iPhone 17 Pro Max");
    expect(m17).toBeTruthy();
    expect(m17?.year).toBe(2025);
    expect(m17?.screen).toBe('6.9"');
    expect(m17?.capacities).toContain("256GB");

    // Teste de resolução de imagem por cor
    const imgOrange = getIphoneModelColorImage(m17, "Cosmic Orange");
    expect(imgOrange).toContain("iphone-17-pro-max-cosmic-orange.png");
    expect(imgOrange).toContain("https://gestaocelular.com.br");

    // Teste de detecção flexível (sem 'iPhone' ou case insensitive)
    const m16 = detectIphoneModel("16 pro");
    expect(m16?.name).toBe("iPhone 16 Pro");
    expect(m16?.year).toBe(2024);

    const mAir = detectIphoneModel("iPhone Air");
    expect(mAir?.name).toBe("iPhone Air");
    expect(mAir?.screen).toBe('6.5"');
  });
});

