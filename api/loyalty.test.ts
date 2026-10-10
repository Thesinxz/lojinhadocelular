import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { declaredLojinhaPurchase, loyaltyApplies } from "@contracts/loyalty";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting, type AdminUserRecord } from "./services/userStore";
import { listAudit, resetAuditLogForTesting } from "./services/auditLog";
import { findEvaluationById, resetEvaluationStoreForTesting, seedEvaluationForTesting } from "./services/evaluationStore";
import { resetEvaluationNotesForTesting } from "./services/evaluationNotes";
import { resetErpClientForTesting } from "./erp/client";
import { extractList, lookupLoyaltyByCpf, summarizeHistory } from "./erp/loyalty";
import { runLoyaltyCheck } from "./services/loyaltyCheck";

const CPF = "529.982.247-25";
const DIGITS = "52998224725";

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function mockErp(routes: {
  clients?: (url: string) => unknown;
  history?: unknown | (() => Response);
}) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith("/api/auth/login")) return jsonRes({ data: { access_token: "tok" } });
    if (url.includes("/api/clientes?")) return jsonRes(routes.clients ? routes.clients(url) : { data: { items: [] } });
    if (url.includes("/historico-atendimento")) {
      if (typeof routes.history === "function") return (routes.history as () => Response)();
      return jsonRes(routes.history ?? { data: { vendas: [], os: [] } });
    }
    return jsonRes({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const client = (patch: Record<string, unknown> = {}) => ({ id: "c-1", nome_completo: "Maria da Silva", cpf: CPF, cnpj: null, ...patch });

function callerFor(token: string) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { authorization: `Bearer ${token}`, "x-forwarded-for": "203.0.113.50" } }),
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
  }
}

let seller: AdminUserRecord;
let asSeller: ReturnType<typeof callerFor>;

beforeEach(async () => {
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  resetEvaluationStoreForTesting();
  resetEvaluationNotesForTesting();
  resetErpClientForTesting();
  vi.stubEnv("ERP_API_TOKEN", "");
  vi.stubEnv("ERP_SERVICE_EMAIL", "servico@loja.test");
  vi.stubEnv("ERP_SERVICE_PASSWORD", "segredo-de-teste");
  seller = await createUser({ username: "ana", name: "Ana", password: "senha-da-ana", role: "vendedor", unit: "jardim", canEditPrices: false });
  asSeller = callerFor(createToken(seller.id));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("regras do bônus", () => {
  it("só confirmado (ERP ou equipe) aplica o bônus", () => {
    expect(loyaltyApplies("verified")).toBe(true);
    expect(loyaltyApplies("manual")).toBe(true);
    for (const s of ["found", "not_found", "unavailable", "denied", "", null, undefined]) expect(loyaltyApplies(s)).toBe(false);
  });

  it("reconhece a declaração de compra na Lojinha", () => {
    expect(declaredLojinhaPurchase("Lojinha do Celular")).toBe(true);
    expect(declaredLojinhaPurchase("Comprado com a nossa equipe")).toBe(true);
    expect(declaredLojinhaPurchase("Outra loja física da cidade")).toBe(false);
    expect(declaredLojinhaPurchase(null)).toBe(false);
  });
});

describe("leitura tolerante das respostas do ERP", () => {
  it("acha a lista de clientes em vários formatos", () => {
    expect(extractList([{ id: 1 }])).toHaveLength(1);
    expect(extractList({ data: [{ id: 1 }] })).toHaveLength(1);
    expect(extractList({ data: { items: [{ id: 1 }, { id: 2 }] } })).toHaveLength(2);
    expect(extractList({ success: true, data: { data: [{ id: 1 }], meta: { total: 1 } } })).toHaveLength(1);
    expect(extractList({ clientes: [{ id: 1 }] })).toHaveLength(1);
    expect(extractList({ nada: true })).toEqual([]);
    expect(extractList(null)).toEqual([]);
  });

  it("conta vendas e OS do histórico", () => {
    expect(summarizeHistory({ data: { vendas: [{}, {}], os: [{}] } })).toEqual({ sales: 2, os: 1 });
    expect(summarizeHistory({ success: true, data: { service_orders: [{}, {}], sales: [{ status: "FINALIZADA" }, { status: "CANCELADA" }] } })).toEqual({ sales: 1, os: 2 });
    expect(summarizeHistory({ vendas: 3, os: 0 })).toEqual({ sales: 3, os: 0 });
    expect(summarizeHistory([{ tipo: "VENDA" }, { tipo: "OS" }, { tipo: "venda" }])).toEqual({ sales: 2, os: 1 });
    expect(summarizeHistory({ qualquer: 1 })).toEqual({ sales: null, os: null });
    expect(summarizeHistory(null)).toEqual({ sales: null, os: null });
  });
});

describe("lookupLoyaltyByCpf", () => {
  it("cliente com compra anterior → confirmado", async () => {
    const fetchMock = mockErp({ clients: () => ({ success: true, data: { data: [client()], meta: { total: 1 } } }), history: { success: true, data: { service_orders: [{}], sales: [{ status: "FINALIZADA" }, { status: "FINALIZADA" }] } } });
    const result = await lookupLoyaltyByCpf(CPF);
    expect(result).toEqual({ status: "verified", note: "Cadastro encontrado · 2 compra(s) · 1 OS", erpCustomerId: "c-1" });
    const search = fetchMock.mock.calls.map(([u]) => String(u)).find((u) => u.includes("/api/clientes?"))!;
    expect(search).toContain("cpf_cnpj=529.982.247-25");
  });

  it("tenta o CPF sem máscara quando o formatado não acha", async () => {
    const fetchMock = mockErp({
      clients: (url) => (url.includes(DIGITS) && !url.includes("529.982") ? { data: { data: [client({ cpf: DIGITS })] } } : { data: { data: [] } }),
      history: { vendas: 1 },
    });
    expect((await lookupLoyaltyByCpf(CPF)).status).toBe("verified");
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("/api/clientes?"))).toHaveLength(2);
  });

  it("sem cadastro → não encontrado", async () => {
    mockErp({ clients: () => ({ data: { data: [] } }) });
    expect(await lookupLoyaltyByCpf(CPF)).toMatchObject({ status: "not_found", erpCustomerId: "" });
  });

  it("ignora cliente de outro CPF devolvido pelo ERP", async () => {
    mockErp({ clients: () => ({ data: { data: [client({ cpf: "111.444.777-35" })] } }) });
    expect((await lookupLoyaltyByCpf(CPF)).status).toBe("not_found");
  });

  it("cadastro sem compra ou sem histórico legível → encontrado (equipe decide)", async () => {
    mockErp({ clients: () => ({ data: { data: [client()] } }), history: { data: { sales: [], service_orders: [{}, {}] } } });
    expect(await lookupLoyaltyByCpf(CPF)).toMatchObject({ status: "found", note: "Cadastro encontrado · 0 compra(s) · 2 OS" });

    // Só vendas canceladas: não vale como compra.
    mockErp({ clients: () => ({ data: { data: [client()] } }), history: { data: { sales: [{ status: "CANCELADA" }], service_orders: [] } } });
    expect((await lookupLoyaltyByCpf(CPF)).status).toBe("found");

    // Histórico fora do ar: usa a contagem do cadastro (_count.sales) quando existe.
    mockErp({ clients: () => ({ data: { data: [client({ _count: { sales: 3 } })] } }), history: () => jsonRes({ message: "erro" }, 500) });
    const fromCount = await lookupLoyaltyByCpf(CPF);
    expect(fromCount.status).toBe("verified");

    mockErp({ clients: () => ({ data: { data: [client()] } }), history: () => jsonRes({ message: "erro" }, 500) });
    const unreadable = await lookupLoyaltyByCpf(CPF);
    expect(unreadable.status).toBe("found");
    expect(unreadable.note).toContain("confira no ERP");
  });

  it("CPF inválido, ERP sem usuário de serviço ou login recusado → indisponível", async () => {
    mockErp({});
    expect(await lookupLoyaltyByCpf("123")).toMatchObject({ status: "unavailable", note: "CPF inválido" });

    vi.stubEnv("ERP_SERVICE_EMAIL", "");
    expect((await lookupLoyaltyByCpf(CPF)).status).toBe("unavailable");

    vi.stubEnv("ERP_SERVICE_EMAIL", "servico@loja.test");
    resetErpClientForTesting();
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ message: "invalid" }, 401)));
    const denied = await lookupLoyaltyByCpf(CPF);
    expect(denied.status).toBe("unavailable");
    expect(denied.note).toContain("recusou");
  });
});

describe("conferência gravada na avaliação", () => {
  it("grava só o resultado: o CPF não aparece no registro nem no histórico", async () => {
    mockErp({ clients: () => ({ data: { data: [client()] } }), history: { data: { sales: [{ status: "FINALIZADA" }], service_orders: [] } } });
    const row = seedEvaluationForTesting({ purchaseLocation: "Lojinha do Celular" });

    const res = await asSeller.admin.evaluationLoyaltyVerify({ id: row.id, cpf: CPF });
    expect(res.status).toBe("verified");

    const saved = await findEvaluationById(row.id);
    expect(saved).toMatchObject({ loyaltyStatus: "verified", erpCustomerId: "c-1" });
    expect(saved?.loyaltyCheckedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(saved)).not.toContain(DIGITS);
    expect(JSON.stringify(saved)).not.toContain("529.982");
    const audit = JSON.stringify(await listAudit({ entityType: "evaluation" }));
    expect(audit).not.toContain(DIGITS);
    expect(audit).not.toContain("529.982");
    expect(audit).toContain("loyaltyCheck");
  });

  it("rejeita CPF inválido e avaliação inexistente", async () => {
    const row = seedEvaluationForTesting();
    await expectTrpcError(asSeller.admin.evaluationLoyaltyVerify({ id: row.id, cpf: "123" }), "BAD_REQUEST");
    await expectTrpcError(asSeller.admin.evaluationLoyaltyVerify({ id: 9999, cpf: CPF }), "NOT_FOUND");
  });

  it("equipe confirma ou nega manualmente, com histórico", async () => {
    const row = seedEvaluationForTesting({ purchaseLocation: "Lojinha do Celular" });
    await asSeller.admin.evaluationLoyaltyConfirm({ id: row.id, confirmed: true });
    expect(await findEvaluationById(row.id)).toMatchObject({ loyaltyStatus: "manual", loyaltyNote: "Confirmado por Ana" });
    await asSeller.admin.evaluationLoyaltyConfirm({ id: row.id, confirmed: false });
    expect(await findEvaluationById(row.id)).toMatchObject({ loyaltyStatus: "denied" });
    expect((await listAudit({ entityType: "evaluation" })).map((a) => a.action)).toContain("evaluation.loyaltyConfirm");
  });

  it("runLoyaltyCheck marca indisponível quando o ERP está fora do ar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const row = seedEvaluationForTesting();
    const res = await runLoyaltyCheck(row.id, CPF);
    expect(res.status).toBe("unavailable");
    expect((await findEvaluationById(row.id))?.loyaltyStatus).toBe("unavailable");
  });
});
