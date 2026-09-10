import type { CategoryValue, ProductSource } from "../../contracts/types";

export interface ErpRawVariant {
  id?: string;
  sku?: string;
  code?: string;
  storage?: string;
  capacity?: string;
  color?: string;
  cor?: string;
  color_hex?: string;
  battery_health?: string | number;
  grade?: string;
  price?: number | string;
  sale_price?: number | string;
  price_cash?: number | string;
  stock?: number | string;
  quantity?: number | string;
  image?: string;
  image_url?: string;
  warranty?: string;
  condition?: string;
  notes?: string;
}

export interface ErpRawProduct {
  id: string; // UUID vindo do ERP
  name?: string;
  nome?: string;
  model?: string;
  modelo?: string;
  title?: string;

  brand?: string;
  marca?: string;

  price?: number | string;
  sale_price?: number | string;
  price_cash?: number | string;
  preco?: number | string;
  preco_venda?: number | string;
  valor?: number | string;
  valor_venda?: number | string;

  image?: string;
  image_url?: string;
  foto?: string;
  foto_url?: string;
  images?: string[];
  fotos?: string[];
  thumbnail?: string;

  condition?: string;
  condicao?: string;
  state?: string;

  storage?: string;
  capacity?: string;
  capacidade?: string;
  armazenamento?: string;

  color?: string;
  cor?: string;
  color_hex?: string;

  battery_health?: string | number;
  battery?: string | number;
  saude_bateria?: string | number;
  bateria?: string | number;

  grade?: string;
  classificacao?: string;

  stock?: number | string;
  quantity?: number | string;
  estoque?: number | string;
  quantidade?: number | string;
  qtd?: number | string;
  saldo?: number | string;

  category?: string | { slug?: string; name?: string };
  category_slug?: string;
  categoria?: string;

  warranty?: string;
  garantia?: string;

  sku?: string;
  code?: string;
  codigo?: string;
  serial?: string;
  imei?: string;

  description?: string;
  descricao?: string;
  notes?: string;
  observacoes?: string;

  video_url?: string;
  video?: string;

  variants?: ErpRawVariant[];
  variacoes?: ErpRawVariant[];
}

export type ErpCatalogApiResponse =
  | ErpRawProduct[]
  | { data: ErpRawProduct[] }
  | { products: ErpRawProduct[] }
  | { items: ErpRawProduct[] };

export interface ShopVariant {
  id: string | number;
  productId: string | number;
  version: string;
  storage: string;
  color: string;
  colorHex: string | null;
  imageUrl: string | null;
  videoUrl?: string | null;
  sku: string | null;
  batteryHealth: string | null;
  warranty: string | null;
  condition: string | null;
  notes: string | null;
  priceCash: number;
  quantity: number;
  available: boolean;
}

export interface ShopProduct {
  id: string | number;
  source: ProductSource;
  externalId: string;
  name: string;
  brand: string;
  category: CategoryValue;
  condition: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl?: string | null;
  warranty: string | null;
  featured: boolean;
  active: boolean;
  createdAt: Date;
  variants: ShopVariant[];
}

export type ErpFetchResult = {
  status: "ok" | "empty" | "offline" | "config_error";
  message?: string;
  products: ShopProduct[];
  cachedAt?: number;
};
