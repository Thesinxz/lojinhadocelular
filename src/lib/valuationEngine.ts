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
  DEFAULT_VALUATION_CONFIG,
} from "@contracts/types";

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
  /** "O aparelho está livre de bloqueio de iCloud?" Sim | Não | Não sei */
  icloudFree?: string;
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
  /** `false` = modelo não reconhecido ou sem preço cadastrado: valores zerados, "sob consulta". */
  priceable: boolean;
  /** Itens respondidos "Não sei": a equipe precisa conferir na loja. */
  pendingChecks: string[];
  /** Motivos que impedem a compra (ex.: iCloud bloqueado). */
  blockers: string[];
}

// Tabela de referência completa enviada pelo lojista (55 itens com modelo, capacidade, cor e valores em USD e BRL)
export interface IphoneReferencePrice {
  model: string;
  capacity: string;
  color: string;
  priceUsd: number;
  priceBrl: number;
}

export const IPHONE_REFERENCE_PRICES: IphoneReferencePrice[] = [
  { model: "iPhone 13", capacity: "128GB", color: "Blue", priceUsd: 290.0, priceBrl: 1450.0 },
  { model: "iPhone 13", capacity: "128GB", color: "Starlight", priceUsd: 290.0, priceBrl: 1450.0 },
  { model: "iPhone 13", capacity: "256GB", color: "Blue", priceUsd: 310.0, priceBrl: 1550.0 },
  { model: "iPhone 13", capacity: "256GB", color: "Starlight", priceUsd: 310.0, priceBrl: 1550.0 },
  { model: "iPhone 13", capacity: "512GB", color: "Blue", priceUsd: 330.0, priceBrl: 1650.0 },
  { model: "iPhone 13", capacity: "512GB", color: "Starlight", priceUsd: 330.0, priceBrl: 1650.0 },
  { model: "iPhone 13 Pro Max", capacity: "128GB", color: "Graphite", priceUsd: 450.0, priceBrl: 2250.0 },
  { model: "iPhone 13 Pro Max", capacity: "128GB", color: "Silver", priceUsd: 450.0, priceBrl: 2250.0 },
  { model: "iPhone 13 Pro Max", capacity: "128GB", color: "Gold", priceUsd: 450.0, priceBrl: 2250.0 },
  { model: "iPhone 13 Pro Max", capacity: "128GB", color: "Sierra Blue", priceUsd: 450.0, priceBrl: 2250.0 },
  { model: "iPhone 13 Pro Max", capacity: "256GB", color: "Sierra Blue", priceUsd: 480.0, priceBrl: 2400.0 },
  { model: "iPhone 13 Pro Max", capacity: "256GB", color: "Gold", priceUsd: 480.0, priceBrl: 2400.0 },
  { model: "iPhone 13 Pro Max", capacity: "256GB", color: "Alpine Green", priceUsd: 480.0, priceBrl: 2400.0 },
  { model: "iPhone 13 Pro Max", capacity: "512GB", color: "Sierra Blue", priceUsd: 500.0, priceBrl: 2500.0 },
  { model: "iPhone 13 Pro Max", capacity: "512GB", color: "Gold", priceUsd: 500.0, priceBrl: 2500.0 },
  { model: "iPhone 13 Pro Max", capacity: "512GB", color: "Alpine Green", priceUsd: 500.0, priceBrl: 2500.0 },
  { model: "iPhone 14", capacity: "128GB", color: "Yellow", priceUsd: 300.0, priceBrl: 1500.0 },
  { model: "iPhone 14", capacity: "128GB", color: "Starlight", priceUsd: 300.0, priceBrl: 1500.0 },
  { model: "iPhone 14", capacity: "128GB", color: "Purple", priceUsd: 300.0, priceBrl: 1500.0 },
  { model: "iPhone 14", capacity: "128GB", color: "Red", priceUsd: 300.0, priceBrl: 1500.0 },
  { model: "iPhone 14", capacity: "128GB", color: "Midnight", priceUsd: 300.0, priceBrl: 1500.0 },
  { model: "iPhone 14", capacity: "256GB", color: "Yellow", priceUsd: 320.0, priceBrl: 1600.0 },
  { model: "iPhone 14", capacity: "256GB", color: "Starlight", priceUsd: 320.0, priceBrl: 1600.0 },
  { model: "iPhone 14", capacity: "256GB", color: "Purple", priceUsd: 320.0, priceBrl: 1600.0 },
  { model: "iPhone 14", capacity: "256GB", color: "Red", priceUsd: 320.0, priceBrl: 1600.0 },
  { model: "iPhone 14", capacity: "256GB", color: "Midnight", priceUsd: 320.0, priceBrl: 1600.0 },
  { model: "iPhone 14", capacity: "512GB", color: "Yellow", priceUsd: 340.0, priceBrl: 1700.0 },
  { model: "iPhone 14", capacity: "512GB", color: "Starlight", priceUsd: 340.0, priceBrl: 1700.0 },
  { model: "iPhone 14", capacity: "512GB", color: "Purple", priceUsd: 340.0, priceBrl: 1700.0 },
  { model: "iPhone 14", capacity: "512GB", color: "Red", priceUsd: 340.0, priceBrl: 1700.0 },
  { model: "iPhone 14", capacity: "512GB", color: "Midnight", priceUsd: 340.0, priceBrl: 1700.0 },
  { model: "iPhone 14 Plus", capacity: "128GB", color: "Purple", priceUsd: 320.0, priceBrl: 1600.0 },
  { model: "iPhone 14 Plus", capacity: "256GB", color: "Purple", priceUsd: 340.0, priceBrl: 1700.0 },
  { model: "iPhone 14 Plus", capacity: "512GB", color: "Purple", priceUsd: 360.0, priceBrl: 1800.0 },
  { model: "iPhone 14 Pro", capacity: "128GB", color: "Space Black", priceUsd: 420.0, priceBrl: 2100.0 },
  { model: "iPhone 14 Pro", capacity: "128GB", color: "Deep Purple", priceUsd: 420.0, priceBrl: 2100.0 },
  { model: "iPhone 14 Pro", capacity: "128GB", color: "Silver", priceUsd: 440.0, priceBrl: 2200.0 },
  { model: "iPhone 14 Pro", capacity: "256GB", color: "Space Black", priceUsd: 450.0, priceBrl: 2250.0 },
  { model: "iPhone 14 Pro", capacity: "512GB", color: "Gold", priceUsd: 500.0, priceBrl: 2500.0 },
  { model: "iPhone 14 Pro Max", capacity: "1TB", color: "Gold", priceUsd: 600.0, priceBrl: 3000.0 },
  { model: "iPhone 14 Pro Max", capacity: "128GB", color: "Deep Purple", priceUsd: 510.0, priceBrl: 2550.0 },
  { model: "iPhone 14 Pro Max", capacity: "128GB", color: "Gold", priceUsd: 540.0, priceBrl: 2700.0 },
  { model: "iPhone 14 Pro Max", capacity: "128GB", color: "Silver", priceUsd: 540.0, priceBrl: 2700.0 },
  { model: "iPhone 14 Pro Max", capacity: "256GB", color: "Silver", priceUsd: 570.0, priceBrl: 2850.0 },
  { model: "iPhone 14 Pro Max", capacity: "256GB", color: "Gold", priceUsd: 570.0, priceBrl: 2850.0 },
  { model: "iPhone 14 Pro Max", capacity: "256GB", color: "Deep Purple", priceUsd: 540.0, priceBrl: 2700.0 },
  { model: "iPhone 14 Pro Max", capacity: "512GB", color: "Silver", priceUsd: 590.0, priceBrl: 2950.0 },
  { model: "iPhone 15", capacity: "128GB", color: "Yellow", priceUsd: 410.0, priceBrl: 2050.0 },
  { model: "iPhone 15", capacity: "256GB", color: "Yellow", priceUsd: 430.0, priceBrl: 2150.0 },
  { model: "iPhone 15", capacity: "512GB", color: "Yellow", priceUsd: 450.0, priceBrl: 2250.0 },
  { model: "iPhone 15 Plus", capacity: "128GB", color: "Yellow", priceUsd: 430.0, priceBrl: 2150.0 },
  { model: "iPhone 15 Plus", capacity: "256GB", color: "Yellow", priceUsd: 450.0, priceBrl: 2250.0 },
  { model: "iPhone 15 Plus", capacity: "512GB", color: "Yellow", priceUsd: 470.0, priceBrl: 2350.0 },
  { model: "iPhone 15 Pro", capacity: "128GB", color: "Natural Titanium", priceUsd: 530.0, priceBrl: 2650.0 },
  { model: "iPhone 15 Pro", capacity: "128GB", color: "Blue Titanium", priceUsd: 520.0, priceBrl: 2600.0 },
  { model: "iPhone 15 Pro", capacity: "128GB", color: "Black Titanium", priceUsd: 520.0, priceBrl: 2600.0 },
  { model: "iPhone 15 Pro", capacity: "256GB", color: "Natural Titanium", priceUsd: 550.0, priceBrl: 2750.0 },
  { model: "iPhone 15 Pro", capacity: "256GB", color: "Blue Titanium", priceUsd: 540.0, priceBrl: 2700.0 },
  { model: "iPhone 15 Pro", capacity: "256GB", color: "Black Titanium", priceUsd: 540.0, priceBrl: 2700.0 },
  { model: "iPhone 15 Pro", capacity: "512GB", color: "Natural Titanium", priceUsd: 570.0, priceBrl: 2850.0 },
  { model: "iPhone 15 Pro", capacity: "512GB", color: "Blue Titanium", priceUsd: 560.0, priceBrl: 2800.0 },
  { model: "iPhone 15 Pro", capacity: "512GB", color: "Black Titanium", priceUsd: 560.0, priceBrl: 2800.0 },
  { model: "iPhone 15 Pro Max", capacity: "1TB", color: "Blue Titanium", priceUsd: 670.0, priceBrl: 3350.0 },
  { model: "iPhone 15 Pro Max", capacity: "1TB", color: "Black Titanium", priceUsd: 670.0, priceBrl: 3350.0 },
  { model: "iPhone 16", capacity: "128GB", color: "Teal", priceUsd: 580.0, priceBrl: 2900.0 },
  { model: "iPhone 16", capacity: "128GB", color: "Ultramarine", priceUsd: 580.0, priceBrl: 2900.0 },
  { model: "iPhone 16", capacity: "128GB", color: "Pink", priceUsd: 580.0, priceBrl: 2900.0 },
  { model: "iPhone 16", capacity: "256GB", color: "Teal", priceUsd: 600.0, priceBrl: 3000.0 },
  { model: "iPhone 16", capacity: "256GB", color: "Ultramarine", priceUsd: 600.0, priceBrl: 3000.0 },
  { model: "iPhone 16", capacity: "256GB", color: "Pink", priceUsd: 600.0, priceBrl: 3000.0 },
  { model: "iPhone 16", capacity: "512GB", color: "Teal", priceUsd: 620.0, priceBrl: 3100.0 },
  { model: "iPhone 16", capacity: "512GB", color: "Ultramarine", priceUsd: 620.0, priceBrl: 3100.0 },
  { model: "iPhone 16", capacity: "512GB", color: "Pink", priceUsd: 620.0, priceBrl: 3100.0 },
  { model: "iPhone 16 Pro", capacity: "128GB", color: "White Titanium", priceUsd: 670.0, priceBrl: 3350.0 },
  { model: "iPhone 16 Pro", capacity: "128GB", color: "Desert Titanium", priceUsd: 670.0, priceBrl: 3350.0 },
  { model: "iPhone 16 Pro", capacity: "128GB", color: "Natural Titanium", priceUsd: 670.0, priceBrl: 3350.0 },
  { model: "iPhone 16 Pro", capacity: "128GB", color: "Black Titanium", priceUsd: 670.0, priceBrl: 3350.0 },
  { model: "iPhone 16 Pro", capacity: "256GB", color: "White Titanium", priceUsd: 690.0, priceBrl: 3450.0 },
  { model: "iPhone 16 Pro", capacity: "256GB", color: "Desert Titanium", priceUsd: 690.0, priceBrl: 3450.0 },
  { model: "iPhone 16 Pro", capacity: "256GB", color: "Natural Titanium", priceUsd: 690.0, priceBrl: 3450.0 },
  { model: "iPhone 16 Pro", capacity: "256GB", color: "Black Titanium", priceUsd: 690.0, priceBrl: 3450.0 },
  { model: "iPhone 16 Pro", capacity: "512GB", color: "White Titanium", priceUsd: 710.0, priceBrl: 3550.0 },
  { model: "iPhone 16 Pro", capacity: "512GB", color: "Desert Titanium", priceUsd: 710.0, priceBrl: 3550.0 },
  { model: "iPhone 16 Pro", capacity: "512GB", color: "Natural Titanium", priceUsd: 710.0, priceBrl: 3550.0 },
  { model: "iPhone 16 Pro", capacity: "512GB", color: "Black Titanium", priceUsd: 710.0, priceBrl: 3550.0 },
  { model: "iPhone 16 Pro Max", capacity: "256GB", color: "Desert Titanium", priceUsd: 820.0, priceBrl: 4100.0 },
  { model: "iPhone 16 Pro Max", capacity: "256GB", color: "White Titanium", priceUsd: 820.0, priceBrl: 4100.0 },
  { model: "iPhone 16 Pro Max", capacity: "256GB", color: "Natural Titanium", priceUsd: 820.0, priceBrl: 4100.0 },
  { model: "iPhone 16 Pro Max", capacity: "512GB", color: "Black Titanium", priceUsd: 860.0, priceBrl: 4300.0 },
  { model: "iPhone 16 Pro Max", capacity: "512GB", color: "Desert Titanium", priceUsd: 880.0, priceBrl: 4400.0 },
  { model: "iPhone 16 Pro Max", capacity: "512GB", color: "Natural Titanium", priceUsd: 880.0, priceBrl: 4400.0 },
  { model: "iPhone 16 Pro Max", capacity: "512GB", color: "White Titanium", priceUsd: 880.0, priceBrl: 4400.0 },
  { model: "iPhone 17", capacity: "256GB", color: "Sage", priceUsd: 740.0, priceBrl: 3700.0 },
  { model: "iPhone 17", capacity: "512GB", color: "Sage", priceUsd: 760.0, priceBrl: 3800.0 },
  { model: "iPhone 17 Pro", capacity: "1TB", color: "Cosmic Orange", priceUsd: 1120.0, priceBrl: 5600.0 },
  { model: "iPhone Air", capacity: "512GB", color: "Cloud White", priceUsd: 780.0, priceBrl: 3900.0 },
  { model: "iPhone XS Max", capacity: "256GB", color: "Space Gray", priceUsd: 180.0, priceBrl: 900.0 },
  { model: "iPhone XS Max", capacity: "512GB", color: "Space Gray", priceUsd: 200.0, priceBrl: 1000.0 },
];

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

// Preços de referência de mercado para compra/troca técnica (valores base para capacidade padrão/inicial Grau A)
export const BASE_IPHONE_VALUES: Record<string, number> = {
  // Linha 17 / Air
  "iphone 17 pro max": 5800,
  "iphone 17 pro": 5000,
  "iphone 17": 3700,
  "iphone air": 3700,

  // Linha 16
  "iphone 16 pro max": 4100,
  "iphone 16 pro": 3350,
  "iphone 16 plus": 3100,
  "iphone 16": 2900,
  "iphone 16e": 2500,

  // Linha 15
  "iphone 15 pro max": 3000,
  "iphone 15 pro": 2600,
  "iphone 15 plus": 2150,
  "iphone 15": 2050,

  // Linha 14
  "iphone 14 pro max": 2600,
  "iphone 14 pro": 2100,
  "iphone 14 plus": 1600,
  "iphone 14": 1500,

  // Linha 13
  "iphone 13 pro max": 2250,
  "iphone 13 pro": 1850,
  "iphone 13": 1450,
  "iphone 13 mini": 1250,

  // Linha 12
  "iphone 12 pro max": 1650,
  "iphone 12 pro": 1400,
  "iphone 12": 1150,
  "iphone 12 mini": 950,

  // Linha 11
  "iphone 11 pro max": 1250,
  "iphone 11 pro": 1050,
  "iphone 11": 850,

  // Linhas Anteriores
  "iphone xr": 650,
  "iphone xs max": 850,
  "iphone xs": 650,
  "iphone x": 550,
  "iphone se (3ª geracao)": 900,
  "iphone se (2ª geracao)": 600,
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

export const POPULAR_CONFIG_IPHONES: Array<{ id: string; name: string; defaultBasePrice: number }> = [
  { id: "iphone 17 pro max", name: "iPhone 17 Pro Max", defaultBasePrice: 5800 },
  { id: "iphone 17 pro", name: "iPhone 17 Pro", defaultBasePrice: 5000 },
  { id: "iphone 17", name: "iPhone 17", defaultBasePrice: 3700 },
  { id: "iphone air", name: "iPhone Air", defaultBasePrice: 3700 },
  { id: "iphone 16 pro max", name: "iPhone 16 Pro Max", defaultBasePrice: 4100 },
  { id: "iphone 16 pro", name: "iPhone 16 Pro", defaultBasePrice: 3350 },
  { id: "iphone 16 plus", name: "iPhone 16 Plus", defaultBasePrice: 3100 },
  { id: "iphone 16", name: "iPhone 16", defaultBasePrice: 2900 },
  { id: "iphone 16e", name: "iPhone 16e", defaultBasePrice: 2500 },
  { id: "iphone 15 pro max", name: "iPhone 15 Pro Max", defaultBasePrice: 3000 },
  { id: "iphone 15 pro", name: "iPhone 15 Pro", defaultBasePrice: 2600 },
  { id: "iphone 15 plus", name: "iPhone 15 Plus", defaultBasePrice: 2150 },
  { id: "iphone 15", name: "iPhone 15", defaultBasePrice: 2050 },
  { id: "iphone 14 pro max", name: "iPhone 14 Pro Max", defaultBasePrice: 2600 },
  { id: "iphone 14 pro", name: "iPhone 14 Pro", defaultBasePrice: 2100 },
  { id: "iphone 14 plus", name: "iPhone 14 Plus", defaultBasePrice: 1600 },
  { id: "iphone 14", name: "iPhone 14", defaultBasePrice: 1500 },
  { id: "iphone 13 pro max", name: "iPhone 13 Pro Max", defaultBasePrice: 2250 },
  { id: "iphone 13 pro", name: "iPhone 13 Pro", defaultBasePrice: 1850 },
  { id: "iphone 13", name: "iPhone 13", defaultBasePrice: 1450 },
  { id: "iphone 12 pro max", name: "iPhone 12 Pro Max", defaultBasePrice: 1650 },
  { id: "iphone 12", name: "iPhone 12", defaultBasePrice: 1150 },
  { id: "iphone 11 pro max", name: "iPhone 11 Pro Max", defaultBasePrice: 1250 },
  { id: "iphone 11", name: "iPhone 11", defaultBasePrice: 850 },
  { id: "iphone xs max", name: "iPhone XS Max", defaultBasePrice: 850 },
];

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

export function evaluateDevice(input: ValuationInput, config?: ValuationConfig): ValuationResult {
  const cfg = config || DEFAULT_VALUATION_CONFIG;
  let multiplier = cfg.globalMultiplier ?? 1.0;
  let score = 95;
  const highlights: string[] = [];

  // Determinação do valor base e capacidade:
  // Se o lojista configurou preço customizado no Admin (seja por modelo, capacidade ou cor), ele tem prioridade máxima.
  const customMatch = getCustomBasePriceMatch(
    input.model,
    cfg.customBasePrices,
    input.storage,
    input.color
  );
  const refDevice = !customMatch
    ? findReferenceDevicePrice(input.model, input.storage, input.color)
    : null;

  let base: number;
  let storageBonus = 0;

  if (customMatch) {
    base = customMatch.price;
    if (customMatch.isSpecificCapacity) {
      // Preço customizado especificamente para este GB/cor: não soma bônus genérico
      storageBonus = 0;
      if (input.storage) {
        highlights.push(`Capacidade ${input.storage} (personalizada)`);
      }
    } else {
      // Preço customizado no modelo base (128GB Grau A): calcula bônus de armazenamento proporcional
      const storageNorm = (input.storage || "").toLowerCase();
      if (storageNorm.includes("1tb") || storageNorm.includes("1 tb")) {
        storageBonus = Math.max(500, Math.round(base * 0.18));
        highlights.push("Capacidade alta de 1TB (+ valor)");
      } else if (storageNorm.includes("512")) {
        storageBonus = Math.max(300, Math.round(base * 0.12));
        highlights.push("Capacidade 512GB (+ valor)");
      } else if (storageNorm.includes("256")) {
        storageBonus = Math.max(100, Math.round(base * 0.06));
        highlights.push("Capacidade 256GB");
      } else if (storageNorm.includes("64")) {
        storageBonus = -Math.max(80, Math.round(base * 0.06));
      }
    }
  } else if (refDevice) {
    // Aparelho bate diretamente com a tabela oficial de compra da loja!
    base = refDevice.priceBrl;
    storageBonus = 0;
    if (refDevice.capacity) {
      highlights.push(`Capacidade ${refDevice.capacity} (tabela oficial)`);
    }
  } else {
    base = findBasePrice(input.model);
    const storageNorm = base > 0 ? (input.storage || "").toLowerCase() : "";
    if (storageNorm.includes("1tb") || storageNorm.includes("1 tb")) {
      storageBonus = Math.max(500, Math.round(base * 0.18));
      highlights.push("Capacidade alta de 1TB (+ valor)");
    } else if (storageNorm.includes("512")) {
      storageBonus = Math.max(300, Math.round(base * 0.12));
      highlights.push("Capacidade 512GB (+ valor)");
    } else if (storageNorm.includes("256")) {
      storageBonus = Math.max(100, Math.round(base * 0.06));
      highlights.push("Capacidade 256GB");
    } else if (storageNorm.includes("64")) {
      storageBonus = -Math.max(80, Math.round(base * 0.06));
    }
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
  const batteryThreshold = cfg.minBatteryThreshold ?? 80;
  const penalty = (cfg.batteryPenaltyUnder80 ?? 18) / 100;

  if (input.batteryUnknown) {
    multiplier *= 0.94;
    score -= 5;
  } else if (typeof input.batteryPercent === "number") {
    const bat = input.batteryPercent;
    multiplier *= batteryMultiplier(bat, batteryThreshold, penalty);
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
  const adjustedBase = (base + storageBonus) * multiplier;
  const roundedEstimated = Math.round(adjustedBase / 50) * 50;

  // Faixa de -5% a +5% em torno da média estimada
  const minEstimatedValue = priceable ? Math.max(200, Math.round((roundedEstimated * 0.95) / 50) * 50) : 0;
  const maxEstimatedValue = priceable ? Math.max(minEstimatedValue + 100, Math.round((roundedEstimated * 1.05) / 50) * 50) : 0;

  // "Não sei" não muda o preço, mas a equipe precisa conferir.
  const pendingChecks = PENDING_CHECK_LABELS.filter(([field]) => input[field] === "Não sei").map(([, label]) => label);
  if (input.batteryUnknown) pendingChecks.push("Saúde da bateria");
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
  },
  loyaltyBonusPercent: number = 5
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

  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}
