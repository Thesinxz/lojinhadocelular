import { describe, it, expect } from "vitest";
import { evaluateDevice, formatBRL, getGradeBadgeConfig } from "../src/lib/valuationEngine";

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
    expect(result.minEstimatedValue).toBeGreaterThanOrEqual(4500);
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

    // iPhone XS Max 256GB
    const rxs = evaluateDevice({
      model: "iPhone XS Max",
      storage: "256GB",
      visualCondition: "Parece novo, sem marcas",
      batteryPercent: 95,
    });
    expect(rxs.basePrice).toBe(900);
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
});

