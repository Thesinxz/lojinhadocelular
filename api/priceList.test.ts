import { describe, expect, it } from "vitest";
import { DEFAULT_VALUATION_CONFIG } from "@contracts/types";
import { buildPriceList } from "../src/lib/priceList";
import { evaluateDevice } from "../src/lib/valuationEngine";

const perfect = {
  visualCondition: "Pouquíssimas marcas de uso",
  batteryPercent: 95,
  faceId: "Sim",
  screenOriginal: "Sim",
  batteryOriginal: "Sim",
  camerasOk: "Sim",
  audioOk: "Sim",
  chargingPortOk: "Sim",
  openedBefore: "Não",
  icloudFree: "Sim",
};

describe("lista fixa de preços (modelo × armazenamento)", () => {
  const list = buildPriceList({});

  it("traz os modelos avaliados com todas as capacidades do catálogo, do mais novo ao mais antigo", () => {
    const names = list.map((m) => m.name);
    expect(names[0]).toBe("iPhone 18 Pro Max");
    expect(names).toContain("iPhone 13");
    expect(names).not.toContain("iPhone 3G");
    const pro = list.find((m) => m.name === "iPhone 18 Pro")!;
    expect(pro.rows.map((r) => r.capacity)).toEqual(["256GB", "512GB", "1TB", "2TB"]);
    expect(new Set(list.map((m) => m.key)).size).toBe(list.length);
  });

  it("modelos sem preço padrão aparecem sem sugestão", () => {
    const pro = list.find((m) => m.name === "iPhone 18 Pro Max")!;
    expect(pro.rows.every((r) => r.suggested === 0 && r.suggestedSource === "sem-preco")).toBe(true);
  });

  it("o preço de uma linha vira o valor do motor para aquele GB e só para ele", () => {
    const row = list.find((m) => m.name === "iPhone 13")!.rows.find((r) => r.capacity === "256GB")!;
    const cfg = { ...DEFAULT_VALUATION_CONFIG, customBasePrices: { [row.key]: 2000 } };
    const at256 = evaluateDevice({ ...perfect, model: "iPhone 13", storage: "256GB" }, cfg);
    const at128 = evaluateDevice({ ...perfect, model: "iPhone 13", storage: "128GB" }, cfg);
    const defaults = evaluateDevice({ ...perfect, model: "iPhone 13", storage: "128GB" }, DEFAULT_VALUATION_CONFIG);
    expect(at256.basePrice).toBe(2000);
    expect(at128.maxEstimatedValue).toBe(defaults.maxEstimatedValue);
  });

  it("definir o preço do 18 Pro Max em um GB cota só esse GB", () => {
    const row = list.find((m) => m.name === "iPhone 18 Pro Max")!.rows.find((r) => r.capacity === "512GB")!;
    const cfg = { ...DEFAULT_VALUATION_CONFIG, customBasePrices: { [row.key]: 7000 } };
    expect(evaluateDevice({ ...perfect, model: "iPhone 18 Pro Max", storage: "512GB" }, cfg).priceable).toBe(true);
    expect(evaluateDevice({ ...perfect, model: "iPhone 18 Pro Max", storage: "256GB" }, cfg).priceable).toBe(false);
  });
});

describe("preço por cor na lista fixa", () => {
  const list = buildPriceList({});
  const row = list.find((m) => m.name === "iPhone 15 Pro")!.rows.find((r) => r.capacity === "256GB")!;
  const color = row.colors[0];

  it("cada linha traz as cores do catálogo", () => {
    expect(row.colors.length).toBeGreaterThan(1);
    expect(new Set(row.colors.map((c) => c.key)).size).toBe(row.colors.length);
  });

  it("a cor com preço próprio vale só para ela; as outras seguem o preço do GB", () => {
    const cfg = { ...DEFAULT_VALUATION_CONFIG, customBasePrices: { [row.key]: 3000, [color.key]: 3400 } };
    const input = { ...perfect, model: "iPhone 15 Pro", storage: "256GB" };
    expect(evaluateDevice({ ...input, color: color.name }, cfg).basePrice).toBe(3400);
    expect(evaluateDevice({ ...input, color: row.colors[1].name }, cfg).basePrice).toBe(3000);
    expect(evaluateDevice(input, cfg).basePrice).toBe(3000);
  });

  it("a sugestão da cor é o valor do GB quando ele tem preço próprio", () => {
    const withGb = buildPriceList({ [row.key]: 3000 }).find((m) => m.name === "iPhone 15 Pro")!.rows.find((r) => r.capacity === "256GB")!;
    expect(withGb.colors[0].suggested).toBe(3000);
  });
});
