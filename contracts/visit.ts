/** Preferência de visita à loja (dia + período). A equipe confirma pelo WhatsApp; não há controle de vagas. */

export type VisitPeriod = "manha" | "tarde";

export const VISIT_PERIOD_LABELS: Record<VisitPeriod, string> = {
  manha: "Manhã",
  tarde: "Tarde",
};

/** Quantos dias à frente o cliente pode escolher (contando a partir de hoje). */
export const VISIT_WINDOW_DAYS = 14;

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Dia da semana (0 = domingo) de uma data "AAAA-MM-DD", sem depender do fuso do aparelho. */
function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Períodos em que as lojas abrem em cada dia (horário comum às duas lojas):
 * segunda a sexta, manhã e tarde; sábado só de manhã; domingo fechado.
 */
export function visitPeriodsFor(dateKey: string): VisitPeriod[] {
  if (!isDateKey(dateKey)) return [];
  const day = weekdayOf(dateKey);
  if (day === 0) return [];
  if (day === 6) return ["manha"];
  return ["manha", "tarde"];
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Próximos dias em que a loja abre, começando em `todayKey` (inclui hoje). */
export function nextVisitDays(todayKey: string, windowDays = VISIT_WINDOW_DAYS): string[] {
  const days: string[] = [];
  for (let i = 0; i < windowDays; i++) {
    const key = addDays(todayKey, i);
    if (visitPeriodsFor(key).length > 0) days.push(key);
  }
  return days;
}

/** "terça, 14/10" */
export function formatVisitDay(dateKey: string): string {
  const [, m, d] = dateKey.split("-");
  return `${WEEKDAYS[weekdayOf(dateKey)]}, ${d}/${m}`;
}

/** Valor guardado: "AAAA-MM-DD manha". */
export function encodeVisit(dateKey: string, period: VisitPeriod): string {
  return `${dateKey} ${period}`;
}

export function decodeVisit(value: string | null | undefined): { date: string; period: VisitPeriod } | null {
  const match = /^(\d{4}-\d{2}-\d{2}) (manha|tarde)$/.exec((value ?? "").trim());
  if (!match || !isDateKey(match[1])) return null;
  return { date: match[1], period: match[2] as VisitPeriod };
}

/** "terça, 14/10 — Manhã" (vazio se não houver preferência válida). */
export function formatVisit(value: string | null | undefined): string {
  const visit = decodeVisit(value);
  return visit ? `${formatVisitDay(visit.date)} — ${VISIT_PERIOD_LABELS[visit.period]}` : "";
}

/**
 * Valida a preferência recebida do cliente: dia dentro da janela (com 1 dia de folga por causa do fuso),
 * loja aberta nesse dia e período em que ela abre. Devolve "" quando não vale (o cadastro segue sem visita).
 */
export function sanitizeVisit(value: string | null | undefined, todayKey: string): string {
  const visit = decodeVisit(value);
  if (!visit) return "";
  if (visit.date < addDays(todayKey, -1) || visit.date > addDays(todayKey, VISIT_WINDOW_DAYS)) return "";
  if (!visitPeriodsFor(visit.date).includes(visit.period)) return "";
  return encodeVisit(visit.date, visit.period);
}
