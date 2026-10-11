import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SETTING_KEYS } from "@contracts/types";
import { appRouter } from "./router";
import { createToken, resetLoginRateLimitForTesting } from "./auth";
import { createUser, resetUserStoreForTesting } from "./services/userStore";
import { resetAuditLogForTesting } from "./services/auditLog";
import { resetEvaluationStoreForTesting, seedEvaluationForTesting } from "./services/evaluationStore";
import { clearSettingsCache, saveSettings } from "./services/settingsStore";

const anonymous = () =>
  appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { "x-forwarded-for": "203.0.113.99" } }),
    resHeaders: new Headers(),
  });

async function callerFor(role: "dono" | "vendedor") {
  const user = await createUser({ username: role, name: role, password: "senha-de-teste", role, unit: null, canEditPrices: false });
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { authorization: `Bearer ${createToken(user.id)}`, "x-forwarded-for": "203.0.113.98" } }),
    resHeaders: new Headers(),
  });
}

const answers = { model: "iPhone 13", storage: "128GB", batteryPercent: 92, faceId: "Sim", icloudFree: "Sim" };

beforeEach(async () => {
  resetUserStoreForTesting();
  resetAuditLogForTesting();
  resetLoginRateLimitForTesting();
  resetEvaluationStoreForTesting();
  clearSettingsCache();
  await saveSettings({ [SETTING_KEYS.valuationConfig]: "" });
});

afterEach(async () => {
  await saveSettings({ [SETTING_KEYS.valuationConfig]: "" });
});

describe("preços e regras do motor só para quem está logado", () => {
  it("a API pública de configurações não traz a configuração do motor", async () => {
    await saveSettings({ [SETTING_KEYS.valuationConfig]: JSON.stringify({ customBasePrices: { "iphone 13": 9999 } }) });
    clearSettingsCache();
    const publicSettings = await anonymous().shop.settings();
    expect(Object.keys(publicSettings)).not.toContain(SETTING_KEYS.valuationConfig);
    expect(JSON.stringify(publicSettings)).not.toContain("9999");
  });

  it("opções públicas do Troca Fácil: só se mostra valor e o aviso legal", async () => {
    const options = await anonymous().shop.tradeInOptions();
    expect(Object.keys(options).sort()).toEqual(["disclaimer", "hidePrices"]);
    expect(options.hidePrices).toBe(true);
  });

  it("a cotação pública não calcula nada enquanto os valores estão ocultos (padrão)", async () => {
    expect(await anonymous().shop.tradeInQuote(answers)).toBeNull();
  });

  it("a cotação pública só responde quando o dono libera os valores, e só para aquele aparelho", async () => {
    await saveSettings({ [SETTING_KEYS.valuationConfig]: JSON.stringify({ hidePricesToClient: false }) });
    clearSettingsCache();
    const quote = await anonymous().shop.tradeInQuote(answers);
    expect(quote?.priceable).toBe(true);
    expect(quote?.maxEstimatedValue).toBeGreaterThan(0);
  });

  it("rotas de preço do painel exigem login e permissão", async () => {
    const evaluation = seedEvaluationForTesting({});
    await expect(anonymous().admin.priceList({ customBasePrices: {} })).rejects.toThrow();
    await expect(anonymous().admin.valuationConfig()).rejects.toThrow();
    await expect(anonymous().admin.evaluationValuation({ id: evaluation.id })).rejects.toThrow();
    await expect(
      anonymous().admin.simulateValuation({ model: "iPhone 13", storage: "128GB", batteryPercent: 90, visualCondition: "", hasBox: false, loyal: false, defects: [], config: {} }),
    ).rejects.toThrow();

    const owner = await callerFor("dono");
    expect((await owner.admin.priceList({ customBasePrices: {} })).length).toBeGreaterThan(10);
    expect((await owner.admin.valuationConfig()).adjustments?.defects?.faceId?.percent).toBe(15);
    expect((await owner.admin.evaluationValuation({ id: evaluation.id })).valuation.priceable).toBe(true);
  });

  it("salvar a configuração do motor sanea valores absurdos", async () => {
    const owner = await callerFor("dono");
    await owner.admin.updateSettings({
      values: { [SETTING_KEYS.valuationConfig]: JSON.stringify({ globalMultiplier: "abc", adjustments: { rangePercent: 999 } }) },
    });
    const saved = await owner.admin.valuationConfig();
    expect(saved.globalMultiplier).toBe(1);
    expect(saved.adjustments?.rangePercent).toBe(25);
  });
});

describe("o código do site (src/) não pode puxar o motor de preços", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it("nenhum arquivo de src/ importa de api/ (só tipos de contracts/)", () => {
    const offenders = walk(path.resolve(__dirname, "../src")).filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      // `import type` some no build; só importações reais de api/ levariam código de preços ao navegador.
      return /import\s+(?!type\b)[^"';]*from\s+["'](?:\.\.\/)+api\//.test(text) || /from\s+["']@\/?api\//.test(text) || /valuationEngine/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});
