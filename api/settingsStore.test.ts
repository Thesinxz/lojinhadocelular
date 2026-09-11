import { describe, it, expect, beforeEach } from "vitest";
import {
  saveSettings,
  getShopPublicSettings,
  getAdminSettings,
  getSingleSetting,
  clearSettingsCache,
} from "./services/settingsStore";
import { SETTING_KEYS } from "../contracts/types";

describe("Armazenamento Resiliente de Configurações (settingsStore)", () => {
  beforeEach(() => {
    clearSettingsCache();
  });

  it("deve salvar e carregar a mensagem de garantia com sucesso", async () => {
    const customText = "Garantia especial de 1 ano e procedência verificada.";
    const saveRes = await saveSettings({
      [SETTING_KEYS.warrantyBadgeText]: customText,
    });

    expect(saveRes.ok).toBe(true);

    const publicSettings = await getShopPublicSettings([SETTING_KEYS.warrantyBadgeText]);
    expect(publicSettings[SETTING_KEYS.warrantyBadgeText]).toBe(customText);

    const adminSettings = await getAdminSettings();
    expect(adminSettings[SETTING_KEYS.warrantyBadgeText]).toBe(customText);

    const singleVal = await getSingleSetting(SETTING_KEYS.warrantyBadgeText);
    expect(singleVal).toBe(customText);
  });

  it("nunca deve expor a senha de admin nas configurações do painel", async () => {
    const adminSettings = await getAdminSettings();
    expect(adminSettings).not.toHaveProperty(SETTING_KEYS.adminPassword);
  });
});
