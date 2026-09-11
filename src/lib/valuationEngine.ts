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

export type ValuationGrade = "A+" | "A" | "B" | "C";

export interface ValuationInput {
  model: string;
  storage?: string;
  color?: string;
  purchaseLocation?: string;
  batteryPercent?: number;
  batteryUnknown?: boolean;
  targetModel?: string;
  visualCondition?: string;
  condition?: string; // fallback
  faceId?: string;
  screenOriginal?: string;
  batteryOriginal?: string;
  camerasOk?: string;
  audioOk?: string;
  chargingPortOk?: string;
  openedBefore?: string;
  hasBox?: string;
  notes?: string;
}

export interface ValuationResult {
  modelName: string;
  basePrice: number;
  minEstimatedValue: number;
  maxEstimatedValue: number;
  targetModelName?: string;
  targetPrice?: number;
  minTradeDelta?: number; // Volta estimada mínima
  maxTradeDelta?: number; // Volta estimada máxima
  grade: ValuationGrade;
  gradeLabel: string;
  score: number; // 0 a 100
  loyaltyBonusApplied: boolean;
  highlights: string[];
  disclaimer: string;
}

// Preços de referência de mercado para compra/troca técnica (valores base para 128GB Grau A)
const BASE_IPHONE_VALUES: Record<string, number> = {
  // Linha 16
  "iphone 16 pro max": 6400,
  "iphone 16 pro": 5400,
  "iphone 16 plus": 4600,
  "iphone 16": 4100,
  "iphone 16e": 3400,

  // Linha 15
  "iphone 15 pro max": 4900,
  "iphone 15 pro": 4200,
  "iphone 15 plus": 3500,
  "iphone 15": 3200,

  // Linha 14
  "iphone 14 pro max": 3900,
  "iphone 14 pro": 3300,
  "iphone 14 plus": 2700,
  "iphone 14": 2500,

  // Linha 13
  "iphone 13 pro max": 3000,
  "iphone 13 pro": 2600,
  "iphone 13": 2100,
  "iphone 13 mini": 1800,

  // Linha 12
  "iphone 12 pro max": 2300,
  "iphone 12 pro": 1900,
  "iphone 12": 1550,
  "iphone 12 mini": 1300,

  // Linha 11
  "iphone 11 pro max": 1650,
  "iphone 11 pro": 1400,
  "iphone 11": 1150,

  // Linhas Anteriores
  "iphone xr": 850,
  "iphone xs max": 950,
  "iphone xs": 800,
  "iphone x": 700,
  "iphone se (3ª geracao)": 1200,
  "iphone se (2ª geracao)": 800,
};

// Preços de referência de venda na loja para cálculo da volta (trade-in delta)
const TARGET_STORE_VALUES: Record<string, number> = {
  "iphone 17 pro max": 10200,
  "iphone 17 pro": 9100,
  "iphone 17": 7200,
  "iphone air": 7800,
  "iphone 17e": 5100,
  "iphone 16 pro max": 7900,
  "iphone 16 pro": 6900,
  "iphone 16 plus": 5800,
  "iphone 16": 5200,
  "iphone 16e": 4300,
  "iphone 15 pro max": 6100,
  "iphone 15 pro": 5200,
  "iphone 15 plus": 4400,
  "iphone 15": 4000,
  "iphone 14 pro max": 4800,
  "iphone 14 pro": 4100,
  "iphone 14 plus": 3400,
  "iphone 14": 3100,
  "iphone 13 pro max": 3700,
  "iphone 13 pro": 3200,
  "iphone 13": 2600,
  "iphone 12 pro max": 2900,
  "iphone 12": 2000,
  "iphone 11": 1500,
};

function normalizeKey(str?: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function findBasePrice(modelName: string): number {
  const norm = normalizeKey(modelName);
  for (const [key, val] of Object.entries(BASE_IPHONE_VALUES)) {
    if (norm.includes(key) || key.includes(norm)) {
      return val;
    }
  }
  // Fallback inteligente por geração caso seja um modelo não mapeado diretamente
  if (norm.includes("16 pro max")) return 6400;
  if (norm.includes("16 pro")) return 5400;
  if (norm.includes("16")) return 4100;
  if (norm.includes("15 pro max")) return 4900;
  if (norm.includes("15 pro")) return 4200;
  if (norm.includes("15")) return 3200;
  if (norm.includes("14 pro max")) return 3900;
  if (norm.includes("14 pro")) return 3300;
  if (norm.includes("14")) return 2500;
  if (norm.includes("13 pro max")) return 3000;
  if (norm.includes("13 pro")) return 2600;
  if (norm.includes("13")) return 2100;
  if (norm.includes("12")) return 1600;
  if (norm.includes("11")) return 1150;
  return 2000; // Valor médio default
}

function findTargetPrice(targetModelName: string): number {
  const norm = normalizeKey(targetModelName);
  for (const [key, val] of Object.entries(TARGET_STORE_VALUES)) {
    if (norm.includes(key) || key.includes(norm)) {
      return val;
    }
  }
  return 0;
}

export function evaluateDevice(input: ValuationInput): ValuationResult {
  const base = findBasePrice(input.model);
  let multiplier = 1.0;
  let score = 95;
  const highlights: string[] = [];

  // 1. Armazenamento
  const storageNorm = (input.storage || "").toLowerCase();
  let storageBonus = 0;
  if (storageNorm.includes("1tb") || storageNorm.includes("1 tb")) {
    storageBonus = Math.max(700, Math.round(base * 0.16));
    highlights.push("Capacidade alta de 1TB (+ valor)");
  } else if (storageNorm.includes("512")) {
    storageBonus = Math.max(450, Math.round(base * 0.11));
    highlights.push("Capacidade 512GB (+ valor)");
  } else if (storageNorm.includes("256")) {
    storageBonus = Math.max(200, Math.round(base * 0.05));
    highlights.push("Capacidade 256GB");
  } else if (storageNorm.includes("64")) {
    storageBonus = -Math.round(base * 0.06);
  }

  // 2. Condição visual
  const visual = (input.visualCondition || input.condition || "").toLowerCase();
  if (visual.includes("parece novo") || visual.includes("sem marcas")) {
    multiplier *= 1.02;
    score += 4;
    highlights.push("Estado impecável sem marcas visíveis");
  } else if (visual.includes("pouquissimas") || visual.includes("poucas")) {
    multiplier *= 0.96;
    score -= 3;
  } else if (visual.includes("normais")) {
    multiplier *= 0.88;
    score -= 10;
  } else if (visual.includes("riscos") || visual.includes("amassados")) {
    multiplier *= 0.74;
    score -= 25;
  } else if (visual.includes("trinco") || visual.includes("trincada")) {
    multiplier *= 0.5;
    score -= 45;
  }

  // 3. Bateria
  if (input.batteryUnknown) {
    multiplier *= 0.94;
    score -= 5;
  } else if (typeof input.batteryPercent === "number") {
    const bat = input.batteryPercent;
    if (bat >= 90) {
      multiplier *= 1.0;
      highlights.push(`Bateria saudável (${bat}%)`);
    } else if (bat >= 85) {
      multiplier *= 0.96;
      score -= 3;
      highlights.push(`Bateria boa (${bat}%)`);
    } else if (bat >= 80) {
      multiplier *= 0.91;
      score -= 8;
    } else {
      multiplier *= 0.82;
      score -= 18;
      highlights.push(`Bateria abaixo de 80% (${bat}%) — requer substituição`);
    }
  }

  // 4. Diagnóstico Técnico
  if (input.faceId === "Não") {
    multiplier *= 0.85;
    score -= 20;
  }
  if (input.screenOriginal === "Não") {
    multiplier *= 0.86;
    score -= 18;
  }
  if (input.batteryOriginal === "Não") {
    multiplier *= 0.93;
    score -= 6;
  }
  if (input.camerasOk === "Não") {
    multiplier *= 0.82;
    score -= 20;
  }
  if (input.audioOk === "Não") {
    multiplier *= 0.92;
    score -= 8;
  }
  if (input.chargingPortOk === "Não") {
    multiplier *= 0.93;
    score -= 8;
  }
  if (input.openedBefore === "Sim") {
    multiplier *= 0.96;
    score -= 4;
  } else if (input.openedBefore === "Não") {
    highlights.push("Aparelho nunca aberto");
  }

  // 5. Acessórios
  if (input.hasBox === "Sim") {
    storageBonus += 80;
    score += 3;
    highlights.push("Acompanha caixa original");
  }

  // 6. Bônus de Fidelidade Lojinha do Celular
  let loyaltyBonusApplied = false;
  const origin = (input.purchaseLocation || "").toLowerCase();
  if (origin.includes("lojinha do celular") || origin.includes("comprado com a nossa equipe")) {
    multiplier *= 1.05; // +5% bônus de fidelidade na troca
    score += 5;
    loyaltyBonusApplied = true;
    highlights.push("✨ Bônus Fidelidade Lojinha do Celular (+5% na avaliação)");
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

  // Cálculo final com margem de segurança (mínimo e máximo)
  const adjustedBase = (base + storageBonus) * multiplier;
  const roundedEstimated = Math.round(adjustedBase / 50) * 50;

  // Faixa de -5% a +5% em torno da média estimada
  const minEstimatedValue = Math.max(200, Math.round((roundedEstimated * 0.95) / 50) * 50);
  const maxEstimatedValue = Math.max(minEstimatedValue + 100, Math.round((roundedEstimated * 1.05) / 50) * 50);

  // Cálculo de Volta para o modelo desejado (se houver)
  let minTradeDelta: number | undefined;
  let maxTradeDelta: number | undefined;
  let targetPrice: number | undefined;

  const target = input.targetModel && !input.targetModel.toLowerCase().includes("apenas vender")
    ? input.targetModel.trim()
    : undefined;

  if (target) {
    targetPrice = findTargetPrice(target);
    if (targetPrice > 0) {
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
      "Pré-avaliação online estimada. O valor exato é confirmado após a conferência física e testes rápidos na Lojinha do Celular.",
  };
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getGradeBadgeConfig(grade: ValuationGrade): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconText: string;
} {
  switch (grade) {
    case "A+":
      return {
        label: "Grau A+ (Impecável)",
        badgeBg: "bg-emerald-500/10",
        badgeText: "text-emerald-700",
        badgeBorder: "border-emerald-500/25",
        iconText: "⭐",
      };
    case "A":
      return {
        label: "Grau A (Muito Bom)",
        badgeBg: "bg-blue-500/10",
        badgeText: "text-[#0071e3]",
        badgeBorder: "border-blue-500/25",
        iconText: "✨",
      };
    case "B":
      return {
        label: "Grau B (Bom)",
        badgeBg: "bg-amber-500/10",
        badgeText: "text-amber-700",
        badgeBorder: "border-amber-500/25",
        iconText: "📱",
      };
    case "C":
      return {
        label: "Grau C (Reparo)",
        badgeBg: "bg-rose-500/10",
        badgeText: "text-rose-700",
        badgeBorder: "border-rose-500/25",
        iconText: "⚠️",
      };
  }
}

/**
 * Gera a mensagem personalizada pronta para o atendente enviar ao cliente pelo WhatsApp
 */
export function generateAdminWhatsAppResponse(
  clientName: string,
  whatsapp: string,
  valuation: ValuationResult,
  itemData: {
    model: string;
    storage?: string;
    color?: string;
  }
): string {
  const digits = whatsapp.replace(/\D/g, "");
  const fullNumber = digits.length <= 11 ? `55${digits}` : digits;

  const tradeText =
    valuation.targetModelName && valuation.minTradeDelta !== undefined
      ? `\n🎯 *Troca pelo ${valuation.targetModelName}:* Volta estimada de *${formatBRL(
          valuation.minTradeDelta
        )} a ${formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}*`
      : "";

  const loyaltyText = valuation.loyaltyBonusApplied
    ? `\n🎁 *Bônus Fidelidade:* +5% adicional por ser cliente Lojinha do Celular!`
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

  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}
