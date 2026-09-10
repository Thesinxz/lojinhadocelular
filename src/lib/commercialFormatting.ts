import { detectIphoneModel } from "./iphoneCatalog";

export interface CartItem {
  id: string; // chave única: `${productId}-${variantId || color}-${storage}`
  productId: number | string;
  variantId?: number | string;
  name: string;
  color: string;
  storage: string;
  condition: string; // "Seminovo" | "Lacrado"
  sku: string; // Ex: "B2700"
  price: number; // em centavos (ex: 339000 para R$ 3.390,00)
  imageUrl: string;
  quantity: number;
}

/**
 * Normaliza nomes técnicos vindos do ERP em nomes comerciais limpos e profissionais.
 * Ex: "CEL IPHONE 17 PRO MAX SILVER 256GB" + "Silver" + "256GB" -> "iPhone 17 Pro Max - Silver 256GB"
 * Evita duplicações de cor e capacidade.
 */
export function formatCommercialProductName(
  name: string,
  color?: string | null,
  storage?: string | null,
): string {
  if (!name) return "";
  let clean = name.trim();

  // 1. Remove prefixos técnicos do ERP
  clean = clean
    .replace(/^Aparelho\s+/i, "")
    .replace(/^APPLE\s+CEL\s+/i, "")
    .replace(/^APPLE\s+/i, "")
    .replace(/^CEL\s+/i, "")
    .replace(/\s*-\s*Seminovo/i, "")
    .replace(/\s*-\s*Novo/i, "")
    .replace(/\s*-\s*Lacrado/i, "")
    .replace(/\s*\([A-D]\)/gi, "")
    .trim();

  // 2. Se for iPhone, resolve o modelo canônico da Apple
  const iphoneMatch = detectIphoneModel(clean);
  let baseName = clean;

  if (iphoneMatch) {
    baseName = iphoneMatch.name; // Ex: "iPhone 17 Pro Max"
  } else {
    // Normalização geral
    if (/^IPHONE\s+/i.test(clean)) {
      baseName = "iPhone " + clean.replace(/^IPHONE\s+/i, "");
    } else if (/^(11|12|13|14|15|16|17)\b/i.test(clean)) {
      baseName = "iPhone " + clean;
    }
  }

  // 3. Montar cor e capacidade sem duplicação
  const normColor = (color || "").trim();
  const normStorage = (storage || "").trim();

  const specParts: string[] = [];
  if (normColor && normColor !== "Padrão") {
    specParts.push(normColor);
  }
  if (normStorage && normStorage !== "Padrão") {
    specParts.push(normStorage);
  }

  if (specParts.length === 0) {
    return baseName;
  }

  // Verifica se baseName já contém cor ou storage
  const baseLower = baseName.toLowerCase();
  const hasColor =
    Boolean(normColor) &&
    normColor !== "Padrão" &&
    baseLower.includes(normColor.toLowerCase());
  const hasStorage =
    Boolean(normStorage) &&
    normStorage !== "Padrão" &&
    baseLower.includes(normStorage.toLowerCase());

  if (hasColor && hasStorage) {
    return baseName;
  }
  if (hasColor && !hasStorage && normStorage && normStorage !== "Padrão") {
    return `${baseName} ${normStorage}`;
  }
  if (!hasColor && hasStorage && normColor && normColor !== "Padrão") {
    return `${baseName} - ${normColor}`;
  }

  return `${baseName} - ${specParts.join(" ")}`;
}

/**
 * Transforma códigos internos do ERP (ex: ERP-50E70D25 ou UUIDs) em códigos comerciais elegantes.
 * Ex: "ERP-50E70D25" -> "B50E7"
 * Ex: "B2700" -> "B2700"
 */
export function formatCommercialSku(sku?: string | null): string {
  if (!sku) return "B1000";
  const s = sku.trim();

  // Já é no formato comercial BXXXX (ex: B2700, B1450)
  if (/^B[A-Z0-9]{3,5}$/i.test(s)) {
    return s.toUpperCase();
  }

  // Prefixo ERP- (ex: ERP-50E70D25)
  if (s.startsWith("ERP-")) {
    const raw = s.replace(/^ERP-/, "").trim();
    const shortCode = raw.slice(0, 4).toUpperCase();
    return `B${shortCode}`;
  }

  // UUID direto (ex: 50e70d25-9123-...)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)) {
    return `B${s.slice(0, 4).toUpperCase()}`;
  }

  // Numérico simples (ex: 2700 -> B2700)
  if (/^\d{3,5}$/.test(s)) {
    return `B${s}`;
  }

  return s.length > 8 ? `B${s.slice(0, 4).toUpperCase()}` : s;
}

/**
 * Normaliza o nome da unidade para não duplicar a palavra "Unidade".
 * Ex: "Unidade Jardim - MS" -> "Jardim - MS"
 */
export function formatUnitName(unitName?: string | null): string {
  if (!unitName) return "Jardim - MS";
  return unitName.replace(/^Unidade\s+/i, "").trim();
}
