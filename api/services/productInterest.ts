/**
 * Interesse por produto: cliques em "pedir no WhatsApp" na página do produto, agregados por dia.
 * Em memória durante os testes ou sem DATABASE_URL.
 */
import { gte, sql } from "drizzle-orm";
import { productInterest } from "@db/schema";
import { ensureTables, getDb } from "../queries/connection";
import { DASHBOARD_TIMEZONE, localDateKey } from "../dashboard";

export interface InterestRow {
  productId: string;
  productName: string;
  clicks: number;
}

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

let memory = new Map<string, { day: string; productId: string; productName: string; clicks: number }>();

export function resetProductInterestForTesting(): void {
  memory = new Map();
  rateBuckets.clear();
}

// ===== Limite por IP: 30 cliques por minuto =====
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetTime: number }>();

export function allowInterestClick(key: string, now = Date.now()): boolean {
  const bucket = rateBuckets.get(key);
  if (bucket && bucket.resetTime > now) {
    if (bucket.count >= RATE_MAX) return false;
    bucket.count += 1;
    return true;
  }
  rateBuckets.set(key, { count: 1, resetTime: now + RATE_WINDOW_MS });
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (v.resetTime < now) rateBuckets.delete(k);
  }
  return true;
}

export async function recordProductInterest(productId: string, productName: string, now = new Date()): Promise<void> {
  const day = localDateKey(now, DASHBOARD_TIMEZONE);
  const name = productName.slice(0, 255);
  if (isMemoryMode()) {
    const key = `${day}|${productId}`;
    const current = memory.get(key);
    if (current) current.clicks += 1;
    else memory.set(key, { day, productId, productName: name, clicks: 1 });
    return;
  }
  const db = getDb();
  await ensureTables();
  await db
    .insert(productInterest)
    .values({ day, productId, productName: name, clicks: 1 })
    .onDuplicateKeyUpdate({ set: { clicks: sql`${productInterest.clicks} + 1`, productName: name } });
}

/** Total de cliques por produto nos últimos `days` dias. */
export async function listProductInterest(days = 30, now = new Date()): Promise<InterestRow[]> {
  const since = localDateKey(new Date(now.getTime() - (days - 1) * 86_400_000), DASHBOARD_TIMEZONE);
  const totals = new Map<string, InterestRow>();
  const add = (productId: string, productName: string, clicks: number) => {
    const row = totals.get(productId);
    if (row) row.clicks += clicks;
    else totals.set(productId, { productId, productName, clicks });
  };

  if (isMemoryMode()) {
    for (const r of memory.values()) if (r.day >= since) add(r.productId, r.productName, r.clicks);
  } else {
    const db = getDb();
    await ensureTables();
    const rows = await db.select().from(productInterest).where(gte(productInterest.day, since));
    for (const r of rows) add(r.productId, r.productName, r.clicks);
  }
  return [...totals.values()].sort((a, b) => b.clicks - a.clicks || a.productName.localeCompare(b.productName, "pt-BR"));
}
