import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// Evita gravar db/erp_overrides.json (arquivo versionado) durante os testes.
const saveErpOverrideMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./erp/overrides", async (importOriginal) => {
  const original = await importOriginal<typeof import("./erp/overrides")>();
  return { ...original, saveErpOverride: saveErpOverrideMock };
});

import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting, type AdminUserRecord } from "./services/userStore";
import { listAudit, logAction, resetAuditLogForTesting } from "./services/auditLog";
import { setMemoryOverridesForTesting } from "./erp/overrides";
import { clearErpCache, setErpCacheForTesting } from "./erp/service";
import type { ShopProduct } from "./erp/types";
import { env } from "./lib/env";

const originalErpEnabled = env.erpCatalogEnabled;
const originalErpSlug = env.erpStoreSlug;

afterAll(() => {
  env.erpCatalogEnabled = originalErpEnabled;
  env.erpStoreSlug = originalErpSlug;
  clearErpCache();
});

function callerFor(token: string | null, ip = "203.0.113.10") {
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  if (token) headers.authorization = `Bearer ${token}`;
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers }),
    resHeaders: new Headers(),
  });
}

async function expectTrpcError(promise: Promise<unknown>, code: TRPCError["code"]) {
  try {
    await promise;
    expect.unreachable(`esperava erro ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe(code);
    return err as TRPCError;
  }
}

let owner: AdminUserRecord;
let seller: AdminUserRecord;
let ownerToken: string;
let sellerToken: string;

beforeEach(async () => {
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  saveErpOverrideMock.mockClear();
  setMemoryOverridesForTesting({});
  env.erpCatalogEnabled = false;
  clearErpCache();

  owner = await createUser({
    username: "chefe",
    name: "Chefe",
    password: "senha-do-chefe",
    role: "dono",
    unit: null,
    canEditPrices: false,
  });
  seller = await createUser({
    username: "ana",
    name: "Ana",
    password: "senha-da-ana",
    role: "vendedor",
    unit: "jardim",
    canEditPrices: false,
  });
  ownerToken = createToken(owner.id);
  sellerToken = createToken(seller.id);
});

describe("sessão", () => {
  it("sem token → UNAUTHORIZED", async () => {
    await expectTrpcError(callerFor(null).admin.products(), "UNAUTHORIZED");
    await expectTrpcError(callerFor(null).admin.me(), "UNAUTHORIZED");
    await expectTrpcError(callerFor("lixo").admin.evaluationSummary(), "UNAUTHORIZED");
  });

  it("login devolve token utilizável em me e registra no histórico", async () => {
    const res = await callerFor(null).admin.login({ username: "Ana", password: "senha-da-ana" });
    expect(res.user).toEqual({
      id: seller.id,
      username: "ana",
      name: "Ana",
      role: "vendedor",
      unit: "jardim",
      canEditPrices: false,
    });
    const me = await callerFor(res.token).admin.me();
    expect(me.username).toBe("ana");
    expect(me).not.toHaveProperty("passwordHash");

    const audit = await listAudit({});
    expect(audit[0]).toMatchObject({ action: "auth.login", userId: seller.id, entityType: "user" });
  });

  it("login com senha errada → UNAUTHORIZED", async () => {
    await expectTrpcError(
      callerFor(null).admin.login({ username: "ana", password: "errada" }),
      "UNAUTHORIZED",
    );
  });

  it("rate limit bloqueia na 11ª tentativa por IP+usuário", async () => {
    const caller = callerFor(null, "198.51.100.7");
    for (let i = 0; i < 10; i++) {
      await expectTrpcError(caller.admin.login({ username: "ana", password: "errada" }), "UNAUTHORIZED");
    }
    await expectTrpcError(
      caller.admin.login({ username: "ana", password: "senha-da-ana" }),
      "TOO_MANY_REQUESTS",
    );
    // Outro usuário no mesmo IP continua liberado
    const ok = await caller.admin.login({ username: "chefe", password: "senha-do-chefe" });
    expect(ok.token).toBeTruthy();
  });

  it("changeOwnPassword exige a senha atual", async () => {
    const caller = callerFor(sellerToken);
    await expectTrpcError(
      caller.admin.changeOwnPassword({ currentPassword: "errada", newPassword: "nova-senha-1" }),
      "BAD_REQUEST",
    );
    await caller.admin.changeOwnPassword({ currentPassword: "senha-da-ana", newPassword: "nova-senha-1" });
    const res = await callerFor(null).admin.login({ username: "ana", password: "nova-senha-1" });
    expect(res.token).toBeTruthy();
  });

  it("usuário desativado perde o acesso na hora", async () => {
    await callerFor(ownerToken).admin.users.update({ id: seller.id, active: false });
    await expectTrpcError(callerFor(sellerToken).admin.me(), "UNAUTHORIZED");
  });
});

describe("permissões do vendedor", () => {
  it("não acessa configurações nem usuários", async () => {
    const caller = callerFor(sellerToken);
    await expectTrpcError(caller.admin.getSettings(), "FORBIDDEN");
    await expectTrpcError(caller.admin.updateSettings({ values: { store_name: "X" } }), "FORBIDDEN");
    await expectTrpcError(caller.admin.users.list(), "FORBIDDEN");
    await expectTrpcError(
      caller.admin.users.create({
        username: "novo",
        name: "Novo",
        password: "123456",
        role: "vendedor",
        unit: null,
        canEditPrices: false,
      }),
      "FORBIDDEN",
    );
    await expectTrpcError(caller.admin.users.resetPassword({ id: owner.id, password: "hack123" }), "FORBIDDEN");
  });

  it("não pode destacar, criar nem excluir produto", async () => {
    const caller = callerFor(sellerToken);
    await expectTrpcError(caller.admin.toggleFeatured({ id: "erp-1", featured: true }), "FORBIDDEN");
    await expectTrpcError(caller.admin.deleteProduct({ id: 1 }), "FORBIDDEN");
    await expectTrpcError(
      caller.admin.upsertProduct({
        name: "Novo",
        brand: "Apple",
        category: "iphone_lacrado",
        condition: "lacrado",
        featured: false,
        active: true,
        variants: [{ storage: "128GB", color: "Preto", priceCash: 100, quantity: 1, available: true, version: "" }],
      }),
      "FORBIDDEN",
    );
    expect(saveErpOverrideMock).not.toHaveBeenCalled();
  });

  it("pode ocultar/mostrar produto do ERP", async () => {
    const res = await callerFor(sellerToken).admin.toggleActive({ id: "erp-abc", active: false });
    expect(res).toEqual({ ok: true });
    expect(saveErpOverrideMock).toHaveBeenCalledWith("erp-abc", { active: false });
    const audit = await listAudit({ entityType: "erp_product" });
    expect(audit[0]).toMatchObject({ action: "product.toggleActive", entityId: "erp-abc", userName: "Ana" });
  });

  it("override do ERP: mídia permitida, destaque/categoria bloqueados", async () => {
    const caller = callerFor(sellerToken);
    await caller.admin.saveErpOverride({ externalId: "erp-abc", imageUrl: "https://cdn/x.jpg", batteryHealth: "90%" });
    expect(saveErpOverrideMock).toHaveBeenCalledTimes(1);

    await expectTrpcError(caller.admin.saveErpOverride({ externalId: "erp-abc", featured: true }), "FORBIDDEN");
    await expectTrpcError(
      caller.admin.saveErpOverride({ externalId: "erp-abc", category: "android" }),
      "FORBIDDEN",
    );
    expect(saveErpOverrideMock).toHaveBeenCalledTimes(1);
  });

  it("override do ERP: reenviar valores atuais de campos restritos não bloqueia", async () => {
    setMemoryOverridesForTesting({ "erp-abc": { featured: true, category: "android", customName: "Galaxy" } });
    await callerFor(sellerToken).admin.saveErpOverride({
      externalId: "erp-abc",
      featured: true,
      category: "android",
      customName: "Galaxy",
      imageUrl: "https://cdn/y.jpg",
    });
    expect(saveErpOverrideMock).toHaveBeenCalledTimes(1);
  });

  it("override do ERP: compara com o produto efetivo do catálogo", async () => {
    env.erpCatalogEnabled = true;
    env.erpStoreSlug = "loja-teste";
    const erpProduct: ShopProduct = {
      id: "erp-xyz",
      source: "erp",
      externalId: "erp-xyz",
      name: "iPhone 13 128GB",
      brand: "Apple",
      category: "iphone_seminovo",
      condition: "seminovo",
      description: null,
      imageUrl: null,
      warranty: "3 meses",
      featured: true,
      active: true,
      createdAt: new Date(),
      variants: [],
    };
    setErpCacheForTesting([erpProduct]);
    const caller = callerFor(sellerToken);

    // O editor reenvia todos os campos com os valores atuais → permitido
    await caller.admin.saveErpOverride({
      externalId: "erp-xyz",
      customName: "iPhone 13 128GB",
      category: "iphone_seminovo",
      warranty: "3 meses",
      featured: true,
      active: true,
      imageUrl: "https://cdn/13.jpg",
    });
    expect(saveErpOverrideMock).toHaveBeenCalledTimes(1);
    const audit = await listAudit({ entityType: "erp_product" });
    expect(audit[0].summary).toBe("iPhone 13 128GB — alterado: foto");

    // Tirar o destaque é exclusivo do dono (o save limpa o cache do ERP; recarrega)
    setErpCacheForTesting([erpProduct]);
    await expectTrpcError(
      caller.admin.saveErpOverride({ externalId: "erp-xyz", featured: false }),
      "FORBIDDEN",
    );
  });

  it("dono pode destacar produto do ERP", async () => {
    await callerFor(ownerToken).admin.toggleFeatured({ id: "erp-abc", featured: true });
    expect(saveErpOverrideMock).toHaveBeenCalledWith("erp-abc", { featured: true });
  });
});

describe("produtos em lote", () => {
  it("vendedor mostra/oculta vários produtos do ERP, mas não destaca", async () => {
    const caller = callerFor(sellerToken);
    const res = await caller.admin.bulkSetProducts({ ids: ["erp-1", "erp-2"], active: false });
    expect(res).toMatchObject({ ok: true, done: 2 });
    expect(saveErpOverrideMock).toHaveBeenCalledWith("erp-1", { active: false });
    expect(saveErpOverrideMock).toHaveBeenCalledWith("erp-2", { active: false });
    expect((await listAudit({ entityType: "product" }))[0]).toMatchObject({ action: "product.bulk" });

    await expectTrpcError(caller.admin.bulkSetProducts({ ids: ["erp-1"], featured: true }), "FORBIDDEN");
  });

  it("dono destaca em lote e exige ao menos uma alteração", async () => {
    const caller = callerFor(ownerToken);
    await caller.admin.bulkSetProducts({ ids: ["erp-9"], featured: true });
    expect(saveErpOverrideMock).toHaveBeenCalledWith("erp-9", { featured: true });
    await expectTrpcError(caller.admin.bulkSetProducts({ ids: ["erp-9"] }), "BAD_REQUEST");
  });
});

describe("visão do ERP", () => {
  it("calcula divergências e estoque a partir do catálogo", async () => {
    env.erpCatalogEnabled = true;
    env.erpStoreSlug = "loja-teste";
    const product = {
      id: "erp-1",
      source: "erp",
      externalId: "erp-1",
      name: "iPhone 13",
      brand: "Apple",
      category: "iphone_seminovo",
      condition: "seminovo",
      description: null,
      imageUrl: null,
      warranty: null,
      featured: false,
      active: true,
      createdAt: new Date(),
      stockJardim: 0,
      stockGuiaLopes: 1,
      variants: [],
    } as unknown as ShopProduct;
    setErpCacheForTesting([product]);

    const overview = await callerFor(sellerToken).admin.erpOverview();
    expect(overview.issues.noPhoto.map((i) => i.id)).toEqual(["erp-1"]);
    expect(overview.stock.soldOutJardim.map((r) => r.id)).toEqual(["erp-1"]);
    expect(overview.stock.lowGll.map((r) => r.id)).toEqual(["erp-1"]);
    expect(overview.status.status).toBe("ok");
    await expectTrpcError(callerFor(null).admin.erpOverview(), "UNAUTHORIZED");
  });
});

describe("histórico", () => {
  beforeEach(async () => {
    await logAction(owner, { action: "product.update", entityType: "product", entityId: 1, summary: "preço" });
    await logAction(seller, { action: "evaluation.status", entityType: "evaluation", entityId: 9, summary: "status" });
  });

  it("vendedor só vê entradas de avaliações", async () => {
    const caller = callerFor(sellerToken);
    const all = await caller.admin.auditLog({ limit: 50 });
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((e) => e.entityType === "evaluation")).toBe(true);
    const forced = await caller.admin.auditLog({ limit: 50, entityType: "product" });
    expect(forced.every((e) => e.entityType === "evaluation")).toBe(true);
  });

  it("dono vê tudo e pode filtrar", async () => {
    const caller = callerFor(ownerToken);
    const all = await caller.admin.auditLog({});
    expect(all.map((e) => e.entityType)).toEqual(expect.arrayContaining(["product", "evaluation"]));
    const products = await caller.admin.auditLog({ entityType: "product", entityId: "1" });
    expect(products.map((e) => e.summary)).toEqual(["preço"]);
  });
});

describe("gestão de usuários (dono)", () => {
  it("lista sem expor hash de senha", async () => {
    const list = await callerFor(ownerToken).admin.users.list();
    expect(list.map((u) => u.username)).toEqual(["chefe", "ana"]);
    for (const u of list) expect(u).not.toHaveProperty("passwordHash");
    expect(list[1]).toMatchObject({ role: "vendedor", unit: "jardim", active: true, lastLoginAt: null });
  });

  it("cria, edita e redefine senha com histórico", async () => {
    const caller = callerFor(ownerToken);
    const created = await caller.admin.users.create({
      username: "bruno",
      name: "Bruno",
      password: "senha-bruno",
      role: "vendedor",
      unit: "gll",
      canEditPrices: true,
    });
    expect(created).toMatchObject({ username: "bruno", unit: "gll", canEditPrices: true });
    expect(created).not.toHaveProperty("passwordHash");

    const updated = await caller.admin.users.update({ id: created.id, name: "Bruno S.", unit: null });
    expect(updated).toMatchObject({ name: "Bruno S.", unit: null });

    await caller.admin.users.resetPassword({ id: created.id, password: "outra-senha" });
    const login = await callerFor(null).admin.login({ username: "bruno", password: "outra-senha" });
    expect(login.user.canEditPrices).toBe(true);

    const actions = (await listAudit({ entityType: "user" })).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["user.create", "user.update", "user.resetPassword"]));
  });

  it("aplica as regras de segurança", async () => {
    const caller = callerFor(ownerToken);
    await expectTrpcError(caller.admin.users.update({ id: owner.id, active: false }), "BAD_REQUEST");
    await expectTrpcError(caller.admin.users.update({ id: owner.id, role: "vendedor" }), "BAD_REQUEST");
    await expectTrpcError(
      caller.admin.users.create({
        username: "ana",
        name: "Outra Ana",
        password: "123456",
        role: "vendedor",
        unit: null,
        canEditPrices: false,
      }),
      "CONFLICT",
    );
  });
});

describe("permissões extras e sessões", () => {
  it("dono concede permissão extra ao vendedor e ela passa a valer", async () => {
    const asOwner = callerFor(ownerToken);
    const asSeller = callerFor(sellerToken);
    await expectTrpcError(asSeller.admin.toggleFeatured({ id: "erp-1", featured: true }), "FORBIDDEN");

    const updated = await asOwner.admin.users.update({ id: seller.id, extraCaps: ["products.manage"] });
    expect(updated.extraCaps).toEqual(["products.manage"]);

    await expect(asSeller.admin.toggleFeatured({ id: "erp-1", featured: true })).resolves.toEqual({ ok: true });
    expect((await listAudit({ entityType: "user" }))[0].summary).toContain("Gerenciar produtos");
  });

  it("não deixa delegar gestão de usuários nem dar extras ao dono", async () => {
    const asOwner = callerFor(ownerToken);
    await expectTrpcError(
      asOwner.admin.users.update({ id: seller.id, extraCaps: ["users.manage" as never] }),
      "BAD_REQUEST",
    );
    const owner2 = await asOwner.admin.users.update({ id: owner.id, extraCaps: ["reports.team"] });
    expect(owner2.extraCaps ?? []).toEqual([]);
    await expectTrpcError(callerFor(sellerToken).admin.users.list(), "FORBIDDEN");
  });

  it("encerrar sessões invalida o token anterior; redefinir a senha também", async () => {
    const asOwner = callerFor(ownerToken);
    await expect(callerFor(sellerToken).admin.me()).resolves.toMatchObject({ id: seller.id });

    await asOwner.admin.users.revokeSessions({ id: seller.id });
    await expectTrpcError(callerFor(sellerToken).admin.me(), "UNAUTHORIZED");

    // Um novo login (token emitido depois) volta a funcionar? Token novo tem mesma emissão em ms: espera 2ms.
    await new Promise((r) => setTimeout(r, 5));
    await expect(callerFor(createToken(seller.id)).admin.me()).resolves.toMatchObject({ id: seller.id });

    await asOwner.admin.users.resetPassword({ id: seller.id, password: "outra-senha-123" });
    await expectTrpcError(callerFor(sellerToken).admin.me(), "UNAUTHORIZED");
  });

  it("trocar a própria senha mantém a sessão; 'sair de todos' derruba", async () => {
    const caller = callerFor(ownerToken);
    await caller.admin.changeOwnPassword({ currentPassword: "senha-do-chefe", newPassword: "nova-senha-1" });
    await expect(caller.admin.me()).resolves.toMatchObject({ id: owner.id });
    await caller.admin.endMySessions();
    await expectTrpcError(callerFor(ownerToken).admin.me(), "UNAUTHORIZED");
  });
});
