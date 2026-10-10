import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting, type AdminUserRecord } from "./services/userStore";
import { resetAuditLogForTesting } from "./services/auditLog";
import { resetEvaluationStoreForTesting } from "./services/evaluationStore";
import { erpAuthMode, erpRequest, getErpServiceStatus, resetErpClientForTesting } from "./erp/client";
import { lookupLoyaltyByCpf } from "./erp/loyalty";

const CPF = "529.982.247-25";
const TOKEN = "gcl_0123456789abcdef_" + "A".repeat(43);

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubFetch(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => handler(String(input), init ?? {}));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function useToken() {
  vi.stubEnv("ERP_API_TOKEN", TOKEN);
  vi.stubEnv("ERP_SERVICE_EMAIL", "");
  vi.stubEnv("ERP_SERVICE_PASSWORD", "");
}

beforeEach(() => {
  resetErpClientForTesting();
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  resetEvaluationStoreForTesting();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("modo de autenticação no ERP", () => {
  it("token tem prioridade; senha é a alternativa; sem nada = desativado", () => {
    vi.stubEnv("ERP_API_TOKEN", "");
    vi.stubEnv("ERP_SERVICE_EMAIL", "");
    vi.stubEnv("ERP_SERVICE_PASSWORD", "");
    expect(erpAuthMode()).toBe("none");

    vi.stubEnv("ERP_SERVICE_EMAIL", "a@b.test");
    vi.stubEnv("ERP_SERVICE_PASSWORD", "x");
    expect(erpAuthMode()).toBe("password");

    vi.stubEnv("ERP_API_TOKEN", TOKEN);
    expect(erpAuthMode()).toBe("token");
  });

  it("usa o token como Bearer e nunca faz login", async () => {
    useToken();
    const fetchMock = stubFetch(() => jsonRes({ data: { ok: true } }));
    await erpRequest("/api/clientes/fidelidade?cpf_cnpj=1");
    const calls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(calls.some((u) => u.endsWith("/api/auth/login"))).toBe(false);
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("token recusado (401) ou sem escopo (403) dá mensagem clara e não tenta login", async () => {
    useToken();
    const fetchMock = stubFetch(() => jsonRes({ message: "Unauthorized" }, 401));
    await expect(erpRequest("/api/x")).rejects.toThrow(/token de API/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    stubFetch(() => jsonRes({ message: "Forbidden" }, 403));
    await expect(erpRequest("/api/x")).rejects.toThrow(/permissão/i);
  });
});

describe("status da conexão", () => {
  it("com token: faz uma consulta de leitura e informa o modo", async () => {
    useToken();
    const fetchMock = stubFetch((url) => (url.includes("/api/clientes/fidelidade") ? jsonRes({ success: true, data: { found: false, completed_sales_count: 0 } }) : jsonRes({}, 404)));
    expect(await getErpServiceStatus()).toEqual({ configured: true, connected: true, mode: "token" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/clientes/fidelidade");
  });

  it("token inválido aparece como desconectado, com o motivo", async () => {
    useToken();
    stubFetch(() => jsonRes({}, 401));
    const status = await getErpServiceStatus();
    expect(status).toMatchObject({ configured: true, connected: false, mode: "token" });
    expect(status.error).toContain("recusou");
  });

  it("sem credenciais: não configurado", async () => {
    vi.stubEnv("ERP_API_TOKEN", "");
    vi.stubEnv("ERP_SERVICE_EMAIL", "");
    vi.stubEnv("ERP_SERVICE_PASSWORD", "");
    expect(await getErpServiceStatus()).toEqual({ configured: false, connected: false, mode: "none" });
  });
});

describe("fidelidade pelo endpoint novo do ERP", () => {
  it("cliente com compras → confirmado, com a data da última", async () => {
    useToken();
    const fetchMock = stubFetch(() =>
      jsonRes({ success: true, data: { found: true, customer_id: "c-9", completed_sales_count: 3, last_sale_at: "2026-08-15T15:00:00.000Z" } }),
    );
    const result = await lookupLoyaltyByCpf(CPF);
    expect(result).toEqual({ status: "verified", note: "Cadastro encontrado · 3 compra(s) · última em 15/08/2026", erpCustomerId: "c-9" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("cpf_cnpj=529.982.247-25");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cadastro sem compras → encontrado; sem cadastro → não encontrado", async () => {
    useToken();
    stubFetch(() => jsonRes({ data: { found: true, customer_id: "c-1", completed_sales_count: 0 } }));
    expect(await lookupLoyaltyByCpf(CPF)).toMatchObject({ status: "found", note: "Cadastro encontrado · 0 compra(s)" });

    stubFetch(() => jsonRes({ data: { found: false, completed_sales_count: 0 } }));
    expect(await lookupLoyaltyByCpf(CPF)).toMatchObject({ status: "not_found", erpCustomerId: "" });
  });

  it("ERP sem o endpoint (404) → usa a leitura antiga de clientes e histórico", async () => {
    vi.stubEnv("ERP_API_TOKEN", "");
    vi.stubEnv("ERP_SERVICE_EMAIL", "servico@loja.test");
    vi.stubEnv("ERP_SERVICE_PASSWORD", "segredo");
    stubFetch((url) => {
      if (url.endsWith("/api/auth/login")) return jsonRes({ data: { access_token: "tok" } });
      if (url.includes("/api/clientes/fidelidade")) return jsonRes({ message: "Cannot GET" }, 404);
      if (url.includes("/api/clientes?")) return jsonRes({ data: { data: [{ id: "c-2", cpf: CPF }] } });
      if (url.includes("/historico-atendimento")) return jsonRes({ data: { sales: [{ status: "FINALIZADA" }], service_orders: [] } });
      return jsonRes({}, 404);
    });
    expect(await lookupLoyaltyByCpf(CPF)).toMatchObject({ status: "verified", erpCustomerId: "c-2" });
  });

  it("token sem escopo de fidelidade → indisponível, com orientação", async () => {
    useToken();
    stubFetch(() => jsonRes({ message: "Forbidden" }, 403));
    const result = await lookupLoyaltyByCpf(CPF);
    expect(result.status).toBe("unavailable");
    expect(result.note).toContain("permissão");
  });
});

describe("tela de conexão com o ERP", () => {
  async function owner(): Promise<AdminUserRecord> {
    return createUser({ username: "chefe", name: "Chefe", password: "senha-do-chefe", role: "dono", unit: null, canEditPrices: false });
  }

  it("o dono vê o modo e se as unidades foram achadas", async () => {
    useToken();
    stubFetch((url) => {
      if (url.includes("/api/clientes/fidelidade")) return jsonRes({ data: { found: false, completed_sales_count: 0 } });
      if (url.includes("/trade-in/public/")) {
        return jsonRes({ data: { units: [{ id: "u1", nome: "Matriz", cidade: "Jardim" }, { id: "u2", nome: "Guia Lopes", cidade: "Guia Lopes da Laguna" }] } });
      }
      return jsonRes({}, 404);
    });
    const user = await owner();
    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc", { headers: { authorization: `Bearer ${createToken(user.id)}`, "x-forwarded-for": "203.0.113.60" } }),
      resHeaders: new Headers(),
    });
    expect(await caller.admin.erpServiceStatus()).toMatchObject({ configured: true, connected: true, mode: "token", units: { jardim: true, gll: true } });
  });

  it("vendedor não acessa", async () => {
    const seller = await createUser({ username: "ana", name: "Ana", password: "senha-da-ana", role: "vendedor", unit: "jardim", canEditPrices: false });
    const caller = appRouter.createCaller({
      req: new Request("http://localhost/api/trpc", { headers: { authorization: `Bearer ${createToken(seller.id)}`, "x-forwarded-for": "203.0.113.61" } }),
      resHeaders: new Headers(),
    });
    await expect(caller.admin.erpServiceStatus()).rejects.toBeInstanceOf(TRPCError);
  });
});
