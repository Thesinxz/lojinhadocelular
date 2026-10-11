import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting } from "./services/userStore";
import { resetAuditLogForTesting } from "./services/auditLog";
import { resetEvaluationStoreForTesting, seedEvaluationForTesting } from "./services/evaluationStore";
import { listEvaluationMessages, recordEvaluationMessage, resetEvaluationMessagesForTesting } from "./services/evaluationMessages";
import { planBatchMessage, waitForBatchIdle } from "./services/batchMessages";
import { clearSettingsCache } from "./services/settingsStore";

async function callerFor(role: "dono" | "vendedor") {
  const user = await createUser({ username: role, name: role === "dono" ? "Chefe" : "Ana", password: "senha-de-teste", role, unit: null, canEditPrices: false });
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { authorization: `Bearer ${createToken(user.id)}`, "x-forwarded-for": "203.0.113.80" } }),
    resHeaders: new Headers(),
  });
}

function stubEvolution() {
  vi.stubEnv("EVOLUTION_API_URL", "https://evo.example.test");
  vi.stubEnv("EVOLUTION_API_KEY", "key");
  vi.stubEnv("EVOLUTION_INSTANCE", "matriz");
}

beforeEach(() => {
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  resetEvaluationStoreForTesting();
  resetEvaluationMessagesForTesting();
  clearSettingsCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("envio em lote de 'avaliação recebida'", () => {
  it("separa quem recebe de quem é pulado e mostra um exemplo do texto", async () => {
    stubEvolution();
    const ok = seedEvaluationForTesting({ name: "Vitória Souza", whatsapp: "(67) 99999-0001", status: "pendente" });
    const already = seedEvaluationForTesting({ whatsapp: "67999990002", status: "pendente" });
    const badNumber = seedEvaluationForTesting({ whatsapp: "123", status: "pendente" });
    const closed = seedEvaluationForTesting({ whatsapp: "67999990004", status: "concluido" });
    await recordEvaluationMessage({ evaluationId: already.id, event: "created", recipient: "cliente", status: "sent", error: null, body: "x" });

    const plan = await planBatchMessage("created", [ok.id, already.id, badNumber.id, closed.id, 99999]);
    expect(plan.eligible).toEqual([ok.id]);
    expect(plan.alreadySent).toEqual([already.id]);
    expect(plan.invalidNumber).toEqual([badNumber.id]);
    expect(plan.closed).toEqual([closed.id]);
    expect(plan.missing).toEqual([99999]);
    expect(plan.sample).toContain("Vitória");
  });

  it("envia só aos elegíveis, uma vez cada, e registra no histórico", async () => {
    stubEvolution();
    const fetchMock = vi.fn().mockImplementation(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const a = seedEvaluationForTesting({ whatsapp: "67999990001", status: "pendente" });
    const b = seedEvaluationForTesting({ whatsapp: "67999990002", status: "pendente" });
    const sent = seedEvaluationForTesting({ whatsapp: "67999990003", status: "pendente" });
    await recordEvaluationMessage({ evaluationId: sent.id, event: "created", recipient: "cliente", status: "sent", error: null, body: "x" });
    const caller = await callerFor("dono");

    const result = await caller.admin.evaluationBatchMessage({ ids: [a.id, b.id, sent.id, a.id] });
    expect(result).toMatchObject({ queued: 2, alreadySent: 1 });
    await waitForBatchIdle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await listEvaluationMessages(a.id)).filter((m) => m.status === "sent")).toHaveLength(1);
    expect((await listEvaluationMessages(sent.id)).filter((m) => m.status === "sent")).toHaveLength(1);

    // Repetir o lote não manda de novo.
    expect((await caller.admin.evaluationBatchMessage({ ids: [a.id, b.id] })).queued).toBe(0);
    await waitForBatchIdle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("envia mesmo com as mensagens automáticas desligadas (a pessoa pediu o lote)", async () => {
    stubEvolution();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { saveSettings } = await import("./services/settingsStore");
    const { DEFAULT_AUTO_MESSAGES, DEFAULT_SETTINGS, SETTING_KEYS } = await import("@contracts/types");
    await saveSettings({ [SETTING_KEYS.autoMessages]: JSON.stringify({ ...DEFAULT_AUTO_MESSAGES, customerEnabled: false }) });
    clearSettingsCache();
    const a = seedEvaluationForTesting({ whatsapp: "67999990001", status: "pendente" });
    await (await callerFor("dono")).admin.evaluationBatchMessage({ ids: [a.id] });
    await waitForBatchIdle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await saveSettings({ [SETTING_KEYS.autoMessages]: DEFAULT_SETTINGS[SETTING_KEYS.autoMessages] });
  });

  it("recusa o lote quando a Evolution não está configurada", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "");
    vi.stubEnv("EVOLUTION_API_KEY", "");
    vi.stubEnv("EVOLUTION_INSTANCE", "");
    const a = seedEvaluationForTesting({ whatsapp: "67999990001", status: "pendente" });
    await expect((await callerFor("dono")).admin.evaluationBatchMessage({ ids: [a.id] })).rejects.toThrow(/Evolution/);
  });

  it("limita o lote a 50 avaliações", async () => {
    const caller = await callerFor("dono");
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    await expect(caller.admin.evaluationBatchMessage({ ids })).rejects.toThrow();
  });
});
