import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listAudit,
  logAction,
  resetAuditLogForTesting,
  summarizeProductChanges,
} from "./services/auditLog";
import type { ProductLike } from "./permissions";

function product(): ProductLike {
  return {
    name: "iPhone 15 Pro",
    brand: "Apple",
    category: "iphone_seminovo",
    condition: "seminovo",
    featured: false,
    active: true,
    imageUrl: "",
    variants: [
      {
        id: 1,
        version: "15 Pro",
        storage: "128GB",
        color: "Preto",
        priceCash: 320000,
        quantity: 1,
        available: true,
      },
    ],
  };
}

describe("logAction / listAudit", () => {
  beforeEach(() => {
    resetAuditLogForTesting();
    vi.useRealTimers();
  });

  it("registra entradas e lista em ordem decrescente", async () => {
    const user = { id: 1, name: "Dono" };
    await logAction(user, { action: "auth.login", entityType: "user", entityId: 1, summary: "Entrou no painel" });
    await logAction(user, { action: "product.update", entityType: "product", entityId: "10", summary: "Preço" });
    await logAction(null, { action: "evaluation.status", entityType: "evaluation", summary: "Status" });

    const all = await listAudit({});
    expect(all.map((e) => e.action)).toEqual(["evaluation.status", "product.update", "auth.login"]);
    expect(all[2]).toMatchObject({
      userId: 1,
      userName: "Dono",
      entityType: "user",
      entityId: "1",
      summary: "Entrou no painel",
    });
    expect(all[2].createdAt).toBeInstanceOf(Date);
    expect(all[0].userId).toBeNull();
    expect(all[0].userName).toBe("Sistema");
    expect(all[0].entityId).toBeNull();
  });

  it("filtra por entityType e entityId e respeita limit", async () => {
    const user = { id: 2, name: "Ana" };
    await logAction(user, { action: "evaluation.claim", entityType: "evaluation", entityId: 5, summary: "a" });
    await logAction(user, { action: "evaluation.note", entityType: "evaluation", entityId: 6, summary: "b" });
    await logAction(user, { action: "product.update", entityType: "product", entityId: 5, summary: "c" });
    await logAction(user, { action: "evaluation.status", entityType: "evaluation", entityId: 5, summary: "d" });

    expect((await listAudit({ entityType: "evaluation" })).map((e) => e.summary)).toEqual(["d", "b", "a"]);
    expect((await listAudit({ entityType: "evaluation", entityId: "5" })).map((e) => e.summary)).toEqual(["d", "a"]);
    expect((await listAudit({ limit: 2 })).map((e) => e.summary)).toEqual(["d", "c"]);
  });

  it("filtra por usuário, ação, texto e pagina por beforeId", async () => {
    const ana = { id: 2, name: "Ana" };
    const bia = { id: 3, name: "Bia" };
    await logAction(ana, { action: "evaluation.claim", entityType: "evaluation", entityId: 1, summary: "Ana assumiu iPhone" });
    await logAction(bia, { action: "product.update", entityType: "product", entityId: 9, summary: "Preço do Galaxy" });
    await logAction(bia, { action: "evaluation.status", entityType: "evaluation", entityId: 1, summary: "Concluída" });

    expect((await listAudit({ userId: 3 })).map((e) => e.summary)).toEqual(["Concluída", "Preço do Galaxy"]);
    expect((await listAudit({ action: "evaluation." })).map((e) => e.summary)).toEqual(["Concluída", "Ana assumiu iPhone"]);
    expect((await listAudit({ search: "galaxy" })).map((e) => e.summary)).toEqual(["Preço do Galaxy"]);

    const firstPage = await listAudit({ limit: 2 });
    const rest = await listAudit({ beforeId: firstPage[firstPage.length - 1].id });
    expect(rest.map((e) => e.summary)).toEqual(["Ana assumiu iPhone"]);

    expect(await listAudit({ from: new Date(Date.now() + 60_000) })).toEqual([]);
  });

  it("nunca lança erro, mesmo com dados ruins", async () => {
    await expect(
      logAction({ id: 1, name: "Dono" }, {
        action: "x".repeat(500),
        entityType: "product",
        summary: "y".repeat(10_000),
      }),
    ).resolves.toBeUndefined();
  });
});

describe("summarizeProductChanges", () => {
  it("descreve mudança de preço com R$ antigo → novo", () => {
    const before = product();
    const after = product();
    after.variants[0].priceCash = 300000;
    const summary = summarizeProductChanges(before, after);
    expect(summary).toContain("Preço 15 Pro 128GB Preto");
    expect(summary).toMatch(/R\$\s?3\.200,00 → R\$\s?3\.000,00/);
  });

  it("descreve foto, visibilidade e novo produto", () => {
    const before = product();
    const after = product();
    after.imageUrl = "https://cdn/foto.jpg";
    after.active = false;
    const summary = summarizeProductChanges(before, after);
    expect(summary).toMatch(/foto alterada/);
    expect(summary).toMatch(/ocult/i);

    expect(summarizeProductChanges(null, product())).toMatch(/criou/i);
  });

  it("indica quando nada mudou", () => {
    expect(summarizeProductChanges(product(), product())).toMatch(/sem alterações/i);
  });
});
