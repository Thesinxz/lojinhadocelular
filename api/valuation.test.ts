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
    expect(result.minEstimatedValue).toBeGreaterThanOrEqual(5800);
    expect(result.maxEstimatedValue).toBeGreaterThan(result.minEstimatedValue);
    expect(result.targetModelName).toBe("iPhone 17 Pro Max");
    expect(result.minTradeDelta).toBeDefined();
    expect(result.maxTradeDelta).toBeDefined();
    expect(result.highlights).toContain("✨ Bônus Fidelidade Lojinha do Celular (+5% na avaliação)");
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
});
