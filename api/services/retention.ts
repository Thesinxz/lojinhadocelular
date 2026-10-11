/**
 * Guarda e exclusão de dados pessoais do Troca Fácil (LGPD).
 * - Guarda máxima: avaliações não concluídas e concluídas são apagadas depois de N meses (configurável; 0 = nunca).
 * - Exclusão a pedido do titular: apaga tudo ligado a um número de WhatsApp.
 * Apagar = linha da avaliação + anotações + mensagens enviadas + controle de entrada no ERP + fotos (S3/R2).
 */
import { SETTING_KEYS, DEFAULT_SETTINGS } from "@contracts/types";
import {
  deleteEvaluationRows,
  listEvaluationsByWhatsapp,
  listEvaluationsCreatedBefore,
  type ErasableEvaluation,
} from "./evaluationStore";
import { deleteEvaluationNotesFor } from "./evaluationNotes";
import { deleteEvaluationMessagesFor } from "./evaluationMessages";
import { deleteErpEntriesFor } from "./evaluationErpEntries";
import { deleteEvaluationPhotoObjects, getPhotoObjectKey, parseStoredEvaluationPhotos } from "./evaluationPhotoStorage";
import { getAllSettings } from "./settingsStore";
import type { SessionUser } from "@contracts/permissions";
import { logAction } from "./auditLog";

export async function isAutomaticRetentionEnabled(): Promise<boolean> {
  return (await getAllSettings())[SETTING_KEYS.retentionAuto] === "1";
}

export interface RetentionPolicy {
  /** Meses para avaliações pendentes/em atendimento/recusadas. 0 = nunca apagar. */
  openMonths: number;
  /** Meses para avaliações concluídas. 0 = nunca apagar. */
  closedMonths: number;
}

const MAX_MONTHS = 120;

function parseMonths(raw: string | undefined, fallback: string): number {
  const value = Number(String(raw ?? fallback).replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return Number(fallback);
  return Math.min(MAX_MONTHS, Math.floor(value));
}

export function parseRetentionPolicy(settings: Record<string, string>): RetentionPolicy {
  return {
    openMonths: parseMonths(settings[SETTING_KEYS.retentionOpenMonths], DEFAULT_SETTINGS[SETTING_KEYS.retentionOpenMonths]),
    closedMonths: parseMonths(settings[SETTING_KEYS.retentionClosedMonths], DEFAULT_SETTINGS[SETTING_KEYS.retentionClosedMonths]),
  };
}

export async function getRetentionPolicy(): Promise<RetentionPolicy> {
  return parseRetentionPolicy(await getAllSettings());
}

function monthsAgo(now: Date, months: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/** A guarda conta a partir da última movimentação (ou da criação, se nunca houve). */
function lastActivity(e: ErasableEvaluation): Date {
  return e.statusChangedAt && e.statusChangedAt > e.createdAt ? e.statusChangedAt : e.createdAt;
}

export async function findExpiredEvaluations(policy: RetentionPolicy, now = new Date()): Promise<ErasableEvaluation[]> {
  const months = [policy.openMonths, policy.closedMonths].filter((m) => m > 0);
  if (months.length === 0) return [];
  const widestCutoff = monthsAgo(now, Math.min(...months));
  const candidates = await listEvaluationsCreatedBefore(widestCutoff);
  return candidates.filter((e) => {
    const limit = e.status === "concluido" ? policy.closedMonths : policy.openMonths;
    return limit > 0 && lastActivity(e) < monthsAgo(now, limit);
  });
}

/** Apaga tudo o que se liga às avaliações; fotos com falha são só registradas (a linha já foi removida). */
export async function eraseEvaluations(items: ErasableEvaluation[]): Promise<number> {
  if (items.length === 0) return 0;
  const ids = items.map((e) => e.id);
  const photoKeys = items
    .flatMap((e) => parseStoredEvaluationPhotos(e.photos))
    .map(getPhotoObjectKey)
    .filter((key): key is string => Boolean(key));
  await deleteEvaluationNotesFor(ids);
  await deleteEvaluationMessagesFor(ids);
  await deleteErpEntriesFor(ids);
  await deleteEvaluationRows(ids);
  try {
    await deleteEvaluationPhotoObjects(photoKeys);
  } catch (error) {
    console.error("[Retention] Avaliações removidas, mas nem todas as fotos saíram do S3:", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return ids.length;
}

export interface RetentionRun {
  deleted: number;
}

/** Executa a guarda máxima agora. Sem `actor`, o histórico registra "Sistema" (rotina automática). */
export async function runRetention(
  now = new Date(),
  actor: Pick<SessionUser, "id" | "name"> | null = null,
): Promise<RetentionRun> {
  const expired = await findExpiredEvaluations(await getRetentionPolicy(), now);
  const deleted = await eraseEvaluations(expired);
  if (deleted > 0) {
    await logAction(actor, {
      action: "privacy.retention",
      entityType: "evaluation",
      summary: `Guarda de dados (LGPD): ${deleted} avaliação(ões) apagada(s) por prazo vencido`,
    });
  }
  return { deleted };
}

/** Pedido de exclusão do titular: acha as avaliações de um WhatsApp. */
export async function findEvaluationsOfHolder(whatsapp: string): Promise<ErasableEvaluation[]> {
  return listEvaluationsByWhatsapp(whatsapp);
}

// ---- rotina em segundo plano ----
const FIRST_RUN_DELAY_MS = 2 * 60 * 1000;
const INTERVAL_MS = 12 * 60 * 60 * 1000;
let started = false;

export function startRetentionJob(): void {
  if (started || process.env.NODE_ENV === "test") return;
  started = true;
  const tick = () => {
    // Só apaga sozinha se o dono ligou a rotina no painel.
    isAutomaticRetentionEnabled()
      .then((enabled) => (enabled ? runRetention() : undefined))
      .catch((error) =>
      console.error("[Retention] Falha na rotina de guarda:", error instanceof Error ? error.message : String(error)),
    );
  };
  setTimeout(() => {
    tick();
    setInterval(tick, INTERVAL_MS).unref?.();
  }, FIRST_RUN_DELAY_MS).unref?.();
}
