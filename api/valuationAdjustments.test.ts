import { DEFAULT_VALUATION_CONFIG, resolveAdjustments } from "./valuation/config";
import { describe, expect, it } from "vitest";
import { type ValuationConfig } from "@contracts/types";
import { evaluateDevice, parseValuationConfig } from "./valuation/engine";

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

describe("custo de reparo por modelo", () => {
  const withRepairs = (modelRepairs: Record<string, Record<string, number>>) =>
    withAdjustments({ modelRepairs } as never);
  const base = evaluateDevice(perfect, DEFAULT_VALUATION_CONFIG);

  it("o custo do modelo substitui a regra geral (Face ID)", () => {
    const general = evaluateDevice({ ...perfect, faceId: "Não" }, DEFAULT_VALUATION_CONFIG);
    const model = evaluateDevice({ ...perfect, faceId: "Não" }, withRepairs({ "iphone 13": { faceId: 600 } }));
    expect(general.maxEstimatedValue).toBeLessThan(base.maxEstimatedValue);
    // Padrão: ~15% de R$ 1.450 ≈ R$ 220; com R$ 600 o desconto é maior.
    expect(model.maxEstimatedValue).toBeLessThan(general.maxEstimatedValue);
    expect(base.maxEstimatedValue - model.maxEstimatedValue).toBeGreaterThanOrEqual(500);
  });

  it("só vale para o modelo configurado; os outros seguem a regra geral", () => {
    const cfg = withRepairs({ "iphone 13 pro max": { faceId: 900 } });
    const other = evaluateDevice({ ...perfect, faceId: "Não" }, cfg);
    const general = evaluateDevice({ ...perfect, faceId: "Não" }, DEFAULT_VALUATION_CONFIG);
    expect(other.maxEstimatedValue).toBe(general.maxEstimatedValue);
  });

  it("tela trincada usa o custo de troca da tela do modelo", () => {
    const cracked = { ...perfect, visualCondition: "Tela ou tampa com trinco" };
    const general = evaluateDevice(cracked, DEFAULT_VALUATION_CONFIG);
    const model = evaluateDevice(cracked, withRepairs({ "iphone 13": { cracked: 300 } }));
    expect(model.maxEstimatedValue).toBeGreaterThan(general.maxEstimatedValue);
    expect(model.maxEstimatedValue).toBeLessThan(base.maxEstimatedValue);
  });

  it("bateria abaixo do limite desconta o custo de trocar a bateria; acima dele nada muda", () => {
    const cfg = withRepairs({ "iphone 13": { batteryLow: 350 } });
    const healthy = evaluateDevice({ ...perfect, batteryPercent: 92 }, cfg);
    const noRepair = evaluateDevice({ ...perfect, batteryPercent: 92 }, DEFAULT_VALUATION_CONFIG);
    expect(healthy.maxEstimatedValue).toBe(noRepair.maxEstimatedValue);
    const worn = evaluateDevice({ ...perfect, batteryPercent: 70 }, cfg);
    expect(healthy.maxEstimatedValue - worn.maxEstimatedValue).toBeGreaterThanOrEqual(300);
  });

  it("valores inválidos são descartados e o JSON salvo preserva os custos", () => {
    const adj = resolveAdjustments({ modelRepairs: { "iphone 13": { faceId: -5, cameras: 400, audio: Number.NaN } } } as never);
    expect(adj.modelRepairs["iphone 13"]).toEqual({ cameras: 400 });
    const cfg = parseValuationConfig(JSON.stringify({ adjustments: { modelRepairs: { "iphone 13": { screen: 700 } } } }));
    expect(cfg.adjustments?.modelRepairs?.["iphone 13"]).toEqual({ screen: 700 });
  });
});
