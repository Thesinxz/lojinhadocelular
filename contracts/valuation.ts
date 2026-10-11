/** Tipos da avaliação (sem nenhum valor ou tabela de preço). */

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


export type PriceSource = "personalizado" | "tabela" | "calculado" | "sem-preco";

export interface PriceListColor {
  name: string;
  hex: string;
  /** Chave salva em `customBasePrices` (modelo + capacidade + cor). */
  key: string;
  /** Valor que o motor usa para esta cor sem o preço próprio dela (o da capacidade). */
  suggested: number;
}

export interface PriceListRow {
  /** Chave salva em `customBasePrices` (modelo + capacidade). */
  key: string;
  capacity: string;
  /** Valor que o motor usa hoje para esta linha, sem contar o preço personalizado dela. */
  suggested: number;
  suggestedSource: PriceSource;
  colors: PriceListColor[];
}

export interface PriceListModel {
  key: string;
  name: string;
  year: number;
  rows: PriceListRow[];
}

