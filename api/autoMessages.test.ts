import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, parseAutoMessages, SETTING_KEYS } from "@contracts/types";
import { normalizeBrazilNumber, parseDestinations } from "./services/evolution";
import { dispatchCustomerEvent } from "./services/autoMessages";
import { notifyEvaluationCreated } from "./services/evaluationNotification";
import { listEvaluationMessages, resetEvaluationMessagesForTesting } from "./services/evaluationMessages";
import { resetEvaluationStoreForTesting, seedEvaluationForTesting } from "./services/evaluationStore";
import { clearSettingsCache, saveSettings } from "./services/settingsStore";

function stubEvolution() {
  vi.stubEnv("EVOLUTION_API_URL", "https://evo.example.test/");
  vi.stubEnv("EVOLUTION_API_KEY", "key");
  vi.stubEnv("EVOLUTION_INSTANCE", "loja");
}

beforeEach(async () => {
  resetEvaluationStoreForTesting();
  resetEvaluationMessagesForTesting();
  clearSettingsCache();
  await saveSettings({ [SETTING_KEYS.autoMessages]: "" });
});

afterEach(async () => {
  // settings.json é compartilhado com outros testes: devolve o padrão.
  await saveSettings({
    [SETTING_KEYS.autoMessages]: DEFAULT_SETTINGS[SETTING_KEYS.autoMessages],
    [SETTING_KEYS.valuationConfig]: DEFAULT_SETTINGS[SETTING_KEYS.valuationConfig],
    [SETTING_KEYS.whatsappGll]: DEFAULT_SETTINGS[SETTING_KEYS.whatsappGll],
  });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("normalizeBrazilNumber", () => {
  it("adiciona o DDI 55 e remove máscara", () => {
    expect(normalizeBrazilNumber("(67) 99208-6012")).toBe("5567992086012");
    expect(normalizeBrazilNumber("+55 67 99208-6012")).toBe("5567992086012");
    expect(normalizeBrazilNumber("067 3333-4444")).toBe("556733334444");
  });

  it("recusa números inválidos", () => {
    expect(normalizeBrazilNumber("123")).toBeNull();
    expect(normalizeBrazilNumber("")).toBeNull();
    expect(normalizeBrazilNumber(null)).toBeNull();
  });
});

describe("destinos da equipe", () => {
  it("aceita telefones e grupos e ignora o que é inválido ou repetido", () => {
    expect(normalizeBrazilNumber("120363025246125486@g.us")).toBe("120363025246125486@g.us");
    expect(normalizeBrazilNumber("abc@g.us")).toBeNull();
    expect(parseDestinations("(67) 99999-0001, 67999990001\n120363025246125486@g.us; xyz\n")).toEqual([
      "5567999990001",
      "120363025246125486@g.us",
    ]);
    expect(parseDestinations("")).toEqual([]);
    expect(parseDestinations(undefined)).toEqual([]);
  });
});

describe("parseAutoMessages", () => {
  it("usa o padrão para JSON vazio ou inválido", () => {
    expect(parseAutoMessages("").events.created.enabled).toBe(true);
    expect(parseAutoMessages("{oops").events.offered.enabled).toBe(false);
  });

  it("aplica só os campos válidos", () => {
    const config = parseAutoMessages(
      JSON.stringify({ customerEnabled: false, events: { created: { enabled: false, body: "   " } } }),
    );
    expect(config.customerEnabled).toBe(false);
    expect(config.events.created.enabled).toBe(false);
    expect(config.events.created.body).toContain("{nome}");
  });
});

describe("Mensagens automáticas ao cliente", () => {
  it("não faz nada sem a Evolution configurada", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const row = seedEvaluationForTesting();
    expect(await dispatchCustomerEvent("created", row.id)).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia a mensagem renderizada e registra no histórico", async () => {
    stubEvolution();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const row = seedEvaluationForTesting({ name: "Maria Souza", whatsapp: "(67) 99999-0000" });

    expect(await dispatchCustomerEvent("created", row.id)).toBe("sent");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://evo.example.test/message/sendText/loja");
    expect((init.headers as Record<string, string>).apikey).toBe("key");
    const body = JSON.parse(String(init.body));
    expect(body.number).toBe("5567999990000");
    expect(body.text).toContain("Maria");
    expect(body.text).toContain("iPhone 13");

    const history = await listEvaluationMessages(row.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ event: "created", recipient: "cliente", status: "sent" });
  });

  it("não reenvia automaticamente o mesmo evento, mas permite reenvio manual", async () => {
    stubEvolution();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const row = seedEvaluationForTesting();

    await dispatchCustomerEvent("created", row.id);
    expect(await dispatchCustomerEvent("created", row.id)).toBe("skipped");
    expect(await dispatchCustomerEvent("created", row.id, { force: true })).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("respeita eventos desligados e registra falhas", async () => {
    stubEvolution();
    const row = seedEvaluationForTesting();
    const fetchMock = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await dispatchCustomerEvent("concluded", row.id)).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();

    expect(await dispatchCustomerEvent("created", row.id)).toBe("failed");
    const history = await listEvaluationMessages(row.id);
    expect(history[0]).toMatchObject({ status: "failed" });
    expect(history[0].error).toContain("HTTP 500");
  });

  it("não envia proposta quando os preços são ocultos ao cliente", async () => {
    stubEvolution();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await saveSettings({
      [SETTING_KEYS.valuationConfig]: JSON.stringify({ hidePricesToClient: true }),
      [SETTING_KEYS.autoMessages]: JSON.stringify({ events: { offered: { enabled: true } } }),
    });
    const row = seedEvaluationForTesting({ offeredValue: 150000 });
    expect(await dispatchCustomerEvent("offered", row.id)).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Aviso à equipe pela Evolution", () => {
  it("envia para o WhatsApp da unidade escolhida", async () => {
    stubEvolution();
    vi.stubEnv("EVALUATION_NOTIFICATION_WEBHOOK_URL", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await saveSettings({ [SETTING_KEYS.whatsappGll]: "5567998206533" });

    const result = await notifyEvaluationCreated({
      id: 7,
      name: "Cliente",
      whatsapp: "67999990000",
      model: "iPhone 14",
      unit: "gll",
    });

    expect(result).toEqual({ status: "sent" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)).number).toBe("5567998206533");
  });
});

describe("números próprios da equipe", () => {
  afterEach(async () => {
    await saveSettings({ [SETTING_KEYS.teamNotifyNumbers]: "" });
  });

  it("usa os números da equipe (inclusive grupo) em vez do WhatsApp da unidade", async () => {
    stubEvolution();
    vi.stubEnv("EVALUATION_NOTIFICATION_WEBHOOK_URL", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await saveSettings({
      [SETTING_KEYS.whatsappJardim]: "5567992086012",
      [SETTING_KEYS.teamNotifyNumbers]: "(67) 98888-0001\n120363025246125486@g.us",
    });

    const result = await notifyEvaluationCreated({ id: 9, name: "Cliente", whatsapp: "67999990000", model: "iPhone 14", unit: "jardim" });

    expect(result).toEqual({ status: "sent" });
    const numbers = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).number);
    expect(numbers).toEqual(["5567988880001", "120363025246125486@g.us"]);
    expect(numbers).not.toContain("5567992086012");
    await saveSettings({ [SETTING_KEYS.whatsappJardim]: DEFAULT_SETTINGS[SETTING_KEYS.whatsappJardim] });
  });
});
