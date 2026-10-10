/**
 * Visão da integração com o ERP no painel: saúde da sincronização,
 * divergências do catálogo e estoque por unidade (`admin.erpOverview`).
 */
import { z } from "zod";
import { env } from "./lib/env";
import { adminProcedure } from "./middleware";
import { assertCan } from "./permissions";
import { computeCatalogIssues, type CatalogIssueProduct } from "@contracts/catalogIssues";
import { getErpStatus, loadAdminProducts } from "./services/adminCatalog";
import { getErpServiceStatus, resolveErpUnitId } from "./erp/client";
import { listCatalogChanges } from "./services/catalogHistory";
import { listProductInterest } from "./services/productInterest";

export interface StockVariantInput {
  priceCash?: number | null;
  available: boolean;
  quantity?: number | null;
  imageUrl?: string | null;
  batteryHealth?: string | null;
  stockJardim?: number | null;
  stockGuiaLopes?: number | null;
}

export interface StockProductInput {
  id: string | number;
  name: string;
  category: string;
  condition: string;
  active: boolean;
  imageUrl?: string | null;
  batteryHealth?: string | null;
  stockJardim?: number | null;
  stockGuiaLopes?: number | null;
  variants: StockVariantInput[];
}

export interface IssueRef {
  id: string;
  name: string;
}

export interface StockRow {
  id: string;
  name: string;
  jardim: number;
  gll: number;
}

export interface ErpOverviewResult {
  issues: {
    noPhoto: IssueRef[];
    noBattery: IssueRef[];
    soldOutVisible: IssueRef[];
    noPrice: IssueRef[];
    hiddenWithStock: IssueRef[];
  };
  stock: {
    lowThreshold: number;
    totals: { jardim: number; gll: number; products: number; visible: number };
    /** Zerado numa loja mas com estoque na outra. */
    soldOutJardim: StockRow[];
    soldOutGll: StockRow[];
    /** Estoque entre 1 e o limite, por loja. */
    lowJardim: StockRow[];
    lowGll: StockRow[];
  };
}

export const LOW_STOCK_THRESHOLD = 2;

function num(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Soma o estoque por loja: usa as variantes quando elas informam a loja, senão o produto. */
export function productStock(product: StockProductInput): { jardim: number; gll: number } {
  const variants = product.variants ?? [];
  const fromVariants = variants.reduce(
    (acc, v) => ({ jardim: acc.jardim + num(v.stockJardim), gll: acc.gll + num(v.stockGuiaLopes) }),
    { jardim: 0, gll: 0 },
  );
  if (fromVariants.jardim + fromVariants.gll > 0) return fromVariants;
  return { jardim: num(product.stockJardim), gll: num(product.stockGuiaLopes) };
}

export function computeErpOverview(
  products: StockProductInput[],
  lowThreshold = LOW_STOCK_THRESHOLD,
): ErpOverviewResult {
  const base = computeCatalogIssues(products as unknown as CatalogIssueProduct[]);
  const noPrice: IssueRef[] = [];
  const hiddenWithStock: IssueRef[] = [];

  const soldOutJardim: StockRow[] = [];
  const soldOutGll: StockRow[] = [];
  const lowJardim: StockRow[] = [];
  const lowGll: StockRow[] = [];
  const totals = { jardim: 0, gll: 0, products: products.length, visible: 0 };

  for (const p of products) {
    const ref = { id: String(p.id), name: p.name };
    const variants = p.variants ?? [];
    const stock = productStock(p);
    const row: StockRow = { ...ref, jardim: stock.jardim, gll: stock.gll };

    if (p.active) {
      totals.visible += 1;
      if (variants.some((v) => v.available && num(v.priceCash) <= 0)) noPrice.push(ref);
    } else if (stock.jardim + stock.gll > 0) {
      hiddenWithStock.push(ref);
    }

    totals.jardim += stock.jardim;
    totals.gll += stock.gll;

    if (stock.jardim === 0 && stock.gll > 0) soldOutJardim.push(row);
    if (stock.gll === 0 && stock.jardim > 0) soldOutGll.push(row);
    if (stock.jardim > 0 && stock.jardim <= lowThreshold) lowJardim.push(row);
    if (stock.gll > 0 && stock.gll <= lowThreshold) lowGll.push(row);
  }

  const byName = (a: StockRow, b: StockRow) => a.name.localeCompare(b.name, "pt-BR");
  return {
    issues: {
      noPhoto: base.noPhoto,
      noBattery: base.noBattery,
      soldOutVisible: base.soldOutVisible,
      noPrice,
      hiddenWithStock,
    },
    stock: {
      lowThreshold,
      totals,
      soldOutJardim: soldOutJardim.sort(byName),
      soldOutGll: soldOutGll.sort(byName),
      lowJardim: lowJardim.sort((a, b) => a.jardim - b.jardim || byName(a, b)),
      lowGll: lowGll.sort((a, b) => a.gll - b.gll || byName(a, b)),
    },
  };
}

export interface InterestOverview {
  wanted: { productId: string; name: string; clicks: number; jardim: number; gll: number }[];
  /** Visíveis e com estoque, mas sem nenhum clique no período. */
  stale: { productId: string; name: string; jardim: number; gll: number }[];
}

/** Cruza cliques com estoque (função pura). */
export function computeInterestOverview(
  interest: { productId: string; productName: string; clicks: number }[],
  products: StockProductInput[],
  limit = 10,
): InterestOverview {
  const byId = new Map<string, StockProductInput>();
  for (const p of products) {
    byId.set(String(p.id), p);
    const external = (p as { externalId?: string | null }).externalId;
    if (external) byId.set(String(external), p);
  }
  const clicked = new Set(interest.map((i) => i.productId));
  const wanted = interest.slice(0, limit).map((i) => {
    const p = byId.get(i.productId);
    const stock = p ? productStock(p) : { jardim: 0, gll: 0 };
    return { productId: i.productId, name: p?.name ?? i.productName, clicks: i.clicks, ...stock };
  });
  const stale = products
    .filter((p) => {
      if (!p.active) return false;
      const external = (p as { externalId?: string | null }).externalId;
      if (clicked.has(String(p.id)) || (external && clicked.has(String(external)))) return false;
      const s = productStock(p);
      return s.jardim + s.gll > 0;
    })
    .slice(0, limit)
    .map((p) => ({ productId: String((p as { externalId?: string | null }).externalId || p.id), name: p.name, ...productStock(p) }));
  return { wanted, stale };
}

export const erpOverviewProcedures = {
  /** Testa o usuário de serviço do ERP e se as unidades foram encontradas (não cria nada). */
  erpServiceStatus: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "settings.manage");
    const status = await getErpServiceStatus();
    const [jardim, gll] = await Promise.all([resolveErpUnitId("jardim").catch(() => null), resolveErpUnitId("gll").catch(() => null)]);
    return { ...status, units: { jardim: Boolean(jardim), gll: Boolean(gll) } };
  }),

  /** Produtos mais procurados (cliques no WhatsApp) cruzados com o estoque. */
  productInterest: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "products.editMedia");
      const days = input?.days ?? 30;
      const [interest, products] = await Promise.all([listProductInterest(days), loadAdminProducts()]);
      return { days, ...computeInterestOverview(interest, products as unknown as StockProductInput[]) };
    }),

  /** Mudanças recentes de preço e estoque (últimos 90 dias). */
  catalogHistory: adminProcedure
    .input(z.object({ productId: z.string().max(80).optional(), limit: z.number().int().min(1).max(200).optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "products.editMedia");
      return listCatalogChanges({ productId: input?.productId, limit: input?.limit ?? 50 });
    }),

  erpOverview: adminProcedure.input(z.object({}).optional()).query(async ({ ctx }) => {
    assertCan(ctx.user, "products.editMedia");
    const [status, products] = await Promise.all([getErpStatus(), loadAdminProducts()]);
    const overview = computeErpOverview(products as unknown as StockProductInput[]);
    return {
      ...overview,
      status,
      config: {
        enabled: env.erpCatalogEnabled,
        storeSlug: env.erpStoreSlug,
        categorySlug: env.erpCategorySlug,
        host: (() => {
          try {
            return new URL(env.erpApiUrl).host;
          } catch {
            return env.erpApiUrl;
          }
        })(),
      },
    };
  }),
};
