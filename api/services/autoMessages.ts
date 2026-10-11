/**
 * Mensagens automáticas do fluxo de avaliação (Evolution API).
 * Nunca lançam erro: uma falha de WhatsApp não pode derrubar a ação principal.
 */
import {
  parseAutoMessages,
  SETTING_KEYS,
  AUTO_MESSAGE_EVENT_LABELS,
  type AutoMessageEvent,
} from "@contracts/types";
import { buildTemplateVars, renderTemplate } from "@/lib/whatsappTemplates";
import { findEvaluationById, type EvaluationRecord } from "./evaluationStore";
import { getAllSettings } from "./settingsStore";
import { evolutionShortError, isEvolutionConfigured, sendEvolutionText } from "./evolution";
import { listEvaluationMessages, recordEvaluationMessage } from "./evaluationMessages";

export type DispatchResult = "sent" | "failed" | "skipped" | "not_configured";

export interface DispatchOptions {
  /** Reenvio manual: ignora o "já enviado" e o liga/desliga do evento. */
  force?: boolean;
}

function hidePricesToClient(raw: string | undefined): boolean {
  try {
    return Boolean(JSON.parse(raw || "{}")?.hidePricesToClient);
  } catch {
    return false;
  }
}

export async function renderCustomerMessage(
  event: AutoMessageEvent,
  evaluation: EvaluationRecord,
  settings: Record<string, string>,
): Promise<string> {
  const config = parseAutoMessages(settings[SETTING_KEYS.autoMessages]);
  const vars = buildTemplateVars({
    evaluation: {
      name: evaluation.name,
      model: evaluation.model,
      storage: evaluation.storage,
      unit: evaluation.unit,
      offeredValue: evaluation.offeredValue,
    },
    sellerName: evaluation.assignedUserName || "Nossa equipe",
    addresses: {
      jardim: settings[SETTING_KEYS.addressJardim] || "",
      gll: settings[SETTING_KEYS.addressGll] || "",
    },
  });
  return renderTemplate(config.events[event].body, vars).trim();
}

let lastNotConfiguredWarning = 0;
function warnNotConfigured(evaluationId: number): void {
  const now = Date.now();
  if (now - lastNotConfiguredWarning < 60 * 60 * 1000) return;
  lastNotConfiguredWarning = now;
  console.warn(
    `[AutoMessages] Evolution API não configurada (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE): avaliação #${evaluationId} ficou sem mensagem automática.`,
  );
}

export async function dispatchCustomerEvent(
  event: AutoMessageEvent,
  evaluationId: number,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  try {
    if (!isEvolutionConfigured()) {
      warnNotConfigured(evaluationId);
      return "not_configured";
    }
    const evaluation = await findEvaluationById(evaluationId);
    if (!evaluation) return "skipped";

    const settings = await getAllSettings();
    const config = parseAutoMessages(settings[SETTING_KEYS.autoMessages]);
    if (!options.force && (!config.customerEnabled || !config.events[event].enabled)) return "skipped";

    // Com preços ocultos ao cliente, nunca enviamos valores automaticamente.
    if (
      !options.force &&
      event === "offered" &&
      hidePricesToClient(settings[SETTING_KEYS.valuationConfig])
    ) {
      return "skipped";
    }
    if (event === "offered" && typeof evaluation.offeredValue !== "number") return "skipped";

    if (!options.force) {
      const history = await listEvaluationMessages(evaluationId);
      const done = history.some((m) => m.event === event && m.recipient === "cliente" && m.status === "sent");
      if (done) return "skipped";
    }

    const body = await renderCustomerMessage(event, evaluation, settings);
    if (!body) return "skipped";

    try {
      await sendEvolutionText(evaluation.whatsapp, body);
      await recordEvaluationMessage({
        evaluationId,
        event,
        recipient: "cliente",
        status: "sent",
        error: null,
        body,
      });
      return "sent";
    } catch (error) {
      await recordEvaluationMessage({
        evaluationId,
        event,
        recipient: "cliente",
        status: "failed",
        error: evolutionShortError(error),
        body,
      });
      return "failed";
    }
  } catch (error) {
    console.error("[AutoMessages] Falha ao despachar mensagem:", {
      event,
      evaluationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }
}

/** Dispara sem esperar (usado na rota pública, para não atrasar a resposta ao cliente). */
export function dispatchCustomerEventInBackground(event: AutoMessageEvent, evaluationId: number): void {
  void dispatchCustomerEvent(event, evaluationId);
}

export function describeEvent(event: AutoMessageEvent): string {
  return AUTO_MESSAGE_EVENT_LABELS[event];
}
