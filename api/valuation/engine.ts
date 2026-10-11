/**
 * Motor de Avaliação Inteligente (Valuation Engine)
 * Lojinha do Celular — Jardim / MS
 *
 * Calcula estimativa de valor de pré-avaliação (compra/troca) com base em:
 * - Modelo do iPhone e ano de lançamento
 * - Capacidade de armazenamento (128GB, 256GB, 512GB, 1TB...)
 * - Saúde da bateria (%)
 * - Condição visual declarada
 * - Diagnóstico funcional (Face ID, tela original, câmeras, etc.)
 * - Bônus de fidelidade (aparelhos comprados na Lojinha do Celular)
 * - Diferença (volta estimada) para o iPhone desejado
 */

import {
  type ValuationConfig,
  type VisualAdjustmentKey,
  type DefectKey,
  DEFECT_LABELS,
} from "@contracts/types";
import type { IphoneReferencePrice, PriceSource, ValuationGrade, ValuationInput, ValuationResult } from "@contracts/valuation";
import { formatBRL, getReferenceVariationKey, normalizeKey, resolveIphoneModel } from "../../src/lib/iphoneKeys";
import { BASE_IPHONE_VALUES, IPHONE_REFERENCE_PRICES, POPULAR_CONFIG_IPHONES, TARGET_STORE_VALUES } from "./tables";
import { DEFAULT_VALUATION_CONFIG, parseValuationConfig, resolveAdjustments } from "./config";

export type { PriceSource, ValuationInput, ValuationResult };
export { DEFAULT_VALUATION_CONFIG, parseValuationConfig, resolveAdjustments, POPULAR_CONFIG_IPHONES, IPHONE_REFERENCE_PRICES, BASE_IPHONE_VALUES };
export { formatBRL, getReferenceVariationKey, normalizeKey, resolveIphoneModel };

function keyedByModel<T>(entries: Array<[string, T]>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [name, value] of entries) {
    const key = resolveIphoneModel(name)?.key;
    if (key && !map.has(key)) map.set(key, value);
  }
  return map;
}

let baseByKey: Map<string, number> | null = null;
let targetByKey: Map<string, number> | null = null;
const referenceKeyCache = new Map<string, string | null>();

function modelOfReference(item: IphoneReferencePrice): string | null {
  if (!referenceKeyCache.has(item.model)) referenceKeyCache.set(item.model, resolveIphoneModel(item.model)?.key ?? null);
  return referenceKeyCache.get(item.model) ?? null;
}


/**
 * Busca valor exato na tabela de referência da Lojinha por modelo, capacidade e cor
 */
export function findReferenceDevicePrice(
  modelName: string,
  capacity?: string,
  color?: string
): IphoneReferencePrice | null {
  const normCap = normalizeKey(capacity).replace(/\s+/g, "");
  const normColor = normalizeKey(color);

  // Casa pelo modelo reconhecido (nunca por "contém": "13 mini" não é "13", "16e" não é "16").
  const resolved = resolveIphoneModel(modelName)?.key;
  if (!resolved) return null;
  const modelMatches = IPHONE_REFERENCE_PRICES.filter((item) => modelOfReference(item) === resolved);

  if (modelMatches.length === 0) return null;

  if (normCap) {
    const capMatches = modelMatches.filter((item) => {
      const itemCap = normalizeKey(item.capacity).replace(/\s+/g, "");
      return normCap === itemCap || normCap.includes(itemCap) || itemCap.includes(normCap);
    });

    if (capMatches.length > 0) {
      if (normColor) {
        const colorMatch = capMatches.find((item) => {
          const itemColor = normalizeKey(item.color);
          return normColor === itemColor || normColor.includes(itemColor) || itemColor.includes(normColor);
        });
        if (colorMatch) return colorMatch;
      }
      return capMatches[0];
    }
  }

  return null;
}

export interface CustomPriceMatch {
  price: number;
  isSpecificCapacity: boolean;
}

export function getCustomBasePriceMatch(
  modelName: string,
  customPrices?: Record<string, number>,
  storage?: string,
  color?: string
): CustomPriceMatch | null {
  if (!customPrices) return null;
  const modelKey = resolveIphoneModel(modelName)?.key;
  if (!modelKey) return null;

  const normCap = normalizeKey(storage).replace(/\s+/g, "");
  const normColor = normalizeKey(color);

  let byColor: CustomPriceMatch | null = null;
  let byCapacity: CustomPriceMatch | null = null;
  let byModel: CustomPriceMatch | null = null;

  for (const [rawKey, val] of Object.entries(customPrices)) {
    if (!(val > 0)) continue;
    const [modelPart, capPart, ...colorParts] = normalizeKey(rawKey).split("_");
    if (resolveIphoneModel(modelPart)?.key !== modelKey) continue;
    const cap = (capPart ?? "").replace(/\s+/g, "");
    const col = colorParts.join("_").trim();

    if (!cap) byModel = { price: val, isSpecificCapacity: false };
    else if (cap === normCap && !col) byCapacity = { price: val, isSpecificCapacity: true };
    else if (cap === normCap && normColor && col === normColor) byColor = { price: val, isSpecificCapacity: true };
  }

  // Prioridade: modelo + capacidade + cor > modelo + capacidade > modelo.
  return byColor ?? byCapacity ?? byModel;
}

export function getCustomBasePrice(
  modelName: string,
  customPrices?: Record<string, number>,
  storage?: string,
  color?: string
): number | null {
  const match = getCustomBasePriceMatch(modelName, customPrices, storage, color);
  return match ? match.price : null;
}

/** Preço base do modelo (128GB, grau A). `0` = modelo desconhecido ou sem preço: "sob consulta". */
export function findBasePrice(modelName: string, customPrices?: Record<string, number>): number {
  const resolved = resolveIphoneModel(modelName)?.key;
  if (!resolved) return 0;

  const custom = getCustomBasePrice(modelName, customPrices);
  if (custom !== null) return custom;

  baseByKey ??= keyedByModel(Object.entries(BASE_IPHONE_VALUES));
  return baseByKey.get(resolved) ?? 0;
}

function findTargetPrice(targetModelName: string): number {
  const resolved = resolveIphoneModel(targetModelName)?.key;
  if (!resolved) return 0;
  targetByKey ??= keyedByModel(Object.entries(TARGET_STORE_VALUES));
  return targetByKey.get(resolved) ?? 0;
}

/**
 * Multiplicador da bateria, contínuo (sem degraus): 100–90% = 1,00 → 85% = 0,96 → limite = 0,91,
 * e daí cai de forma linear até o desconto máximo, 10 pontos abaixo do limite.
 */
export function batteryMultiplier(percent: number, threshold: number, penaltyFraction: number): number {
  const floor = Math.max(0.4, 1 - penaltyFraction);
  const anchors: Array<[number, number]> = [[100, 1]];
  if (threshold < 90) anchors.push([90, 1]);
  if (threshold < 85) anchors.push([85, 0.96]);
  anchors.push([threshold, 0.91]);
  anchors.push([threshold - 10, Math.min(floor, 0.91)]);

  if (percent >= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [p1, m1] = anchors[i - 1];
    const [p2, m2] = anchors[i];
    if (percent >= p2) {
      const t = p1 === p2 ? 1 : (p1 - percent) / (p1 - p2);
      return m1 + (m2 - m1) * t;
    }
  }
  return anchors[anchors.length - 1][1];
}

const PENDING_CHECK_LABELS: Array<[keyof ValuationInput, string]> = [
  ["icloudFree", "iCloud / Buscar iPhone"],
  ["faceId", "Face ID"],
  ["screenOriginal", "Tela original"],
  ["batteryOriginal", "Bateria original"],
  ["camerasOk", "Câmeras"],
  ["audioOk", "Áudio"],
  ["chargingPortOk", "Conector de carga"],
  ["openedBefore", "Se já foi aberto/reparado"],
];


function storageAdjustment(base: number, storage?: string): { bonus: number; highlight?: string } {
  const norm = (storage || "").toLowerCase();
  if (base <= 0) return { bonus: 0 };
  if (norm.includes("2tb") || norm.includes("2 tb")) {
    return { bonus: Math.max(900, Math.round(base * 0.28)), highlight: "Capacidade máxima de 2TB (+ valor)" };
  }
  if (norm.includes("1tb") || norm.includes("1 tb")) {
    return { bonus: Math.max(500, Math.round(base * 0.18)), highlight: "Capacidade alta de 1TB (+ valor)" };
  }
  if (norm.includes("512")) return { bonus: Math.max(300, Math.round(base * 0.12)), highlight: "Capacidade 512GB (+ valor)" };
  if (norm.includes("256")) return { bonus: Math.max(100, Math.round(base * 0.06)), highlight: "Capacidade 256GB" };
  if (norm.includes("64")) return { bonus: -Math.max(80, Math.round(base * 0.06)) };
  return { bonus: 0 };
}

/**
 * Preço de referência de um aparelho (modelo + capacidade [+ cor]) antes de bateria, estado e defeitos.
 * `base + storageBonus` é o valor que o motor usa; `source` diz de onde ele veio.
 */
export function resolveDevicePrice(
  model: string,
  storage?: string,
  color?: string,
  customPrices?: Record<string, number>,
): { base: number; storageBonus: number; source: PriceSource; highlights: string[] } {
  const highlights: string[] = [];
  const customMatch = getCustomBasePriceMatch(model, customPrices, storage, color);
  if (customMatch) {
    if (customMatch.isSpecificCapacity) {
      if (storage) highlights.push(`Capacidade ${storage} (personalizada)`);
      return { base: customMatch.price, storageBonus: 0, source: "personalizado", highlights };
    }
    const adj = storageAdjustment(customMatch.price, storage);
    if (adj.highlight) highlights.push(adj.highlight);
    return { base: customMatch.price, storageBonus: adj.bonus, source: "personalizado", highlights };
  }
  const ref = findReferenceDevicePrice(model, storage, color);
  if (ref) {
    if (ref.capacity) highlights.push(`Capacidade ${ref.capacity} (tabela oficial)`);
    return { base: ref.priceBrl, storageBonus: 0, source: "tabela", highlights };
  }
  const base = findBasePrice(model);
  const adj = storageAdjustment(base, storage);
  if (adj.highlight) highlights.push(adj.highlight);
  return { base, storageBonus: adj.bonus, source: base > 0 ? "calculado" : "sem-preco", highlights };
}

export function evaluateDevice(input: ValuationInput, config?: ValuationConfig): ValuationResult {
  const cfg = config || DEFAULT_VALUATION_CONFIG;
  let multiplier = cfg.globalMultiplier ?? 1.0;
  let score = 95;
  const highlights: string[] = [];

  // Valor base e capacidade: preço personalizado no painel > tabela oficial da loja > preço do modelo + ajuste de GB.
  const resolved = resolveDevicePrice(input.model, input.storage, input.color, cfg.customBasePrices);
  const base = resolved.base;
  let storageBonus = resolved.storageBonus;
  highlights.push(...resolved.highlights);

  // 2. Condição visual (ajustes configuráveis em %)
  const adj = resolveAdjustments(cfg.adjustments);
  const modelKey = resolveIphoneModel(input.model)?.key;
  const repairs = (modelKey && adj.modelRepairs[modelKey]) || {};
  let fixedDeduction = 0;
  const visual = (input.visualCondition || input.condition || "").toLowerCase();
  let visualKey: VisualAdjustmentKey | null = null;
  if (visual.includes("parece novo") || visual.includes("sem marcas")) visualKey = "novo";
  else if (visual.includes("pouquissimas") || visual.includes("poucas")) visualKey = "poucas";
  else if (visual.includes("normais")) visualKey = "normais";
  else if (visual.includes("riscos") || visual.includes("amassados")) visualKey = "riscos";
  else if (visual.includes("trinco") || visual.includes("trincada")) visualKey = "trinco";
  if (visualKey) {
    if (visualKey === "trinco" && repairs.cracked) {
      // Custo de trocar a tela deste modelo, no lugar do desconto percentual geral.
      fixedDeduction += repairs.cracked;
    } else {
      multiplier *= 1 + adj.visual[visualKey] / 100;
    }
    score += visualKey === "novo" ? 4 : visualKey === "poucas" ? -3 : visualKey === "normais" ? -10 : visualKey === "riscos" ? -25 : -45;
    if (visualKey === "novo") highlights.push("Estado impecável sem marcas visíveis");
  }

  // 3. Bateria
  const batteryThreshold = cfg.minBatteryThreshold ?? 80;
  const penalty = (cfg.batteryPenaltyUnder80 ?? 18) / 100;

  if (input.batteryUnknown) {
    multiplier *= 1 - adj.batteryUnknownPercent / 100;
    score -= 5;
  } else if (typeof input.batteryPercent === "number") {
    const bat = input.batteryPercent;
    if (bat < batteryThreshold && repairs.batteryLow) {
      // Abaixo do limite: custo de trocar a bateria deste modelo, no lugar da curva de desconto.
      fixedDeduction += repairs.batteryLow;
    } else {
      multiplier *= batteryMultiplier(bat, batteryThreshold, penalty);
    }
    if (bat >= 90) {
      highlights.push(`Bateria saudável (${bat}%)`);
    } else if (bat >= 85) {
      score -= 3;
      highlights.push(`Bateria boa (${bat}%)`);
    } else if (bat >= batteryThreshold) {
      score -= 8;
    } else {
      score -= 18;
      highlights.push(`Bateria abaixo de ${batteryThreshold}% (${bat}%) — requer substituição`);
    }
  }

  // 4. Diagnóstico Técnico (descontos configuráveis: % e/ou R$ fixo; "manual" pede conferência na loja)
  const manualChecks: string[] = [];
  const applyDefect = (key: DefectKey, scorePenalty: number) => {
    const rule = adj.defects[key];
    const modelCost = repairs[key];
    if (modelCost) {
      // Custo de reparo configurado para este modelo substitui o percentual e o valor geral.
      fixedDeduction += modelCost;
    } else {
      multiplier *= 1 - rule.percent / 100;
      fixedDeduction += rule.reais;
    }
    score -= scorePenalty;
    if (rule.manual) manualChecks.push(`${DEFECT_LABELS[key]}: definir o desconto na loja`);
  };
  if (input.faceId === "Não") applyDefect("faceId", 20);
  if (input.screenOriginal === "Não") applyDefect("screen", 18);
  if (input.batteryOriginal === "Não") applyDefect("batteryOriginal", 6);
  if (input.camerasOk === "Não") applyDefect("cameras", 20);
  if (input.audioOk === "Não") applyDefect("audio", 8);
  if (input.chargingPortOk === "Não") applyDefect("chargingPort", 8);
  if (input.openedBefore === "Sim") {
    applyDefect("opened", 4);
  } else if (input.openedBefore === "Não") {
    highlights.push("Aparelho nunca aberto");
  }

  // 5. Acessórios
  if (input.hasBox === "Sim") {
    const boxBonus = cfg.boxBonusReais ?? 80;
    storageBonus += boxBonus;
    score += 3;
    highlights.push(`Acompanha caixa original (+${formatBRL(boxBonus)})`);
  }

  // 6. Bônus de Fidelidade Lojinha do Celular
  let loyaltyBonusApplied = false;
  const origin = (input.purchaseLocation || "").toLowerCase();
  if (origin.includes("lojinha do celular") || origin.includes("comprado com a nossa equipe")) {
    const loyaltyMultiplier = 1 + (cfg.loyaltyBonusPercent ?? 5) / 100;
    multiplier *= loyaltyMultiplier;
    score += 5;
    loyaltyBonusApplied = true;
    highlights.push(
      `✨ Bônus Fidelidade Lojinha do Celular (+${cfg.loyaltyBonusPercent ?? 5}% na avaliação)`
    );
  }

  // Limita o score entre 20 e 100
  score = Math.max(20, Math.min(100, Math.round(score)));

  // Determinação de Grau
  let grade: ValuationGrade = "A";
  let gradeLabel = "Muito Bom";

  if (score >= 90) {
    grade = "A+";
    gradeLabel = "Excelente / Impecável";
  } else if (score >= 78) {
    grade = "A";
    gradeLabel = "Muito Bom";
  } else if (score >= 60) {
    grade = "B";
    gradeLabel = "Bom com marcas de uso";
  } else {
    grade = "C";
    gradeLabel = "Atenção / Reparo necessário";
  }

  // Sem preço (modelo não reconhecido ou não cadastrado): nunca inventa valor, fica "sob consulta".
  const priceable = base > 0;

  // Cálculo final com margem de segurança (mínimo e máximo)
  const adjustedBase = Math.max(0, (base + storageBonus) * multiplier - fixedDeduction);
  const roundedEstimated = Math.round(adjustedBase / 50) * 50;

  // Faixa de -5% a +5% em torno da média estimada
  const minEstimatedValue = priceable ? Math.max(200, Math.round((roundedEstimated * (1 - adj.rangePercent / 100)) / 50) * 50) : 0;
  const maxEstimatedValue = priceable ? Math.max(minEstimatedValue + 100, Math.round((roundedEstimated * (1 + adj.rangePercent / 100)) / 50) * 50) : 0;

  // "Não sei" não muda o preço, mas a equipe precisa conferir.
  const pendingChecks = PENDING_CHECK_LABELS.filter(([field]) => input[field] === "Não sei").map(([, label]) => label);
  if (input.batteryUnknown) pendingChecks.push("Saúde da bateria");
  pendingChecks.push(...manualChecks);
  const blockers = input.icloudFree === "Não" ? ["iCloud bloqueado: não compramos aparelho com bloqueio de conta"] : [];

  // Cálculo de Volta para o modelo desejado (se houver)
  let minTradeDelta: number | undefined;
  let maxTradeDelta: number | undefined;
  let targetPrice: number | undefined;

  const target = input.targetModel && !input.targetModel.toLowerCase().includes("apenas vender")
    ? input.targetModel.trim()
    : undefined;

  if (target) {
    targetPrice = findTargetPrice(target);
    if (targetPrice > 0 && priceable) {
      // Diferença = Preço do aparelho novo - Valor pago no aparelho usado
      minTradeDelta = Math.max(0, targetPrice - maxEstimatedValue);
      maxTradeDelta = Math.max(0, targetPrice - minEstimatedValue);
    }
  }

  return {
    modelName: input.model.trim() || "iPhone",
    basePrice: base,
    minEstimatedValue,
    maxEstimatedValue,
    targetModelName: target,
    targetPrice,
    minTradeDelta,
    maxTradeDelta,
    grade,
    gradeLabel,
    score,
    loyaltyBonusApplied,
    highlights,
    disclaimer:
      cfg.disclaimerText ||
      DEFAULT_VALUATION_CONFIG.disclaimerText ||
      "Pré-avaliação online estimada. O valor exato é confirmado após a conferência física e testes rápidos na Lojinha do Celular.",
    priceable,
    pendingChecks,
    blockers,
  };
}


/**
 * Gera a mensagem personalizada pronta para o atendente enviar ao cliente pelo WhatsApp
 */
export function buildAdminWhatsAppMessage(
  clientName: string,
  valuation: ValuationResult,
  itemData: {
    model: string;
    storage?: string;
    color?: string;
  },
  loyaltyBonusPercent: number = 5
): string {
  const tradeText =
    valuation.targetModelName && valuation.minTradeDelta !== undefined
      ? `\n🎯 *Troca pelo ${valuation.targetModelName}:* Volta estimada de *${formatBRL(
          valuation.minTradeDelta
        )} a ${formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}*`
      : "";

  const loyaltyText = valuation.loyaltyBonusApplied
    ? `\n🎁 *Bônus Fidelidade:* +${loyaltyBonusPercent}% adicional por ser cliente Lojinha do Celular!`
    : "";

  const message =
    `Olá ${clientName}! Tudo bem? Sou da equipe da *Lojinha do Celular* em Jardim/MS. 📱\n\n` +
    `Recebemos a avaliação do seu *${itemData.model}* (${itemData.storage || "Capacidade a confirmar"}, cor ${itemData.color || "a confirmar"}).\n\n` +
    `✨ *Classificação Preliminar:* ${valuation.gradeLabel} (${valuation.grade})\n` +
    `💰 *Pré-Avaliação Estimada:* *${formatBRL(valuation.minEstimatedValue)} a ${formatBRL(
      valuation.maxEstimatedValue
    )}*` +
    tradeText +
    loyaltyText +
    `\n\nPodemos dar continuidade para fechar o negócio? Se quiser, você pode trazer hoje mesmo na nossa loja para conferência rápida em 10 minutos!`;

  return message;
}

/** Mesma mensagem, como link wa.me (reserva quando a Evolution não está disponível). */
export function generateAdminWhatsAppResponse(
  clientName: string,
  whatsapp: string,
  valuation: ValuationResult,
  itemData: { model: string; storage?: string; color?: string },
  loyaltyBonusPercent: number = 5
): string {
  const digits = whatsapp.replace(/\D/g, "");
  const fullNumber = digits.length <= 11 ? `55${digits}` : digits;
  const message = buildAdminWhatsAppMessage(clientName, valuation, itemData, loyaltyBonusPercent);
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}
