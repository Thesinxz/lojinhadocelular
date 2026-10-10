import { beforeEach, describe, expect, it } from "vitest";
import {
  diffCatalog,
  listCatalogChanges,
  recordCatalogSnapshot,
  resetCatalogHistoryForTesting,
  type CatalogSnapshotProduct,
} from "./services/catalogHistory";

function product(id: string, patch: Partial<CatalogSnapshotProduct> = {}, price = 100000): CatalogSnapshotProduct {
  return {
    id,
    externalId: id,
    name: `Produto ${id}`,
    stockJardim: 1,
    stockGuiaLopes: 0,
    variants: [{ priceCash: price, available: true }],
    ...patch,
  };
}

beforeEach(() => resetCatalogHistoryForTesting());

describe("recordCatalogSnapshot", () => {
  it("a primeira sincronização só forma a base, sem eventos", async () => {
    expect(await recordCatalogSnapshot([product("a"), product("b")])).toBe(0);
    expect(await listCatalogChanges()).toEqual([]);
  });

  it("registra mudança de preço, estoque, produto novo e removido", async () => {
    await recordCatalogSnapshot([product("a"), product("b")]);
    const count = await recordCatalogSnapshot([
      product("a", { stockJardim: 0, stockGuiaLopes: 2 }, 90000),
      product("c"),
    ]);

    const changes = await listCatalogChanges();
    expect(count).toBe(5);
    const kinds = changes.map((c) => `${c.productId}:${c.kind}`).sort();
    expect(kinds).toEqual(["a:price", "a:stock_gll", "a:stock_jardim", "b:removed", "c:new"]);
    expect(changes.find((c) => c.kind === "price")).toMatchObject({ oldValue: 100000, newValue: 90000 });
  });

  it("não registra nada quando nada mudou e ignora catálogo vazio", async () => {
    await recordCatalogSnapshot([product("a")]);
    expect(await recordCatalogSnapshot([product("a")])).toBe(0);
    expect(await recordCatalogSnapshot([])).toBe(0);
    // O catálogo vazio não apaga a base: a volta não gera "novo".
    expect(await recordCatalogSnapshot([product("a")])).toBe(0);
  });

  it("filtra por produto", async () => {
    await recordCatalogSnapshot([product("a"), product("b")]);
    await recordCatalogSnapshot([product("a", {}, 1), product("b", {}, 2)]);
    const onlyA = await listCatalogChanges({ productId: "a" });
    expect(onlyA.map((c) => c.productId)).toEqual(["a"]);
  });
});

describe("diffCatalog", () => {
  it("estados iguais não geram mudanças", () => {
    const prev = new Map([["a", { name: "A", price: 100, stockJardim: 0, stockGll: 0 }]]);
    const cur = new Map([["a", { name: "A", price: 100, stockJardim: 0, stockGll: 0 }]]);
    expect(diffCatalog(prev, cur)).toEqual([]);
  });
});
