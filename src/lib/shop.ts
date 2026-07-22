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
