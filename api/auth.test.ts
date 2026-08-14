import { describe, it, expect } from "vitest";
import { hashPassword, verifyPasswordHash, createToken, verifyToken } from "./auth";

describe("Segurança de Autenticação", () => {
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
});
