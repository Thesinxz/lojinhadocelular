/**
 * Histórico de preço e estoque do catálogo do ERP.
 * A cada sincronização compara com o último estado conhecido e grava só as mudanças
 * (retenção de 90 dias). Em memória durante os testes ou sem DATABASE_URL.
 * Nunca lança erro: histórico não pode atrapalhar a sincronização.
 */
import { desc, eq, lt } from "drizzle-orm";
import { catalogChanges, catalogState } from "@db/schema";
import { ensureTables, getDb } from "../queries/connection";

export type CatalogChangeKind = "price" | "stock_jardim" | "stock_gll" | "new" | "removed";

export interface CatalogChange {
  id: number;
  productId: string;
  productName: string;
  kind: CatalogChangeKind;
  oldValue: number | null;
  newValue: number | null;
  createdAt: Date;
}

export interface CatalogSnapshotProduct {
  externalId?: string | null;
  id: string | number;
  name: string;
  stockJardim?: number | null;
  stockGuiaLopes?: number | null;
  variants: { priceCash?: number | null; available?: boolean }[];
}

interface ProductState {
  name: string;
  price: number | null;
  stockJardim: number;
  stockGll: number;
}

export const CATALOG_HISTORY_RETENTION_DAYS = 90;
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

let memoryState = new Map<string, ProductState>();
let memoryChanges: CatalogChange[] = [];
let memoryNextId = 1;
let loadedState: Map<string, ProductState> | null = null;
let lastPrunedAt = 0;

export function resetCatalogHistoryForTesting(): void {
  memoryState = new Map();
  memoryChanges = [];
  memoryNextId = 1;
  loadedState = null;
  lastPrunedAt = 0;
}

function stateOf(product: CatalogSnapshotProduct): ProductState {
  const prices = product.variants
    .filter((v) => v.available !== false)
    .map((v) => Number(v.priceCash))
    .filter((n) => Number.isFinite(n) && n > 0);
  return {
    name: product.name,
    price: prices.length ? Math.min(...prices) : null,
    stockJardim: Math.max(0, Math.trunc(Number(product.stockJardim) || 0)),
    stockGll: Math.max(0, Math.trunc(Number(product.stockGuiaLopes) || 0)),
  };
}

type Draft = Omit<CatalogChange, "id" | "createdAt">;

/** Compara o catálogo atual com o último estado e devolve as mudanças (função pura). */
export function diffCatalog(previous: Map<string, ProductState>, current: Map<string, ProductState>): Draft[] {
  const drafts: Draft[] = [];
  for (const [productId, now] of current) {
    const before = previous.get(productId);
    if (!before) {
      drafts.push({ productId, productName: now.name, kind: "new", oldValue: null, newValue: now.price });
      continue;
    }
    if (before.price !== now.price) {
      drafts.push({ productId, productName: now.name, kind: "price", oldValue: before.price, newValue: now.price });
    }
    if (before.stockJardim !== now.stockJardim) {
      drafts.push({ productId, productName: now.name, kind: "stock_jardim", oldValue: before.stockJardim, newValue: now.stockJardim });
    }
    if (before.stockGll !== now.stockGll) {
      drafts.push({ productId, productName: now.name, kind: "stock_gll", oldValue: before.stockGll, newValue: now.stockGll });
    }
  }
  for (const [productId, before] of previous) {
    if (!current.has(productId)) {
      drafts.push({ productId, productName: before.name, kind: "removed", oldValue: before.price, newValue: null });
    }
  }
  return drafts;
}

async function loadState(): Promise<Map<string, ProductState>> {
  if (isMemoryMode()) return memoryState;
  if (loadedState) return loadedState;
  const db = getDb();
  await ensureTables();
  const rows = await db.select().from(catalogState);
  loadedState = new Map(
    rows.map((r) => [
      r.productId,
      { name: r.name, price: r.price, stockJardim: r.stockJardim, stockGll: r.stockGll },
    ]),
  );
  return loadedState;
}

/** Registra as mudanças da sincronização. Na primeira vez só forma a base (sem eventos "novo"). */
export async function recordCatalogSnapshot(products: CatalogSnapshotProduct[]): Promise<number> {
  try {
    if (!products.length) return 0; // catálogo vazio costuma ser falha do ERP, não "tudo removido"
    const current = new Map<string, ProductState>();
    for (const p of products) {
      const key = String(p.externalId || p.id);
      if (key) current.set(key, stateOf(p));
    }

    const previous = await loadState();
    const isFirstRun = previous.size === 0;
    const drafts = isFirstRun ? [] : diffCatalog(previous, current);

    if (isMemoryMode()) {
      for (const draft of drafts) memoryChanges.push({ ...draft, id: memoryNextId++, createdAt: new Date() });
      memoryState = current;
      return drafts.length;
    }

    const db = getDb();
    await ensureTables();
    if (drafts.length) await db.insert(catalogChanges).values(drafts);

    for (const [productId, state] of current) {
      const before = previous.get(productId);
      const same =
        before &&
        before.name === state.name &&
        before.price === state.price &&
        before.stockJardim === state.stockJardim &&
        before.stockGll === state.stockGll;
      if (same) continue;
      await db
        .insert(catalogState)
        .values({ productId, ...state })
        .onDuplicateKeyUpdate({ set: { name: state.name, price: state.price, stockJardim: state.stockJardim, stockGll: state.stockGll } });
    }
    for (const productId of previous.keys()) {
      if (!current.has(productId)) await db.delete(catalogState).where(eq(catalogState.productId, productId));
    }
    loadedState = current;

    if (Date.now() - lastPrunedAt > PRUNE_INTERVAL_MS) {
      lastPrunedAt = Date.now();
      const cutoff = new Date(Date.now() - CATALOG_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await db.delete(catalogChanges).where(lt(catalogChanges.createdAt, cutoff));
    }
    return drafts.length;
  } catch (err) {
    console.error("[CatalogHistory] Falha ao registrar histórico:", err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function listCatalogChanges(opts: { productId?: string; limit?: number } = {}): Promise<CatalogChange[]> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50) || 50, 1), 200);
  if (isMemoryMode()) {
    return memoryChanges
      .filter((c) => !opts.productId || c.productId === opts.productId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
      .slice(0, limit)
      .map((c) => ({ ...c }));
  }
  const db = getDb();
  await ensureTables();
  const query = db.select().from(catalogChanges);
  const rows = await (opts.productId ? query.where(eq(catalogChanges.productId, opts.productId)) : query)
    .orderBy(desc(catalogChanges.createdAt), desc(catalogChanges.id))
    .limit(limit);
  return rows.map((r) => ({
    id: Number(r.id),
    productId: r.productId,
    productName: r.productName,
    kind: r.kind as CatalogChangeKind,
    oldValue: r.oldValue,
    newValue: r.newValue,
    createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
  }));
}
