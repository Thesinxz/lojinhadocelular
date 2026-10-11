/**
 * "Quem já comprou com a gente": últimos compradores de celular vindos do ERP.
 * O ERP já devolve só primeiro nome, inicial, marca e modelo (e respeita quem pediu para não aparecer);
 * aqui validamos tudo de novo, descartamos o que não parece seguro e guardamos em cache.
 * Se o ERP falhar, a faixa some em silêncio (nunca derruba a página inicial).
 */
import { env } from "../lib/env";

export interface RecentBuyer {
  firstName: string;
  lastInitial: string;
  model: string;
  brand: string;
}

const MAX_ITEMS = 20;
const FRESH_MS = 10 * 60 * 1000;
const STALE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 8_000;

let cache: { items: RecentBuyer[]; at: number } | null = null;

export function resetSocialProofCacheForTesting(): void {
  cache = null;
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Aceita só o formato esperado e descarta qualquer coisa que lembre dado sensível. */
export function sanitizeBuyers(body: unknown): RecentBuyer[] {
  const root = body as { data?: { items?: unknown }; items?: unknown } | null;
  const list = root?.data?.items ?? root?.items;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const result: RecentBuyer[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    const firstName = clean(item.first_name, 20);
    if (!/^\p{L}[\p{L}'’-]{1,19}$/u.test(firstName)) continue; // um nome só, só letras

    const initialRaw = clean(item.last_initial, 2);
    const lastInitial = /^\p{L}\.?$/u.test(initialRaw) ? initialRaw.replace(".", "").toUpperCase() : "";

    const model = clean(item.model, 40);
    if (model.length < 2 || /\d{8,}/.test(model) || /[@<>]/.test(model)) continue;

    const brand = clean(item.brand, 20);
    if (/\d{8,}|[@<>]/.test(brand)) continue;

    const key = `${firstName}|${lastInitial}|${model}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ firstName: firstName[0].toUpperCase() + firstName.slice(1), lastInitial, model, brand });
    if (result.length >= MAX_ITEMS) break;
  }
  return result;
}

async function fetchFromErp(): Promise<RecentBuyer[]> {
  const slug = encodeURIComponent(env.erpStoreSlug);
  const url = `${env.erpApiUrl}/api/storefront/${slug}/compras-recentes?limit=${MAX_ITEMS}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return sanitizeBuyers(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function getRecentBuyers(now = Date.now()): Promise<RecentBuyer[]> {
  if (!env.erpCatalogEnabled) return [];
  if (cache && now - cache.at < FRESH_MS) return cache.items;
  try {
    const items = await fetchFromErp();
    cache = { items, at: now };
    return items;
  } catch {
    // ERP fora do ar ou sem o endpoint: usa a última lista por até 1 hora, senão não mostra nada.
    return cache && now - cache.at < STALE_MS ? cache.items : [];
  }
}
