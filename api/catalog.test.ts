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
});
