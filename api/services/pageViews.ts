/**
 * Contador de acessos do site, sem cookies e sem dado pessoal: o "visitante" é um hash que muda todo dia
 * (IP + navegador + dia + segredo do servidor), então não dá para acompanhar uma pessoa de um dia para o outro.
 * Em memória durante os testes ou sem DATABASE_URL.
 */
import { createHash } from "crypto";
import { gte } from "drizzle-orm";
import { pageViews } from "@db/schema";
import { ensureTables, getDb } from "../queries/connection";
import { DASHBOARD_TIMEZONE, localDateKey } from "../dashboard";
import { secret } from "../auth";

export type ViewSite = "loja" | "trocafacil";
export type ViewDevice = "mobile" | "desktop" | "tablet";

export interface PageViewRow {
  day: string;
  visitor: string;
  path: string;
  site: ViewSite;
  device: ViewDevice;
  source: string;
}

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

let memory: PageViewRow[] = [];

export function resetPageViewsForTesting(): void {
  memory = [];
  rateBuckets.clear();
}

// ===== Limite por IP: 120 visualizações por minuto =====
const RATE_MAX = 120;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetTime: number }>();

export function allowPageView(key: string, now = Date.now()): boolean {
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

const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http/i;

export function isBotUserAgent(userAgent: string): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

export function deviceFromUserAgent(userAgent: string): ViewDevice {
  if (/ipad|tablet|playbook|silk/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android|windows phone/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** Só o caminho, sem consulta nem âncora, em minúsculas e com limite de tamanho. */
export function normalizeViewPath(path: string): string {
  const clean = path.split(/[?#]/)[0].trim().toLowerCase().replace(/\/+$/, "");
  return (clean.startsWith("/") ? clean : `/${clean}`).slice(0, 120);
}

/** Origem da visita a partir do referenciador (ou do utm_source). Vazio de origem = acesso direto. */
export function classifySource(referrer: string, utmSource: string, ownHost: string): string {
  const utm = utmSource.trim().toLowerCase();
  let host = "";
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, "") : "";
  } catch {
    host = "";
  }
  const hay = `${utm} ${host}`;
  if (/instagram/.test(hay) || utm === "ig") return "instagram";
  if (/facebook|fb\./.test(hay) || utm === "fb") return "facebook";
  if (/whatsapp|wa\.me/.test(hay)) return "whatsapp";
  if (/google|googleads/.test(hay)) return "google";
  if (/tiktok/.test(hay)) return "tiktok";
  if (/youtube|youtu\.be/.test(hay)) return "youtube";
  const root = (h: string) => h.split(".").slice(-2).join(".");
  if (host && ownHost && root(host) === root(ownHost)) return "direto";
  if (host) return "outros";
  return utm ? "outros" : "direto";
}

export function visitorHash(ip: string, userAgent: string, day: string): string {
  return createHash("sha256").update(`${secret()}|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

export async function recordPageView(row: PageViewRow): Promise<void> {
  if (isMemoryMode()) {
    memory.push(row);
    return;
  }
  const db = getDb();
  await ensureTables();
  await db.insert(pageViews).values(row);
}

async function loadSince(days: number, now: Date): Promise<PageViewRow[]> {
  const since = localDateKey(new Date(now.getTime() - (days - 1) * 86_400_000), DASHBOARD_TIMEZONE);
  if (isMemoryMode()) return memory.filter((r) => r.day >= since);
  const db = getDb();
  await ensureTables();
  const rows = await db
    .select({
      day: pageViews.day,
      visitor: pageViews.visitor,
      path: pageViews.path,
      site: pageViews.site,
      device: pageViews.device,
      source: pageViews.source,
    })
    .from(pageViews)
    .where(gte(pageViews.day, since));
  return rows as PageViewRow[];
}

export interface TrafficOverview {
  days: number;
  totals: { views: number; visitors: number; visitsToday: number; visitorsToday: number };
  daily: { day: string; views: number; visitors: number }[];
  topPages: { path: string; views: number }[];
  sources: { source: string; visits: number }[];
  devices: { device: ViewDevice; visitors: number }[];
  sites: { site: ViewSite; views: number }[];
}

const uniq = (items: string[]) => new Set(items).size;

export function computeTraffic(rows: PageViewRow[], days: number, now = new Date()): TrafficOverview {
  const today = localDateKey(now, DASHBOARD_TIMEZONE);

  const daily: TrafficOverview["daily"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = localDateKey(new Date(now.getTime() - i * 86_400_000), DASHBOARD_TIMEZONE);
    const dayRows = rows.filter((r) => r.day === day);
    daily.push({ day, views: dayRows.length, visitors: uniq(dayRows.map((r) => r.visitor)) });
  }

  // O hash muda por dia: "visitantes" do período = soma dos visitantes únicos de cada dia.
  const visitors = daily.reduce((sum, d) => sum + d.visitors, 0);
  const todayRow = daily.find((d) => d.day === today);

  const countBy = <T extends string>(items: T[]) => {
    const map = new Map<T, number>();
    for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const deviceVisitors = new Map<ViewDevice, Set<string>>();
  for (const r of rows) {
    const set = deviceVisitors.get(r.device) ?? new Set<string>();
    set.add(`${r.day}|${r.visitor}`);
    deviceVisitors.set(r.device, set);
  }

  return {
    days,
    totals: {
      views: rows.length,
      visitors,
      visitsToday: todayRow?.views ?? 0,
      visitorsToday: todayRow?.visitors ?? 0,
    },
    daily,
    topPages: countBy(rows.map((r) => r.path))
      .slice(0, 10)
      .map(([path, views]) => ({ path, views })),
    sources: countBy(rows.filter((r) => r.source).map((r) => r.source)).map(([source, visits]) => ({ source, visits })),
    devices: [...deviceVisitors.entries()]
      .map(([device, set]) => ({ device, visitors: set.size }))
      .sort((a, b) => b.visitors - a.visitors),
    sites: countBy(rows.map((r) => r.site)).map(([site, views]) => ({ site, views })),
  };
}

export async function getTrafficOverview(days: number, now = new Date()): Promise<TrafficOverview> {
  return computeTraffic(await loadSince(days, now), days, now);
}
