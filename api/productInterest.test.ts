import { beforeEach, describe, expect, it } from "vitest";
import {
  allowInterestClick,
  listProductInterest,
  recordProductInterest,
  resetProductInterestForTesting,
} from "./services/productInterest";

beforeEach(() => resetProductInterestForTesting());

describe("interesse por produto", () => {
  it("soma cliques por produto e ordena do mais clicado", async () => {
    await recordProductInterest("a", "Produto A");
    await recordProductInterest("b", "Produto B");
    await recordProductInterest("b", "Produto B");
    const list = await listProductInterest(30);
    expect(list).toEqual([
      { productId: "b", productName: "Produto B", clicks: 2 },
      { productId: "a", productName: "Produto A", clicks: 1 },
    ]);
  });

  it("ignora cliques fora da janela", async () => {
    const old = new Date(Date.now() - 40 * 86_400_000);
    await recordProductInterest("a", "Produto A", old);
    expect(await listProductInterest(30)).toEqual([]);
    expect((await listProductInterest(60)).length).toBe(1);
  });

  it("limita cliques por IP por minuto", () => {
    const now = Date.now();
    for (let i = 0; i < 30; i++) expect(allowInterestClick("1.1.1.1", now)).toBe(true);
    expect(allowInterestClick("1.1.1.1", now)).toBe(false);
    expect(allowInterestClick("2.2.2.2", now)).toBe(true);
    expect(allowInterestClick("1.1.1.1", now + 61_000)).toBe(true);
  });
});
