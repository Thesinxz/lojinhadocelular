import { describe, it, expect } from "vitest";
import {
  evaluateDevice,
  formatBRL,
  getGradeBadgeConfig,
  getReferenceVariationKey,
  getCustomBasePriceMatch,
} from "../src/lib/valuationEngine";

describe("valuationEngine", () => {
  it("evaluates a pristine iPhone 16 Pro Max with 512GB and loyalty bonus as Grade A+", () => {
    const result = evaluateDevice({
      model: "iPhone 16 Pro Max",
      storage: "512 GB",
      color: "Black Titanium",
      purchaseLocation: "Lojinha do Celular",
      batteryPercent: 90,
      visualCondition: "Parece novo, sem marcas",
      targetModel: "iPhone 17 Pro Max",
      faceId: "Sim",
      screenOriginal: "Sim",
      batteryOriginal: "Sim",
      camerasOk: "Sim",
      audioOk: "Sim",
      chargingPortOk: "Sim",
      openedBefore: "Não",
      hasBox: "Sim",
    });

    expect(result.grade).toBe("A+");
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.loyaltyBonusApplied).toBe(true);
    expect(result.minEstimatedValue).toBeGreaterThanOrEqual(4400);
    expect(result.maxEstimatedValue).toBeGreaterThan(result.minEstimatedValue);
    expect(result.targetModelName).toBe("iPhone 17 Pro Max");
    expect(result.minTradeDelta).toBeDefined();
    expect(result.maxTradeDelta).toBeDefined();
    expect(result.highlights).toContain("✨ Bônus Fidelidade Lojinha do Celular (+5% na avaliação)");
  });

  it("calcula com exatidão os preços da nova matriz oficial fornecida pelo lojista", () => {
    // iPhone 13 128GB e 256GB
    const r13_128 = evaluateDevice({
      model: "iPhone 13",
      storage: "128GB",
      color: "Blue",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(r13_128.basePrice).toBe(1450);
    expect(r13_128.minEstimatedValue).toBeLessThanOrEqual(1500);
    expect(r13_128.maxEstimatedValue).toBeGreaterThanOrEqual(1400);

    const r13_256 = evaluateDevice({
      model: "iPhone 13",
      storage: "256GB",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(r13_256.basePrice).toBe(1550);

    // iPhone 16 Pro Max 256GB
    const r16pm_256 = evaluateDevice({
      model: "iPhone 16 Pro Max",
      storage: "256GB",
      color: "Desert Titanium",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(r16pm_256.basePrice).toBe(4100);

    // iPhone 14 Pro Max 1TB
    const r14pm_1tb = evaluateDevice({
      model: "iPhone 14 Pro Max",
      storage: "1TB",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(r14pm_1tb.basePrice).toBe(3000);

    // iPhone XS Max 256GB e 512GB
    const rxs = evaluateDevice({
      model: "iPhone XS Max",
      storage: "256GB",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(rxs.basePrice).toBe(900);

    const rxs_512 = evaluateDevice({
      model: "iPhone XS Max",
      storage: "512GB",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(rxs_512.basePrice).toBe(1000);

    // iPhone 13 512GB
    const r13_512 = evaluateDevice({
      model: "iPhone 13",
      storage: "512GB",
      color: "Blue",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(r13_512.basePrice).toBe(1650);

    // iPhone 16 Pro 512GB
    const r16p_512 = evaluateDevice({
      model: "iPhone 16 Pro",
      storage: "512GB",
      color: "Black Titanium",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(r16p_512.basePrice).toBe(3550);

    // iPhone 17 512GB
    const r17_512 = evaluateDevice({
      model: "iPhone 17",
      storage: "512GB",
      color: "Sage",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(r17_512.basePrice).toBe(3800);
  });

  it("penalizes heavily damaged devices with cracked screens", () => {
    const result = evaluateDevice({
      model: "iPhone 13",
      storage: "128GB",
      batteryPercent: 74,
      visualCondition: "Tela ou tampa com trinco",
      faceId: "Não",
      screenOriginal: "Não",
    });

    expect(result.grade).toBe("C");
    expect(result.score).toBeLessThan(60);
    expect(result.minEstimatedValue).toBeLessThan(1500);
  });

  it("formats BRL currency correctly", () => {
    const formatted = formatBRL(5000);
    expect(formatted).toContain("5.000");
    expect(formatted).toContain("R$");
  });

  it("returns appropriate badge configuration for all grades", () => {
    expect(getGradeBadgeConfig("A+").label).toContain("A+");
    expect(getGradeBadgeConfig("A").label).toContain("A");
    expect(getGradeBadgeConfig("B").label).toContain("B");
    expect(getGradeBadgeConfig("C").label).toContain("C");
  });

  it("respects custom valuation configuration and price overrides", () => {
    const config = {
      globalMultiplier: 1.1, // +10%
      loyaltyBonusPercent: 8, // +8%
      boxBonusReais: 150,
      minBatteryThreshold: 80,
      batteryPenaltyUnder80: 25,
      customBasePrices: {
        "iphone 15 pro": 5000, // Sobrescreve de 4200 para 5000
      },
      disclaimerText: "Aviso customizado para teste",
    };

    const result = evaluateDevice(
      {
        model: "iPhone 15 Pro",
        storage: "128GB",
        batteryPercent: 90,
        purchaseLocation: "Lojinha do Celular",
        hasBox: "Sim",
      },
      config
    );

    expect(result.basePrice).toBe(5000);
    expect(result.loyaltyBonusApplied).toBe(true);
    expect(result.highlights).toContain("✨ Bônus Fidelidade Lojinha do Celular (+8% na avaliação)");
    expect(result.highlights.some(h => h.includes("Acompanha caixa original"))).toBe(true);
    expect(result.disclaimer).toBe("Aviso customizado para teste");
  });

  it("permite envio de fotos anexadas no endpoint submitEvaluation", async () => {
    const { appRouter } = await import("./router");
    const caller = appRouter.createCaller({
      req: new Request("https://lojinhadocelular.com", {
        headers: { "x-forwarded-for": "10.0.0.99" },
      }),
      resHeaders: new Headers(),
    });

    const mockPhotos = [
      {
        key: "front",
        label: "Foto da frente",
        url: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/v39/f39/f39/f39/f39/f39/f39/f39/f39/f38A",
        name: "frente.webp",
        size: 1024,
      },
      {
        key: "back",
        label: "Foto da traseira",
        url: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/v39/f39/f39/f39/f39/f39/f39/f39/f39/f38A",
        name: "traseira.webp",
        size: 1024,
      },
      {
        key: "battery",
        label: "Foto da saúde da bateria",
        url: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/v39/f39/f39/f39/f39/f39/f39/f39/f39/f38A",
        name: "bateria.webp",
        size: 1024,
      },
      {
        key: "screen",
        label: "Foto da tela ligada",
        url: "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/v39/f39/f39/f39/f39/f39/f39/f39/f39/f38A",
        name: "tela.webp",
        size: 1024,
      },
    ];

    const res = await caller.shop.submitEvaluation({
      name: "Cliente Teste Fotos",
      whatsapp: "67992086012",
      model: "iPhone 14",
      storage: "128GB",
      color: "Azul",
      purchaseLocation: "Lojinha do Celular",
      condition: "Pouquíssimas marcas de uso",
      battery: "88%",
      photos: mockPhotos,
      photosCount: 4,
    });

    expect(res.ok).toBe(true);
  });

  it("permite customização granular por modelo, GB e cor na matriz de preços", () => {
    // 1. Testa geração de chaves compostas
    expect(getReferenceVariationKey("iPhone 16 Pro Max", "512GB", "Desert Titanium")).toBe(
      "iphone 16 pro max_512gb_desert titanium"
    );
    expect(getReferenceVariationKey("iPhone 15 Pro", "256GB")).toBe("iphone 15 pro_256gb");
    expect(getReferenceVariationKey("iPhone 14")).toBe("iphone 14");

    // 2. Testa prioridade de override: cor específica > capacidade > modelo base
    const customBasePrices = {
      "iphone 16 pro max": 4000,
      "iphone 16 pro max_512gb": 4350,
      "iphone 16 pro max_512gb_desert titanium": 4600,
    };

    // Caso Desert Titanium 512GB: deve casar na chave mais específica (4600)
    const matchSpecific = getCustomBasePriceMatch(
      "iPhone 16 Pro Max",
      customBasePrices,
      "512GB",
      "Desert Titanium"
    );
    expect(matchSpecific).not.toBeNull();
    expect(matchSpecific?.price).toBe(4600);
    expect(matchSpecific?.isSpecificCapacity).toBe(true);

    // Caso White Titanium 512GB: não tem cor específica, deve casar na chave de capacidade (4350)
    const matchCap = getCustomBasePriceMatch(
      "iPhone 16 Pro Max",
      customBasePrices,
      "512GB",
      "White Titanium"
    );
    expect(matchCap).not.toBeNull();
    expect(matchCap?.price).toBe(4350);
    expect(matchCap?.isSpecificCapacity).toBe(true);

    // Caso 256GB: não tem chave de 256GB, deve casar na chave geral do modelo (4000)
    const matchModel = getCustomBasePriceMatch(
      "iPhone 16 Pro Max",
      customBasePrices,
      "256GB",
      "White Titanium"
    );
    expect(matchModel).not.toBeNull();
    expect(matchModel?.price).toBe(4000);
    expect(matchModel?.isSpecificCapacity).toBe(false);

    // 3. Verifica se evaluateDevice respeita o preço customizado da variação exata
    const evaluation = evaluateDevice(
      {
        model: "iPhone 16 Pro Max",
        storage: "512GB",
        color: "Desert Titanium",
        batteryPercent: 95,
      },
      {
        globalMultiplier: 1.0,
        loyaltyBonusPercent: 5,
        boxBonusReais: 80,
        minBatteryThreshold: 80,
        batteryPenaltyUnder80: 18,
        customBasePrices,
      }
    );

    // Deve usar diretamente 4600 sem adicionar bônus de 512GB sobre si mesmo
    expect(evaluation.basePrice).toBe(4600);
    expect(evaluation.highlights.some((h: string) => h.includes("Capacidade 512GB (personalizada)"))).toBe(true);
  });

  it("suporta configuração de ocultar valores para o cliente e normaliza capacidades com espaços", async () => {
    const { parseValuationConfig, findReferenceDevicePrice } = await import("../src/lib/valuationEngine");

    // 1. Testa parseValuationConfig com hidePricesToClient
    const defaultConfig = parseValuationConfig(null);
    expect(defaultConfig.hidePricesToClient).toBe(true);

    const explicitFalse = parseValuationConfig({ hidePricesToClient: false });
    expect(explicitFalse.hidePricesToClient).toBe(false);

    const explicitTrue = parseValuationConfig({ hidePricesToClient: true });
    expect(explicitTrue.hidePricesToClient).toBe(true);

    // 2. Testa correspondência de capacidades com e sem espaços ("128 GB" vs "128GB")
    const matchWithSpace = findReferenceDevicePrice("iPhone 14", "128 GB");
    expect(matchWithSpace).not.toBeNull();
    expect(matchWithSpace?.priceBrl).toBe(1500);

    const matchWithoutSpace = findReferenceDevicePrice("iPhone 14", "128GB");
    expect(matchWithoutSpace).not.toBeNull();
    expect(matchWithoutSpace?.priceBrl).toBe(1500);

    // 3. Testa que iPhone 14 avalia na faixa correta (~R$ 1.500) e não R$ 4.000
    const evalIphone14 = evaluateDevice({
      model: "iPhone 14",
      storage: "128 GB",
      color: "Starlight",
      purchaseLocation: "Lojinha do Celular",
      batteryPercent: 95,
      targetModel: "iPhone 15 Pro Max",
      visualCondition: "Parece novo, sem marcas",
      faceId: "Sim",
      screenOriginal: "Sim",
      batteryOriginal: "Sim",
      camerasOk: "Sim",
      audioOk: "Sim",
      chargingPortOk: "Sim",
      openedBefore: "Não",
      hasBox: "Não sei",
    });

    expect(evalIphone14.basePrice).toBe(1500);
    expect(evalIphone14.minEstimatedValue).toBeGreaterThanOrEqual(1400);
    expect(evalIphone14.maxEstimatedValue).toBeLessThanOrEqual(1800);
  });
});

