/**
 * Notificação push (Web Push) para o painel: avisa os atendentes de uma avaliação nova mesmo com o painel fechado.
 * Precisa de chaves VAPID no ambiente (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e, opcionalmente, VAPID_SUBJECT);
 * sem elas o recurso fica desligado e nada quebra. Sem DATABASE_URL (ou em testes) guarda em memória.
 */
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { can } from "@contracts/permissions";
import { pushSubscriptions } from "@db/schema";
import { ensureTables, getDb } from "../queries/connection";
import { getUserById } from "./userStore";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface StoredPushSubscription extends PushSubscriptionInput {
  id: number;
  userId: number;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Caminho aberto ao clicar na notificação. */
  url: string;
  tag: string;
}

/** Função que entrega a mensagem ao serviço push do navegador (injetável nos testes). */
export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) => Promise<unknown>;

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return isPushConfigured() ? (process.env.VAPID_PUBLIC_KEY as string) : null;
}

let memoryRows: StoredPushSubscription[] = [];
let memoryNextId = 1;

export function resetPushSubscriptionsForTesting(): void {
  memoryRows = [];
  memoryNextId = 1;
}

function hashEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

/** Só aceita endpoints https de serviços push (evita usar o servidor para chamar endereços internos). */
export function isValidPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.hostname.includes(".") && endpoint.length <= 2000;
  } catch {
    return false;
  }
}

export async function saveSubscription(
  userId: number,
  input: PushSubscriptionInput,
  userAgent = "",
): Promise<void> {
  if (isMemoryMode()) {
    memoryRows = memoryRows.filter((row) => row.endpoint !== input.endpoint);
    memoryRows.push({ id: memoryNextId++, userId, ...input });
    return;
  }
  const db = getDb();
  await ensureTables();
  const values = {
    userId,
    endpointHash: hashEndpoint(input.endpoint),
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: userAgent.slice(0, 255),
  };
  // O mesmo navegador pode passar de um usuário para outro: a inscrição passa a valer para quem entrou por último.
  await db
    .insert(pushSubscriptions)
    .values(values)
    .onDuplicateKeyUpdate({ set: { userId, p256dh: values.p256dh, auth: values.auth, userAgent: values.userAgent } });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  if (isMemoryMode()) {
    memoryRows = memoryRows.filter((row) => row.endpoint !== endpoint);
    return;
  }
  const db = getDb();
  await ensureTables();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpointHash, hashEndpoint(endpoint)));
}

export async function listSubscriptions(): Promise<StoredPushSubscription[]> {
  if (isMemoryMode()) return memoryRows.map((row) => ({ ...row }));
  const db = getDb();
  await ensureTables();
  const rows = await db.select().from(pushSubscriptions);
  return rows.map((r) => ({ id: Number(r.id), userId: r.userId, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }));
}

let vapidConfigured = false;

function defaultSender(): PushSender {
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contato@lojinhadocelular.com",
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
    vapidConfigured = true;
  }
  return (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 6, urgency: "high" });
}

/**
 * Envia o aviso para os atendentes que podem ver avaliações (e atendem aquela loja).
 * Nunca lança erro: falha de push não pode atrapalhar o cadastro da avaliação.
 * Devolve quantos avisos foram aceitos pelo serviço push.
 */
export async function sendPushToEvaluationStaff(
  evaluation: { unit?: string | null },
  payload: PushPayload,
  sender?: PushSender,
): Promise<number> {
  if (!sender && !isPushConfigured()) {
    console.warn("[Push] Desligado: faltam VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no ambiente.");
    return 0;
  }
  try {
    const subscriptions = await listSubscriptions();
    if (subscriptions.length === 0) {
      console.warn("[Push] Nenhum navegador inscrito (ligue o sino no painel).");
      return 0;
    }
    const send = sender ?? defaultSender();
    const body = JSON.stringify(payload);
    const userCache = new Map<number, Awaited<ReturnType<typeof getUserById>>>();
    let delivered = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          if (!userCache.has(sub.userId)) userCache.set(sub.userId, await getUserById(sub.userId));
          const user = userCache.get(sub.userId);
          if (!user || !user.active || !can(user, "evaluations.manage")) return;
          if (user.unit && evaluation.unit && user.unit !== evaluation.unit) return;
          await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
          delivered += 1;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          // 404/410: o navegador cancelou a inscrição. Remove para não tentar de novo.
          if (status === 404 || status === 410) await removeSubscription(sub.endpoint).catch(() => {});
          else console.error("[Push] Falha ao enviar notificação:", status ?? (err instanceof Error ? err.message : err));
        }
      }),
    );
    console.info(`[Push] ${delivered}/${subscriptions.length} aviso(s) aceito(s) pelo serviço push.`);
    return delivered;
  } catch (err) {
    console.error("[Push] Falha ao preparar notificações:", err instanceof Error ? err.message : err);
    return 0;
  }
}
