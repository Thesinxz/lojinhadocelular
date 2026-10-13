import type { ValuationResult } from "@contracts/valuation";
import type { StoreUnit } from "@contracts/permissions";
import { brazilPhoneInputDigits } from "@contracts/brDocs";

/** Cotação vazia: usada enquanto o valor não vem do servidor (ou quando a loja oculta valores). */
export const EMPTY_VALUATION: ValuationResult = {
  modelName: "",
  basePrice: 0,
  minEstimatedValue: 0,
  maxEstimatedValue: 0,
  grade: "A",
  gradeLabel: "",
  score: 0,
  loyaltyBonusApplied: false,
  highlights: [],
  disclaimer: "",
  priceable: false,
  pendingChecks: [],
  blockers: [],
};

/** Pontos positivos mostrados ao cliente SEM valores nem regras de preço: só o que ele mesmo respondeu. */
export function publicHighlights(answers: {
  batteryPercent?: number | null;
  batteryUnknown?: boolean;
  openedBefore?: string;
  visualCondition?: string;
}): string[] {
  const list: string[] = [];
  const battery = answers.batteryPercent;
  if (!answers.batteryUnknown && typeof battery === "number") {
    if (battery >= 90) list.push(`Bateria saudável (${battery}%)`);
    else if (battery >= 85) list.push(`Bateria boa (${battery}%)`);
  }
  if (answers.openedBefore === "Não") list.push("Aparelho nunca aberto");
  if (/parece novo|sem marcas/i.test(answers.visualCondition ?? "")) list.push("Estado impecável sem marcas visíveis");
  return list;
}

// Modelos alvo para troca
export const TARGET_IPHONE_MODELS = [
  "iPhone 18 Pro Max",
  "iPhone 18 Pro",
  "iPhone 17 Pro Max",
  "iPhone 17 Pro",
  "iPhone 17",
  "iPhone Air",
  "iPhone 17e",
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 16e",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14 Plus",
  "iPhone 14",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 12 Pro Max",
  "iPhone 12",
  "iPhone 11",
];

export const PURCHASE_ORIGIN_OPTIONS = [
  { id: "Lojinha do Celular", label: "Lojinha do Celular", desc: "Comprado com a nossa equipe" },
  { id: "Outra loja física da cidade", label: "Outra loja física da cidade", desc: "" },
  {
    id: "Loja de departamento / Marketplace",
    label: "Loja de departamento / Marketplace",
    desc: "Ex.: Mercado Livre, Amazon, Shopee, Magazine Luiza, etc.",
  },
  { id: "Outro", label: "Outro", desc: "" },
];

export const SIMPLE_TRI_OPTIONS = ["Sim", "Não", "Não sei"];

export const VISUAL_CONDITION_OPTIONS = [
  "Parece novo, sem marcas",
  "Pouquíssimas marcas de uso",
  "Marcas normais do dia a dia",
  "Riscos ou amassados visíveis",
  "Tela ou tampa com trinco",
];

export type PhotoSlotKey = "front" | "back" | "sides" | "battery" | "screen";

export interface PhotoSlot {
  key: PhotoSlotKey;
  label: string;
  required: boolean;
  file?: File;
  previewUrl?: string;
  dataUrl?: string;
  originalSize?: number;
  compressedSize?: number;
  savingsPercent?: number;
  isCompressing?: boolean;
}

export const INITIAL_PHOTO_SLOTS: PhotoSlot[] = [
  { key: "front", label: "Foto da frente", required: true },
  { key: "back", label: "Foto da traseira", required: true },
  { key: "sides", label: "Foto das laterais (opcional)", required: false },
  { key: "battery", label: "Foto da saúde da bateria (opcional)", required: false },
  { key: "screen", label: "Foto da tela ligada (opcional)", required: false },
];

export type EvaluationData = {
  name: string;
  whatsapp: string;
  model: string;
  storage: string;
  color: string;
  purchaseLocation: string;
  batteryPercent: number;
  batteryUnknown: boolean;
  targetModel: string;
  faceId: string;
  screenOriginal: string;
  batteryOriginal: string;
  camerasOk: string;
  audioOk: string;
  chargingPortOk: string;
  openedBefore: string;
  hasBox: string;
  icloudFree: string;
  /** Só para conferir o bônus de fidelidade no ERP. Nunca vai para o histórico local nem para o WhatsApp. */
  cpf: string;
  visualCondition: string;
  notes: string;
  unit: StoreUnit | "";
};

export const INITIAL_EVALUATION: EvaluationData = {
  name: "",
  whatsapp: "",
  model: "",
  storage: "",
  color: "",
  purchaseLocation: "",
  batteryPercent: 90,
  batteryUnknown: false,
  targetModel: "",
  faceId: "",
  screenOriginal: "",
  batteryOriginal: "",
  camerasOk: "",
  audioOk: "",
  chargingPortOk: "",
  openedBefore: "",
  hasBox: "",
  icloudFree: "",
  cpf: "",
  visualCondition: "",
  notes: "",
  unit: "",
};

export function formatCpfInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatPhoneInput(value: string): string {
  const digits = brazilPhoneInputDigits(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/** Modelos oferecidos na escolha do aparelho atual, por série (mais novos primeiro). */
export const MODEL_GROUPS: { title: string; models: string[] }[] = [
  { title: "iPhone 18", models: ["iPhone 18 Pro Max", "iPhone 18 Pro"] },
  { title: "iPhone 17", models: ["iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone Air", "iPhone 17", "iPhone 17e"] },
  { title: "iPhone 16", models: ["iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16", "iPhone 16e"] },
  { title: "iPhone 15", models: ["iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15"] },
  { title: "iPhone 14", models: ["iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14"] },
  { title: "iPhone 13", models: ["iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini"] },
  { title: "iPhone 12", models: ["iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 mini"] },
  { title: "iPhone 11", models: ["iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11"] },
  {
    title: "Mais antigos",
    models: ["iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X", "iPhone SE (3ª geração)", "iPhone SE (2ª geração)"],
  },
];

/** Só o primeiro nome, para saudações (o campo aceita o nome completo). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
