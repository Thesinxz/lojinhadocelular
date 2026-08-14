import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "node:crypto";
import { getDb } from "./queries/connection";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { SETTING_KEYS, DEFAULT_SETTINGS } from "../contracts/types";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    console.warn("[WARN] APP_SECRET não definido em produção. Usando chave de sessão temporária.");
  }
  return s || "lojinha-secret-key-32-chars-min-prod-safe";
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPasswordHash(plain: string, stored: string): boolean {
  if (!plain || !stored) return false;
  try {
    if (stored.startsWith("scrypt:")) {
      const [, salt, hash] = stored.split(":");
      if (!salt || !hash) return false;
      const derived = scryptSync(plain, salt, 64).toString("hex");
      const a = Buffer.from(derived);
      const b = Buffer.from(hash);
      return a.length === b.length && timingSafeEqual(a, b);
    }
    // Suporte para comparação segura caso a senha antiga ainda esteja em texto no banco
    const a = Buffer.from(plain);
    const b = Buffer.from(stored);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function getSetting(key: string): Promise<string> {
  try {
    const db = getDb();
    const rows = await db.select().from(settings).where(eq(settings.key, key));
    if (rows.length > 0 && rows[0].value != null) return rows[0].value;
  } catch {
    // Se o banco não estiver disponível, usa as configurações padrão
  }
  return DEFAULT_SETTINGS[key] ?? "";
}

export async function checkPassword(password: string): Promise<boolean> {
  const inputStr = (password || "").trim();
  if (!inputStr) return false;

  const stored = await getSetting(SETTING_KEYS.adminPassword);
  const storedStr = (stored || "").trim();
  const defaultStr = (DEFAULT_SETTINGS[SETTING_KEYS.adminPassword] || "lojinha123").trim();

  // Se houver senha salva no banco, valida EXCLUSIVAMENTE contra ela
  if (storedStr) {
    return verifyPasswordHash(inputStr, storedStr);
  }

  // Fallback apenas no primeiro boot antes de qualquer senha ser cadastrada
  return verifyPasswordHash(inputStr, defaultStr);
}

export function createToken(): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `admin.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [role, expStr, sig] = decoded.split(".");
    if (role !== "admin" || !expStr || !sig) return false;
    if (Number(expStr) < Date.now()) return false;
    const expected = createHmac("sha256", secret())
      .update(`${role}.${expStr}`)
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
