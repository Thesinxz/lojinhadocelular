/**
 * Cliente mínimo da Evolution API (WhatsApp).
 * Envio de texto e verificação do estado da instância.
 */
import { env } from "../lib/env";
import { normalizeBrazilPhone } from "../../contracts/brDocs";

export function isEvolutionConfigured(): boolean {
  return Boolean(env.evolutionApiUrl && env.evolutionApiKey && env.evolutionInstance);
}

/** Lista de destinos (telefones ou grupos "…@g.us"), separados por vírgula, ponto e vírgula ou linha. */
export function parseDestinations(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  for (const part of String(raw ?? "").split(/[\n,;]+/)) {
    const normalized = normalizeBrazilNumber(part);
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

/** Normaliza para 55 + DDD + número (ou mantém o ID de um grupo); `null` quando não parece válido. */
export function normalizeBrazilNumber(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (/^[\d-]{10,}@g\.us$/.test(trimmed)) return trimmed; // grupo do WhatsApp
  return normalizeBrazilPhone(trimmed);
}

function shortError(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "Erro desconhecido");
  return text.replace(/[\r\n]+/g, " ").slice(0, 500);
}

/** Traduz a resposta de número inexistente da Evolution, inclusive em registros antigos. */
export function friendlyEvolutionError(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "");
  const body = text.match(/^HTTP \d+\s*:\s*(\{.*\})$/)?.[1];
  if (body) {
    try {
      const parsed = JSON.parse(body) as {
        response?: { message?: { exists?: boolean }[] };
      };
      if (parsed.response?.message?.some((item) => item.exists === false)) {
        return "O WhatsApp não reconhece este número. Confira o DDD e o número cadastrado e tente enviar novamente.";
      }
    } catch {
      // Mantém a mensagem original quando a resposta não for JSON válido.
    }
  }
  return text;
}

async function evolutionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${env.evolutionApiUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", apikey: env.evolutionApiKey, ...init.headers },
      signal: controller.signal,
    });
    if (response.ok) return response;
    let detail = "";
    try {
      detail = await response.text();
    } catch {}
    const error = `HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`;
    throw new Error(friendlyEvolutionError(error));
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendEvolutionText(number: string, text: string): Promise<void> {
  if (!isEvolutionConfigured()) throw new Error("Evolution API não configurada.");
  const normalized = normalizeBrazilNumber(number);
  if (!normalized) throw new Error("Número de WhatsApp inválido.");
  await evolutionFetch(`/message/sendText/${encodeURIComponent(env.evolutionInstance)}`, {
    method: "POST",
    body: JSON.stringify({ number: normalized, text }),
  });
}

export interface EvolutionStatus {
  configured: boolean;
  /** `open` = conectado ao WhatsApp. */
  state: string;
  connected: boolean;
  error?: string;
}

export async function getEvolutionStatus(): Promise<EvolutionStatus> {
  if (!isEvolutionConfigured()) return { configured: false, state: "not_configured", connected: false };
  try {
    const response = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(env.evolutionInstance)}`);
    const data = (await response.json()) as { instance?: { state?: string }; state?: string };
    const state = String(data?.instance?.state ?? data?.state ?? "unknown");
    return { configured: true, state, connected: state === "open" };
  } catch (error) {
    return { configured: true, state: "error", connected: false, error: shortError(error) };
  }
}

export { shortError as evolutionShortError };
