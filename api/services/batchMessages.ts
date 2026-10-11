/**
 * Envio em lote da mensagem de "avaliação recebida" (Evolution API).
 * As mensagens saem uma a uma, com intervalo variável entre elas, para não parecer disparo em massa
 * e não arriscar o número da loja. A fila vive na memória: se o servidor reiniciar, o que faltava não é enviado
 * (dá para refazer o lote, pois quem já recebeu é pulado).
 */
import type { AutoMessageEvent } from "@contracts/types";
import { findEvaluationById } from "./evaluationStore";
import { listEvaluationMessages } from "./evaluationMessages";
import { dispatchCustomerEvent, renderCustomerMessage } from "./autoMessages";
import { getAllSettings } from "./settingsStore";
import { isEvolutionConfigured, normalizeBrazilNumber } from "./evolution";

export const BATCH_MAX = 50;
const SPACING_MIN_MS = 6_000;
const SPACING_MAX_MS = 12_000;

export interface BatchPlan {
  eligible: number[];
  /** Já recebeu essa mensagem antes. */
  alreadySent: number[];
  /** WhatsApp sem formato válido. */
  invalidNumber: number[];
  /** Avaliação já concluída ou recusada. */
  closed: number[];
  /** Não existe mais. */
  missing: number[];
  sample: string | null;
  evolutionConfigured: boolean;
  /** Estimativa de duração do envio, em segundos. */
  estimatedSeconds: number;
}

function spacingMs(): number {
  if (process.env.NODE_ENV === "test") return 0;
  return SPACING_MIN_MS + Math.floor(Math.random() * (SPACING_MAX_MS - SPACING_MIN_MS));
}

export async function planBatchMessage(event: AutoMessageEvent, rawIds: number[]): Promise<BatchPlan> {
  const ids = [...new Set(rawIds)].slice(0, BATCH_MAX);
  const plan: BatchPlan = {
    eligible: [],
    alreadySent: [],
    invalidNumber: [],
    closed: [],
    missing: [],
    sample: null,
    evolutionConfigured: isEvolutionConfigured(),
    estimatedSeconds: 0,
  };
  let sampleSource: Awaited<ReturnType<typeof findEvaluationById>> = null;
  for (const id of ids) {
    const evaluation = await findEvaluationById(id);
    if (!evaluation) {
      plan.missing.push(id);
      continue;
    }
    if (evaluation.status === "concluido" || evaluation.status === "recusado") {
      plan.closed.push(id);
      continue;
    }
    if (!normalizeBrazilNumber(evaluation.whatsapp)) {
      plan.invalidNumber.push(id);
      continue;
    }
    const history = await listEvaluationMessages(id);
    if (history.some((m) => m.event === event && m.recipient === "cliente" && m.status === "sent")) {
      plan.alreadySent.push(id);
      continue;
    }
    plan.eligible.push(id);
    sampleSource ??= evaluation;
  }
  if (sampleSource) plan.sample = await renderCustomerMessage(event, sampleSource, await getAllSettings());
  plan.estimatedSeconds = Math.round((plan.eligible.length * (SPACING_MIN_MS + SPACING_MAX_MS)) / 2 / 1000);
  return plan;
}

// ---- fila em memória (um envio por vez no processo) ----
interface Job {
  event: AutoMessageEvent;
  id: number;
}
const pending: Job[] = [];
let worker: Promise<void> | null = null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function run(): Promise<void> {
  while (pending.length > 0) {
    const job = pending.shift()!;
    try {
      await dispatchCustomerEvent(job.event, job.id, { manual: true });
    } catch (error) {
      console.error("[BatchMessages] Falha ao enviar:", { id: job.id, message: error instanceof Error ? error.message : String(error) });
    }
    if (pending.length > 0) await sleep(spacingMs());
  }
}

/** Coloca os envios na fila e devolve na hora; o envio continua em segundo plano. */
export function enqueueBatchMessages(event: AutoMessageEvent, ids: number[]): number {
  let added = 0;
  for (const id of ids) {
    if (pending.some((job) => job.event === event && job.id === id)) continue;
    pending.push({ event, id });
    added++;
  }
  if (added > 0 && !worker) {
    worker = run().finally(() => {
      worker = null;
    });
  }
  return added;
}

export function pendingBatchMessages(): number {
  return pending.length;
}

/** Para testes: espera a fila esvaziar. */
export async function waitForBatchIdle(): Promise<void> {
  while (worker) await worker;
}
