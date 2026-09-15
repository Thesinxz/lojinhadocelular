import { env } from "../lib/env";
import { getPool } from "../queries/connection";

export type EvaluationNotificationStatus = "not_configured" | "sent" | "failed";

export interface EvaluationNotificationInput {
  id: number;
  name: string;
  whatsapp: string;
  model: string;
  storage?: string | null;
  targetModel?: string | null;
  photosCount?: number | null;
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
      photosCount: input.photosCount || 0,
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

export function isEvaluationNotificationConfigured(): boolean {
  const webhookConfigured = Boolean(env.evaluationNotificationWebhookUrl);
  const cloudConfigured = Boolean(
    env.whatsappCloudApiToken ||
      env.whatsappCloudPhoneNumberId ||
      env.whatsappNotificationTo ||
      env.whatsappNotificationTemplate,
  );
  return webhookConfigured || cloudConfigured;
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

  if (!webhookUrl && !hasCloudConfig) {
    return { status: "not_configured" };
  }

  try {
    if (webhookUrl) {
      await sendWebhook(input);
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
