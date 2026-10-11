import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTING_KEYS } from "@contracts/types";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting } from "./services/userStore";
import { listAudit, resetAuditLogForTesting } from "./services/auditLog";
import { listEvaluationsByWhatsapp, resetEvaluationStoreForTesting, seedEvaluationForTesting } from "./services/evaluationStore";
import { addEvaluationNote, listEvaluationNotes, resetEvaluationNotesForTesting } from "./services/evaluationNotes";
import { listEvaluationMessages, recordEvaluationMessage, resetEvaluationMessagesForTesting } from "./services/evaluationMessages";
import { clearSettingsCache, saveSettings } from "./services/settingsStore";
import { findExpiredEvaluations, isAutomaticRetentionEnabled, parseRetentionPolicy, runRetention } from "./services/retention";

const DAY = 24 * 60 * 60 * 1000;
const monthsAgo = (m: number) => new Date(Date.now() - m * 31 * DAY);

async function callerFor(role: "dono" | "vendedor") {
  const user = await createUser({ username: role, name: role === "dono" ? "Chefe" : "Ana", password: "senha-de-teste", role, unit: null, canEditPrices: false });
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { authorization: `Bearer ${createToken(user.id)}`, "x-forwarded-for": "203.0.113.90" } }),
    resHeaders: new Headers(),
  });
}

beforeEach(async () => {
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  resetEvaluationStoreForTesting();
  resetEvaluationNotesForTesting();
  resetEvaluationMessagesForTesting();
  clearSettingsCache();
  await saveSettings({
    [SETTING_KEYS.retentionOpenMonths]: "12",
    [SETTING_KEYS.retentionClosedMonths]: "60",
  });
});

afterEach(async () => {
  await saveSettings({
    [SETTING_KEYS.retentionOpenMonths]: DEFAULT_SETTINGS[SETTING_KEYS.retentionOpenMonths],
    [SETTING_KEYS.retentionClosedMonths]: DEFAULT_SETTINGS[SETTING_KEYS.retentionClosedMonths],
    [SETTING_KEYS.retentionAuto]: DEFAULT_SETTINGS[SETTING_KEYS.retentionAuto],
  });
});

describe("guarda máxima de dados (LGPD)", () => {
  it("lê os prazos com limites seguros", () => {
    expect(parseRetentionPolicy({})).toEqual({ openMonths: 12, closedMonths: 60 });
    expect(parseRetentionPolicy({ [SETTING_KEYS.retentionOpenMonths]: "6", [SETTING_KEYS.retentionClosedMonths]: "0" })).toEqual({ openMonths: 6, closedMonths: 0 });
    expect(parseRetentionPolicy({ [SETTING_KEYS.retentionOpenMonths]: "-3", [SETTING_KEYS.retentionClosedMonths]: "9999" })).toEqual({ openMonths: 12, closedMonths: 120 });
    expect(parseRetentionPolicy({ [SETTING_KEYS.retentionOpenMonths]: "abc" }).openMonths).toBe(12);
  });

  it("apaga só o que passou do prazo, por tipo de avaliação", async () => {
    const oldOpen = seedEvaluationForTesting({ status: "pendente", createdAt: monthsAgo(14) });
    const recentOpen = seedEvaluationForTesting({ status: "pendente", createdAt: monthsAgo(3) });
    const oldRefused = seedEvaluationForTesting({ status: "recusado", createdAt: monthsAgo(20) });
    const closed2y = seedEvaluationForTesting({ status: "concluido", createdAt: monthsAgo(24) });
    const closed6y = seedEvaluationForTesting({ status: "concluido", createdAt: monthsAgo(72) });

    const expired = await findExpiredEvaluations({ openMonths: 12, closedMonths: 60 });
    expect(expired.map((e) => e.id).sort()).toEqual([oldOpen.id, oldRefused.id, closed6y.id].sort());
    expect(expired.some((e) => e.id === recentOpen.id || e.id === closed2y.id)).toBe(false);
  });

  it("a guarda conta a partir da última movimentação, não só da criação", async () => {
    const reopened = seedEvaluationForTesting({ status: "atendimento", createdAt: monthsAgo(20), statusChangedAt: monthsAgo(2) });
    expect((await findExpiredEvaluations({ openMonths: 12, closedMonths: 60 })).some((e) => e.id === reopened.id)).toBe(false);
  });

  it("a rotina automática vem desligada e só liga quando o dono pede", async () => {
    clearSettingsCache();
    expect(await isAutomaticRetentionEnabled()).toBe(false);
    await saveSettings({ [SETTING_KEYS.retentionAuto]: "1" });
    clearSettingsCache();
    expect(await isAutomaticRetentionEnabled()).toBe(true);
  });

  it("prazo 0 significa nunca apagar", async () => {
    seedEvaluationForTesting({ status: "pendente", createdAt: monthsAgo(48) });
    seedEvaluationForTesting({ status: "concluido", createdAt: monthsAgo(100) });
    expect(await findExpiredEvaluations({ openMonths: 0, closedMonths: 0 })).toEqual([]);
  });

  it("apagar remove também anotações e mensagens, e registra no histórico como Sistema", async () => {
    const old = seedEvaluationForTesting({ status: "pendente", createdAt: monthsAgo(14), name: "Maria Antiga" });
    const keep = seedEvaluationForTesting({ status: "pendente", createdAt: monthsAgo(1) });
    await addEvaluationNote({ id: 1, name: "Ana" }, old.id, "ligar amanhã");
    await addEvaluationNote({ id: 1, name: "Ana" }, keep.id, "ok");
    await recordEvaluationMessage({ evaluationId: old.id, event: "created", recipient: "cliente", status: "sent", error: null, body: "Olá Maria" });

    expect(await runRetention()).toEqual({ deleted: 1 });

    expect(await listEvaluationNotes(old.id)).toEqual([]);
    expect(await listEvaluationMessages(old.id)).toEqual([]);
    expect(await listEvaluationNotes(keep.id)).toHaveLength(1);
    const [entry] = await listAudit({ entityType: "evaluation" });
    expect(entry.action).toBe("privacy.retention");
    expect(entry.userName).toBe("Sistema");
    expect(entry.summary).not.toContain("Maria");
  });
});

describe("exclusão a pedido do titular", () => {
  it("acha as avaliações pelo número, com máscara ou DDI, e só as dele", async () => {
    const a = seedEvaluationForTesting({ whatsapp: "(67) 99208-6012" });
    const b = seedEvaluationForTesting({ whatsapp: "5567992086012" });
    seedEvaluationForTesting({ whatsapp: "67999990001" });
    const found = await listEvaluationsByWhatsapp("+55 67 99208-6012");
    expect(found.map((e) => e.id).sort()).toEqual([a.id, b.id].sort());
    expect(await listEvaluationsByWhatsapp("123")).toEqual([]);
  });

  it("o dono vê o que existe e apaga tudo do titular, sem tocar nos outros", async () => {
    const mine1 = seedEvaluationForTesting({ whatsapp: "67992086012" });
    seedEvaluationForTesting({ whatsapp: "(67) 99208-6012", createdAt: monthsAgo(2) });
    const other = seedEvaluationForTesting({ whatsapp: "67999990001" });
    await addEvaluationNote({ id: 1, name: "Ana" }, mine1.id, "nota");
    const caller = await callerFor("dono");

    expect((await caller.admin.privacyHolderPreview({ whatsapp: "67992086012" })).count).toBe(2);
    expect(await caller.admin.privacyHolderErase({ whatsapp: "67992086012", confirm: true })).toEqual({ deleted: 2 });

    expect(await listEvaluationsByWhatsapp("67992086012")).toEqual([]);
    expect(await listEvaluationNotes(mine1.id)).toEqual([]);
    expect((await listEvaluationsByWhatsapp("67999990001")).map((e) => e.id)).toEqual([other.id]);
    expect((await listAudit({ entityType: "evaluation" }))[0].action).toBe("privacy.erase");
  });

  it("exige confirmação explícita e permissão de gestão", async () => {
    seedEvaluationForTesting({ whatsapp: "67992086012" });
    const caller = await callerFor("dono");
    await expect(caller.admin.privacyHolderErase({ whatsapp: "67992086012", confirm: false as never })).rejects.toThrow();
    const seller = await callerFor("vendedor");
    await expect(seller.admin.privacyHolderErase({ whatsapp: "67992086012", confirm: true })).rejects.toThrow();
    await expect(seller.admin.privacyRetentionRun()).rejects.toThrow();
  });

  it("a prévia da guarda conta sem apagar nada", async () => {
    seedEvaluationForTesting({ status: "pendente", createdAt: monthsAgo(15) });
    seedEvaluationForTesting({ status: "concluido", createdAt: monthsAgo(70) });
    const caller = await callerFor("dono");
    expect(await caller.admin.privacyRetentionPreview()).toMatchObject({ expired: 2, expiredOpen: 1, expiredClosed: 1 });
    expect(await caller.admin.privacyRetentionPreview()).toMatchObject({ expired: 2 });
  });
});
