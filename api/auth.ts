import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@contracts/permissions";
import { getSingleSetting } from "./services/settingsStore";
import {
  ensureBootstrapOwner,
  getUserById,
  getUserByUsername,
  toSessionUser,
  type AdminUserRecord,
} from "./services/userStore";
import { hashPassword, verifyPasswordHash } from "./lib/password";

export { hashPassword, verifyPasswordHash };

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
const TOKEN_VERSION = "v2";

export function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[FATAL SECURITY] APP_SECRET obrigatório em ambiente de produção com no mínimo 32 caracteres.",
      );
    }
    return "lojinha-secret-key-32-chars-min-dev-only";
  }
  if (process.env.NODE_ENV === "production" && s.length < 32) {
    throw new Error(
      "[FATAL SECURITY] APP_SECRET em produção deve conter no mínimo 32 caracteres.",
    );
  }
  return s;
}

export async function getSetting(key: string): Promise<string> {
  return await getSingleSetting(key);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Token por usuário: base64url(`v2.<userId>.<exp>.<hmac>`). */
export function createToken(userId: number, ttlMs: number = TOKEN_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = `${TOKEN_VERSION}.${userId}.${exp}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
}

export function verifyToken(token: string): { userId: number } | null {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return null;
    const [version, idStr, expStr, sig] = parts;
    if (version !== TOKEN_VERSION || !/^\d+$/.test(idStr) || !/^\d+$/.test(expStr) || !sig) return null;
    const expected = sign(`${version}.${idStr}.${expStr}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Number(expStr) < Date.now()) return null;
    const userId = Number(idStr);
    return Number.isSafeInteger(userId) && userId > 0 ? { userId } : null;
  } catch {
    return null;
  }
}

export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// Hash fixo usado para equalizar o tempo de resposta quando o usuário não existe.
let dummyHash: string | null = null;

/** Valida usuário + senha. Faz o bootstrap do dono e rejeita usuários inativos. */
export async function authenticate(username: string, password: string): Promise<AdminUserRecord | null> {
  await ensureBootstrapOwner();
  const pass = password || "";
  const user = await getUserByUsername(username);
  if (!user || !user.active || !pass) {
    dummyHash ??= hashPassword("senha-inexistente");
    verifyPasswordHash(pass || "x", dummyHash);
    return null;
  }
  return verifyPasswordHash(pass, user.passwordHash) ? user : null;
}

/** Valida o token e recarrega o usuário do store (inativo/inexistente → null). */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const token = tokenFromRequest(req);
  if (!token) return null;
  const parsed = verifyToken(token);
  if (!parsed) return null;
  const user = await getUserById(parsed.userId);
  if (!user || !user.active) return null;
  return toSessionUser(user);
}

// ===== Rate limit de login (10 tentativas / 15 min por IP+usuário) =====
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

/** Registra uma tentativa; retorna `false` quando o limite foi excedido. */
export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (record && record.resetTime > now) {
    if (record.count >= LOGIN_MAX_ATTEMPTS) return false;
    record.count += 1;
  } else {
    loginAttempts.set(key, { count: 1, resetTime: now + LOGIN_WINDOW_MS });
  }
  if (loginAttempts.size > 5000) {
    for (const [k, v] of loginAttempts.entries()) {
      if (v.resetTime < now) loginAttempts.delete(k);
    }
  }
  return true;
}

/** Limpa as tentativas de uma chave (após login bem-sucedido). */
export function clearLoginRateLimit(key: string): void {
  loginAttempts.delete(key);
}

export function resetLoginRateLimitForTesting(): void {
  loginAttempts.clear();
}

export function clientIpFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown-client"
  );
}
