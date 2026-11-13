import { resolveProductImage } from "./iphoneCatalog";
import {
  extractProductIdFromShareSlug,
  extractProductUuidPrefixFromShareSlug,
} from "./productUrls";

export type ParsedProductRoute = {
  idStr: string;
  productRouteId: string;
  shareSlugUuid: string | null;
  isUuidOrString: boolean;
  numericId: number;
  productQueryId: string;
  isValidId: boolean;
};

export type ProductVariantLike = {
  id?: string | number | null;
  version: string;
  storage: string;
  color: string;
  colorHex?: string | null;
  imageUrl?: string | null;
  priceCash: number;
  quantity?: number | null;
  available: boolean;
};

export type ProductCatalogLike = {
  id: string | number;
  externalId?: string | null;
  alternateIds?: string[] | null;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string | null;
  variants: readonly ProductVariantLike[];
};

export type VariantPickResult = {
  storage?: string;
  color?: string;
  variantId: string | number | null;
};

export type DerivedVariantState<V extends ProductVariantLike> = {
  versions: string[];
  storages: string[];
  colors: string[];
  storageAvailable: (storage: string) => boolean;
  colorAvailable: (color: string) => boolean;
  colorHex: (color: string) => string;
  matchingVariants: V[];
  selected: V | undefined;
};

const STORE_UNITS = {
  jardim: {
    streetAddress: "Av. Duque de Caxias, 486",
    locality: "Jardim",
    postalCode: "79240-000",
    telephone: "+55-67-99208-6012",
  },
  guia_lopes: {
    streetAddress: "Rua Macias Barbosa, 2185",
    locality: "Guia Lopes da Laguna",
    postalCode: "79230-000",
    telephone: "+55-67-99820-6533",
  },
} as const;

/** Interpreta o parâmetro `:id` da rota `/produto/:id` suportando IDs numéricos, UUIDs e slugs amigáveis. */
export function parseProductRouteParams(rawId?: string): ParsedProductRoute {
  const idStr = rawId ? String(rawId).trim() : "";
  const shareSlugId = extractProductIdFromShareSlug(idStr);
  const shareSlugUuid = extractProductUuidPrefixFromShareSlug(idStr);
  const productRouteId = shareSlugId ?? idStr;
  const isUuidOrString =
    Boolean(shareSlugUuid) ||
    (idStr.length > 0 &&
      (productRouteId.includes("-") || Number.isNaN(Number(productRouteId))));
  const numericId = Number(productRouteId);
  const productQueryId = shareSlugUuid ? idStr : productRouteId;
  const isValidId = isUuidOrString
    ? Boolean(productRouteId)
    : !Number.isNaN(numericId) && numericId > 0;

  return {
    idStr,
    productRouteId,
    shareSlugUuid,
    isUuidOrString,
    numericId,
    productQueryId,
    isValidId,
  };
}

/** Localiza rapidamente um aparelho no cache da vitrine (`shop.products`) antes de buscar na API. */
export function findProductInCachedCatalog<T extends ProductCatalogLike>(
  list: readonly T[] | undefined,
  rawId: string,
): T | undefined {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const parsed = parseProductRouteParams(rawId);
  if (!parsed.productRouteId) return undefined;

  const rawLower = parsed.idStr.toLowerCase();
  const lookup = parsed.productRouteId.toLowerCase();
  const uuidPrefix = parsed.shareSlugUuid?.toLowerCase() ?? null;

  return list.find((item) => {
    const idNorm = String(item.id).trim().toLowerCase();
    const extNorm = item.externalId?.trim().toLowerCase() ?? "";
    const idMatch = idNorm === lookup || idNorm === rawLower;
    const extMatch = Boolean(extNorm && (extNorm === lookup || extNorm === rawLower));
    const altMatch =
      Array.isArray(item.alternateIds) &&
      item.alternateIds.some((alt: unknown) => {
        if (typeof alt !== "string") return false;
        const altNorm = alt.trim().toLowerCase();
        return altNorm === lookup || altNorm === rawLower;
      });
    const uuidMatch = Boolean(
      uuidPrefix &&
        (idNorm.startsWith(uuidPrefix) || extNorm.startsWith(uuidPrefix)),
    );
    return idMatch || extMatch || altMatch || uuidMatch;
  });
}

function isVariantInStock(variant: ProductVariantLike): boolean {
  return Boolean(variant.available) && (variant.quantity ?? 1) > 0;
}

function matchColorForStorage<V extends ProductVariantLike>(
  color: string,
  variants: readonly V[],
  version: string,
  storage: string,
): string {
  if (
    variants.some(
      (v) => v.version === version && v.storage === storage && v.color === color,
    )
  ) {
    return color;
  }
  const availableMatch = variants.find(
    (v) => v.version === version && v.storage === storage && isVariantInStock(v),
  );
  if (availableMatch) return availableMatch.color;
  const fallbackMatch = variants.find(
    (v) => v.version === version && v.storage === storage,
  );
  return fallbackMatch ? fallbackMatch.color : color;
}

/** Calcula versões, capacidades, cores e a variante ativa com base nas seleções do cliente. */
export function deriveVariantSelection<V extends ProductVariantLike>(
  variants: readonly V[],
  selection: {
    version: string;
    storage: string;
    color: string;
    selectedVariantId: string | number | null;
  },
): DerivedVariantState<V> {
  const { version, storage, color, selectedVariantId } = selection;
  const versions = [...new Set(variants.map((v) => v.version))];
  const byVersion = variants.filter((v) => v.version === version);
  const storages = [...new Set(byVersion.map((v) => v.storage))];
  const colors = [...new Set(byVersion.map((v) => v.color))];

  const storageAvailable = (targetStorage: string) =>
    byVersion.some((v) => v.storage === targetStorage && isVariantInStock(v));

  const colorAvailable = (targetColor: string) =>
    byVersion.some((v) => v.color === targetColor && isVariantInStock(v));

  const colorHex = (targetColor: string) =>
    byVersion.find((v) => v.color === targetColor)?.colorHex ?? "#111111";

  const matchedColor = matchColorForStorage(color, variants, version, storage);
  const matchingVariants = byVersion.filter(
    (v) => v.storage === storage && v.color === matchedColor,
  );

  const selected =
    matchingVariants.find((v) => v.id === selectedVariantId) ??
    matchingVariants.find(isVariantInStock) ??
    matchingVariants[0] ??
    byVersion.find((v) => v.storage === storage && v.color === color) ??
    variants[0];

  return {
    versions,
    storages,
    colors,
    storageAvailable,
    colorAvailable,
    colorHex,
    matchingVariants,
    selected,
  };
}

/** Seleciona a primeira variante válida ao alternar de versão (ex.: Anatel / eSIM). */
export function pickNextVersionVariant<V extends ProductVariantLike>(
  variants: readonly V[],
  nextVersion: string,
): { version: string; storage?: string; color?: string; variantId: string | number | null } {
  const inVersion = variants.filter((v) => v.version === nextVersion);
  const chosen = inVersion.find(isVariantInStock) ?? inVersion[0];
  return {
    version: nextVersion,
    storage: chosen?.storage,
    color: chosen?.color,
    variantId: chosen?.id ?? null,
  };
}

/** Resolve próxima variante ao tocar numa capacidade, preservando a cor quando disponível em estoque. */
export function pickNextStorageVariant<V extends ProductVariantLike>(
  variants: readonly V[],
  version: string,
  nextStorage: string,
  currentColor: string,
): VariantPickResult {
  const exactInStock = variants.find(
    (v) =>
      v.version === version &&
      v.storage === nextStorage &&
      v.color === currentColor &&
      isVariantInStock(v),
  );
  if (exactInStock) {
    return {
      storage: nextStorage,
      variantId: exactInStock.id ?? null,
    };
  }

  const firstInStock = variants.find(
    (v) => v.version === version && v.storage === nextStorage && isVariantInStock(v),
  );
  if (firstInStock) {
    return {
      storage: nextStorage,
      color: firstInStock.color,
      variantId: firstInStock.id ?? null,
    };
  }

  const fallbackAny = variants.find(
    (v) => v.version === version && v.storage === nextStorage,
  );
  return {
    storage: nextStorage,
    color: fallbackAny?.color,
    variantId: fallbackAny?.id ?? null,
  };
}

/** Resolve próxima variante ao tocar numa cor, preservando a capacidade quando disponível em estoque. */
export function pickNextColorVariant<V extends ProductVariantLike>(
  variants: readonly V[],
  version: string,
  nextColor: string,
  currentStorage: string,
): VariantPickResult {
  const exactInStock = variants.find(
    (v) =>
      v.version === version &&
      v.storage === currentStorage &&
      v.color === nextColor &&
      isVariantInStock(v),
  );
  if (exactInStock) {
    return {
      storage: currentStorage,
      color: nextColor,
      variantId: exactInStock.id ?? null,
    };
  }

  const firstInStock = variants.find(
    (v) => v.version === version && v.color === nextColor && isVariantInStock(v),
  );
  if (firstInStock) {
    return {
      storage: firstInStock.storage,
      color: nextColor,
      variantId: firstInStock.id ?? null,
    };
  }

  const fallbackAny = variants.find(
    (v) => v.version === version && v.color === nextColor,
  );
  return {
    storage: fallbackAny?.storage ?? currentStorage,
    color: nextColor,
    variantId: fallbackAny?.id ?? null,
  };
}

/** Constrói lista deduplicada de imagens da galeria mantendo a cor/variante ativa na posição 0. */
export function buildProductGalleryImages(
  productName: string,
  productImageUrl: string | null | undefined,
  selectedImageUrl: string | null | undefined,
  selectedColor: string,
  variants: readonly Pick<ProductVariantLike, "color" | "imageUrl">[],
  maxImages = 6,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushUnique = (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    ordered.push(trimmed);
  };

  pushUnique(
    resolveProductImage(productName, selectedImageUrl || productImageUrl, selectedColor),
  );
  if (productImageUrl) {
    pushUnique(resolveProductImage(productName, productImageUrl, selectedColor));
  }
  for (const variant of variants) {
    if (variant.imageUrl || variant.color) {
      pushUnique(
        resolveProductImage(
          productName,
          variant.imageUrl || productImageUrl,
          variant.color,
        ),
      );
    }
    if (ordered.length >= maxImages) break;
  }

  return ordered.slice(0, maxImages);
}

/** Extrai logradouro e número de um endereço completo de loja para o Schema.org. */
export function extractStreetAddress(
  rawAddress: string | undefined,
  fallback: string,
): string {
  const cleaned = rawAddress?.trim();
  if (!cleaned) return fallback;
  const streetPart = cleaned.split(" - ")[0]?.trim();
  return streetPart || fallback;
}

function formatSchemaPhone(rawPhone: string | undefined, fallback: string): string {
  const digits = (rawPhone || "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    return `+55-${digits.slice(2, 4)}-${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length >= 10) {
    return `+55-${digits.slice(0, 2)}-${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return fallback;
}

export type ProductJsonLdInput = {
  productId: string | number;
  cleanTitle: string;
  description: string;
  brand: string;
  sku: string;
  priceCash: number | null;
  imageUrl?: string;
  productUrl?: string;
  isLacrado: boolean;
  isAvailable: boolean;
  unitAvailability?: string | null;
  addressJardim?: string;
  addressGll?: string;
  whatsappJardim?: string;
  whatsappGll?: string;
};

/** Gera JSON-LD Schema.org/Product alinhado ao endereço oficial da unidade em estoque. */
export function buildProductJsonLd(
  input: ProductJsonLdInput,
): Record<string, unknown> | undefined {
  if (input.priceCash == null) return undefined;

  const isGuia = input.unitAvailability === "guia_lopes";
  const unitDefaults = isGuia ? STORE_UNITS.guia_lopes : STORE_UNITS.jardim;
  const streetAddress = extractStreetAddress(
    isGuia ? input.addressGll : input.addressJardim,
    unitDefaults.streetAddress,
  );
  const telephone = formatSchemaPhone(
    isGuia ? input.whatsappGll : input.whatsappJardim,
    unitDefaults.telephone,
  );

  const absoluteImage = input.imageUrl
    ? input.imageUrl.startsWith("/")
      ? `https://lojinhadocelular.com${input.imageUrl}`
      : input.imageUrl
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.cleanTitle,
    image: absoluteImage,
    description: input.description,
    sku: input.sku || String(input.productId),
    brand: {
      "@type": "Brand",
      name:
        input.brand ||
        (input.cleanTitle.toLowerCase().includes("iphone") ? "Apple" : "Smartphone"),
    },
    offers: {
      "@type": "Offer",
      url: input.productUrl || `https://lojinhadocelular.com/produto/${input.productId}`,
      priceCurrency: "BRL",
      price: (input.priceCash / 100).toFixed(2),
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      itemCondition: input.isLacrado
        ? "https://schema.org/NewCondition"
        : "https://schema.org/UsedCondition",
      availability: input.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "LocalBusiness",
        name: "Lojinha do Celular",
        telephone,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          streetAddress,
          addressLocality: unitDefaults.locality,
          addressRegion: "MS",
          postalCode: unitDefaults.postalCode,
          addressCountry: "BR",
        },
      },
    },
  };
}

function getMinAvailableCashPrice(
  variants: readonly Pick<ProductVariantLike, "available" | "quantity" | "priceCash">[],
): number | null {
  const prices = variants
    .filter((v) => v.available && (v.quantity ?? 1) > 0)
    .map((v) => v.priceCash);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

type RelatedProductCandidate = {
  id: string | number;
  brand: string;
  category: string;
  variants: readonly Pick<ProductVariantLike, "available" | "quantity" | "priceCash">[];
};

/** Seleciona até N aparelhos relacionados em estoque priorizando categoria, marca e faixa de preço. */
export function selectRelatedProducts<T extends RelatedProductCandidate>(
  allProducts: readonly T[] | undefined,
  currentProduct: RelatedProductCandidate,
  limit = 4,
): T[] {
  if (!Array.isArray(allProducts) || allProducts.length === 0 || limit <= 0) {
    return [];
  }

  const currentId = String(currentProduct.id);
  const currentMinPrice = getMinAvailableCashPrice(currentProduct.variants);
  const currentBrand = currentProduct.brand.toLowerCase();

  return allProducts
    .map((candidate, index) => {
      const candidatePrice = getMinAvailableCashPrice(candidate.variants);
      return { candidate, candidatePrice, index };
    })
    .filter(
      (entry): entry is { candidate: T; candidatePrice: number; index: number } =>
        String(entry.candidate.id) !== currentId && entry.candidatePrice != null,
    )
    .sort((a, b) => {
      const aSameCategory = a.candidate.category === currentProduct.category ? 0 : 1;
      const bSameCategory = b.candidate.category === currentProduct.category ? 0 : 1;
      if (aSameCategory !== bSameCategory) return aSameCategory - bSameCategory;

      const aSameBrand = a.candidate.brand.toLowerCase() === currentBrand ? 0 : 1;
      const bSameBrand = b.candidate.brand.toLowerCase() === currentBrand ? 0 : 1;
      if (aSameBrand !== bSameBrand) return aSameBrand - bSameBrand;

      if (currentMinPrice != null) {
        const aDiff = Math.abs(a.candidatePrice - currentMinPrice);
        const bDiff = Math.abs(b.candidatePrice - currentMinPrice);
        if (aDiff !== bDiff) return aDiff - bDiff;
      }

      return a.index - b.index;
    })
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
