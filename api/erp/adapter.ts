import type { CategoryValue } from "../../contracts/types";
import type { ErpRawProduct, ShopProduct, ShopVariant, StoreUnitAvailability } from "./types";
import { resolveProductImage, detectColorHex } from "../../src/lib/iphoneCatalog";
import { formatCommercialProductName } from "../../src/lib/commercialFormatting";
import { env, ERP_KNOWN_UNITS } from "../lib/env";

export function extractBrandString(brandInput: unknown): string {
  if (!brandInput) return "";
  if (typeof brandInput === "string") return brandInput.trim();
  if (typeof brandInput === "object" && brandInput !== null) {
    const obj = brandInput as Record<string, any>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.nome === "string") return obj.nome.trim();
  }
  return "";
}

export function parsePriceToCents(rawPrice: unknown): number {
  if (rawPrice == null) return 0;
  if (typeof rawPrice === "number") {
    if (isNaN(rawPrice) || rawPrice <= 0) return 0;
    if (!Number.isInteger(rawPrice)) {
      return Math.round(rawPrice * 100);
    }
    // Celulares normalmente custam entre R$ 500 e R$ 15.000 (ex: 5690 ou 569000)
    if (rawPrice >= 100000) {
      return rawPrice;
    }
    return rawPrice * 100;
  }
  if (typeof rawPrice === "string") {
    const s = rawPrice.trim();
    if (!s) return 0;
    if (s.includes(",")) {
      const clean = s.replace(/[^\d,]/g, "").replace(",", ".");
      const num = parseFloat(clean);
      return Math.round((isNaN(num) ? 0 : num) * 100);
    }
    if (s.includes(".")) {
      const num = parseFloat(s.replace(/[^\d.]/g, ""));
      return Math.round((isNaN(num) ? 0 : num) * 100);
    }
    const digitsOnly = s.replace(/\D/g, "");
    if (!digitsOnly) return 0;
    const num = parseInt(digitsOnly, 10);
    if (num >= 100000) return num;
    return num * 100;
  }
  return 0;
}

export function parseStockQuantity(rawStock: unknown): number {
  if (rawStock == null) return 0;
  if (typeof rawStock === "number") {
    return isNaN(rawStock) || rawStock < 0 ? 0 : Math.floor(rawStock);
  }
  if (typeof rawStock === "string") {
    const parsed = parseInt(rawStock.replace(/\D/g, ""), 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }
  return 0;
}

export function parseBatteryHealth(val: unknown, condition = "seminovo"): string | null {
  if (val == null) {
    return condition === "lacrado" ? "100%" : null;
  }
  const s = String(val).trim();
  if (!s || s === "0") {
    return condition === "lacrado" ? "100%" : null;
  }
  const match = s.match(/(\d{1,3})%/);
  if (match) {
    return `${match[1]}%`;
  }
  const num = parseInt(s.replace(/\D/g, ""), 10);
  if (!isNaN(num) && num > 0 && num <= 100) {
    return `${num}%`;
  }
  return condition === "lacrado" ? "100%" : null;
}

export function extractBatteryFromName(name: string): string | null {
  if (!name) return null;
  const matchExplicit = name.match(/(?:bateria|saude|saúde|bat\.?)\s*[:=]?\s*(\d{2,3})%?/i);
  if (matchExplicit) {
    const n = parseInt(matchExplicit[1], 10);
    if (n >= 50 && n <= 100) return `${n}%`;
  }
  const matchSuffix = name.match(/\b(100|[5-9]\d)%\s*(?:bateria|saude|saúde|bat\.?)/i);
  if (matchSuffix) {
    return `${matchSuffix[1]}%`;
  }
  return null;
}

export function inferBrandAndCategory(
  nameOrOptions: string | { name: string; brand?: any; condition?: string },
  rawBrand?: any,
  condition = "seminovo",
): { brand: string; category: CategoryValue; condition: string } {
  let name = "";
  let bInput = extractBrandString(rawBrand);
  let condInput = condition;

  if (typeof nameOrOptions === "object" && nameOrOptions !== null) {
    name = nameOrOptions.name || "";
    bInput = extractBrandString(nameOrOptions.brand) || bInput;
    condInput = nameOrOptions.condition || condInput;
  } else {
    name = String(nameOrOptions || "");
  }

  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const b = bInput.toLowerCase().trim();

  let brand = "Outra";
  if (b.includes("tecno") || n.includes("tecno")) {
    brand = "Tecno";
  } else if (b.includes("xiaomi") || n.includes("xiaomi") || n.includes("redmi") || n.includes("poco")) {
    brand = "Xiaomi";
  } else if (b.includes("samsung") || n.includes("samsung") || n.includes("galaxy")) {
    brand = "Samsung";
  } else if (b.includes("motorola") || n.includes("motorola") || n.includes("moto")) {
    brand = "Motorola";
  } else if (b.includes("realme") || n.includes("realme")) {
    brand = "Realme";
  } else if (b.includes("infinix") || n.includes("infinix")) {
    brand = "Infinix";
  } else if (
    b.includes("apple") ||
    n.includes("iphone") ||
    n.includes("ipad") ||
    n.includes("apple watch") ||
    /\b(11|12|13|14|15|16)\s*(pro\s*max|pro|plus|mini|e)?\b/i.test(n) ||
    /\b(xr|xs\s*max|xs)\b/i.test(n) ||
    n.includes("pro max") ||
    n.includes("titanio") ||
    n.includes("titanium")
  ) {
    brand = "Apple";
  } else if (bInput) {
    brand = bInput.charAt(0).toUpperCase() + bInput.slice(1);
  } else {
    brand = "Outra";
  }

  const condNormalized = condInput.toLowerCase().trim();
  const isSeminovo =
    condNormalized.includes("seminov") ||
    condNormalized.includes("semi-nov") ||
    condNormalized.includes("usado") ||
    condNormalized.includes("used");

  const isLacrado =
    !isSeminovo &&
    (condNormalized.includes("lacrad") ||
      condNormalized === "novo" ||
      condNormalized.startsWith("novo ") ||
      condNormalized.includes(" sealed") ||
      condNormalized.startsWith("sealed") ||
      condNormalized === "new");

  const finalCondition = isLacrado ? "lacrado" : "seminovo";

  let category: CategoryValue = "android";
  if (brand === "Apple" || n.includes("iphone")) {
    category = isLacrado ? "iphone_lacrado" : "iphone_seminovo";
  } else if (
    n.includes("capa") ||
    n.includes("pelicula") ||
    n.includes("fone") ||
    n.includes("carregador") ||
    n.includes("cabo") ||
    n.includes("suporte")
  ) {
    category = "acessorio";
  } else {
    category = "android";
  }

  return { brand, category, condition: finalCondition };
}

export function extractStorageFromName(name: string): string {
  const match = name.match(/\b(16|32|64|128|256|512)\s*gb\b|\b(1|2)\s*tb\b/i);
  if (match) {
    return match[0].replace(/\s+/g, "").toUpperCase();
  }
  return "128GB";
}

export function extractColorFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("titanio deserto") || n.includes("desert titanium") || n.includes("deserto")) return "Titânio Deserto";
  if (n.includes("titanio natural") || n.includes("natural titanium")) return "Titânio Natural";
  if (n.includes("titanio preto") || n.includes("black titanium")) return "Titânio Preto";
  if (n.includes("titanio branco") || n.includes("white titanium")) return "Titânio Branco";
  if (n.includes("titanio azul") || n.includes("blue titanium")) return "Titânio Azul";
  if (n.includes("estelar") || n.includes("starlight")) return "Estelar";
  if (n.includes("meia-noite") || n.includes("meia noite") || n.includes("midnight")) return "Meia-noite";
  if (n.includes("dourado") || n.includes("gold")) return "Dourado";
  if (n.includes("prateado") || n.includes("silver") || n.includes("prata")) return "Prateado";
  if (n.includes("grafite") || n.includes("graphite")) return "Grafite";
  if (n.includes("cinza espacial") || n.includes("space gray")) return "Cinza Espacial";
  if (n.includes("preto espacial") || n.includes("space black")) return "Preto Espacial";
  if (n.includes("azul") || n.includes("blue")) return "Azul";
  if (n.includes("rosa") || n.includes("pink")) return "Rosa";
  if (n.includes("verde") || n.includes("green")) return "Verde";
  if (n.includes("roxo") || n.includes("purple")) return "Roxo";
  if (n.includes("amarelo") || n.includes("yellow")) return "Amarelo";
  if (n.includes("preto") || n.includes("black")) return "Preto";
  if (n.includes("branco") || n.includes("white")) return "Branco";
  if (n.includes("vermelho") || n.includes("red")) return "Vermelho";
  return "Preto";
}

export function adaptErpProduct(raw: ErpRawProduct, unitFilter = env.erpUnitId): ShopProduct | null {
  if (!raw || !raw.id) return null;

  const rawVariants = raw.variants || raw.variacoes || [];

  let stockJardim = 0;
  let stockGuiaLopes = 0;
  let stock = 0;

  // Se houver array de estoques por unidade (Matriz Jardim e Filial Guia Lopes)
  if (Array.isArray(raw.stocks) && raw.stocks.length > 0) {
    const sMatriz = raw.stocks.find(
      (s: any) =>
        s.unit_id?.toLowerCase() === ERP_KNOWN_UNITS.MATRIZ.toLowerCase() ||
        s.unit?.nome?.toLowerCase().includes("matriz") ||
        s.unit?.nome?.toLowerCase().includes("jardim"),
    );
    const sGuia = raw.stocks.find(
      (s: any) =>
        s.unit_id?.toLowerCase() === ERP_KNOWN_UNITS.GUIA_LOPES.toLowerCase() ||
        s.unit?.nome?.toLowerCase().includes("guia"),
    );
    stockJardim = parseStockQuantity(sMatriz?.available ?? sMatriz?.quantity ?? sMatriz?.stock ?? 0);
    stockGuiaLopes = parseStockQuantity(sGuia?.available ?? sGuia?.quantity ?? sGuia?.stock ?? 0);

    if (unitFilter && (unitFilter.toLowerCase() === ERP_KNOWN_UNITS.MATRIZ.toLowerCase() || unitFilter.toLowerCase() === "matriz" || unitFilter.toLowerCase() === "jardim")) {
      stock = stockJardim;
    } else if (unitFilter && (unitFilter.toLowerCase() === ERP_KNOWN_UNITS.GUIA_LOPES.toLowerCase() || unitFilter.toLowerCase() === "guia_lopes" || unitFilter.toLowerCase() === "guialopes")) {
      stock = stockGuiaLopes;
    } else {
      stock = stockJardim > 0 ? stockJardim : stockGuiaLopes;
    }
  } else {
    stock = parseStockQuantity(
      raw.stock ?? raw.quantity ?? raw.estoque ?? raw.quantidade ?? raw.qtd ?? raw.saldo ?? 0,
    );
    stockJardim = stock;
  }

  // Se o estoque direto for 0 ou indefinido, calcula a soma das variantes
  if (stock <= 0 && rawVariants.length > 0) {
    stock = rawVariants.reduce((acc, v) => {
      return acc + parseStockQuantity(v.stock ?? v.quantity ?? 0);
    }, 0);
    if (stockJardim === 0 && stockGuiaLopes === 0) {
      stockJardim = stock;
    }
  }

  // Requisito 3: "Exibir somente produtos com estoque disponível. Quando o ERP informar estoque zero, remover o produto da vitrine."
  if (stock <= 0) {
    return null;
  }

  let unitAvailability: StoreUnitAvailability = "indisponivel";
  if (stockJardim > 0) {
    unitAvailability = "jardim";
  } else if (stockGuiaLopes > 0) {
    unitAvailability = "guia_lopes";
  }

  const name = (raw.name || raw.nome || raw.model || raw.modelo || raw.title || "Celular").trim();

  // Filtra modelos fictícios / de teste cadastrados no ERP (ex: iPhone 17 que ainda não existe no mercado)
  const isUnreleasedModel = /\biphone\s*(1[7-9]|[2-9]\d)\b/i.test(name);
  if (isUnreleasedModel) {
    return null;
  }

  // Filtra peças de reposição da assistência técnica (como frontais, telas avulsas, conectores)
  const lowerName = name.toLowerCase();
  const isSparePart =
    lowerName.includes("frontal ") ||
    lowerName.startsWith("frontal") ||
    lowerName.includes("modulo frontal") ||
    lowerName.includes("touch screen") ||
    lowerName.includes("conector de carga") ||
    lowerName.includes("flex de carga");

  if (isSparePart) {
    return null;
  }

  const rawCondition = String(raw.condition || raw.condicao || raw.state || "").trim();

  const { brand, category, condition } = inferBrandAndCategory(name, raw.brand || raw.marca, rawCondition);

  let priceCash = parsePriceToCents(
    raw.price_cash ??
      raw.sale_price ??
      raw.price ??
      raw.preco_venda ??
      raw.preco ??
      raw.valor_venda ??
      raw.valor,
  );

  if (priceCash <= 0 && rawVariants.length > 0) {
    const firstPricedVariant = rawVariants.find(
      (v) => parsePriceToCents(v.price_cash ?? v.sale_price ?? v.price) > 0,
    );
    if (firstPricedVariant) {
      priceCash = parsePriceToCents(
        firstPricedVariant.price_cash ?? firstPricedVariant.sale_price ?? firstPricedVariant.price,
      );
    }
  }

  if (priceCash <= 0) {
    return null;
  }

  const storage = (
    raw.storage ||
    raw.storage_capacity ||
    raw.capacity ||
    raw.capacidade ||
    raw.armazenamento ||
    extractStorageFromName(name)
  ).trim();
  const color = (raw.color || raw.cor || extractColorFromName(name)).trim();
  const colorHex = raw.color_hex || detectColorHex(color) || "#111111";

  const batteryHealth = parseBatteryHealth(
    raw.battery_health ??
      raw.battery ??
      raw.saude_bateria ??
      raw.bateria ??
      raw.observacoes ??
      raw.notes ??
      raw.description ??
      extractBatteryFromName(name),
    condition,
  );

  const rawImg =
    raw.image_url ||
    raw.image ||
    raw.foto_url ||
    raw.foto ||
    raw.images?.[0] ||
    raw.fotos?.[0] ||
    raw.thumbnail ||
    "";
  const formattedProductName = formatCommercialProductName(name, color, storage);
  const imageUrl = resolveProductImage(formattedProductName, rawImg || null, color);

  const grade = raw.grade || raw.classificacao || "";
  const notesParts: string[] = [];
  if (grade) notesParts.push(`Grade ${grade}`);
  if (raw.notes || raw.observacoes) notesParts.push(String(raw.notes || raw.observacoes));
  const notes = notesParts.join(" · ") || null;

  const sku =
    raw.sku ||
    raw.code ||
    raw.codigo ||
    raw.serial ||
    raw.imei ||
    `ERP-${String(raw.id).slice(0, 8).toUpperCase()}`;

  const warranty =
    raw.warranty ||
    raw.garantia ||
    (condition === "lacrado" ? "1 ano de garantia" : "6 meses de garantia");

  const description = raw.description || raw.descricao || null;
  const videoUrl = raw.video_url || raw.video || null;

  // Requisito 6: "Como os IDs do ERP são UUID e o site usa IDs numéricos, criar um adaptador de produto remoto. Não converter UUID para número. O produto remoto deve usar uma identificação segura, como: source: erp, externalId: produto.id"
  const externalId = String(raw.id);
  const productId = externalId;

  const mainVariant: ShopVariant = {
    id: `${externalId}-1`,
    productId,
    version: "",
    storage,
    color,
    colorHex,
    imageUrl,
    videoUrl,
    sku,
    batteryHealth,
    warranty,
    condition,
    notes,
    priceCash,
    quantity: stock,
    available: true,
    stockJardim,
    stockGuiaLopes,
    unitAvailability,
  };

  let mappedVariants: ShopVariant[] = [];
  if (rawVariants.length > 0) {
    mappedVariants = rawVariants
      .filter((v) => parseStockQuantity(v.stock ?? v.quantity ?? 0) > 0)
      .map((v, idx) => {
        const vStock = parseStockQuantity(v.stock ?? v.quantity ?? 0);
        const vPrice = parsePriceToCents(
          v.price_cash ?? v.sale_price ?? v.price ?? priceCash,
        );
        const vStorage = (v.storage ?? v.capacity ?? storage).trim();
        const vColor = (v.color ?? v.cor ?? color).trim();
        const vColorHex = v.color_hex ?? (detectColorHex(vColor) || colorHex);
        const vBattery = parseBatteryHealth(v.battery_health, condition) || batteryHealth;
        const vSku = v.sku ?? v.code ?? `${sku}-${idx + 1}`;
        const vImg = v.image_url ?? v.image ?? imageUrl;
        const vWarranty = v.warranty ?? warranty;
        const vCondition = v.condition ?? condition;
        const vNotes = v.notes ? `${notes ? `${notes} · ` : ""}${v.notes}` : notes;

        return {
          id: v.id ? String(v.id) : `${externalId}-${idx + 1}`,
          productId,
          version: "",
          storage: vStorage,
          color: vColor,
          colorHex: vColorHex,
          imageUrl: vImg,
          videoUrl,
          sku: vSku,
          batteryHealth: vBattery,
          warranty: vWarranty,
          condition: vCondition,
          notes: vNotes,
          priceCash: vPrice > 0 ? vPrice : priceCash,
          quantity: vStock,
          available: true,
          stockJardim,
          stockGuiaLopes,
          unitAvailability,
        };
      });
  }

  if (mappedVariants.length === 0) {
    mappedVariants = [mainVariant];
  }

  return {
    id: productId,
    source: "erp",
    externalId,
    name,
    brand,
    category,
    condition,
    description,
    imageUrl,
    videoUrl,
    warranty,
    batteryHealth,
    featured: false,
    active: true,
    createdAt: new Date(),
    variants: mappedVariants,
    stockJardim,
    stockGuiaLopes,
    unitAvailability,
  };
}

export function adaptErpCatalog(items: unknown, unitFilter = env.erpUnitId): ShopProduct[] {
  if (!items) return [];

  let rawList: ErpRawProduct[] = [];
  if (Array.isArray(items)) {
    rawList = items;
  } else if (typeof items === "object" && items !== null) {
    const obj = items as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      rawList = obj.data as ErpRawProduct[];
    } else if (
      obj.data &&
      typeof obj.data === "object" &&
      Array.isArray((obj.data as Record<string, unknown>).products)
    ) {
      rawList = (obj.data as Record<string, unknown>).products as ErpRawProduct[];
    } else if (Array.isArray(obj.products)) {
      rawList = obj.products as ErpRawProduct[];
    } else if (Array.isArray(obj.items)) {
      rawList = obj.items as ErpRawProduct[];
    }
  }

  // Agrupa e mescla produtos idênticos cadastrados separadamente no ERP por IMEI/lote
  const mergedMap = new Map<string, ShopProduct>();

  for (const item of rawList) {
    const adapted = adaptErpProduct(item, unitFilter);
    if (!adapted) continue;

    const mainV = adapted.variants[0];
    const storageKey = (mainV?.storage || "").toLowerCase().trim();
    const colorKey = (mainV?.color || "").toLowerCase().trim();
    const priceKey = mainV?.priceCash || 0;
    const key = `${adapted.name.toLowerCase().trim()}__${adapted.condition}__${storageKey}__${colorKey}__${priceKey}`;

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      existing.alternateIds = existing.alternateIds || [];
      existing.alternateIds.push(String(adapted.id), adapted.externalId);

      const existingV = existing.variants[0];
      if (existingV && mainV) {
        existingV.quantity += mainV.quantity;
        existingV.stockJardim = (existingV.stockJardim || 0) + (mainV.stockJardim || 0);
        existingV.stockGuiaLopes = (existingV.stockGuiaLopes || 0) + (mainV.stockGuiaLopes || 0);
        if (existingV.stockJardim > 0) {
          existingV.unitAvailability = "jardim";
        } else if (existingV.stockGuiaLopes > 0) {
          existingV.unitAvailability = "guia_lopes";
        }
      }

      existing.stockJardim = (existing.stockJardim || 0) + (adapted.stockJardim || 0);
      existing.stockGuiaLopes = (existing.stockGuiaLopes || 0) + (adapted.stockGuiaLopes || 0);
      if (existing.stockJardim > 0) {
        existing.unitAvailability = "jardim";
      } else if (existing.stockGuiaLopes > 0) {
        existing.unitAvailability = "guia_lopes";
      }
    } else {
      mergedMap.set(key, adapted);
    }
  }

  return Array.from(mergedMap.values());
}

export const adaptErpCatalogResponse = adaptErpCatalog;
