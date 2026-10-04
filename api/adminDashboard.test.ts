import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting, type AdminUserRecord } from "./services/userStore";
import { logAction, resetAuditLogForTesting } from "./services/auditLog";
import { resetEvaluationStoreForTesting, seedEvaluationForTesting } from "./services/evaluationStore";
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

function callerFor(token: string) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": "203.0.113.30" },
    }),
    resHeaders: new Headers(),
  });
}

const erpProduct = (patch: Partial<ShopProduct>): ShopProduct => ({
  id: "erp-1",
  source: "erp",
  externalId: "1",
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
  variants: [],
  ...patch,
});

let owner: AdminUserRecord;
let seller: AdminUserRecord;

beforeEach(async () => {
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  resetEvaluationStoreForTesting();
  env.erpCatalogEnabled = true;
  env.erpStoreSlug = "loja-teste";
  const cachedAt = Date.now();
  setErpCacheForTesting(
    [
      erpProduct({
        variants: [
          {
            id: "v1",
            productId: "erp-1",
            version: "",
            storage: "128GB",
            color: "Preto",
            colorHex: null,
            imageUrl: null,
            sku: null,
            batteryHealth: null,
            warranty: null,
            condition: null,
            notes: null,
            priceCash: 300000,
            quantity: 1,
            available: true,
          },
        ],
      }),
    ],
    cachedAt,
  );

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
});

describe("admin.dashboard", () => {
  it("devolve indicadores, pendências da vitrine, ERP e ranking para o dono", async () => {
    seedEvaluationForTesting({ unit: "jardim" });
    seedEvaluationForTesting({ unit: "gll", createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) });
    await logAction(owner, { action: "settings.update", entityType: "settings", summary: "x" });

    const data = await callerFor(createToken(owner.id)).admin.dashboard();
    expect(data.now.pending).toBe(2);
    expect(data.now.late).toBe(1);
    expect(data.ranking).toEqual([]);
    expect(data.catalogIssues.noPhoto.total).toBe(1);
    expect(data.catalogIssues.noBattery.items[0]).toEqual({ id: "erp-1", name: "iPhone 13" });
    expect(data.erp.enabled).toBe(true);
    expect(data.erp.lastSyncAt).not.toBeNull();
    expect(data.activity.map((a) => a.action)).toContain("settings.update");
  });

  it("filtra por unidade", async () => {
    seedEvaluationForTesting({ unit: "jardim" });
    seedEvaluationForTesting({ unit: "gll" });
    const data = await callerFor(createToken(owner.id)).admin.dashboard({ unit: "gll" });
    expect(data.now.pending).toBe(1);
  });

  it("esconde ranking e atividades que não são de avaliação para o vendedor", async () => {
    await logAction(owner, { action: "settings.update", entityType: "settings", summary: "x" });
    await logAction(owner, {
      action: "evaluation.note",
      entityType: "evaluation",
      entityId: 1,
      summary: "nota",
    });
    const data = await callerFor(createToken(seller.id)).admin.dashboard();
    expect(data.ranking).toBeNull();
    expect(data.activity.map((a) => a.action)).toEqual(["evaluation.note"]);
  });
});
