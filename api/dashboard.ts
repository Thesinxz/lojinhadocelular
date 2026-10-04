/**
 * Cálculos do dashboard do painel (funções puras, testadas em dashboard.test.ts).
 */
import type { EvaluationStatus } from "@contracts/types";
import { isLate } from "./evaluationWorkflow";

export const DASHBOARD_TIMEZONE = "America/Campo_Grande";

export interface EvalStatRow {
  status: EvaluationStatus;
  createdAt: Date;
  firstResponseAt: Date | null;
  statusChangedAt: Date | null;
  assignedAt: Date | null;
  closedValue: number | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
}

export interface RankingEntry {
  userId: number | null;
  userName: string;
  handled: number;
  concluded: number;
  totalClosedCents: number;
}

export interface EvaluationStats {
  now: { pending: number; late: number; respondedToday: number };
  month: {
    received: number;
    concluded: number;
    refused: number;
    closeRate: number | null;
    totalClosedCents: number;
    avgResponseMinutes: number | null;
  };
  ranking: RankingEntry[];
}

export interface IssueItem {
  id: string;
  name: string;
}

export interface CatalogIssues {
  noPhoto: IssueItem[];
  noBattery: IssueItem[];
  soldOutVisible: IssueItem[];
}

export interface CatalogIssueVariant {
  imageUrl?: string | null;
  batteryHealth?: string | null;
  available: boolean;
  quantity?: number | null;
}

export interface CatalogIssueProduct {
  id: string | number;
  name: string;
  category: string;
  condition: string;
  active: boolean;
  imageUrl?: string | null;
  batteryHealth?: string | null;
  variants: CatalogIssueVariant[];
}

const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/** Data local `AAAA-MM-DD` no fuso informado (padrão: Campo Grande/MS). */
export function localDateKey(date: Date, timeZone = DASHBOARD_TIMEZONE): string {
  let fmt = dateKeyFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateKeyFormatters.set(timeZone, fmt);
  }
  return fmt.format(date);
}

function monthKey(date: Date, timeZone: string): string {
  return localDateKey(date, timeZone).slice(0, 7);
}

export function computeEvaluationStats(
  rows: EvalStatRow[],
  now: Date,
  slaHours: number,
  timeZone = DASHBOARD_TIMEZONE,
): EvaluationStats {
  const today = localDateKey(now, timeZone);
  const currentMonth = today.slice(0, 7);
  const inMonth = (d: Date | null | undefined) => !!d && monthKey(d, timeZone) === currentMonth;
  /** Data em que a avaliação chegou ao status final. */
  const closedAt = (r: EvalStatRow) => r.statusChangedAt ?? r.createdAt;

  let pending = 0;
  let late = 0;
  let respondedToday = 0;
  let received = 0;
  let concluded = 0;
  let refused = 0;
  let totalClosedCents = 0;
  let responseMinutesSum = 0;
  let responseCount = 0;
  const ranking = new Map<string, RankingEntry>();

  const rankFor = (r: EvalStatRow): RankingEntry | null => {
    const name = (r.assignedUserName ?? "").trim();
    if (!name && r.assignedUserId === null) return null;
    const key = r.assignedUserId !== null ? `id:${r.assignedUserId}` : `name:${name}`;
    let entry = ranking.get(key);
    if (!entry) {
      entry = { userId: r.assignedUserId, userName: name || "Sem nome", handled: 0, concluded: 0, totalClosedCents: 0 };
      ranking.set(key, entry);
    }
    return entry;
  };

  for (const r of rows) {
    if (r.status === "pendente") {
      pending++;
      if (isLate(r, now, slaHours)) late++;
    }
    if (r.firstResponseAt && localDateKey(r.firstResponseAt, timeZone) === today) respondedToday++;

    if (inMonth(r.createdAt)) {
      received++;
      if (r.firstResponseAt) {
        const minutes = (r.firstResponseAt.getTime() - r.createdAt.getTime()) / 60_000;
        if (minutes >= 0) {
          responseMinutesSum += minutes;
          responseCount++;
        }
      }
    }

    const finishedThisMonth = inMonth(closedAt(r));
    if (r.status === "concluido" && finishedThisMonth) {
      concluded++;
      totalClosedCents += r.closedValue ?? 0;
    }
    if (r.status === "recusado" && finishedThisMonth) refused++;

    const handledThisMonth = inMonth(r.assignedAt ?? r.createdAt);
    if (handledThisMonth || (r.status === "concluido" && finishedThisMonth)) {
      const entry = rankFor(r);
      if (entry) {
        if (handledThisMonth) entry.handled++;
        if (r.status === "concluido" && finishedThisMonth) {
          entry.concluded++;
          entry.totalClosedCents += r.closedValue ?? 0;
        }
      }
    }
  }

  const decided = concluded + refused;
  return {
    now: { pending, late, respondedToday },
    month: {
      received,
      concluded,
      refused,
      closeRate: decided > 0 ? concluded / decided : null,
      totalClosedCents,
      avgResponseMinutes: responseCount > 0 ? Math.round(responseMinutesSum / responseCount) : null,
    },
    ranking: [...ranking.values()].sort(
      (a, b) =>
        b.concluded - a.concluded ||
        b.totalClosedCents - a.totalClosedCents ||
        b.handled - a.handled ||
        a.userName.localeCompare(b.userName, "pt-BR"),
    ),
  };
}

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;

function isSeminovo(p: CatalogIssueProduct): boolean {
  return p.category === "iphone_seminovo" || p.condition.toLowerCase().startsWith("seminovo");
}

/** Pendências da vitrine (somente produtos visíveis). */
export function computeCatalogIssues(products: CatalogIssueProduct[]): CatalogIssues {
  const issues: CatalogIssues = { noPhoto: [], noBattery: [], soldOutVisible: [] };
  for (const p of products) {
    if (!p.active) continue;
    const item = { id: String(p.id), name: p.name };
    const variants = p.variants ?? [];

    if (!filled(p.imageUrl) && !variants.some((v) => filled(v.imageUrl))) {
      issues.noPhoto.push(item);
    }

    if (isSeminovo(p) && !filled(p.batteryHealth)) {
      const sellable = variants.filter((v) => v.available);
      if (variants.length === 0 || sellable.some((v) => !filled(v.batteryHealth))) {
        issues.noBattery.push(item);
      }
    }

    if (variants.length > 0 && variants.every((v) => !v.available || (v.quantity ?? 1) <= 0)) {
      issues.soldOutVisible.push(item);
    }
  }
  return issues;
}
