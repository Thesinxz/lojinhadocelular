import { TRPCError } from "@trpc/server";
import { can, type Capability, type SessionUser } from "@contracts/permissions";

export type { Capability, SessionUser } from "@contracts/permissions";
export { can } from "@contracts/permissions";

type Loose<T> = T | null | undefined;

export interface VariantLike {
  id?: Loose<number>;
  version?: Loose<string>;
  storage: string;
  color: string;
  colorHex?: Loose<string>;
  sku?: Loose<string>;
  warranty?: Loose<string>;
  condition?: Loose<string>;
  priceCash: number;
  imageUrl?: Loose<string>;
  videoUrl?: Loose<string>;
  batteryHealth?: Loose<string>;
  notes?: Loose<string>;
  quantity?: Loose<number>;
  available: boolean;
}

export interface ProductLike {
  name: string;
  brand: string;
  category: string;
  condition: string;
  warranty?: Loose<string>;
  description?: Loose<string>;
  featured: boolean;
  active: boolean;
  imageUrl?: Loose<string>;
  videoUrl?: Loose<string>;
  variants: VariantLike[];
}

export const FORBIDDEN_MESSAGE = "Sem permissão para esta ação";

export function assertCan(user: SessionUser, cap: Capability): void {
  if (!can(user, cap)) {
    throw new TRPCError({ code: "FORBIDDEN", message: FORBIDDEN_MESSAGE });
  }
}

const PRODUCT_FIELD_LABELS: Record<string, string> = {
  name: "o nome",
  brand: "a marca",
  category: "a categoria",
  condition: "a condição",
  warranty: "a garantia",
  description: "a descrição",
  featured: "o destaque",
  version: "a versão",
  storage: "o armazenamento",
  color: "a cor",
  colorHex: "a cor",
  sku: "o código (SKU)",
  customName: "o nome",
};

const PRODUCT_MANAGE_FIELDS = [
  "name",
  "brand",
  "category",
  "condition",
  "warranty",
  "description",
  "featured",
] as const;
const PRODUCT_MEDIA_FIELDS = ["imageUrl", "videoUrl", "active"] as const;

const VARIANT_MANAGE_FIELDS = [
  "version",
  "storage",
  "color",
  "colorHex",
  "sku",
  "warranty",
  "condition",
] as const;
const VARIANT_MEDIA_FIELDS = [
  "imageUrl",
  "videoUrl",
  "batteryHealth",
  "notes",
  "quantity",
  "available",
] as const;

const ERP_MEDIA_KEYS = new Set(["imageUrl", "videoUrl", "batteryHealth", "description", "active"]);

/** Normaliza `undefined`, `null` e `""` como equivalentes. */
function norm(value: unknown): unknown {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  return value;
}

function differs(a: unknown, b: unknown): boolean {
  return norm(a) !== norm(b);
}

function ownerOnly(field: string): string {
  const label = PRODUCT_FIELD_LABELS[field] ?? `o campo "${field}"`;
  return `Apenas o dono pode alterar ${label}`;
}

const PRICE_MESSAGE = "Você não tem permissão para alterar preços";
const MEDIA_MESSAGE = "Você não tem permissão para alterar fotos, vídeos e disponibilidade";
const STRUCTURE_MESSAGE = "Apenas o dono pode adicionar ou remover variantes";
const CREATE_DELETE_MESSAGE = "Apenas o dono pode criar ou excluir produtos";

/**
 * Verifica se o usuário pode aplicar a mudança `before → after` em um produto.
 * Retorna a mensagem de erro (PT-BR) ou `null` se permitido.
 */
export function checkProductUpdate(
  user: SessionUser,
  before: ProductLike | null,
  after: ProductLike | null,
): string | null {
  if (!before || !after) {
    return can(user, "products.manage") ? null : CREATE_DELETE_MESSAGE;
  }

  const canManage = can(user, "products.manage");
  const canMedia = can(user, "products.editMedia");
  const canPrice = can(user, "products.editPrice");
  if (canManage && canMedia && canPrice) return null;

  for (const field of PRODUCT_MANAGE_FIELDS) {
    if (!canManage && differs(before[field], after[field])) return ownerOnly(field);
  }
  for (const field of PRODUCT_MEDIA_FIELDS) {
    if (!canMedia && differs(before[field], after[field])) return MEDIA_MESSAGE;
  }

  // Estrutura das variantes: mesmo conjunto de ids
  const beforeById = new Map<number, VariantLike>();
  for (const v of before.variants) {
    if (typeof v.id === "number") beforeById.set(v.id, v);
  }
  const afterIds = after.variants.map((v) => v.id);
  const structural =
    after.variants.length !== before.variants.length ||
    afterIds.some((id) => typeof id !== "number" || !beforeById.has(id)) ||
    new Set(afterIds).size !== afterIds.length;
  if (structural) {
    return canManage ? null : STRUCTURE_MESSAGE;
  }

  for (const next of after.variants) {
    const prev = beforeById.get(next.id as number)!;
    for (const field of VARIANT_MANAGE_FIELDS) {
      if (!canManage && differs(prev[field], next[field])) return ownerOnly(field);
    }
    if (!canPrice && differs(prev.priceCash, next.priceCash)) return PRICE_MESSAGE;
    for (const field of VARIANT_MEDIA_FIELDS) {
      if (!canMedia && differs(prev[field], next[field])) return MEDIA_MESSAGE;
    }
  }

  return null;
}

/**
 * Verifica se o usuário pode alterar as chaves informadas de um override de produto do ERP.
 * Retorna a mensagem de erro (PT-BR) ou `null` se permitido.
 */
export function checkErpOverrideUpdate(user: SessionUser, changedKeys: string[]): string | null {
  for (const key of changedKeys) {
    if (ERP_MEDIA_KEYS.has(key)) {
      if (!can(user, "products.editMedia")) return MEDIA_MESSAGE;
    } else if (!can(user, "products.manage")) {
      return ownerOnly(key);
    }
  }
  return null;
}
