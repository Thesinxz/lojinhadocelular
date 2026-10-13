import { env } from "../lib/env";
import { getPool } from "../queries/connection";
import { STORE_UNITS, type StoreUnit } from "@contracts/permissions";
import { parseAutoMessages, SETTING_KEYS } from "@contracts/types";
import { getAllSettings } from "./settingsStore";
import { isEvolutionConfigured, normalizeBrazilNumber, parseDestinations, sendEvolutionText } from "./evolution";
import { recordEvaluationMessage } from "./evaluationMessages";
import { formatVisit } from "@contracts/visit";

export type EvaluationNotificationStatus = "not_configured" | "sent" | "failed";

export interface EvaluationNotificationInput {
  id: number;
  name: string;
  whatsapp: string;
  model: string;
  storage?: string | null;
  targetModel?: string | null;
  targetDetails?: string | null;
  visitPreference?: string | null;
  photosCount?: number | null;
  /** Loja escolhida pelo cliente (vai só no webhook; o template do Cloud tem parâmetros fixos). */
  unit?: StoreUnit | "" | null;
}

export interface EvaluationNotificationResult {
  status: EvaluationNotificationStatus;
  error?: string;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function shortError(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "Erro desconhecido");
  return text.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function notificationPayload(input: EvaluationNotificationInput) {
  return {
    event: "evaluation.created",
    evaluation: {
      id: input.id,
      name: input.name,
      whatsapp: input.whatsapp,
      model: input.model,
      storage: input.storage || "",
      targetModel: input.targetModel || "",
      targetDetails: input.targetDetails || "",
      visitPreference: input.visitPreference || "",
      visitLabel: formatVisit(input.visitPreference),
      photosCount: input.photosCount || 0,
      unit: input.unit || "",
      unitLabel: STORE_UNITS.find((u) => u.value === input.unit)?.label ?? "",
    },
  };
}

async function postJson(url: string, init: RequestInit): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.ok) return;

    let detail = "";
    try {
      detail = await response.text();
    } catch {}
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWebhook(input: EvaluationNotificationInput): Promise<void> {
  await postJson(env.evaluationNotificationWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notificationPayload(input)),
  });
}

async function sendWhatsAppCloudMessage(input: EvaluationNotificationInput): Promise<void> {
  const phoneNumberId = env.whatsappCloudPhoneNumberId;
  const token = env.whatsappCloudApiToken;
  const destination = onlyDigits(env.whatsappNotificationTo);
  const template = env.whatsappNotificationTemplate;

  if (!phoneNumberId || !token || !destination || !template) {
    throw new Error(
      "WhatsApp Cloud API incompleta: configure token, phone number ID, destinatário e template.",
    );
  }

  const url = `https://graph.facebook.com/${env.whatsappCloudApiVersion}/${phoneNumberId}/messages`;
  await postJson(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: destination,
      type: "template",
      template: {
        name: template,
        language: { code: env.whatsappNotificationLanguage },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: String(input.id) },
              { type: "text", text: input.name },
              { type: "text", text: input.model },
              { type: "text", text: input.whatsapp },
              { type: "text", text: String(input.photosCount || 0) },
            ],
          },
        ],
      },
    }),
  });
}

/** Aviso à equipe pela Evolution API: WhatsApp da unidade escolhida (ou das duas, sem unidade). */
async function sendEvolutionTeamMessage(input: EvaluationNotificationInput): Promise<"sent" | "skipped"> {
  const settings = await getAllSettings();
  if (!parseAutoMessages(settings[SETTING_KEYS.autoMessages]).teamEnabled) return "skipped";

  // Números/grupos próprios da equipe têm prioridade. Sem eles, cai no WhatsApp da unidade, que costuma ser
  // o MESMO número da instância da Evolution (enviar para si mesmo não avisa ninguém).
  const own = parseDestinations(settings[SETTING_KEYS.teamNotifyNumbers]);
  const numbers = {
    jardim: settings[SETTING_KEYS.whatsappJardim],
    gll: settings[SETTING_KEYS.whatsappGll],
  };
  const targets = input.unit === "jardim" || input.unit === "gll" ? [numbers[input.unit]] : [numbers.jardim, numbers.gll];
  const fallback = [...new Set(targets.map((n) => normalizeBrazilNumber(n)).filter((n): n is string => Boolean(n)))];
  const destinations = own.length ? own : fallback;
  if (!destinations.length) throw new Error("Nenhum WhatsApp válido para avisar a equipe. Cadastre os números da equipe em Configurações › Mensagens.");

  const unitLabel = STORE_UNITS.find((u) => u.value === input.unit)?.label;
  const lines = [
    `📱 Nova avaliação #${input.id}`,
    `${input.name} — ${[input.model, input.storage].filter(Boolean).join(" ")}`,
    input.targetModel ? `Quer: ${[input.targetModel, input.targetDetails].filter(Boolean).join(" — ")}` : "",
    unitLabel ? `Loja: ${unitLabel}` : "",
    formatVisit(input.visitPreference) ? `Visita: ${formatVisit(input.visitPreference)}` : "",
    `WhatsApp: ${input.whatsapp}`,
    `Fotos: ${input.photosCount || 0}`,
  ].filter(Boolean);
  const text = lines.join("\n");

  const failures: string[] = [];
  for (const number of destinations) {
    try {
      await sendEvolutionText(number, text);
    } catch (error) {
      failures.push(shortError(error));
    }
  }
  const status = failures.length === destinations.length ? "failed" : "sent";
  await recordEvaluationMessage({
    evaluationId: input.id,
    event: "created",
    recipient: "equipe",
    status,
    error: failures[0] ?? null,
    body: text,
  });
  if (status === "failed") throw new Error(failures[0]);
  return "sent";
}

export function isEvaluationNotificationConfigured(): boolean {
  const webhookConfigured = Boolean(env.evaluationNotificationWebhookUrl);
  const cloudConfigured = Boolean(
    env.whatsappCloudApiToken ||
      env.whatsappCloudPhoneNumberId ||
      env.whatsappNotificationTo ||
      env.whatsappNotificationTemplate,
  );
  return webhookConfigured || isEvolutionConfigured() || cloudConfigured;
}

export async function notifyEvaluationCreated(
  input: EvaluationNotificationInput,
): Promise<EvaluationNotificationResult> {
  const webhookUrl = env.evaluationNotificationWebhookUrl;
  const hasCloudConfig = Boolean(
    env.whatsappCloudApiToken ||
      env.whatsappCloudPhoneNumberId ||
      env.whatsappNotificationTo ||
      env.whatsappNotificationTemplate,
  );

  const hasEvolution = isEvolutionConfigured();

  if (!webhookUrl && !hasEvolution && !hasCloudConfig) {
    return { status: "not_configured" };
  }

  try {
    if (webhookUrl) {
      await sendWebhook(input);
    } else if (hasEvolution) {
      if ((await sendEvolutionTeamMessage(input)) === "skipped") return { status: "not_configured" };
    } else {
      await sendWhatsAppCloudMessage(input);
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: shortError(error) };
  }
}

export async function persistEvaluationNotificationStatus(
  id: number,
  result: EvaluationNotificationResult,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  await pool.query(
    "UPDATE evaluations SET notification_status = ?, notification_error = ?, notified_at = ? WHERE id = ?",
    [
      result.status,
      result.error || null,
      result.status === "sent" ? new Date() : null,
      id,
    ],
  );
}
