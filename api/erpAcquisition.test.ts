import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { isValidCpf, isValidCnpj, isValidImei } from "@contracts/brDocs";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting, type AdminUserRecord } from "./services/userStore";
import { listAudit, resetAuditLogForTesting } from "./services/auditLog";
import { resetEvaluationStoreForTesting, seedEvaluationForTesting } from "./services/evaluationStore";
import { resetEvaluationNotesForTesting } from "./services/evaluationNotes";
import { getErpEntry, resetErpEntriesForTesting, claimErpEntry, STALE_SENDING_MS } from "./services/evaluationErpEntries";
import { buildEntradaSeminovoPayload, extractCreatedId, acquisitionInputSchema } from "./erp/acquisition";
import { extractToken, resetErpClientForTesting } from "./erp/client";

const VALID_CPF = "529.982.247-25";
const VALID_IMEI = "490154203237518";

function callerFor(token: string) {
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { authorization: `Bearer ${token}`, "x-forwarded-for": "203.0.113.30" } }),
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

const formData = (patch: Record<string, unknown> = {}) => ({
  brandName: "Apple",
  modelName: "iPhone 13",
  imei1: VALID_IMEI,
  imei2: "",
  cor: "Azul",
  capacidade: "128GB",
  batteryHealth: 88,
  grade: "A" as const,
  costCents: 250000,
  saleCents: 349900,
  observacoes: "",
  necessitaReparo: false,
  emitirNfe: false,
  cliente: {
    nome: "Maria da Silva",
    cpfCnpj: VALID_CPF,
    telefone: "(67) 99999-0000",
    email: "",
    endereco: {
      cep: "79240-000",
      logradouro: "Av. Duque de Caxias",
      numero: "486",
      complemento: "",
      bairro: "Centro",
      codigoMunicipio: "5005400",
      nomeMunicipio: "Jardim",
      uf: "ms",
    },
  },
  ...patch,
});

let owner: AdminUserRecord;
let seller: AdminUserRecord;
let asOwner: ReturnType<typeof callerFor>;
let asSeller: ReturnType<typeof callerFor>;

function mockErp(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => handler(String(url), init ?? {}));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const imeiOk = {
  success: true,
  data: { success: true, isValid: true, isBlacklistedLocal: false, status: "REGULAR", origem: "ANATEL", consultadoAnatel: true, brand: "Apple", model: "iPhone 13", pdfUrl: null, consultaOficialUrl: "https://anatel.example.test" },
};

function standardErp(onCreate?: () => Response, imei: unknown = imeiOk) {
  return mockErp((url) => {
    if (url.endsWith("/api/auth/login")) return jsonRes({ data: { access_token: "tok-1" } });
    if (url.endsWith("/api/tools/imei/consultar")) return jsonRes(imei);
    if (url.includes("/trade-in/public/")) {
      return jsonRes({ data: { units: [{ id: "u-matriz", nome: "Matriz", cidade: "Jardim" }, { id: "u-gll", nome: "Guia Lopes", cidade: "Guia Lopes da Laguna" }] } });
    }
    if (url.endsWith("/api/products/entrada-seminovo")) return onCreate ? onCreate() : jsonRes({ data: { id: "prod-123" } }, 201);
    return jsonRes({}, 404);
  });
}

beforeEach(async () => {
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  resetEvaluationStoreForTesting();
  resetEvaluationNotesForTesting();
  resetErpEntriesForTesting();
  resetErpClientForTesting();
  vi.stubEnv("ERP_SERVICE_EMAIL", "servico@loja.test");
  vi.stubEnv("ERP_SERVICE_PASSWORD", "segredo-de-teste");
  owner = await createUser({ username: "chefe", name: "Chefe", password: "senha-do-chefe", role: "dono", unit: null, canEditPrices: false });
  seller = await createUser({ username: "ana", name: "Ana", password: "senha-da-ana", role: "vendedor", unit: "jardim", canEditPrices: false });
  asOwner = callerFor(createToken(owner.id));
  asSeller = callerFor(createToken(seller.id));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("validações de documentos", () => {
  it("CPF, CNPJ e IMEI", () => {
    expect(isValidCpf(VALID_CPF)).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidImei(VALID_IMEI)).toBe(true);
    expect(isValidImei("490154203237519")).toBe(false);
    expect(isValidImei("123")).toBe(false);
  });
});

describe("montagem da entrada", () => {
  it("converte centavos em reais, limpa CEP/IMEI e põe UF em maiúsculas", () => {
    const parsed = acquisitionInputSchema.parse(formData());
    const payload = buildEntradaSeminovoPayload(parsed, "u-matriz");
    expect(payload.unidadeId).toBe("u-matriz");
    expect(payload.celular).toMatchObject({ valorCusto: 2500, valorVenda: 3499, imei1: VALID_IMEI, battery_health: 88, grade: "A" });
    expect(payload.cliente.endereco).toMatchObject({ cep: "79240000", uf: "MS", codigoMunicipio: "5005400" });
    expect(payload.cliente).not.toHaveProperty("email");
  });

  it("rejeita IMEI 2 igual ao IMEI 1 e CPF inválido", () => {
    expect(acquisitionInputSchema.safeParse(formData({ imei2: VALID_IMEI })).success).toBe(false);
    expect(acquisitionInputSchema.safeParse(formData({ cliente: { ...formData().cliente, cpfCnpj: "123" } })).success).toBe(false);
  });

  it("acha o token e o id nos formatos usuais", () => {
    expect(extractToken({ access_token: "a" })).toBe("a");
    expect(extractToken({ data: { accessToken: "b" } })).toBe("b");
    expect(extractToken({ nada: 1 })).toBeNull();
    expect(extractCreatedId({ id: 7 })).toBe("7");
    expect(extractCreatedId({ data: { product: { id: "p" } } })).toBe("p");
    expect(extractCreatedId({})).toBeNull();
  });
});

describe("erpEntryCreate", () => {
  it("dá entrada numa troca concluída, usando a unidade certa, e registra sem CPF no histórico", async () => {
    const fetchMock = standardErp();
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim", closedValue: 250000 });

    const res = await asSeller.admin.erpEntryCreate({ id: row.id, data: formData() });
    expect(res).toEqual({ ok: true, erpProductId: "prod-123" });

    const create = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/entrada-seminovo"))!;
    const init = create[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    expect(JSON.parse(String(init.body)).unidadeId).toBe("u-matriz");

    expect(await getErpEntry(row.id)).toMatchObject({ status: "sent", erpProductId: "prod-123", imeiLast4: "7518" });
    const audit = (await listAudit({ entityType: "evaluation" }))[0];
    expect(audit.action).toBe("evaluation.erpEntry");
    expect(audit.summary).not.toContain("529");
  });

  it("não deixa dar entrada duas vezes", async () => {
    standardErp();
    const row = seedEvaluationForTesting({ status: "concluido", unit: "gll" });
    await asSeller.admin.erpEntryCreate({ id: row.id, data: formData() });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() }), "CONFLICT");
  });

  it("exige troca concluída, unidade definida e usuário de serviço configurado", async () => {
    standardErp();
    const pending = seedEvaluationForTesting({ status: "atendimento", unit: "jardim" });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: pending.id, data: formData() }), "BAD_REQUEST");

    const noUnit = seedEvaluationForTesting({ status: "concluido", unit: "" });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: noUnit.id, data: formData() }), "BAD_REQUEST");

    vi.stubEnv("ERP_SERVICE_EMAIL", "");
    const ok = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: ok.id, data: formData() }), "PRECONDITION_FAILED");
  });

  it("emitir NF-e só com permissão de gerenciar produtos", async () => {
    standardErp();
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData({ emitirNfe: true }) }), "FORBIDDEN");
    await expect(asOwner.admin.erpEntryCreate({ id: row.id, data: formData({ emitirNfe: true }) })).resolves.toMatchObject({ ok: true });
  });

  it("recusa do ERP libera nova tentativa; erro de rede mantém a reserva", async () => {
    let rejectNext = true;
    standardErp(() => {
      if (rejectNext) return jsonRes({ message: "IMEI já cadastrado" }, 400);
      throw new TypeError("fetch failed");
    });
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });

    const err = await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() }), "BAD_REQUEST");
    expect(err.message).toContain("IMEI já cadastrado");
    expect(await getErpEntry(row.id)).toBeNull();

    rejectNext = false;
    const err2 = await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() }), "INTERNAL_SERVER_ERROR");
    expect(err2.message).toContain("Confira no ERP");
    expect(await getErpEntry(row.id)).toMatchObject({ status: "sending" });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() }), "CONFLICT");
  });

  it("reserva travada há mais de 2 minutos pode ser refeita", async () => {
    const t0 = new Date("2026-10-10T12:00:00Z");
    expect(await claimErpEntry(1, { id: 1, name: "A" }, "1234", t0)).toBe(true);
    expect(await claimErpEntry(1, { id: 1, name: "A" }, "1234", new Date(t0.getTime() + 1000))).toBe(false);
    expect(await claimErpEntry(1, { id: 1, name: "A" }, "1234", new Date(t0.getTime() + STALE_SENDING_MS + 1))).toBe(true);
  });

  it("refaz o login uma vez quando o token é recusado", async () => {
    let logins = 0;
    let creates = 0;
    mockErp((url) => {
      if (url.endsWith("/api/auth/login")) return jsonRes({ access_token: `tok-${++logins}` });
      if (url.endsWith("/api/tools/imei/consultar")) return jsonRes(imeiOk);
      if (url.includes("/trade-in/public/")) return jsonRes({ data: { units: [{ id: "u-matriz", nome: "Matriz", cidade: "Jardim" }] } });
      if (url.endsWith("/entrada-seminovo")) return ++creates === 1 ? jsonRes({ message: "expired" }, 401) : jsonRes({ id: "p9" }, 201);
      return jsonRes({}, 404);
    });
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    await expect(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() })).resolves.toMatchObject({ erpProductId: "p9" });
    expect(logins).toBe(2);
  });

  it("consulta o IMEI antes e repassa o resultado ao ERP (só as chaves permitidas)", async () => {
    const fetchMock = standardErp(undefined, { data: { ...imeiOk.data, chaveInesperada: "x" } });
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    await asSeller.admin.erpEntryCreate({ id: row.id, data: formData() });

    const calls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(calls.findIndex((u) => u.endsWith("/imei/consultar"))).toBeLessThan(calls.findIndex((u) => u.endsWith("/entrada-seminovo")));
    const create = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/entrada-seminovo"))!;
    const celular = JSON.parse(String((create[1] as RequestInit).body)).celular;
    expect(celular.anatelResult).toMatchObject({ status: "REGULAR", consultadoAnatel: true, isBlacklistedLocal: false });
    expect(celular.anatelResult).not.toHaveProperty("chaveInesperada");
    expect(celular).not.toHaveProperty("anatelManual");
  });

  it("recusa IMEI impedido (lista da loja ou status) e libera nova tentativa", async () => {
    standardErp(undefined, { data: { ...imeiOk.data, isBlacklistedLocal: true, blacklistMotivo: "furto", status: "IMPEDIDO (BLACKLIST LOCAL)" } });
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    const err = await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() }), "BAD_REQUEST");
    expect(err.message).toContain("impedido");
    expect(await getErpEntry(row.id)).toBeNull();

    standardErp(undefined, { data: { ...imeiOk.data, status: "ROUBADO" } });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() }), "BAD_REQUEST");
  });

  it("recusa quando a pessoa informa que a ANATEL mostra IMPEDIDO", async () => {
    standardErp();
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData({ anatelManual: "IMPEDIDO" }) }), "BAD_REQUEST");
  });

  it("sem consulta oficial exige o resultado informado manualmente", async () => {
    standardErp(undefined, { data: { ...imeiOk.data, consultadoAnatel: false, status: "NÃO VERIFICADO NA ANATEL" } });
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    const err = await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() }), "BAD_REQUEST");
    expect(err.message).toContain("ANATEL");
    expect(err.message).toContain("anatel.example.test");

    await expect(
      asSeller.admin.erpEntryCreate({ id: row.id, data: formData({ anatelManual: "REGULAR" }) }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("IMEI inválido segundo o ERP é recusado", async () => {
    standardErp(undefined, { data: { ...imeiOk.data, isValid: false, status: "IMEI INVÁLIDO" } });
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    await expectTrpcError(asSeller.admin.erpEntryCreate({ id: row.id, data: formData() }), "BAD_REQUEST");
  });

  it("estado da entrada mostra se o ERP está configurado", async () => {
    const row = seedEvaluationForTesting({ status: "concluido", unit: "jardim" });
    expect(await asSeller.admin.erpEntryState({ id: row.id })).toMatchObject({ configured: true, entry: null, canEmitNfe: false });
    expect((await asOwner.admin.erpEntryState({ id: row.id })).canEmitNfe).toBe(true);
  });
});

describe("erpServiceStatus", () => {
  it("só o dono vê e informa se o login e as unidades funcionam", async () => {
    standardErp();
    await expectTrpcError(asSeller.admin.erpServiceStatus(), "FORBIDDEN");
    expect(await asOwner.admin.erpServiceStatus()).toMatchObject({ configured: true, connected: true, units: { jardim: true, gll: true } });
  });

  it("login recusado aparece como desconectado", async () => {
    mockErp(() => jsonRes({ message: "invalid" }, 401));
    const status = await asOwner.admin.erpServiceStatus();
    expect(status).toMatchObject({ configured: true, connected: false });
    expect(status.error).toContain("recusou");
  });
});

describe("valores em reais digitados no painel", () => {
  it("converte para centavos", async () => {
    const { parseMoneyToCents, centsToField } = await import("@/lib/money");
    expect(parseMoneyToCents("2.500,00")).toBe(250000);
    expect(parseMoneyToCents("R$ 3499,90")).toBe(349990);
    expect(parseMoneyToCents("2500")).toBe(250000);
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(centsToField(250000)).toBe("2500,00");
    expect(centsToField(null)).toBe("");
  });
});
