import { trpc } from "@/providers/trpc";
import type { ProductWithVariants } from "@/providers/trpc";
import { SETTING_KEYS, parseFees, type FeeTable } from "@contracts/types";

export function useShopSettings() {
  const query = trpc.shop.settings.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });
  const s = query.data ?? {};
  return {
    loading: query.isLoading,
    whatsappJardim: s[SETTING_KEYS.whatsappJardim] ?? "",
    whatsappGll: s[SETTING_KEYS.whatsappGll] ?? "",
    addressJardim: s[SETTING_KEYS.addressJardim] ?? "",
    addressGll: s[SETTING_KEYS.addressGll] ?? "",
    mapsJardim: s[SETTING_KEYS.mapsJardim] ?? "",
    mapsGll: s[SETTING_KEYS.mapsGll] ?? "",
    installmentsMax: Number(s[SETTING_KEYS.installmentsMax] ?? "12") || 12,
    fees: parseFees(s[SETTING_KEYS.installmentFees]) as FeeTable,
    debitPixFee: Number(s[SETTING_KEYS.debitPixFee] ?? "2.39") || 0,
    popupEnabled: (s[SETTING_KEYS.popupEnabled] ?? "1") === "1",
    heroImages: parseHeroImages(s[SETTING_KEYS.heroImages]),
  };
}

export function parseHeroImages(json: string | undefined): string[] {
  try {
    if (json) {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((u) => typeof u === "string" && u.trim());
      }
    }
  } catch {
    // ignora
  }
  return [
    "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=900&q=80",
    "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=900&q=80",
    "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=900&q=80",
  ];
}

/** Menor preço à vista entre as variantes disponíveis */
export function minPrice(product: ProductWithVariants): number | null {
  const prices = product.variants.filter((v) => v.available).map((v) => v.priceCash);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

/** 
 * Otimiza qualquer URL de imagem externa (ex: ImgBB, Amazon, Unsplash) usando CDN Cloudflare Edge (wsrv.nl).
 * Converte imagens pesadas (ex: 5MB PNGs) para WebP ultra-leve (~40KB) com cache de borda no Brasil!
 */
export function optimizeImageUrl(url: string | null | undefined, width = 600): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Se já for imagem local ou data URI, mantém original
  if (trimmed.startsWith("/") || trimmed.startsWith("data:")) return trimmed;

  // Se já for otimizada pelo wsrv.nl
  if (trimmed.includes("wsrv.nl")) return trimmed;

  return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=${width}&output=webp&q=80`;
}

/** Cores disponíveis de um produto (sem duplicar) */
export function availableColors(product: ProductWithVariants) {
  const map = new Map<string, string>();
  for (const v of product.variants) {
    if (v.available && !map.has(v.color)) map.set(v.color, v.colorHex ?? "#111111");
  }
  return [...map.entries()].map(([color, hex]) => ({ color, hex }));
}

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export type SortOption = "relevancia" | "lacrados_primeiro" | "modelo_recente" | "menor_preco" | "maior_preco";

export function getProductModelRank(name: string): number {
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Se for iPhone, extrai o número da geração (ex: "iphone 16 pro max" => 16)
  const iphoneMatch = n.match(/iphone\s*(\d+)/i);
  let gen = 0;
  if (iphoneMatch) {
    gen = parseInt(iphoneMatch[1], 10);
  } else if (n.includes("iphone x") || n.includes("iphone xs") || n.includes("iphone xr")) {
    gen = 10;
  } else if (n.includes("iphone 8")) {
    gen = 8;
  } else if (n.includes("iphone 7")) {
    gen = 7;
  } else if (n.includes("iphone se")) {
    gen = 9;
  }

  // Tier da versão (Pro Max = 0.9 > Pro = 0.8 > Plus = 0.3 > Normal = 0.1 > Mini = 0.05)
  let tier = 0.1;
  if (n.includes("pro max")) tier = 0.9;
  else if (n.includes("pro")) tier = 0.8;
  else if (n.includes("plus")) tier = 0.3;
  else if (n.includes("mini")) tier = 0.05;

  return gen * 100 + tier * 10;
}

/** Verifica se um produto é um iPhone Seminovo de Entrada (gerações 11, 12, 13, SE, 8 Plus) */
export function isEntryLevelSeminovo(product: { name: string; condition: string; category: string }): boolean {
  const isSeminovo = product.condition === "seminovo" || product.category === "iphone_seminovo";
  if (!isSeminovo) return false;
  const rank = getProductModelRank(product.name);
  return rank > 0 && rank <= 1309;
}

/** Verifica se o produto tem procedência de importação dos EUA */
export function isImportedEua(product: { name: string; category: string; description?: string | null; warranty?: string | null; variants?: { notes?: string | null }[] }): boolean {
  const text = `${product.name} ${product.category} ${product.description || ""} ${product.warranty || ""} ${product.variants?.map(v => v.notes || "").join(" ") || ""}`.toLowerCase();
  return text.includes("eua") || text.includes("usa") || text.includes("importad") || text.includes("norte-american");
}

export function getProductGroupPriority(p: { brand?: string; name: string; category: string; condition: string }): number {
  const brand = (p.brand || "").toLowerCase();
  const name = p.name.toLowerCase();
  const isApple = brand.includes("apple") || name.includes("iphone") || p.category.includes("iphone");
  const isLacrado = p.condition === "lacrado" || p.condition === "novo" || p.category === "iphone_lacrado";
  const isSeminovo = p.condition === "seminovo" || p.category === "iphone_seminovo";

  if (isApple && isLacrado) {
    return 3; // 1º LUGAR: iPhones Lacrados
  }
  if (isApple || isSeminovo) {
    return 2; // 2º LUGAR: iPhones Seminovos
  }
  return 1;   // 3º LUGAR: Outras Marcas (Xiaomi, Realme, Tecno, Infinix, Androids, Acessórios)
}

export function sortProducts(
  products: ProductWithVariants[],
  sortOption: SortOption = "relevancia",
): ProductWithVariants[] {
  return [...products].sort((a, b) => {
    const priceA = minPrice(a) ?? 0;
    const priceB = minPrice(b) ?? 0;
    const rankA = getProductModelRank(a.name);
    const rankB = getProductModelRank(b.name);

    if (sortOption === "menor_preco") {
      return priceA - priceB;
    }
    if (sortOption === "maior_preco") {
      return priceB - priceA;
    }
    if (sortOption === "modelo_recente") {
      if (rankA !== rankB) return rankB - rankA;
      return priceB - priceA;
    }

    // Padrão ("relevancia" e "lacrados_primeiro"):
    // 1º HIERARQUIA DE GRUPOS:
    //   - Grupo 3: iPhones Lacrados
    //   - Grupo 2: iPhones Seminovos
    //   - Grupo 1: Outras Marcas (Xiaomi, Realme, Tecno, Infinix...)
    const groupA = getProductGroupPriority(a);
    const groupB = getProductGroupPriority(b);
    if (groupA !== groupB) return groupB - groupA;

    // 2º Destaques (featured) em cada grupo
    const featA = a.featured ? 1 : 0;
    const featB = b.featured ? 1 : 0;
    if (featA !== featB) return featB - featA;

    // 3º Modelo mais recente primeiro (iPhone 16 > 15 > 14 > 13)
    if (rankA !== rankB) return rankB - rankA;

    // 4º Maior preço como desempate
    return priceB - priceA;
  });
}
