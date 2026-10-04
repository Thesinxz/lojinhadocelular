import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hashPassword,
  verifyPasswordHash,
  createToken,
  verifyToken,
  secret,
  tokenFromRequest,
} from "./auth";

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

  it("deve criar e validar tokens admin por usuário (v2)", () => {
    const token = createToken(7);
    expect(typeof token).toBe("string");
    expect(verifyToken(token)).toEqual({ userId: 7 });
    expect(verifyToken("token-invalido-forjado")).toBeNull();
  });

  it("deve extrair o token Bearer do cabeçalho Authorization", () => {
    const req = new Request("http://localhost", { headers: { authorization: "Bearer abc.def" } });
    expect(tokenFromRequest(req)).toBe("abc.def");
    expect(tokenFromRequest(new Request("http://localhost"))).toBeNull();
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
