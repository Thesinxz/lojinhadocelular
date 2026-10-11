/**
 * Cliente mínimo da Evolution API (WhatsApp).
 * Envio de texto e verificação do estado da instância.
 */
import { env } from "../lib/env";

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
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
}

function shortError(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "Erro desconhecido");
  return text.replace(/[\r\n]+/g, " ").slice(0, 500);
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
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
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
