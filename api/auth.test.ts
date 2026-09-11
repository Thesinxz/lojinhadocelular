import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hashPassword,
  verifyPasswordHash,
  createToken,
  verifyToken,
  checkPassword,
  secret,
} from "./auth";
import { SETTING_KEYS } from "../contracts/types";
import { saveSingleSetting } from "./services/settingsStore";

describe("Segurança de Autenticação", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("deve hashear e verificar senhas corretamente com scrypt", () => {
    const plain = "minha-senha-secreta-123";
    const hashed = hashPassword(plain);

    expect(hashed).toContain("scrypt:");
    expect(verifyPasswordHash(plain, hashed)).toBe(true);
    expect(verifyPasswordHash("senha-incorreta", hashed)).toBe(false);
  });

  it("deve criar e validar tokens admin", () => {
    const token = createToken();
    expect(typeof token).toBe("string");
    expect(verifyToken(token)).toBe(true);
    expect(verifyToken("token-invalido-forjado")).toBe(false);
  });

  it("deve bloquear senhas antigas/backdoors ('admin', 'lojinha123') quando uma nova senha for definida", async () => {
    const novaSenha = "NovaSenhaForte@2026";
    const novoHash = hashPassword(novaSenha);
    await saveSingleSetting(SETTING_KEYS.adminPassword, novoHash);

    // Senha correta deve autenticar
    const ok = await checkPassword(novaSenha);
    expect(ok).toBe(true);

    // Backdoors estáticos anteriores devem ser expressamente rejeitados
    expect(await checkPassword("admin")).toBe(false);
    expect(await checkPassword("lojinha123")).toBe(false);
    expect(await checkPassword("qualquer-outra")).toBe(false);
  });

  it("deve exigir APP_SECRET com no mínimo 32 caracteres em produção", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_SECRET;

    // Sem APP_SECRET deve lançar erro fatal
    expect(() => secret()).toThrow(/APP_SECRET obrigatório/i);

    // Com APP_SECRET fraco (< 32 caracteres) deve lançar erro fatal
    process.env.APP_SECRET = "chave-muito-curta";
    expect(() => secret()).toThrow(/no mínimo 32 caracteres/i);

    // Com APP_SECRET seguro (>= 32 caracteres) deve funcionar
    process.env.APP_SECRET = "chave-de-producao-super-segura-com-mais-de-32-caracteres";
    expect(secret()).toBe(process.env.APP_SECRET);
  });
});
