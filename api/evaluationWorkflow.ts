/**
 * Regras puras do fluxo de atendimento das avaliações (Troca Fácil).
 * Sem acesso a banco: recebem o estado atual e devolvem o próximo (ou lançam Error com
 * mensagem em PT-BR, pronta para exibir).
 */
import type { SessionUser, StoreUnit } from "@contracts/permissions";
import {
  EVALUATION_STATUSES,
  REFUSAL_REASONS,
  type EvaluationStatus,
} from "@contracts/types";

export type { EvaluationStatus } from "@contracts/types";

export type EvaluationUnit = StoreUnit | "";

export interface WorkflowState {
  status: EvaluationStatus;
  unit: EvaluationUnit;
  assignedUserId: number | null;
  assignedUserName: string;
  assignedAt: Date | null;
  firstResponseAt: Date | null;
  statusChangedAt: Date | null;
  offeredValue: number | null;
  closedValue: number | null;
  refusalReason: string;
  createdAt: Date;
}

export const NOTE_MAX_LENGTH = 2000;
const MAX_CENTS = 100_000_000; // R$ 1.000.000,00

export class WorkflowError extends Error {}

function assertCents(value: number | null | undefined, label: string): void {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new WorkflowError(`${label} inválido`);
  }
}

export function isEvaluationStatus(value: unknown): value is EvaluationStatus {
  return typeof value === "string" && (EVALUATION_STATUSES as readonly string[]).includes(value);
}

export function isRefusalReason(value: unknown): boolean {
  return typeof value === "string" && REFUSAL_REASONS.some((r) => r.value === value);
}

/**
 * Atribui a avaliação a `user`. Se estiver pendente vira "em atendimento".
 * Já atribuída a outra pessoa → erro "Já está com <nome>", exceto com `force` (dono).
 */
export function applyClaim(
  s: WorkflowState,
  user: Pick<SessionUser, "id" | "name">,
  now: Date,
  opts: { force?: boolean } = {},
): WorkflowState {
  if (s.assignedUserId === user.id) return s;
  if (s.assignedUserId !== null && !opts.force) {
    throw new WorkflowError(`Já está com ${s.assignedUserName || "outra pessoa"}`);
  }
  const next: WorkflowState = {
    ...s,
    assignedUserId: user.id,
    assignedUserName: user.name,
    assignedAt: now,
    firstResponseAt: s.firstResponseAt ?? now,
  };
  if (s.status === "pendente") {
    next.status = "atendimento";
    next.statusChangedAt = now;
  }
  return next;
}

/** Remove o responsável (somente dono). Não mexe no status. */
export function applyUnassign(s: WorkflowState): WorkflowState {
  if (s.assignedUserId === null) return s;
  return { ...s, assignedUserId: null, assignedUserName: "", assignedAt: null };
}

/**
 * Muda o status. "recusado" exige um motivo válido; "concluido" aceita valor fechado.
 * Sair de "recusado" limpa o motivo.
 */
export function applyStatus(
  s: WorkflowState,
  status: EvaluationStatus,
  now: Date,
  extra: { refusalReason?: string; closedValue?: number | null } = {},
): WorkflowState {
  if (!isEvaluationStatus(status)) throw new WorkflowError("Status inválido");

  const next: WorkflowState = { ...s, status };
  if (status === "recusado") {
    if (!isRefusalReason(extra.refusalReason)) {
      throw new WorkflowError("Informe o motivo da recusa");
    }
    next.refusalReason = extra.refusalReason as string;
  } else {
    next.refusalReason = "";
  }

  if (status === "concluido" && extra.closedValue !== undefined) {
    assertCents(extra.closedValue, "Valor fechado");
    next.closedValue = extra.closedValue;
  }

  if (status !== s.status) {
    next.statusChangedAt = now;
    next.firstResponseAt = s.firstResponseAt ?? now;
  }
  return next;
}

/** Valores da negociação, em centavos. `undefined` mantém, `null` limpa. */
export function applyValues(
  s: WorkflowState,
  v: { offeredValue?: number | null; closedValue?: number | null },
): WorkflowState {
  assertCents(v.offeredValue, "Valor oferecido");
  assertCents(v.closedValue, "Valor fechado");
  return {
    ...s,
    offeredValue: v.offeredValue === undefined ? s.offeredValue : v.offeredValue,
    closedValue: v.closedValue === undefined ? s.closedValue : v.closedValue,
  };
}

export function applyUnit(s: WorkflowState, unit: EvaluationUnit): WorkflowState {
  if (unit !== "" && unit !== "jardim" && unit !== "gll") {
    throw new WorkflowError("Unidade inválida");
  }
  return { ...s, unit };
}

/** Normaliza e valida o texto de uma anotação (1–2000 caracteres). */
export function validateNoteBody(body: string): string {
  const text = String(body ?? "").trim();
  if (!text) throw new WorkflowError("Escreva a anotação");
  if (text.length > NOTE_MAX_LENGTH) {
    throw new WorkflowError(`A anotação pode ter no máximo ${NOTE_MAX_LENGTH} caracteres`);
  }
  return text;
}

/** Pendente há mais tempo que o SLA (em horas). */
export function isLate(
  s: Pick<WorkflowState, "status" | "createdAt">,
  now: Date,
  slaHours: number,
): boolean {
  if (s.status !== "pendente") return false;
  const created = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
  return now.getTime() - created.getTime() > slaHours * 60 * 60 * 1000;
}

/** Lê o SLA salvo nas configurações (fallback: 2 horas). */
export function parseSlaHours(raw: string | undefined | null, fallback = 2): number {
  const n = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
