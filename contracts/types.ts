export * from "./errors";

// ===== Constantes compartilhadas (frontend + backend) =====

export const CATEGORIES = [
  { value: "iphone_lacrado", label: "iPhone Lacrado" },
  { value: "iphone_seminovo", label: "iPhone Seminovo" },
  { value: "android", label: "Android" },
  { value: "acessorio", label: "Acessório" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const BRANDS = ["Apple", "Xiaomi", "Realme", "Tecno", "Infinix", "Outra"] as const;

export const CONDITIONS = [
  { value: "lacrado", label: "Lacrado" },
  { value: "seminovo", label: "Seminovo" },
  { value: "novo", label: "Novo" },
] as const;

// Chaves de configuração da loja (tabela settings)
export const SETTING_KEYS = {
  whatsappJardim: "whatsapp_jardim",
  whatsappGll: "whatsapp_gll",
  addressJardim: "address_jardim",
  addressGll: "address_gll",
  mapsJardim: "maps_jardim",
  mapsGll: "maps_gll",
  installmentsMax: "installments_max", // nº máximo de parcelas
  installmentFees: "installment_fees", // JSON: {"1": 4.99, "2": 6.59, ...}
  debitPixFee: "debit_pix_fee", // taxa débito/PIX em %
  popupEnabled: "popup_enabled", // "1" | "0"
  heroImages: "hero_images", // JSON array de URLs para o carrossel da página inicial
  adminPassword: "admin_password", // nunca exposta publicamente
} as const;

// Taxas padrão da maquininha (% sobre o valor total, por nº de parcelas)
export const DEFAULT_FEES: Record<string, number> = {
  "1": 4.99, // crédito à vista
  "2": 6.59,
  "3": 7.52,
  "4": 8.17,
  "5": 9.11,
  "6": 9.73,
  "7": 10.29,
  "8": 10.99,
  "9": 11.72,
  "10": 12.79,
  "11": 13.12,
  "12": 14.09,
  "13": 14.91,
  "14": 15.79,
  "15": 16.51,
  "16": 17.44,
  "17": 18.31,
  "18": 18.99,
  "19": 19.95,
  "20": 20.99,
  "21": 21.79,
};

export const DEFAULT_SETTINGS: Record<string, string> = {
  whatsapp_jardim: "5567992086012",
  whatsapp_gll: "5567998206533",
  address_jardim: "Av. Duque de Caxias, 486 - Jardim/MS",
  address_gll: "Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS",
  maps_jardim: "https://www.google.com/maps/search/?api=1&query=Av.+Duque+de+Caxias+486+Jardim+MS",
  maps_gll: "https://www.google.com/maps/search/?api=1&query=Rua+Macias+Barbosa+2185+Guia+Lopes+da+Laguna+MS",
  installments_max: "12",
  installment_fees: JSON.stringify(DEFAULT_FEES),
  debit_pix_fee: "2.39",
  popup_enabled: "1",
  hero_images: JSON.stringify([
    "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=900&q=80",
    "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=900&q=80",
    "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=900&q=80",
    "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=900&q=80",
  ]),
  admin_password: "lojinha123",
};

// ===== Tipos =====

export type VariantInput = {
  id?: number;
  version: string;
  storage: string;
  color: string;
  colorHex?: string;
  imageUrl?: string;
  batteryHealth?: string;
  warranty?: string;
  condition?: string;
  notes?: string;
  priceCash: number;
  quantity?: number;
  available: boolean;
};

export type ProductInput = {
  id?: number;
  name: string;
  brand: string;
  category: CategoryValue;
  condition: string;
  description?: string;
  imageUrl?: string;
  warranty?: string;
  featured: boolean;
  active: boolean;
  variants: VariantInput[];
};

// ===== Helpers de preço (usados no frontend e backend) =====

export function formatBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

/**
 * Valor da parcela no cartão repassando a taxa da maquininha.
 * A taxa é um % sobre o valor total cobrado: total = àVista / (1 - taxa%),
 * e a parcela é total / n (arredondado para o centavo mais próximo).
 */
export function installmentFromFees(
  priceCash: number,
  installments: number,
  feePct: number,
): number {
  if (installments <= 1 && feePct <= 0) return priceCash;
  const total = priceCash / (1 - feePct / 100);
  return Math.round(total / Math.max(installments, 1));
}

/** Valor total no cartão em n parcelas (com a taxa repassada). */
export function totalWithFee(priceCash: number, feePct: number): number {
  return Math.round(priceCash / (1 - feePct / 100));
}

export type FeeTable = Record<string, number>;

export function parseFees(json: string | undefined): FeeTable {
  try {
    if (json) {
      const parsed = JSON.parse(json) as Record<string, number>;
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignora e usa padrão
  }
  return DEFAULT_FEES;
}
