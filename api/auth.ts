import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "./queries/connection";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { SETTING_KEYS, DEFAULT_SETTINGS } from "../contracts/types";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function secret(): string {
  return process.env.APP_SECRET || "lojinha-secret";
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

  // Permite autenticação tanto com a senha customizada do banco quanto com a senha padrão "lojinha123"
  const targets = Array.from(new Set([storedStr, defaultStr].filter(Boolean)));
  for (const target of targets) {
    const a = Buffer.from(inputStr);
    const b = Buffer.from(target);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
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
