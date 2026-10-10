/**
 * Relatório de avaliações por período (funções puras, testadas em evaluationReport.test.ts).
 * Cohort: considera as avaliações RECEBIDAS dentro do período e como terminaram.
 */
import type { EvaluationStatus } from "@contracts/types";
import { localDateKey, DASHBOARD_TIMEZONE, type RankingEntry } from "./dashboard";

export interface ReportRow {
  id: number;
  name: string;
  whatsapp: string;
  model: string;
  storage: string | null;
  unit: string | null;
  status: EvaluationStatus;
  refusalReason: string | null;
  offeredValue: number | null;
  closedValue: number | null;
  createdAt: Date;
  firstResponseAt: Date | null;
  statusChangedAt: Date | null;
  assignedUserId: number | null;
  assignedUserName: string | null;
}

export interface EvaluationReport {
  totals: {
    received: number;
    pending: number;
    inProgress: number;
    concluded: number;
    refused: number;
    /** concluídas ÷ (concluídas + recusadas) */
    conversionRate: number | null;
    totalClosedCents: number;
    avgTicketCents: number | null;
    avgOfferedCents: number | null;
    avgResponseMinutes: number | null;
    medianResponseMinutes: number | null;
    unanswered: number;
    repeatCustomers: number;
  };
  refusalReasons: { reason: string; count: number }[];
  byUnit: { unit: string; received: number; concluded: number; totalClosedCents: number }[];
  byDay: { date: string; received: number; concluded: number }[];
  topModels: { model: string; count: number }[];
  ranking: RankingEntry[];
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

export function computeEvaluationReport(
  rows: ReportRow[],
  timeZone = DASHBOARD_TIMEZONE,
): EvaluationReport {
  let pending = 0;
  let inProgress = 0;
  let concluded = 0;
  let refused = 0;
  let totalClosedCents = 0;
  let closedWithValue = 0;
  let offeredSum = 0;
  let offeredCount = 0;
  let unanswered = 0;
  const responseMinutes: number[] = [];
  const reasons = new Map<string, number>();
  const units = new Map<string, { unit: string; received: number; concluded: number; totalClosedCents: number }>();
  const days = new Map<string, { date: string; received: number; concluded: number }>();
  const models = new Map<string, number>();
  const people = new Map<string, RankingEntry>();
  const phones = new Map<string, number>();

  const dayOf = (date: Date) => {
    const key = localDateKey(date, timeZone);
    let entry = days.get(key);
    if (!entry) {
      entry = { date: key, received: 0, concluded: 0 };
      days.set(key, entry);
    }
    return entry;
  };

  for (const r of rows) {
    dayOf(r.createdAt).received++;
    const unitKey = r.unit === "jardim" || r.unit === "gll" ? r.unit : "";
    let unit = units.get(unitKey);
    if (!unit) {
      unit = { unit: unitKey, received: 0, concluded: 0, totalClosedCents: 0 };
      units.set(unitKey, unit);
    }
    unit.received++;

    const model = r.model.trim();
    if (model) models.set(model, (models.get(model) ?? 0) + 1);

    const digits = onlyDigits(r.whatsapp);
    if (digits.length >= 8) phones.set(digits.slice(-8), (phones.get(digits.slice(-8)) ?? 0) + 1);

    if (r.firstResponseAt) {
      const minutes = (r.firstResponseAt.getTime() - r.createdAt.getTime()) / 60_000;
      if (minutes >= 0) responseMinutes.push(minutes);
    } else if (r.status === "pendente") {
      unanswered++;
    }
    if (typeof r.offeredValue === "number") {
      offeredSum += r.offeredValue;
      offeredCount++;
    }

    if (r.status === "pendente") pending++;
    else if (r.status === "atendimento") inProgress++;
    else if (r.status === "recusado") {
      refused++;
      const reason = r.refusalReason || "outro";
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    } else if (r.status === "concluido") {
      concluded++;
      unit.concluded++;
      dayOf(r.statusChangedAt ?? r.createdAt).concluded++;
      if (typeof r.closedValue === "number" && r.closedValue > 0) {
        totalClosedCents += r.closedValue;
        closedWithValue++;
        unit.totalClosedCents += r.closedValue;
      }
    }

    const name = (r.assignedUserName ?? "").trim();
    if (name || r.assignedUserId !== null) {
      const key = r.assignedUserId !== null ? `id:${r.assignedUserId}` : `name:${name}`;
      let person = people.get(key);
      if (!person) {
        person = { userId: r.assignedUserId, userName: name || "Sem nome", handled: 0, concluded: 0, totalClosedCents: 0 };
        people.set(key, person);
      }
      person.handled++;
      if (r.status === "concluido") {
        person.concluded++;
        person.totalClosedCents += r.closedValue ?? 0;
      }
    }
  }

  const decided = concluded + refused;
  const avgResponse = responseMinutes.length
    ? Math.round(responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length)
    : null;

  return {
    totals: {
      received: rows.length,
      pending,
      inProgress,
      concluded,
      refused,
      conversionRate: decided > 0 ? concluded / decided : null,
      totalClosedCents,
      avgTicketCents: closedWithValue ? Math.round(totalClosedCents / closedWithValue) : null,
      avgOfferedCents: offeredCount ? Math.round(offeredSum / offeredCount) : null,
      avgResponseMinutes: avgResponse,
      medianResponseMinutes: median(responseMinutes),
      unanswered,
      repeatCustomers: [...phones.values()].filter((n) => n > 1).length,
    },
    refusalReasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    byUnit: [...units.values()].sort((a, b) => b.received - a.received),
    byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    topModels: [...models.entries()]
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model, "pt-BR"))
      .slice(0, 8),
    ranking: [...people.values()].sort(
      (a, b) =>
        b.concluded - a.concluded ||
        b.totalClosedCents - a.totalClosedCents ||
        b.handled - a.handled ||
        a.userName.localeCompare(b.userName, "pt-BR"),
    ),
  };
}
