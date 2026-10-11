import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting } from "./services/userStore";
import { listAudit, resetAuditLogForTesting } from "./services/auditLog";
import { resetEvaluationStoreForTesting, seedEvaluationForTesting } from "./services/evaluationStore";
import { listEvaluationMessages, resetEvaluationMessagesForTesting } from "./services/evaluationMessages";

async function callerFor(role: "dono" | "vendedor") {
  const user = await createUser({ username: role, name: role === "dono" ? "Chefe" : "Ana", password: "senha-de-teste", role, unit: null, canEditPrices: false });
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { authorization: `Bearer ${createToken(user.id)}`, "x-forwarded-for": "203.0.113.70" } }),
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
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("admin.evolutionTest", () => {
  it("envia a mensagem de teste pela instância configurada e registra no histórico", async () => {
    stubEvolution();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const caller = await callerFor("dono");

    expect(await caller.admin.evolutionTest({ number: "(67) 99999-0001" })).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://evo.example.test/message/sendText/matriz");
    expect(JSON.parse(String(init.body)).number).toBe("5567999990001");
    expect((await listAudit({ entityType: "settings" }))[0].action).toBe("settings.evolutionTest");
  });

  it("explica o que falta quando não está configurada", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "");
    vi.stubEnv("EVOLUTION_API_KEY", "");
    vi.stubEnv("EVOLUTION_INSTANCE", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await (await callerFor("dono")).admin.evolutionTest({ number: "67999990001" });
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toContain("EVOLUTION_API_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devolve o erro da Evolution em vez de falhar calado", async () => {
    stubEvolution();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("instance not found", { status: 404 })));
    const result = await (await callerFor("dono")).admin.evolutionTest({ number: "67999990001" });
    expect(result.ok === false && result.error).toContain("HTTP 404");
  });

  it("recusa número inválido e quem não é dono", async () => {
    stubEvolution();
    const result = await (await callerFor("dono")).admin.evolutionTest({ number: "12345678" });
    expect(result.ok === false && result.error).toContain("inválido");
    await expect((await callerFor("vendedor")).admin.evolutionTest({ number: "67999990001" })).rejects.toThrow();
  });
});

describe("admin.sendEvaluationMessage", () => {
  it("envia o texto ao WhatsApp da avaliação pela Evolution e registra no histórico", async () => {
    stubEvolution();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const evaluation = seedEvaluationForTesting({ whatsapp: "(67) 99999-0002" });
    const caller = await callerFor("dono");

    expect(await caller.admin.sendEvaluationMessage({ id: evaluation.id, text: "Olá, tudo bem?" })).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://evo.example.test/message/sendText/matriz");
    expect(JSON.parse(String(init.body))).toEqual({ number: "5567999990002", text: "Olá, tudo bem?" });
    const [saved] = await listEvaluationMessages(evaluation.id);
    expect(saved).toMatchObject({ event: "manual", recipient: "cliente", status: "sent" });
    expect(saved.body).toContain("Olá, tudo bem?");
  });

  it("registra a falha e devolve o erro para o painel oferecer a alternativa", async () => {
    stubEvolution();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("instance not found", { status: 404 })));
    const evaluation = seedEvaluationForTesting({ whatsapp: "67999990002" });
    const result = await (await callerFor("dono")).admin.sendEvaluationMessage({ id: evaluation.id, text: "Oi" });
    expect(result.ok === false && result.error).toContain("HTTP 404");
    expect((await listEvaluationMessages(evaluation.id))[0]).toMatchObject({ event: "manual", status: "failed" });
  });

  it("não envia nada quando a Evolution não está configurada", async () => {
    vi.stubEnv("EVOLUTION_API_URL", "");
    vi.stubEnv("EVOLUTION_API_KEY", "");
    vi.stubEnv("EVOLUTION_INSTANCE", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const evaluation = seedEvaluationForTesting({ whatsapp: "67999990002" });
    const result = await (await callerFor("dono")).admin.sendEvaluationMessage({ id: evaluation.id, text: "Oi" });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
