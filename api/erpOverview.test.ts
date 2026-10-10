import { describe, expect, it } from "vitest";
import { computeErpOverview, computeInterestOverview, productStock, type StockProductInput } from "./erpOverview";

function product(patch: Partial<StockProductInput> & { id: string }): StockProductInput {
  return {
    name: `Produto ${patch.id}`,
    category: "iphone_seminovo",
    condition: "seminovo",
    active: true,
    imageUrl: "https://img/x.jpg",
    batteryHealth: "90%",
    variants: [{ priceCash: 100000, available: true, quantity: 1, imageUrl: "x" }],
    ...patch,
  };
}

describe("productStock", () => {
  it("soma o estoque das variantes quando informam a loja", () => {
    expect(
      productStock(
        product({
          id: "a",
          variants: [
            { available: true, stockJardim: 2, stockGuiaLopes: 1 },
            { available: true, stockJardim: 1, stockGuiaLopes: 0 },
          ],
        }),
      ),
    ).toEqual({ jardim: 3, gll: 1 });
  });

  it("usa o produto quando as variantes não trazem estoque por loja", () => {
    expect(productStock(product({ id: "a", stockJardim: 4, stockGuiaLopes: 0 }))).toEqual({ jardim: 4, gll: 0 });
  });
});

describe("computeErpOverview", () => {
  it("separa esgotado numa loja e estoque baixo", () => {
    const result = computeErpOverview([
      product({ id: "1", stockJardim: 0, stockGuiaLopes: 3 }),
      product({ id: "2", stockJardim: 5, stockGuiaLopes: 0 }),
      product({ id: "3", stockJardim: 1, stockGuiaLopes: 2 }),
    ]);
    expect(result.stock.soldOutJardim.map((r) => r.id)).toEqual(["1"]);
    expect(result.stock.soldOutGll.map((r) => r.id)).toEqual(["2"]);
    expect(result.stock.lowJardim.map((r) => r.id)).toEqual(["3"]);
    expect(result.stock.lowGll.map((r) => r.id)).toEqual(["3"]);
    expect(result.stock.totals).toMatchObject({ jardim: 6, gll: 5, products: 3, visible: 3 });
  });

  it("aponta preço zero e produto oculto com estoque", () => {
    const result = computeErpOverview([
      product({ id: "1", variants: [{ priceCash: 0, available: true, quantity: 1, imageUrl: "x" }] }),
      product({ id: "2", active: false, stockJardim: 2 }),
      product({ id: "3", imageUrl: "", variants: [{ priceCash: 10, available: true, quantity: 1 }] }),
    ]);
    expect(result.issues.noPrice.map((r) => r.id)).toEqual(["1"]);
    expect(result.issues.hiddenWithStock.map((r) => r.id)).toEqual(["2"]);
    expect(result.issues.noPhoto.map((r) => r.id)).toEqual(["3"]);
  });
});

describe("computeInterestOverview", () => {
  it("cruza cliques com estoque e lista parados", () => {
    const products = [
      product({ id: "1", stockJardim: 2 }),
      product({ id: "2", stockGuiaLopes: 1 }),
      product({ id: "3", stockJardim: 0 }),
      product({ id: "4", active: false, stockJardim: 5 }),
    ];
    const result = computeInterestOverview(
      [
        { productId: "1", productName: "Produto 1", clicks: 7 },
        { productId: "gone", productName: "Sumiu", clicks: 1 },
      ],
      products,
    );
    expect(result.wanted[0]).toMatchObject({ productId: "1", clicks: 7, jardim: 2, gll: 0 });
    expect(result.wanted[1]).toMatchObject({ productId: "gone", name: "Sumiu", jardim: 0 });
    expect(result.stale.map((p) => p.productId)).toEqual(["2"]);
  });
});
