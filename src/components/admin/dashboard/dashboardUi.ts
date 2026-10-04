import type { RouterOutputs } from "@/providers/trpc";

export type DashboardData = RouterOutputs["admin"]["dashboard"];
export type DashboardActivity = DashboardData["activity"][number];
export type DashboardRankingEntry = NonNullable<DashboardData["ranking"]>[number];

/** "45 min", "1 h 20 min", "2 d 3 h". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours < 24) return mins ? `${hours} h ${mins} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days} d ${remHours} h` : `${days} d`;
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return "—";
  return `${Math.round(ratio * 100)}%`;
}

export function monthLabel(date: Date = new Date()): string {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Campo_Grande" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
