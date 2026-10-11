/**
 * Configuração padrão e leitura segura da configuração do motor. SOMENTE no servidor:
 * os percentuais e valores padrão não podem ir para o navegador de quem visita o site.
 */
import {
  MODEL_REPAIR_KEYS,
  DEFECT_KEYS,
  VISUAL_ADJUSTMENT_KEYS,
  type DefectKey,
  type DefectRule,
  type ModelRepairKey,
  type ModelRepairs,
  type ValuationAdjustments,
  type ValuationConfig,
} from "@contracts/types";

export const DEFAULT_ADJUSTMENTS: ValuationAdjustments = {
  visual: { novo: 2, poucas: -4, normais: -12, riscos: -26, trinco: -50 },
  defects: {
    faceId: { percent: 15, reais: 0, manual: false },
    screen: { percent: 14, reais: 0, manual: false },
    batteryOriginal: { percent: 7, reais: 0, manual: false },
    cameras: { percent: 18, reais: 0, manual: false },
    audio: { percent: 8, reais: 0, manual: false },
    chargingPort: { percent: 7, reais: 0, manual: false },
    opened: { percent: 4, reais: 0, manual: false },
  },
  batteryUnknownPercent: 6,
  rangePercent: 5,
  modelRepairs: {},
};

function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Junta o que foi salvo com os padrões (valores inválidos voltam ao padrão e são limitados a faixas seguras). */
export function resolveAdjustments(raw?: Partial<ValuationAdjustments> | null): ValuationAdjustments {
  const d = DEFAULT_ADJUSTMENTS;
  const visual = { ...d.visual };
  for (const key of VISUAL_ADJUSTMENT_KEYS) visual[key] = num(raw?.visual?.[key], d.visual[key], -90, 30);
  const defects = {} as Record<DefectKey, DefectRule>;
  for (const key of DEFECT_KEYS) {
    const r = raw?.defects?.[key];
    defects[key] = {
      percent: num(r?.percent, d.defects[key].percent, 0, 90),
      reais: num(r?.reais, d.defects[key].reais, 0, 20000),
      manual: typeof r?.manual === "boolean" ? r.manual : d.defects[key].manual,
    };
  }
  const modelRepairs: ModelRepairs = {};
  const rawRepairs = raw?.modelRepairs;
  if (rawRepairs && typeof rawRepairs === "object") {
    for (const [modelKey, items] of Object.entries(rawRepairs).slice(0, 200)) {
      if (!items || typeof items !== "object" || modelKey.length > 60) continue;
      const clean: Partial<Record<ModelRepairKey, number>> = {};
      for (const key of MODEL_REPAIR_KEYS) {
        const value = (items as Record<string, unknown>)[key];
        if (typeof value === "number" && Number.isFinite(value) && value > 0) clean[key] = Math.min(20000, Math.round(value));
      }
      if (Object.keys(clean).length > 0) modelRepairs[modelKey] = clean;
    }
  }
  return {
    visual,
    defects,
    batteryUnknownPercent: num(raw?.batteryUnknownPercent, d.batteryUnknownPercent, 0, 50),
    rangePercent: num(raw?.rangePercent, d.rangePercent, 0, 25),
    modelRepairs,
  };
}

export const DEFAULT_VALUATION_CONFIG: ValuationConfig = {
  globalMultiplier: 1.0,
  loyaltyBonusPercent: 5,
  boxBonusReais: 80,
  minBatteryThreshold: 80,
  batteryPenaltyUnder80: 18,
  customBasePrices: {},
  disclaimerText:
    "Pré-avaliação online estimada. O valor exato é confirmado após a conferência física e testes rápidos na Lojinha do Celular.",
  hidePricesToClient: true, // Padrão seguro solicitado pelo lojista para evitar divergências ou erros
  adjustments: resolveAdjustments(undefined), // padrões completos, para o editor e o motor
};

export function parseValuationConfig(json?: string | Partial<ValuationConfig> | null): ValuationConfig {
  if (!json) return DEFAULT_VALUATION_CONFIG;
  try {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    return {
      globalMultiplier:
        typeof parsed.globalMultiplier === "number" && !isNaN(parsed.globalMultiplier)
          ? parsed.globalMultiplier
          : DEFAULT_VALUATION_CONFIG.globalMultiplier,
      loyaltyBonusPercent:
        typeof parsed.loyaltyBonusPercent === "number" && !isNaN(parsed.loyaltyBonusPercent)
          ? parsed.loyaltyBonusPercent
          : DEFAULT_VALUATION_CONFIG.loyaltyBonusPercent,
      boxBonusReais:
        typeof parsed.boxBonusReais === "number" && !isNaN(parsed.boxBonusReais)
          ? parsed.boxBonusReais
          : DEFAULT_VALUATION_CONFIG.boxBonusReais,
      minBatteryThreshold:
        typeof parsed.minBatteryThreshold === "number" && !isNaN(parsed.minBatteryThreshold)
          ? parsed.minBatteryThreshold
          : DEFAULT_VALUATION_CONFIG.minBatteryThreshold,
      batteryPenaltyUnder80:
        typeof parsed.batteryPenaltyUnder80 === "number" && !isNaN(parsed.batteryPenaltyUnder80)
          ? parsed.batteryPenaltyUnder80
          : DEFAULT_VALUATION_CONFIG.batteryPenaltyUnder80,
      customBasePrices:
        typeof parsed.customBasePrices === "object" && parsed.customBasePrices
          ? parsed.customBasePrices
          : {},
      adjustments: resolveAdjustments(
        typeof parsed.adjustments === "object" ? parsed.adjustments : undefined,
      ),
      disclaimerText:
        typeof parsed.disclaimerText === "string" && parsed.disclaimerText.trim()
          ? parsed.disclaimerText
          : DEFAULT_VALUATION_CONFIG.disclaimerText,
      hidePricesToClient:
        typeof parsed.hidePricesToClient === "boolean"
          ? parsed.hidePricesToClient
          : (DEFAULT_VALUATION_CONFIG.hidePricesToClient ?? true),
    };
  } catch {
    return DEFAULT_VALUATION_CONFIG;
  }
}
