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
  warrantyBadgeText: "warranty_badge_text", // Mensagem de garantia e procedência na página do produto
  valuationConfig: "valuation_config", // JSON: Configuração do motor de avaliação inteligente
  evaluationSlaHours: "evaluation_sla_hours", // horas até uma avaliação pendente ficar "Atrasada"
  whatsappTemplates: "whatsapp_templates", // JSON: [{ id, label, body }] mensagens prontas do atendimento
  autoMessages: "auto_messages", // JSON: AutoMessagesConfig (mensagens automáticas via Evolution API)
  teamNotifyNumbers: "team_notify_numbers", // números ou grupos do WhatsApp que recebem o aviso de nova avaliação
  socialProofEnabled: "social_proof_enabled", // "1" | "0": faixa "quem já comprou" na página inicial
  socialProofTitle: "social_proof_title", // título da faixa
  retentionAuto: "retention_auto", // "1" | "0": a rotina apaga sozinha as avaliações com prazo vencido (desligada por padrão)
  retentionOpenMonths: "retention_open_months", // meses até apagar avaliações não concluídas (0 = nunca apagar)
  retentionClosedMonths: "retention_closed_months", // meses até apagar avaliações concluídas (0 = nunca apagar)
  privacyOfficerName: "privacy_officer_name", // nome do encarregado (DPO), mostrado na Política de Privacidade
  privacyEmail: "privacy_email", // e-mail do canal do titular (opcional), mostrado na Política de Privacidade
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

/** Estado visual: ajuste em % sobre o valor (negativo desconta, positivo acrescenta). */
export const VISUAL_ADJUSTMENT_KEYS = ["novo", "poucas", "normais", "riscos", "trinco"] as const;
export type VisualAdjustmentKey = (typeof VISUAL_ADJUSTMENT_KEYS)[number];
export const VISUAL_ADJUSTMENT_LABELS: Record<VisualAdjustmentKey, string> = {
  novo: "Parece novo, sem marcas",
  poucas: "Pouquíssimas marcas de uso",
  normais: "Marcas normais do dia a dia",
  riscos: "Riscos ou amassados visíveis",
  trinco: "Tela ou tampa com trinco",
};

/** Itens do diagnóstico técnico; "Não" na resposta do cliente aplica a regra. */
export const DEFECT_KEYS = ["faceId", "screen", "batteryOriginal", "cameras", "audio", "chargingPort", "opened"] as const;
export type DefectKey = (typeof DEFECT_KEYS)[number];
export const DEFECT_LABELS: Record<DefectKey, string> = {
  faceId: "Face ID não funciona",
  screen: "Tela trocada / não original",
  batteryOriginal: "Bateria trocada / não original",
  cameras: "Câmeras com problema",
  audio: "Áudio com problema",
  chargingPort: "Conector de carga com problema",
  opened: "Já foi aberto / reparado",
};

/** Custos de reparo por modelo (R$): quando preenchidos, substituem a regra geral daquele item. */
export const MODEL_REPAIR_KEYS = ["cracked", "batteryLow", ...DEFECT_KEYS] as const;
export type ModelRepairKey = (typeof MODEL_REPAIR_KEYS)[number];
export const MODEL_REPAIR_LABELS: Record<ModelRepairKey, string> = {
  cracked: "Tela trincada",
  batteryLow: "Bateria abaixo do limite",
  faceId: "Face ID",
  screen: "Tela trocada (não original)",
  batteryOriginal: "Bateria trocada (não original)",
  cameras: "Câmeras",
  audio: "Áudio",
  chargingPort: "Conector de carga",
  opened: "Já foi aberto",
};
export type ModelRepairs = Record<string, Partial<Record<ModelRepairKey, number>>>;

export interface DefectRule {
  /** Desconto em % do valor do aparelho. */
  percent: number;
  /** Desconto fixo em R$ (ex.: custo de trocar a peça). Soma com o percentual. */
  reais: number;
  /** Mesmo com desconto, marca "conferir na loja" para a equipe decidir. */
  manual: boolean;
}

export interface ValuationAdjustments {
  visual: Record<VisualAdjustmentKey, number>;
  defects: Record<DefectKey, DefectRule>;
  /** Desconto quando o cliente não sabe a saúde da bateria. */
  batteryUnknownPercent: number;
  /** Folga da faixa mostrada: valor estimado ± este %. */
  rangePercent: number;
  /** Custo de reparo em R$ por modelo (chave do modelo → item → valor). */
  modelRepairs: ModelRepairs;
}



export interface ValuationConfig {
  globalMultiplier: number; // ex: 1.0 = 100%, 0.95 = 95%, 1.05 = 105%
  loyaltyBonusPercent: number; // ex: 5 = +5%
  boxBonusReais: number; // ex: 80 = +R$ 80
  minBatteryThreshold: number; // ex: 80 = 80%
  batteryPenaltyUnder80: number; // ex: 18 = -18%
  customBasePrices: Record<string, number>; // ex: {"iphone 16 pro max": 6500, ...}
  /** Descontos por estado visual e defeitos; ausente = padrões. */
  adjustments?: Partial<ValuationAdjustments>;
  disclaimerText?: string;
  hidePricesToClient?: boolean; // Se true, o cliente não vê valores monetários (R$) no site nem na mensagem do WhatsApp
}

// ===== Avaliações (Troca Fácil) =====

export const EVALUATION_STATUSES = ["pendente", "atendimento", "concluido", "recusado"] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  pendente: "Pendente",
  atendimento: "Em atendimento",
  concluido: "Concluído",
  recusado: "Recusado",
};

export const REFUSAL_REASONS = [
  { value: "preco", label: "Preço não agradou" },
  { value: "defeito", label: "Aparelho com defeito/peças" },
  { value: "sem_resposta", label: "Cliente não respondeu" },
  { value: "desistiu", label: "Cliente desistiu" },
  { value: "outro", label: "Outro" },
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number]["value"];

export const DEFAULT_EVALUATION_SLA_HOURS = 2;

export interface WhatsappTemplate {
  id: string;
  label: string;
  body: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsappTemplate[] = [
  {
    id: "recebemos",
    label: "Recebemos sua avaliação",
    body: "Olá {nome}! Aqui é {vendedor} da Lojinha do Celular {loja}. Recebemos a avaliação do seu {modelo} e já estamos analisando. Em instantes te passo a proposta 😊",
  },
  {
    id: "proposta",
    label: "Proposta",
    body: "Olá {nome}! Analisamos seu {modelo}. Conseguimos oferecer {valor_oferecido} na troca, sujeito à conferência presencial. Podemos agendar sua visita?",
  },
  {
    id: "convite",
    label: "Convite para a loja",
    body: "{nome}, te esperamos na Lojinha do Celular {loja}: {endereco}. É só trazer o aparelho para a conferência final!",
  },
  {
    id: "fotos",
    label: "Pedir mais fotos",
    body: "Olá {nome}! Para fechar a avaliação do seu {modelo}, pode nos enviar mais algumas fotos da tela e da traseira?",
  },
];

// ===== Mensagens automáticas (Evolution API) =====
export const AUTO_MESSAGE_EVENTS = ["created", "assigned", "offered", "concluded", "refused"] as const;
export type AutoMessageEvent = (typeof AUTO_MESSAGE_EVENTS)[number];

export const AUTO_MESSAGE_EVENT_LABELS: Record<AutoMessageEvent, string> = {
  created: "Avaliação recebida",
  assigned: "Atendente definido",
  offered: "Proposta enviada",
  concluded: "Troca concluída",
  refused: "Avaliação encerrada",
};

export interface AutoMessageRule {
  enabled: boolean;
  body: string;
}

export interface AutoMessagesConfig {
  /** Liga/desliga todas as mensagens para o cliente. */
  customerEnabled: boolean;
  /** Avisa a equipe (WhatsApp da unidade) quando chega uma avaliação. */
  teamEnabled: boolean;
  events: Record<AutoMessageEvent, AutoMessageRule>;
}

export const DEFAULT_AUTO_MESSAGES: AutoMessagesConfig = {
  customerEnabled: true,
  teamEnabled: true,
  events: {
    created: {
      enabled: true,
      body: "Olá {nome}! Recebemos a avaliação do seu {modelo} na Lojinha do Celular 😊 Nossa equipe vai analisar e te responde em breve por aqui.",
    },
    assigned: {
      enabled: false,
      body: "Olá {nome}! {vendedor} vai cuidar da avaliação do seu {modelo}. Qualquer dúvida é só chamar por aqui.",
    },
    offered: {
      enabled: false,
      body: "Olá {nome}! Analisamos seu {modelo} e conseguimos oferecer {valor_oferecido} na troca, sujeito à conferência presencial. Podemos agendar sua visita?",
    },
    concluded: {
      enabled: false,
      body: "Obrigado pela confiança, {nome}! Sua troca foi concluída. Qualquer coisa, estamos à disposição na Lojinha do Celular 💙",
    },
    refused: {
      enabled: false,
      body: "Olá {nome}! Encerramos por aqui a avaliação do seu {modelo}. Se mudar de ideia ou quiser reavaliar, é só nos chamar.",
    },
  },
};

/** Lê o JSON salvo; qualquer campo ausente/inválido cai no padrão. */
export function parseAutoMessages(raw: string | undefined | null): AutoMessagesConfig {
  const base: AutoMessagesConfig = {
    customerEnabled: DEFAULT_AUTO_MESSAGES.customerEnabled,
    teamEnabled: DEFAULT_AUTO_MESSAGES.teamEnabled,
    events: { ...DEFAULT_AUTO_MESSAGES.events },
  };
  if (!raw) return base;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!data || typeof data !== "object") return base;
  const input = data as Record<string, unknown>;
  if (typeof input.customerEnabled === "boolean") base.customerEnabled = input.customerEnabled;
  if (typeof input.teamEnabled === "boolean") base.teamEnabled = input.teamEnabled;
  const events = input.events && typeof input.events === "object" ? (input.events as Record<string, unknown>) : {};
  for (const event of AUTO_MESSAGE_EVENTS) {
    const rule = events[event];
    if (!rule || typeof rule !== "object") continue;
    const { enabled, body } = rule as Record<string, unknown>;
    base.events[event] = {
      enabled: typeof enabled === "boolean" ? enabled : DEFAULT_AUTO_MESSAGES.events[event].enabled,
      body: typeof body === "string" && body.trim() ? body : DEFAULT_AUTO_MESSAGES.events[event].body,
    };
  }
  return base;
}

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
  warranty_badge_text: "Garantia e procedência verificada.",
  valuation_config: "", // vazio = padrões do servidor (api/valuation/config.ts)
  evaluation_sla_hours: String(DEFAULT_EVALUATION_SLA_HOURS),
  whatsapp_templates: JSON.stringify(DEFAULT_WHATSAPP_TEMPLATES),
  auto_messages: JSON.stringify(DEFAULT_AUTO_MESSAGES),
  team_notify_numbers: "",
  social_proof_enabled: "0", // desligada até o ERP publicar o endpoint e o dono ligar
  social_proof_title: "Quem confia e já faz parte da família Lojinha ❤️",
  retention_auto: "0",
  retention_open_months: "12",
  retention_closed_months: "60",
  privacy_officer_name: "",
  privacy_email: "",
  admin_password: "lojinha123",
};

export type ProductSource = "local" | "erp" | "demo";

export type CatalogStatus =
  | "ok"
  | "empty"
  | "offline"
  | "config_error"
  | "disabled";

export type CatalogStatusResponse = {
  erpEnabled: boolean;
  status: CatalogStatus;
  message?: string;
  count: number;
};

export type VariantInput = {
  id?: number;
  version: string;
  storage: string;
  color: string;
  colorHex?: string;
  imageUrl?: string;
  videoUrl?: string;
  sku?: string;
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
  videoUrl?: string;
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

export interface EvaluationPhotoItem {
  key: string;
  label: string;
  url: string;
  storage?: "inline" | "s3";
  objectKey?: string;
  name?: string;
  size?: number;
}
