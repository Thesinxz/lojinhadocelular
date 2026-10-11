/**
 * Utilitários de iPhone seguros para o navegador: reconhecimento de modelo, chaves, formatação e cores.
 * NÃO contém tabelas de preço nem regras de desconto (isso fica só no servidor, em api/valuation/).
 */

import type { ValuationGrade } from "@contracts/valuation";

export type { ValuationGrade } from "@contracts/valuation";

export const COLOR_SWATCHES: Record<string, string> = {
  "blue": "#42506e",
  "starlight": "#f0e9d7",
  "graphite": "#545351",
  "silver": "#e2e4e1",
  "gold": "#fae7cf",
  "sierra blue": "#9bb7d4",
  "alpine green": "#475c4d",
  "yellow": "#f9e58b",
  "purple": "#b5a7cb",
  "red": "#e30016",
  "midnight": "#1b242d",
  "space black": "#2e2c2e",
  "deep purple": "#43384d",
  "natural titanium": "#9c9689",
  "blue titanium": "#3b444b",
  "black titanium": "#232426",
  "white titanium": "#e8e8ea",
  "desert titanium": "#be9e82",
  "teal": "#338085",
  "ultramarine": "#4b68a4",
  "pink": "#faddd7",
  "sage": "#9caf88",
  "cosmic orange": "#ff6f3c",
  "cloud white": "#f7f7f7",
  "space gray": "#545351",
};

export function getDeviceColorHex(colorName?: string): string {
  if (!colorName) return "#9ca3af";
  const norm = colorName.toLowerCase().trim();
  return COLOR_SWATCHES[norm] || "#9ca3af";
}


/**
 * Reconhece o modelo de iPhone digitado e devolve uma chave canônica ("iphone 13 pro max").
 * Aceita variações ("iPhone13ProMax", "13 pro max", "iPhone 16e 256GB") e devolve `null`
 * quando não é um iPhone reconhecido, para nunca "adivinhar" um modelo parecido
 * (ex.: "13 mini" não pode virar "13", nem "16e" virar "16").
 */
export function resolveIphoneModel(input?: string | null): { key: string } | null {
  const compact = normalizeKey(input ?? "").replace(/[^a-z0-9]/g, "");
  if (!compact) return null;
  const rest = compact
    .replace(/^apple/, "")
    .replace(/^iphone/, "")
    .replace(/\d+(gb|tb)$/, "");
  if (!rest) return null;

  if (rest === "air") return { key: "iphone air" };
  if (rest === "x" || rest === "xr" || rest === "xs") return { key: `iphone ${rest}` };
  if (rest === "xsmax") return { key: "iphone xs max" };

  const se = /^se(\d{1,4})?(?:geracao|a)?$/.exec(rest);
  if (se) {
    const d = se[1];
    if (d === "3" || d === "2022") return { key: "iphone se 3" };
    if (d === "2" || d === "2020") return { key: "iphone se 2" };
    if (d === "1" || d === "2016") return { key: "iphone se 1" };
    return { key: "iphone se" };
  }

  const num = /^(\d{1,2})(promax|pro|plus|mini|e)?$/.exec(rest);
  if (num) {
    const gen = Number(num[1]);
    if (gen < 6 || gen > 20) return null;
    const suffix = { promax: " pro max", pro: " pro", plus: " plus", mini: " mini", e: "e" }[num[2] ?? ""] ?? "";
    return { key: `iphone ${gen}${suffix}` };
  }
  return null;
}


export function normalizeKey(str?: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_]/g, "")
    .trim();
}

/**
 * Gera a chave única de variação para armazenamento e recuperação de preços personalizados
 */
export function getReferenceVariationKey(model: string, capacity?: string, color?: string): string {
  const normModel = normalizeKey(model);
  const normCap = normalizeKey(capacity).replace(/\s+/g, "");
  const normColor = normalizeKey(color);
  if (normCap && normColor) {
    return `${normModel}_${normCap}_${normColor}`;
  }
  if (normCap) {
    return `${normModel}_${normCap}`;
  }
  return normModel;
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

/** "iPhone 18 Pro Max" → "iPhone 17 Pro Max"; `null` quando o nome não tem geração numérica. */
export function previousGenerationName(name: string): string | null {
  const match = /^iPhone (\d+)(.*)$/.exec(name);
  if (!match) return null;
  const generation = Number(match[1]) - 1;
  return generation >= 6 ? `iPhone ${generation}${match[2]}` : null;
}
