import { describe, expect, it } from "vitest";
import { DEFAULT_VALUATION_CONFIG, resolveAdjustments, type ValuationConfig } from "@contracts/types";
import { evaluateDevice, parseValuationConfig } from "../src/lib/valuationEngine";

const perfect = {
  model: "iPhone 13",
  storage: "128GB",
  batteryPercent: 95,
  visualCondition: "Parece novo, sem marcas",
  faceId: "Sim",
  screenOriginal: "Sim",
  batteryOriginal: "Sim",
  camerasOk: "Sim",
  audioOk: "Sim",
  chargingPortOk: "Sim",
  openedBefore: "Não",
  icloudFree: "Sim",
};

function withAdjustments(adjustments: ValuationConfig["adjustments"]): ValuationConfig {
  return { ...DEFAULT_VALUATION_CONFIG, adjustments };
}

describe("descontos configuráveis do motor", () => {
  it("sem configuração usa os padrões e reproduz os valores antigos", () => {
    const base = evaluateDevice(perfect, DEFAULT_VALUATION_CONFIG);
    const faceIdBroken = evaluateDevice({ ...perfect, faceId: "Não" }, DEFAULT_VALUATION_CONFIG);
    expect(faceIdBroken.maxEstimatedValue).toBeLessThan(base.maxEstimatedValue);
    expect(resolveAdjustments(undefined).defects.faceId.percent).toBe(15);
  });

  it("desconto em % do defeito muda o valor", () => {
    const soft = evaluateDevice({ ...perfect, faceId: "Não" }, withAdjustments({ defects: { faceId: { percent: 5, reais: 0, manual: false } } as never }));
    const hard = evaluateDevice({ ...perfect, faceId: "Não" }, withAdjustments({ defects: { faceId: { percent: 40, reais: 0, manual: false } } as never }));
    expect(hard.maxEstimatedValue).toBeLessThan(soft.maxEstimatedValue);
  });

  it("desconto fixo em R$ (custo da tela) é subtraído do valor", () => {
    const none = evaluateDevice({ ...perfect, screenOriginal: "Não" }, withAdjustments({ defects: { screen: { percent: 0, reais: 0, manual: false } } as never }));
    const fixed = evaluateDevice({ ...perfect, screenOriginal: "Não" }, withAdjustments({ defects: { screen: { percent: 0, reais: 400, manual: false } } as never }));
    expect(none.maxEstimatedValue - fixed.maxEstimatedValue).toBeGreaterThanOrEqual(350);
  });

  it("'conferir na loja' acrescenta o aviso para a equipe", () => {
    const result = evaluateDevice({ ...perfect, cameras: undefined, camerasOk: "Não" } as never, withAdjustments({ defects: { cameras: { percent: 18, reais: 0, manual: true } } as never }));
    expect(result.pendingChecks.join(" ")).toContain("Câmeras com problema");
  });

  it("o estado visual é configurável", () => {
    const worse = evaluateDevice({ ...perfect, visualCondition: "Riscos ou amassados visíveis" }, withAdjustments({ visual: { riscos: -60 } as never }));
    const normal = evaluateDevice({ ...perfect, visualCondition: "Riscos ou amassados visíveis" }, DEFAULT_VALUATION_CONFIG);
    expect(worse.maxEstimatedValue).toBeLessThan(normal.maxEstimatedValue);
  });

  it("a faixa mostrada acompanha o percentual configurado", () => {
    const narrow = evaluateDevice(perfect, withAdjustments({ rangePercent: 0 }));
    const wide = evaluateDevice(perfect, withAdjustments({ rangePercent: 15 }));
    expect(wide.maxEstimatedValue - wide.minEstimatedValue).toBeGreaterThan(narrow.maxEstimatedValue - narrow.minEstimatedValue);
  });

  it("valores inválidos ou absurdos voltam ao padrão ou são limitados", () => {
    const adj = resolveAdjustments({ rangePercent: 900, batteryUnknownPercent: Number.NaN, defects: { faceId: { percent: 500, reais: -10, manual: true } } } as never);
    expect(adj.rangePercent).toBe(25);
    expect(adj.batteryUnknownPercent).toBe(6);
    expect(adj.defects.faceId).toEqual({ percent: 90, reais: 0, manual: true });
  });

  it("o JSON salvo carrega os ajustes e nunca desconta abaixo de zero", () => {
    const cfg = parseValuationConfig(JSON.stringify({ adjustments: { defects: { screen: { percent: 0, reais: 20000, manual: false } } } }));
    expect(cfg.adjustments?.defects?.screen?.reais).toBe(20000);
    const result = evaluateDevice({ ...perfect, screenOriginal: "Não" }, cfg);
    expect(result.minEstimatedValue).toBeGreaterThanOrEqual(0);
  });
});
