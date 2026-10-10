import { describe, it, expect, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting, type AdminUserRecord } from "./services/userStore";
import { listAudit, resetAuditLogForTesting } from "./services/auditLog";
import {
  findEvaluationById,
  resetEvaluationStoreForTesting,
  seedEvaluationForTesting,
} from "./services/evaluationStore";
import { resetEvaluationNotesForTesting } from "./services/evaluationNotes";
import { DEFAULT_WHATSAPP_TEMPLATES } from "@contracts/types";

function callerFor(token: string) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": "203.0.113.20" },
    }),
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

const HOUR = 60 * 60 * 1000;

let owner: AdminUserRecord;
let seller: AdminUserRecord;
let seller2: AdminUserRecord;
let asOwner: ReturnType<typeof callerFor>;
let asSeller: ReturnType<typeof callerFor>;
let asSeller2: ReturnType<typeof callerFor>;

beforeEach(async () => {
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  resetEvaluationStoreForTesting();
  resetEvaluationNotesForTesting();

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
  seller2 = await createUser({
    username: "bruno",
    name: "Bruno",
    password: "senha-do-bruno",
    role: "vendedor",
    unit: "gll",
    canEditPrices: false,
  });
  asOwner = callerFor(createToken(owner.id));
  asSeller = callerFor(createToken(seller.id));
  asSeller2 = callerFor(createToken(seller2.id));
});

describe("evaluationClaim", () => {
  it("vendedor assume uma pendente: vira em atendimento e registra no histórico", async () => {
    const ev = seedEvaluationForTesting();
    await asSeller.admin.evaluationClaim({ id: ev.id });
    const saved = await findEvaluationById(ev.id);
    expect(saved?.status).toBe("atendimento");
    expect(saved?.assignedUserId).toBe(seller.id);
    expect(saved?.assignedUserName).toBe("Ana");
    expect(saved?.firstResponseAt).toBeInstanceOf(Date);
    const audit = await listAudit({ entityType: "evaluation", entityId: String(ev.id) });
    expect(audit.map((a) => a.action)).toEqual(["evaluation.claim"]);
  });

  it("já com outra pessoa → CONFLICT com o nome", async () => {
    const ev = seedEvaluationForTesting();
    await asSeller.admin.evaluationClaim({ id: ev.id });
    const err = await expectTrpcError(asSeller2.admin.evaluationClaim({ id: ev.id }), "CONFLICT");
    expect(err.message).toBe("Já está com Ana");
  });

  it("avaliação inexistente → NOT_FOUND", async () => {
    await expectTrpcError(asSeller.admin.evaluationClaim({ id: 999 }), "NOT_FOUND");
  });
});

describe("evaluationAssign", () => {
  it("dono atribui para outro vendedor e pode remover o responsável", async () => {
    const ev = seedEvaluationForTesting();
    await asSeller.admin.evaluationClaim({ id: ev.id });
    await asOwner.admin.evaluationAssign({ id: ev.id, userId: seller2.id });
    expect((await findEvaluationById(ev.id))?.assignedUserName).toBe("Bruno");

    await asOwner.admin.evaluationAssign({ id: ev.id, userId: null });
    const saved = await findEvaluationById(ev.id);
    expect(saved?.assignedUserId).toBeNull();
    expect(saved?.status).toBe("atendimento");

    const actions = (await listAudit({ entityType: "evaluation", entityId: String(ev.id) })).map((a) => a.action);
    expect(actions).toEqual(["evaluation.assign", "evaluation.assign", "evaluation.claim"]);
  });

  it("vendedor não pode atribuir → FORBIDDEN", async () => {
    const ev = seedEvaluationForTesting();
    await expectTrpcError(asSeller.admin.evaluationAssign({ id: ev.id, userId: seller.id }), "FORBIDDEN");
  });

  it("usuário inexistente → BAD_REQUEST", async () => {
    const ev = seedEvaluationForTesting();
    await expectTrpcError(asOwner.admin.evaluationAssign({ id: ev.id, userId: 999 }), "BAD_REQUEST");
  });
});

describe("evaluationSetStatus", () => {
  it("recusado sem motivo → BAD_REQUEST", async () => {
    const ev = seedEvaluationForTesting();
    const err = await expectTrpcError(
      asSeller.admin.evaluationSetStatus({ id: ev.id, status: "recusado" }),
      "BAD_REQUEST",
    );
    expect(err.message).toBe("Informe o motivo da recusa");
  });

  it("recusado com motivo salva o motivo e registra o histórico", async () => {
    const ev = seedEvaluationForTesting();
    await asSeller.admin.evaluationSetStatus({ id: ev.id, status: "recusado", refusalReason: "preco" });
    const saved = await findEvaluationById(ev.id);
    expect(saved?.status).toBe("recusado");
    expect(saved?.refusalReason).toBe("preco");
    expect(saved?.statusChangedAt).toBeInstanceOf(Date);
    const [entry] = await listAudit({ entityType: "evaluation", entityId: String(ev.id) });
    expect(entry.action).toBe("evaluation.status");
    expect(entry.summary).toContain("Recusado");
  });

  it("concluido com valor fechado em centavos", async () => {
    const ev = seedEvaluationForTesting();
    await asSeller.admin.evaluationSetStatus({ id: ev.id, status: "concluido", closedValue: 250000 });
    const saved = await findEvaluationById(ev.id);
    expect(saved?.status).toBe("concluido");
    expect(saved?.closedValue).toBe(250000);
  });

  it("updateEvaluationStatus (legado) recusa sem motivo usando \"outro\"", async () => {
    const ev = seedEvaluationForTesting();
    await asSeller.admin.updateEvaluationStatus({ id: ev.id, status: "recusado" });
    expect((await findEvaluationById(ev.id))?.refusalReason).toBe("outro");
  });
});

describe("evaluationSetValues / evaluationSetUnit", () => {
  it("salva valores e unidade, com histórico", async () => {
    const ev = seedEvaluationForTesting();
    await asSeller.admin.evaluationSetValues({ id: ev.id, offeredValue: 180000 });
    await asSeller.admin.evaluationSetUnit({ id: ev.id, unit: "gll" });
    const saved = await findEvaluationById(ev.id);
    expect(saved?.offeredValue).toBe(180000);
    expect(saved?.closedValue).toBeNull();
    expect(saved?.unit).toBe("gll");
    const actions = (await listAudit({ entityType: "evaluation", entityId: String(ev.id) })).map((a) => a.action);
    expect(actions).toEqual(["evaluation.unit", "evaluation.values"]);
  });

  it("sem mudança não registra histórico", async () => {
    const ev = seedEvaluationForTesting({ unit: "jardim" });
    const res = await asSeller.admin.evaluationSetUnit({ id: ev.id, unit: "jardim" });
    expect(res.changed).toBe(false);
    expect(await listAudit({ entityType: "evaluation" })).toEqual([]);
  });
});

describe("evaluationAddNote / evaluationDetail", () => {
  it("anotação aparece no detalhe junto com o histórico", async () => {
    const ev = seedEvaluationForTesting({ name: "Maria" });
    await asSeller.admin.evaluationAddNote({ id: ev.id, body: "  Cliente pediu retorno amanhã  " });
    const detail = await asOwner.admin.evaluationDetail({ id: ev.id });
    expect(detail.evaluation.id).toBe(ev.id);
    expect(detail.evaluation.name).toBe("Maria");
    expect(detail.evaluation.photos).toEqual([]);
    expect(detail.notes).toHaveLength(1);
    expect(detail.notes[0]).toMatchObject({ userId: seller.id, userName: "Ana", body: "Cliente pediu retorno amanhã" });
    expect(detail.audit.map((a) => a.action)).toEqual(["evaluation.note"]);
  });

  it("anotação vazia → BAD_REQUEST", async () => {
    const ev = seedEvaluationForTesting();
    await expectTrpcError(asSeller.admin.evaluationAddNote({ id: ev.id, body: "   " }), "BAD_REQUEST");
  });
});

describe("evaluationsPage / evaluationSummary", () => {
  it("filtra por unidade, responsável e atraso", async () => {
    const now = Date.now();
    const late = seedEvaluationForTesting({ unit: "jardim", createdAt: new Date(now - 5 * HOUR) });
    const fresh = seedEvaluationForTesting({ unit: "gll", createdAt: new Date(now - 10 * 60 * 1000) });
    const mine = seedEvaluationForTesting({ unit: "jardim", createdAt: new Date(now - HOUR / 2) });
    await asSeller.admin.evaluationClaim({ id: mine.id });

    const byUnit = await asSeller.admin.evaluationsPage({ unit: "jardim" });
    expect(byUnit.items.map((i) => i.id).sort()).toEqual([late.id, mine.id].sort());

    const me = await asSeller.admin.evaluationsPage({ assigned: "me" });
    expect(me.items.map((i) => i.id)).toEqual([mine.id]);
    expect(me.items[0].assignedUserName).toBe("Ana");

    const none = await asSeller.admin.evaluationsPage({ assigned: "none" });
    expect(none.items.map((i) => i.id).sort()).toEqual([late.id, fresh.id].sort());

    const lateOnly = await asSeller.admin.evaluationsPage({ late: true });
    expect(lateOnly.items.map((i) => i.id)).toEqual([late.id]);
    expect(lateOnly.items[0].isLate).toBe(true);

    const all = await asSeller.admin.evaluationsPage({});
    expect(all.total).toBe(3);
    expect(all.items.find((i) => i.id === fresh.id)?.isLate).toBe(false);
  });

  it("resumo conta atrasadas e respeita a unidade", async () => {
    const now = Date.now();
    seedEvaluationForTesting({ unit: "jardim", createdAt: new Date(now - 5 * HOUR) });
    seedEvaluationForTesting({ unit: "gll", createdAt: new Date(now - 6 * HOUR) });
    seedEvaluationForTesting({ unit: "gll", status: "concluido", createdAt: new Date(now - 9 * HOUR) });

    expect(await asSeller.admin.evaluationSummary()).toEqual({
      total: 3,
      pending: 2,
      atendimento: 0,
      concluido: 1,
      recusado: 0,
      late: 2,
    });
    expect(await asSeller.admin.evaluationSummary({ unit: "gll" })).toMatchObject({ total: 2, pending: 1, late: 1 });
  });
});

describe("evaluationConfig", () => {
  it("vendedor lê SLA, mensagens prontas e lojas", async () => {
    const config = await asSeller.admin.evaluationConfig();
    expect(config.slaHours).toBeGreaterThan(0);
    expect(config.templates.length).toBeGreaterThan(0);
    expect(config.templates.map((t) => t.id)).toEqual(
      expect.arrayContaining(DEFAULT_WHATSAPP_TEMPLATES.map((t) => t.id).slice(0, 1)),
    );
    expect(config.stores.jardim.label).toBe("Jardim");
    expect(config.stores.gll.label).toBe("Guia Lopes da Laguna");
  });

  it("vendedor continua sem acesso a getSettings", async () => {
    await expectTrpcError(asSeller.admin.getSettings(), "FORBIDDEN");
  });
});

describe("evaluationBatch", () => {
  it("vendedor pega várias avaliações para si e informa as que falharam", async () => {
    const a = seedEvaluationForTesting();
    const b = seedEvaluationForTesting();
    await asSeller2.admin.evaluationClaim({ id: b.id });

    const result = await asSeller.admin.evaluationBatch({ action: "claim", ids: [a.id, b.id, 9999] });

    expect(result.done).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.failed.map((f) => f.id).sort()).toEqual([b.id, 9999].sort());
    expect((await findEvaluationById(a.id))?.assignedUserId).toBe(seller.id);
    expect((await findEvaluationById(b.id))?.assignedUserId).toBe(seller2.id);
  });

  it("dono atribui em lote; vendedor não pode atribuir", async () => {
    const a = seedEvaluationForTesting();
    const b = seedEvaluationForTesting();

    await expectTrpcError(
      asSeller.admin.evaluationBatch({ action: "assign", ids: [a.id], userId: seller2.id }),
      "FORBIDDEN",
    );
    const result = await asOwner.admin.evaluationBatch({ action: "assign", ids: [a.id, b.id], userId: seller2.id });
    expect(result).toMatchObject({ ok: true, done: 2 });
    expect((await findEvaluationById(b.id))?.assignedUserName).toBe("Bruno");
  });

  it("recusa em lote com motivo e rejeita motivo inválido por avaliação", async () => {
    const a = seedEvaluationForTesting();
    const ok = await asSeller.admin.evaluationBatch({ action: "refuse", ids: [a.id], refusalReason: "preco" });
    expect(ok).toMatchObject({ ok: true, done: 1 });
    expect((await findEvaluationById(a.id))?.status).toBe("recusado");

    const c = seedEvaluationForTesting();
    const bad = await asSeller.admin.evaluationBatch({ action: "refuse", ids: [c.id], refusalReason: "xyz" });
    expect(bad.ok).toBe(false);
    expect(bad.failed[0].id).toBe(c.id);
  });
});

describe("cliente recorrente", () => {
  it("o detalhe lista outras avaliações do mesmo WhatsApp, ignorando a máscara", async () => {
    const a = seedEvaluationForTesting({ whatsapp: "(67) 99208-6012" });
    const b = seedEvaluationForTesting({ whatsapp: "67992086012", model: "iPhone 12" });
    seedEvaluationForTesting({ whatsapp: "67911112222" });

    const detail = await asOwner.admin.evaluationDetail({ id: a.id });
    expect(detail.related.map((r) => r.id)).toEqual([b.id]);
    expect(detail.related[0]).toMatchObject({ model: "iPhone 12" });
  });
});
