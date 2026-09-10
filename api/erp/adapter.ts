import type { CategoryValue } from "../../contracts/types";
import type { ErpRawProduct, ShopProduct, ShopVariant } from "./types";
import { resolveProductImage, detectColorHex } from "../../src/lib/iphoneCatalog";

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

export function inferBrandAndCategory(
  nameOrOptions: string | { name: string; brand?: string; condition?: string },
  rawBrand?: string,
  condition = "seminovo",
): { brand: string; category: CategoryValue; condition: string } {
  let name = "";
  let bInput = rawBrand;
  let condInput = condition;

  if (typeof nameOrOptions === "object" && nameOrOptions !== null) {
    name = nameOrOptions.name || "";
    bInput = nameOrOptions.brand || bInput;
    condInput = nameOrOptions.condition || condInput;
  } else {
    name = String(nameOrOptions || "");
  }

  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const b = (bInput || "").toLowerCase().trim();

  let brand = "Apple";
  if (b.includes("apple") || n.includes("iphone") || n.includes("ipad") || n.includes("apple watch")) {
    brand = "Apple";
  } else if (b.includes("xiaomi") || n.includes("xiaomi") || n.includes("redmi") || n.includes("poco")) {
    brand = "Xiaomi";
  } else if (b.includes("realme") || n.includes("realme")) {
    brand = "Realme";
  } else if (b.includes("samsung") || n.includes("samsung") || n.includes("galaxy")) {
    brand = "Samsung";
  } else if (b.includes("motorola") || n.includes("motorola") || n.includes("moto")) {
    brand = "Motorola";
  } else if (bInput) {
    brand = bInput.trim();
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

  let category: CategoryValue = "iphone_seminovo";
  if (brand === "Apple" || n.includes("iphone")) {
    category = isLacrado ? "iphone_lacrado" : "iphone_seminovo";
  } else if (
    n.includes("capa") ||
    n.includes("pelicula") ||
    n.includes("fone") ||
    n.includes("carregador") ||
    n.includes("cabo")
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

export function adaptErpProduct(raw: ErpRawProduct): ShopProduct | null {
  if (!raw || !raw.id) return null;

  const rawVariants = raw.variants || raw.variacoes || [];

  let stock = parseStockQuantity(
    raw.stock ?? raw.quantity ?? raw.estoque ?? raw.quantidade ?? raw.qtd ?? raw.saldo ?? 0,
  );

  // Se o estoque direto for 0 ou indefinido, calcula a soma das variantes
  if (stock <= 0 && rawVariants.length > 0) {
    stock = rawVariants.reduce((acc, v) => {
      return acc + parseStockQuantity(v.stock ?? v.quantity ?? 0);
    }, 0);
  }

  // Requisito 3: "Exibir somente produtos com estoque disponível. Quando o ERP informar estoque zero, remover o produto da vitrine."
  if (stock <= 0) {
    return null;
  }

  const name = (raw.name || raw.nome || raw.model || raw.modelo || raw.title || "Celular").trim();
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
    raw.capacity ||
    raw.capacidade ||
    raw.armazenamento ||
    extractStorageFromName(name)
  ).trim();
  const color = (raw.color || raw.cor || extractColorFromName(name)).trim();
  const colorHex = raw.color_hex || detectColorHex(color) || "#111111";

  const batteryHealth = parseBatteryHealth(
    raw.battery_health ?? raw.battery ?? raw.saude_bateria ?? raw.bateria,
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
  const imageUrl = resolveProductImage(name, rawImg || null, color);

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
    featured: false,
    active: true,
    createdAt: new Date(),
    variants: mappedVariants,
  };
}

export function adaptErpCatalog(items: unknown): ShopProduct[] {
  if (!items) return [];

  let rawList: ErpRawProduct[] = [];
  if (Array.isArray(items)) {
    rawList = items;
  } else if (typeof items === "object" && items !== null) {
    const obj = items as Record<string, unknown>;
    if (Array.isArray(obj.data)) rawList = obj.data as ErpRawProduct[];
    else if (Array.isArray(obj.products)) rawList = obj.products as ErpRawProduct[];
    else if (Array.isArray(obj.items)) rawList = obj.items as ErpRawProduct[];
  }

  const result: ShopProduct[] = [];
  for (const item of rawList) {
    const adapted = adaptErpProduct(item);
    if (adapted) {
      result.push(adapted);
    }
  }

  return result;
}

export const adaptErpCatalogResponse = adaptErpCatalog;
