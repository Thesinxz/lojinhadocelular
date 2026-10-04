/**
 * Tipos e utilitários (não-componentes) compartilhados pelas telas de avaliações.
 * Mantidos fora dos .tsx para não quebrar o Fast Refresh.
 */
import { STORE_UNITS } from "@contracts/permissions";
import {
  EVALUATION_STATUS_LABELS,
  REFUSAL_REASONS,
  type EvaluationPhotoItem,
  type EvaluationStatus,
} from "@contracts/types";
import type { RouterOutputs } from "@/providers/trpc";

export type EvaluationRow = RouterOutputs["admin"]["evaluationsPage"]["items"][number];
export type EvaluationDetailData = RouterOutputs["admin"]["evaluationDetail"];
export type EvaluationNoteItem = EvaluationDetailData["notes"][number];
export type EvaluationAuditItem = EvaluationDetailData["audit"][number];
export type EvaluationConfigData = RouterOutputs["admin"]["evaluationConfig"];
export type AssignedFilter = "me" | "none" | "any";
export type StatusFilter = EvaluationStatus | "todos";

export const STATUS_CONFIG: Record<EvaluationStatus, { label: string; bg: string; text: string; border: string }> = {
  pendente: {
    label: EVALUATION_STATUS_LABELS.pendente,
    bg: "bg-amber-500/10",
    text: "text-amber-700",
    border: "border-amber-500/20",
  },
  atendimento: {
    label: EVALUATION_STATUS_LABELS.atendimento,
    bg: "bg-blue-500/10",
    text: "text-blue-700",
    border: "border-blue-500/20",
  },
  concluido: {
    label: EVALUATION_STATUS_LABELS.concluido,
    bg: "bg-emerald-500/10",
    text: "text-emerald-700",
    border: "border-emerald-500/20",
  },
  recusado: {
    label: EVALUATION_STATUS_LABELS.recusado,
    bg: "bg-neutral-500/10",
    text: "text-neutral-600",
    border: "border-neutral-500/20",
  },
};

export function unitLabel(unit: string | null | undefined): string {
  return STORE_UNITS.find((u) => u.value === unit)?.label ?? "";
}

export function refusalLabel(reason: string | null | undefined): string {
  return REFUSAL_REASONS.find((r) => r.value === reason)?.label ?? "";
}

export function formatDateTime(val?: string | Date | null): string {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function timeAgo(val: string | Date | null | undefined, now: Date = new Date()): string {
  if (!val) return "";
  const d = new Date(val);
  const diffMin = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function initials(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

// ===== Valores em reais (máscara) ⇄ centavos =====

/** Máscara de digitação: "123456" → "1.234,56". Vazio continua vazio. */
export function maskReaisInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 11);
  if (!digits) return "";
  const cents = Number(digits);
  return centsToReaisInput(cents);
}

/** 123456 → "1.234,56"; null → "". */
export function centsToReaisInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56" → 123456; "" → null. */
export function reaisInputToCents(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits);
}

export function hasInlinePhotos(photos: EvaluationPhotoItem[]): boolean {
  return photos.some((photo) => photo.storage !== "s3" && !photo.url.startsWith("s3://"));
}
