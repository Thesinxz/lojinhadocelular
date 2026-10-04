import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
