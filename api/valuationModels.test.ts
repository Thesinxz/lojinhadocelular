import { describe, expect, it } from "vitest";
import {
  batteryMultiplier,
  evaluateDevice,
  findBasePrice,
  findReferenceDevicePrice,
  getCustomBasePriceMatch,
  resolveIphoneModel,
  type ValuationInput,
} from "../src/lib/valuationEngine";

const good: Partial<ValuationInput> = {
  visualCondition: "Parece novo, sem marcas",
  batteryPercent: 92,
  faceId: "Sim",
  screenOriginal: "Sim",
  camerasOk: "Sim",
  audioOk: "Sim",
  chargingPortOk: "Sim",
  batteryOriginal: "Sim",
  openedBefore: "Não",
  hasBox: "Não",
};

describe("resolveIphoneModel", () => {
  it.each([
    ["iPhone 13 Pro Max", "iphone 13 pro max"],
    ["iphone13promax", "iphone 13 pro max"],
    ["13 pro max", "iphone 13 pro max"],
    ["iPhone 16e 256GB", "iphone 16e"],
    ["iPhone 13 mini", "iphone 13 mini"],
    ["iPhone 12 Pro", "iphone 12 pro"],
    ["iPhone Air", "iphone air"],
    ["iPhone XS Max", "iphone xs max"],
    ["iPhone XR", "iphone xr"],
    ["iPhone SE (3ª geração)", "iphone se 3"],
    ["iPhone SE 2020", "iphone se 2"],
    ["Apple iPhone 15 Plus", "iphone 15 plus"],
  ])("%s → %s", (input, key) => {
    expect(resolveIphoneModel(input)?.key).toBe(key);
  });

  it("não adivinha: o que não é iPhone reconhecido volta null", () => {
    expect(resolveIphoneModel("Samsung Galaxy S24")).toBeNull();
    expect(resolveIphoneModel("")).toBeNull();
    expect(resolveIphoneModel(undefined)).toBeNull();
    expect(resolveIphoneModel("iPhone 99 Ultra")).toBeNull();
  });
});

describe("preço por modelo (sem confundir variantes)", () => {
  it("13 mini, 16e e SE têm preço próprio", () => {
    expect(findBasePrice("iPhone 13 mini")).toBe(1250);
    expect(findBasePrice("iPhone 13")).toBe(1450);
    expect(findBasePrice("iPhone 16e")).toBe(2500);
    expect(findBasePrice("iPhone 16")).toBe(2900);
    expect(findBasePrice("iPhone SE (3ª geração)")).toBe(900);
    expect(findBasePrice("iphone13promax")).toBe(2250);
  });

  it("a tabela de referência não casa 13 mini com 13 nem 16e com 16", () => {
    expect(findReferenceDevicePrice("iPhone 13 mini", "128GB")).toBeNull();
    expect(findReferenceDevicePrice("iPhone 16e", "128GB")).toBeNull();
    expect(findReferenceDevicePrice("iPhone 13", "128GB")?.priceBrl).toBe(1450);
  });

  it("preço personalizado do 13 não vale para o 13 mini", () => {
    const custom = { "iphone 13": 1700 };
    expect(getCustomBasePriceMatch("iPhone 13", custom)?.price).toBe(1700);
    expect(getCustomBasePriceMatch("iPhone 13 mini", custom)).toBeNull();
    expect(getCustomBasePriceMatch("iPhone 13 Pro", custom)).toBeNull();
  });

  it("avaliação completa usa o modelo certo", () => {
    expect(evaluateDevice({ model: "iPhone 13 mini", storage: "128GB", ...good }).basePrice).toBe(1250);
    expect(evaluateDevice({ model: "iPhone 16e", storage: "128GB", ...good }).basePrice).toBe(2500);
    expect(evaluateDevice({ model: "iphone13promax", storage: "256GB", ...good }).basePrice).toBeGreaterThan(2000);
  });

  it("alvo da troca também respeita a variante", () => {
    const a = evaluateDevice({ model: "iPhone 12", storage: "128GB", ...good, targetModel: "iPhone 16e" });
    const b = evaluateDevice({ model: "iPhone 12", storage: "128GB", ...good, targetModel: "iPhone 16" });
    expect(a.targetPrice).toBe(4300);
    expect(b.targetPrice).toBe(5200);
  });
});

describe("sob consulta", () => {
  it.each(["Samsung Galaxy S24", "", "iPhone 99"])("modelo %j não recebe valor inventado", (model) => {
    const r = evaluateDevice({ model, storage: "256GB", ...good, targetModel: "iPhone 16" });
    expect(r.priceable).toBe(false);
    expect(r.minEstimatedValue).toBe(0);
    expect(r.maxEstimatedValue).toBe(0);
    expect(r.minTradeDelta).toBeUndefined();
  });

  it("modelo conhecido continua com valor", () => {
    const r = evaluateDevice({ model: "iPhone 13", storage: "128GB", ...good });
    expect(r.priceable).toBe(true);
    expect(r.minEstimatedValue).toBeGreaterThan(0);
  });
});

describe("bateria sem degraus", () => {
  it("é contínua no limite e nunca aumenta quando a bateria piora", () => {
    expect(batteryMultiplier(80, 80, 0.18)).toBeCloseTo(0.91);
    expect(batteryMultiplier(79, 80, 0.18)).toBeGreaterThan(0.89);
    expect(batteryMultiplier(70, 80, 0.18)).toBeCloseTo(0.82);
    expect(batteryMultiplier(50, 80, 0.18)).toBeCloseTo(0.82);
    let previous = batteryMultiplier(100, 80, 0.18);
    for (let pct = 99; pct >= 40; pct--) {
      const m = batteryMultiplier(pct, 80, 0.18);
      expect(m).toBeLessThanOrEqual(previous + 1e-9);
      expect(previous - m).toBeLessThan(0.02);
      previous = m;
    }
  });

  it("1 ponto de bateria não muda a oferta em centenas de reais", () => {
    const at80 = evaluateDevice({ model: "iPhone 13", storage: "128GB", ...good, batteryPercent: 80 });
    const at79 = evaluateDevice({ model: "iPhone 13", storage: "128GB", ...good, batteryPercent: 79 });
    expect(at80.minEstimatedValue - at79.minEstimatedValue).toBeLessThanOrEqual(100);
  });

  it("respeita limite e penalidade configurados", () => {
    expect(batteryMultiplier(60, 70, 0.3)).toBeCloseTo(0.7);
    expect(batteryMultiplier(75, 70, 0.3)).toBeGreaterThan(0.91 - 0.001);
  });
});

describe("itens para conferir e impeditivos", () => {
  it('"Não sei" não muda o preço, mas vira item para conferir', () => {
    const base = evaluateDevice({ model: "iPhone 13", storage: "128GB", ...good });
    const unsure = evaluateDevice({ model: "iPhone 13", storage: "128GB", ...good, faceId: "Não sei", icloudFree: "Não sei" });
    expect(unsure.minEstimatedValue).toBe(base.minEstimatedValue);
    expect(unsure.pendingChecks).toEqual(["iCloud / Buscar iPhone", "Face ID"]);
    expect(base.pendingChecks).toEqual([]);
  });

  it("bateria desconhecida também entra na lista", () => {
    const r = evaluateDevice({ model: "iPhone 13", storage: "128GB", ...good, batteryPercent: undefined, batteryUnknown: true });
    expect(r.pendingChecks).toContain("Saúde da bateria");
  });

  it("iCloud bloqueado vira impeditivo", () => {
    expect(evaluateDevice({ model: "iPhone 13", ...good, icloudFree: "Não" }).blockers).toHaveLength(1);
    expect(evaluateDevice({ model: "iPhone 13", ...good, icloudFree: "Sim" }).blockers).toEqual([]);
  });
});

describe("iPhone 18 Pro e 18 Pro Max (lançados em 09/2026)", () => {
  it("são reconhecidos como modelos distintos", async () => {
    const { detectIphoneModel, IPHONE_CATALOG, POPULAR_IPHONE_MODELS } = await import("../src/lib/iphoneCatalog");
    expect(resolveIphoneModel("iPhone 18 Pro Max")?.key).toBe("iphone 18 pro max");
    expect(resolveIphoneModel("iphone18pro")?.key).toBe("iphone 18 pro");
    expect(detectIphoneModel("iPhone 18 Pro Max 512GB")?.name).toBe("iPhone 18 Pro Max");
    expect(detectIphoneModel("iPhone 18 Pro")?.name).toBe("iPhone 18 Pro");
    expect(detectIphoneModel("iPhone 17 Pro")?.name).toBe("iPhone 17 Pro");
    const spec = IPHONE_CATALOG.find((m) => m.name === "iPhone 18 Pro Max")!;
    expect(spec.screen).toBe('6.9"');
    expect(spec.colors.map((c) => c.name)).toEqual(["Black", "Silver", "Glacier", "Burgundy"]);
    expect(POPULAR_IPHONE_MODELS.slice(0, 2)).toEqual(["iPhone 18 Pro Max", "iPhone 18 Pro"]);
  });

  it("sem preço cadastrado ficam 'sob consulta'; com preço personalizado são avaliados", () => {
    const input = { model: "iPhone 18 Pro Max", storage: "256GB", ...good };
    expect(evaluateDevice(input).priceable).toBe(false);
    expect(findBasePrice("iPhone 18 Pro Max")).toBe(0);

    const cfg = { globalMultiplier: 1, loyaltyBonusPercent: 5, boxBonusReais: 80, minBatteryThreshold: 80, batteryPenaltyUnder80: 18, customBasePrices: { "iphone 18 pro max": 6500 } };
    const priced = evaluateDevice(input, cfg);
    expect(priced.priceable).toBe(true);
    expect(priced.basePrice).toBe(6500);
    // o 18 Pro não herda o preço do 18 Pro Max
    expect(evaluateDevice({ model: "iPhone 18 Pro", storage: "256GB", ...good }, cfg).priceable).toBe(false);
  });
});
