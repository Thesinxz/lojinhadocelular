import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import { SETTING_KEYS } from "@contracts/types";
import type { SessionUser } from "@contracts/permissions";
import { saveSingleSetting } from "./services/settingsStore";
import {
  createUser,
  ensureBootstrapOwner,
  getUserById,
  getUserByUsername,
  listUsers,
  resetUserStoreForTesting,
  setUserPassword,
  toSessionUser,
  touchLastLogin,
  updateUser,
} from "./services/userStore";
import {
  authenticate,
  checkLoginRateLimit,
  createToken,
  getSessionUser,
  hashPassword,
  resetLoginRateLimitForTesting,
  secret,
  verifyPasswordHash,
  verifyToken,
} from "./auth";

const SETTINGS_FILE = path.resolve(process.cwd(), "db", "settings.json");
let originalSettingsFile: string | null = null;

beforeAll(() => {
  originalSettingsFile = fs.existsSync(SETTINGS_FILE) ? fs.readFileSync(SETTINGS_FILE, "utf-8") : null;
});

afterAll(() => {
  // Os testes gravam admin_password no arquivo local; restaura o estado original.
  if (originalSettingsFile === null) {
    fs.rmSync(SETTINGS_FILE, { force: true });
  } else {
    fs.writeFileSync(SETTINGS_FILE, originalSettingsFile, "utf-8");
  }
});

beforeEach(() => {
  resetUserStoreForTesting();
  resetLoginRateLimitForTesting();
});

function requestWithToken(token: string | null): Request {
  return new Request("http://localhost/api/trpc/admin.me", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function makeOwner(): Promise<SessionUser> {
  return toSessionUser(
    await createUser({
      username: "chefe",
      name: "Chefe",
      password: "senha-do-chefe",
      role: "dono",
      unit: null,
      canEditPrices: false,
    }),
  );
}

describe("bootstrap do dono", () => {
  it("cria o usuário dono reaproveitando o hash scrypt da senha antiga", async () => {
    const hashed = hashPassword("SenhaAntiga@2026");
    await saveSingleSetting(SETTING_KEYS.adminPassword, hashed);

    await ensureBootstrapOwner();
    const users = await listUsers();
    expect(users).toHaveLength(1);
    const owner = users[0];
    expect(owner.username).toBe("dono");
    expect(owner.name).toBe("Dono");
    expect(owner.role).toBe("dono");
    expect(owner.unit).toBeNull();
    expect(owner.active).toBe(true);
    expect(owner.passwordHash).toBe(hashed);

    expect(await authenticate("dono", "SenhaAntiga@2026")).not.toBeNull();
    // Backdoors / senha padrão não funcionam depois que uma senha foi definida
    expect(await authenticate("dono", "lojinha123")).toBeNull();
    expect(await authenticate("dono", "admin")).toBeNull();
  });

  it("faz hash quando a senha antiga está em texto", async () => {
    await saveSingleSetting(SETTING_KEYS.adminPassword, "texto-puro-123");

    await ensureBootstrapOwner();
    const owner = await getUserByUsername("dono");
    expect(owner?.passwordHash.startsWith("scrypt:")).toBe(true);
    expect(verifyPasswordHash("texto-puro-123", owner!.passwordHash)).toBe(true);
  });

  it("não cria um segundo dono se já houver usuários", async () => {
    await makeOwner();
    await ensureBootstrapOwner();
    await ensureBootstrapOwner();
    const users = await listUsers();
    expect(users.map((u) => u.username)).toEqual(["chefe"]);
  });

  it("authenticate faz o bootstrap automaticamente", async () => {
    await saveSingleSetting(SETTING_KEYS.adminPassword, hashPassword("auto-boot-1"));
    const user = await authenticate("DONO ", "auto-boot-1");
    expect(user?.username).toBe("dono");
  });
});

describe("authenticate", () => {
  it("aceita a senha correta e rejeita a errada", async () => {
    await makeOwner();
    const ok = await authenticate("chefe", "senha-do-chefe");
    expect(ok?.username).toBe("chefe");
    expect(await authenticate("chefe", "errada")).toBeNull();
    expect(await authenticate("ninguem", "senha-do-chefe")).toBeNull();
    expect(await authenticate("chefe", "")).toBeNull();
  });

  it("rejeita usuário inativo", async () => {
    const owner = await makeOwner();
    const seller = await createUser({
      username: "bia",
      name: "Bia",
      password: "senha-da-bia",
      role: "vendedor",
      unit: "gll",
      canEditPrices: false,
    });
    await updateUser(owner, seller.id, { active: false });
    expect(await authenticate("bia", "senha-da-bia")).toBeNull();
  });

  it("setUserPassword troca a senha", async () => {
    const owner = await makeOwner();
    await setUserPassword(owner.id, "nova-senha-9");
    expect(await authenticate("chefe", "senha-do-chefe")).toBeNull();
    expect(await authenticate("chefe", "nova-senha-9")).not.toBeNull();
  });

  it("touchLastLogin registra o último acesso", async () => {
    const owner = await makeOwner();
    expect((await getUserById(owner.id))?.lastLoginAt).toBeNull();
    await touchLastLogin(owner.id);
    expect((await getUserById(owner.id))?.lastLoginAt).toBeInstanceOf(Date);
  });
});

describe("token v2", () => {
  it("createToken → verifyToken devolve o id do usuário", () => {
    const token = createToken(42);
    expect(verifyToken(token)).toEqual({ userId: 42 });
  });

  it("rejeita token adulterado", () => {
    const token = createToken(42);
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const forged = Buffer.from(decoded.replace("v2.42.", "v2.1.")).toString("base64url");
    expect(verifyToken(forged)).toBeNull();
    expect(verifyToken("token-invalido-forjado")).toBeNull();
    expect(verifyToken("")).toBeNull();
  });

  it("rejeita token expirado", () => {
    expect(verifyToken(createToken(42, -1))).toBeNull();
  });

  it("rejeita token legado admin.<exp>.<sig>", () => {
    const payload = `admin.${Date.now() + 60_000}`;
    const sig = createHmac("sha256", secret()).update(payload).digest("hex");
    const legacy = Buffer.from(`${payload}.${sig}`).toString("base64url");
    expect(verifyToken(legacy)).toBeNull();
  });

  it("getSessionUser recarrega o usuário a cada requisição", async () => {
    const owner = await makeOwner();
    const seller = await createUser({
      username: "caio",
      name: "Caio",
      password: "senha-do-caio",
      role: "vendedor",
      unit: "jardim",
      canEditPrices: false,
    });
    const token = createToken(seller.id);

    expect(await getSessionUser(requestWithToken(token))).toEqual({
      id: seller.id,
      username: "caio",
      name: "Caio",
      role: "vendedor",
      unit: "jardim",
      canEditPrices: false,
    });

    await updateUser(owner, seller.id, { canEditPrices: true });
    expect((await getSessionUser(requestWithToken(token)))?.canEditPrices).toBe(true);

    await updateUser(owner, seller.id, { active: false });
    expect(await getSessionUser(requestWithToken(token))).toBeNull();

    expect(await getSessionUser(requestWithToken(createToken(9999)))).toBeNull();
    expect(await getSessionUser(requestWithToken(null))).toBeNull();
  });
});

describe("regras de usuários", () => {
  it("rejeita username duplicado (sem diferenciar maiúsculas)", async () => {
    await makeOwner();
    await expect(
      createUser({
        username: "Chefe",
        name: "Outro",
        password: "123456",
        role: "vendedor",
        unit: null,
        canEditPrices: false,
      }),
    ).rejects.toThrow(/já existe/i);
  });

  it("rejeita username e senha inválidos", async () => {
    const base = { name: "X", role: "vendedor" as const, unit: null, canEditPrices: false };
    await expect(createUser({ ...base, username: "ab", password: "123456" })).rejects.toThrow();
    await expect(createUser({ ...base, username: "com espaço", password: "123456" })).rejects.toThrow();
    await expect(createUser({ ...base, username: "valido", password: "123" })).rejects.toThrow();
  });

  it("normaliza o username para minúsculo", async () => {
    const user = await createUser({
      username: "  Joao.Silva ",
      name: "João",
      password: "123456",
      role: "vendedor",
      unit: "gll",
      canEditPrices: true,
    });
    expect(user.username).toBe("joao.silva");
    expect(user.canEditPrices).toBe(true);
  });

  it("impede remover o último dono ativo", async () => {
    const owner = await makeOwner();
    const other = toSessionUser(
      await createUser({
        username: "socio",
        name: "Sócio",
        password: "123456",
        role: "dono",
        unit: null,
        canEditPrices: false,
      }),
    );
    // Com dois donos, um pode rebaixar o outro
    await updateUser(owner, other.id, { role: "vendedor" });
    // Agora o único dono ativo não pode ser rebaixado/desativado por ninguém
    await expect(updateUser(other, owner.id, { role: "vendedor" })).rejects.toThrow(/dono ativo/i);
    await expect(updateUser(other, owner.id, { active: false })).rejects.toThrow(/dono ativo/i);
  });

  it("impede desativar ou rebaixar a si mesmo", async () => {
    const owner = await makeOwner();
    await createUser({
      username: "socio",
      name: "Sócio",
      password: "123456",
      role: "dono",
      unit: null,
      canEditPrices: false,
    });
    await expect(updateUser(owner, owner.id, { active: false })).rejects.toThrow(/si mesmo/i);
    await expect(updateUser(owner, owner.id, { role: "vendedor" })).rejects.toThrow(/si mesmo/i);
    // Outras alterações em si mesmo são permitidas
    const updated = await updateUser(owner, owner.id, { name: "Chefe Novo" });
    expect(updated.name).toBe("Chefe Novo");
  });

  it("updateUser em id inexistente falha", async () => {
    const owner = await makeOwner();
    await expect(updateUser(owner, 999, { name: "X" })).rejects.toThrow(/não encontrado/i);
  });
});

describe("rate limit de login", () => {
  it("bloqueia na 11ª tentativa e isola por chave", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkLoginRateLimit("1.2.3.4|dono")).toBe(true);
    }
    expect(checkLoginRateLimit("1.2.3.4|dono")).toBe(false);
    expect(checkLoginRateLimit("1.2.3.4|ana")).toBe(true);
  });
});
