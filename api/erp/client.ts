/**
 * Cliente autenticado do ERP Gestão Celular (usuário de serviço).
 * Login por e-mail/senha → JWT, guardado em memória até perto de vencer.
 * Só é usado para operações de escrita iniciadas por uma pessoa no painel.
 */
import { env } from "../lib/env";

const TIMEOUT_MS = 20_000;
const FALLBACK_TOKEN_TTL_MS = 10 * 60 * 1000;
const EXPIRY_MARGIN_MS = 30_000;

export function isErpServiceConfigured(): boolean {
  return Boolean(env.erpServiceEmail && env.erpServicePassword);
}

export class ErpApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

let cached: { token: string; expiresAt: number } | null = null;
let loginInFlight: Promise<string> | null = null;

export function resetErpClientForTesting(): void {
  cached = null;
  loginInFlight = null;
}

function baseUrl(): string {
  return (env.erpApiUrl || "https://api.gestaocelular.com.br").replace(/\/+$/, "");
}

function shortMessage(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? "Erro desconhecido");
  return text.replace(/[\r\n]+/g, " ").slice(0, 300);
}

async function fetchJson(path: string, init: RequestInit): Promise<{ status: number; ok: boolean; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers },
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, ok: res.ok, body };
  } catch (err) {
    throw new ErpApiError(err instanceof Error && err.name === "AbortError" ? "ERP não respondeu a tempo" : shortMessage(err));
  } finally {
    clearTimeout(timer);
  }
}

function pickString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

/** O formato da resposta do login não é tipado no Swagger: procura o token nos lugares usuais. */
export function extractToken(body: unknown): string | null {
  const keys = ["access_token", "accessToken", "token", "jwt"];
  const direct = pickString(body, keys);
  if (direct) return direct;
  const record = body as Record<string, unknown> | null;
  for (const holder of [record?.data, record?.tokens, (record?.data as Record<string, unknown> | undefined)?.tokens]) {
    const found = pickString(holder, keys);
    if (found) return found;
  }
  return null;
}

function tokenExpiry(token: string, now: number): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: number };
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    // Token opaco: usa o prazo padrão.
  }
  return now + FALLBACK_TOKEN_TTL_MS;
}

async function login(): Promise<string> {
  if (!isErpServiceConfigured()) throw new ErpApiError("Usuário de serviço do ERP não configurado.");
  const res = await fetchJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: env.erpServiceEmail, senha: env.erpServicePassword, lembrar_me: false }),
  });
  if (!res.ok) {
    throw new ErpApiError(
      res.status === 401 || res.status === 400 ? "O ERP recusou o usuário de serviço (confira e-mail e senha)." : `Login no ERP falhou (HTTP ${res.status}).`,
      res.status,
    );
  }
  const token = extractToken(res.body);
  if (!token) throw new ErpApiError("O ERP respondeu ao login sem um token reconhecível.");
  cached = { token, expiresAt: tokenExpiry(token, Date.now()) };
  return token;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cached.token;
  loginInFlight ??= login().finally(() => {
    loginInFlight = null;
  });
  return loginInFlight;
}

/** Chamada autenticada. Se o token foi recusado, entra de novo uma única vez. */
export async function erpRequest(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const call = async (token: string) =>
    fetchJson(path, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}` },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  let res = await call(await getToken());
  if (res.status === 401) res = await call(await getToken(true));
  if (!res.ok) {
    const message = pickString(res.body, ["message", "error"]) ?? (Array.isArray((res.body as { message?: unknown })?.message) ? String((res.body as { message: unknown[] }).message[0]) : null);
    throw new ErpApiError(message ? `ERP: ${shortMessage(message)}` : `ERP respondeu HTTP ${res.status}`, res.status);
  }
  return res.body;
}

export interface ErpServiceStatus {
  configured: boolean;
  connected: boolean;
  error?: string;
}

/** Testa o login do usuário de serviço (não cria nada). */
export async function getErpServiceStatus(): Promise<ErpServiceStatus> {
  if (!isErpServiceConfigured()) return { configured: false, connected: false };
  try {
    await getToken(true);
    return { configured: true, connected: true };
  } catch (err) {
    return { configured: true, connected: false, error: shortMessage(err) };
  }
}

export interface ErpUnit {
  id: string;
  nome: string;
  cidade: string;
}

/** Unidades do ERP, lidas da configuração pública do trade-in (sem login). */
export async function listErpUnits(): Promise<ErpUnit[]> {
  const slug = encodeURIComponent(env.erpStoreSlug);
  const res = await fetchJson(`/api/trade-in/public/${slug}/config`, { method: "GET" });
  const units = (res.body as { data?: { units?: unknown } } | null)?.data?.units;
  if (!res.ok || !Array.isArray(units)) return [];
  return units
    .filter((u): u is Record<string, unknown> => Boolean(u) && typeof u === "object")
    .map((u) => ({ id: String(u.id ?? ""), nome: String(u.nome ?? ""), cidade: String(u.cidade ?? "") }))
    .filter((u) => u.id);
}

function norm(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** ID da unidade no ERP para a loja do site: variável de ambiente ou casamento pelo nome/cidade. */
export async function resolveErpUnitId(unit: "jardim" | "gll"): Promise<string | null> {
  const configured = unit === "jardim" ? env.erpUnitIdJardim : env.erpUnitIdGll;
  if (configured) return configured;
  const units = await listErpUnits();
  const wanted = unit === "jardim" ? "jardim" : "guia lopes";
  const match = units.find((u) => norm(u.cidade).includes(wanted) || norm(u.nome).includes(wanted));
  return match?.id ?? null;
}
