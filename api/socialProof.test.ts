import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, SETTING_KEYS } from "@contracts/types";
import { appRouter } from "./router";
import { env } from "./lib/env";
import { getRecentBuyers, resetSocialProofCacheForTesting, sanitizeBuyers } from "./services/socialProof";
import { clearSettingsCache, saveSettings } from "./services/settingsStore";

const item = (patch: Record<string, unknown> = {}) => ({ first_name: "Andressa", last_initial: "B", model: "iPhone 11", brand: "Apple", ...patch });
const envelope = (items: unknown[]) => ({ success: true, data: { items } });
const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const originalEnabled = env.erpCatalogEnabled;

beforeEach(async () => {
  resetSocialProofCacheForTesting();
  clearSettingsCache();
  env.erpCatalogEnabled = true;
  await saveSettings({ [SETTING_KEYS.socialProofEnabled]: "0" });
});

afterEach(async () => {
  env.erpCatalogEnabled = originalEnabled;
  await saveSettings({
    [SETTING_KEYS.socialProofEnabled]: "0",
    [SETTING_KEYS.socialProofTitle]: DEFAULT_SETTINGS[SETTING_KEYS.socialProofTitle],
  });
  vi.unstubAllGlobals();
});

describe("sanitizeBuyers", () => {
  it("aceita o formato esperado e padroniza nome e inicial", () => {
    expect(sanitizeBuyers(envelope([item({ first_name: "joão", last_initial: "g." })]))).toEqual([
      { firstName: "João", lastInitial: "G", model: "iPhone 11", brand: "Apple" },
    ]);
  });

  it("aceita nome sem inicial", () => {
    expect(sanitizeBuyers(envelope([item({ last_initial: undefined })]))[0].lastInitial).toBe("");
  });

  it("descarta o que pode ser dado sensível ou inválido", () => {
    const result = sanitizeBuyers(
      envelope([
        item({ first_name: "Ana Maria" }), // mais de um nome
        item({ first_name: "A" }), // curto
        item({ first_name: "R2D2" }), // dígitos
        item({ model: "iPhone 13 358765098765432" }), // IMEI
        item({ model: "contato@x.com" }), // e-mail
        item({ model: "<script>" }),
        item({ model: "" }),
        item({ brand: "12345678901" }),
        null,
        "texto",
      ]),
    );
    expect(result).toEqual([]);
  });

  it("não deixa passar campos extras (CPF, telefone etc.)", () => {
    const [buyer] = sanitizeBuyers(envelope([item({ cpf: "52998224725", phone: "67999990000", id: "x" })]));
    expect(Object.keys(buyer).sort()).toEqual(["brand", "firstName", "lastInitial", "model"]);
  });

  it("remove duplicados e limita a 30", () => {
    expect(sanitizeBuyers(envelope([item(), item()]))).toHaveLength(1);
    const many = Array.from({ length: 40 }, (_, i) => item({ first_name: `Nome${String.fromCharCode(97 + (i % 26))}x`.replace(/\d/g, ""), model: `iPhone ${i}` }));
    expect(sanitizeBuyers(envelope(many))).toHaveLength(30);
  });

  it("formatos desconhecidos viram lista vazia", () => {
    expect(sanitizeBuyers(null)).toEqual([]);
    expect(sanitizeBuyers({ data: { items: "x" } })).toEqual([]);
    expect(sanitizeBuyers({ foo: 1 })).toEqual([]);
  });
});

describe("getRecentBuyers (cache e falhas)", () => {
  it("busca no endpoint do ERP e usa cache por 10 minutos", async () => {
    const fetchMock = vi.fn(async () => jsonRes(envelope([item()])));
    vi.stubGlobal("fetch", fetchMock);
    const t0 = 1_000_000;
    expect(await getRecentBuyers(t0)).toHaveLength(1);
    expect(await getRecentBuyers(t0 + 5 * 60_000)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls as unknown as string[][])[0][0])).toMatch(/\/api\/storefront\/.+\/compras-recentes\?limit=30$/);
    await getRecentBuyers(t0 + 11 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("se o ERP falha, usa a última lista por até 1 hora e depois esconde", async () => {
    const t0 = 5_000_000;
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(envelope([item()]))));
    await getRecentBuyers(t0);

    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({}, 500)));
    expect(await getRecentBuyers(t0 + 20 * 60_000)).toHaveLength(1);
    expect(await getRecentBuyers(t0 + 70 * 60_000)).toEqual([]);
  });

  it("endpoint inexistente (404) ou rede fora: lista vazia, sem erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({}, 404)));
    expect(await getRecentBuyers()).toEqual([]);
    resetSocialProofCacheForTesting();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(await getRecentBuyers()).toEqual([]);
  });

  it("catálogo do ERP desativado: nem consulta", async () => {
    env.erpCatalogEnabled = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getRecentBuyers()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("shop.socialProof (rota pública)", () => {
  const caller = () =>
    appRouter.createCaller({ req: new Request("http://localhost/api/trpc"), resHeaders: new Headers() });

  it("desligada por padrão: não consulta o ERP e devolve só o título", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await caller().shop.socialProof();
    expect(res.items).toEqual([]);
    expect(res.title).toContain("família");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ligada: devolve os compradores validados", async () => {
    await saveSettings({ [SETTING_KEYS.socialProofEnabled]: "1", [SETTING_KEYS.socialProofTitle]: "Quem confia" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(envelope([item(), item({ first_name: "Henrique", last_initial: "B", model: "iPhone 11 Pro Max" })]))));
    const res = await caller().shop.socialProof();
    expect(res.title).toBe("Quem confia");
    expect(res.items.map((b) => b.firstName)).toEqual(["Andressa", "Henrique"]);
  });
});
