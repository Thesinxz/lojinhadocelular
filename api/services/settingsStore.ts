import fs from "node:fs/promises";
import path from "node:path";
import { SETTING_KEYS, DEFAULT_SETTINGS } from "../../contracts/types";
import { getDb, ensureTables } from "../queries/connection";
import { settings } from "../../db/schema";

const SETTINGS_FILE = path.resolve(process.cwd(), "db", "settings.json");

let memorySettings: Record<string, string> | null = null;

async function loadFromFile(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Arquivo não existe ainda ou erro de leitura
  }
  return {};
}

async function saveToFile(data: Record<string, string>): Promise<void> {
  try {
    const toSave = { ...data };
    if (toSave[SETTING_KEYS.adminPassword] === "lojinha123") {
      delete toSave[SETTING_KEYS.adminPassword];
    }
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(toSave, null, 2), "utf-8");
  } catch (err) {
    console.error("Aviso: Falha ao salvar settings em arquivo local:", err);
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  if (memorySettings === null) {
    const fileData = await loadFromFile();
    memorySettings = { ...DEFAULT_SETTINGS, ...fileData };

    // Tenta carregar do banco de dados MySQL se disponível
    if (process.env.DATABASE_URL && process.env.NODE_ENV !== "test") {
      try {
        const db = getDb();
        await ensureTables();
        const rows = await db.select().from(settings);
        for (const row of rows) {
          if (row.key && row.value != null) {
            memorySettings[row.key] = row.value;
          }
        }
        // Salva backup local sincronizado
        await saveToFile(memorySettings);
      } catch (err) {
        console.warn("[Settings] Aviso: Banco MySQL indisponível, usando armazenamento local:", err);
      }
    }
  }

  return { ...memorySettings };
}

export async function saveSettings(
  newValues: Record<string, string>,
): Promise<{ ok: boolean }> {
  const current = await getAllSettings();
  const allowed = new Set<string>(Object.values(SETTING_KEYS));

  const updated: Record<string, string> = { ...current };
  const toDb: Array<{ key: string; value: string }> = [];

  for (const [key, value] of Object.entries(newValues)) {
    if (!allowed.has(key)) continue;
    const strVal = String(value ?? "");
    updated[key] = strVal;
    toDb.push({ key, value: strVal });
  }

  memorySettings = updated;
  // Salva no arquivo local imediatamente (garante persistência 100% mesmo sem MySQL)
  await saveToFile(updated);

  // Tenta sincronizar com o banco MySQL se disponível
  if (toDb.length > 0 && process.env.DATABASE_URL && process.env.NODE_ENV !== "test") {
    try {
      const db = getDb();
      await ensureTables();
      for (const item of toDb) {
        await db
          .insert(settings)
          .values(item)
          .onDuplicateKeyUpdate({ set: { value: item.value } });
      }
    } catch (err) {
      console.warn("[Settings] Aviso: Falha ao persistir no MySQL. Dados mantidos com sucesso no arquivo local:", err);
    }
  }

  return { ok: true };
}

export async function getShopPublicSettings(
  publicKeys: readonly string[],
): Promise<Record<string, string>> {
  const all = await getAllSettings();
  const result: Record<string, string> = {};
  for (const key of publicKeys) {
    result[key] = all[key] ?? DEFAULT_SETTINGS[key] ?? "";
  }
  return result;
}

export async function getAdminSettings(): Promise<Record<string, string>> {
  const all = await getAllSettings();
  const result: Record<string, string> = {};
  for (const key of Object.values(SETTING_KEYS)) {
    if (key !== SETTING_KEYS.adminPassword) {
      result[key] = all[key] ?? DEFAULT_SETTINGS[key] ?? "";
    }
  }
  return result;
}

export async function getSingleSetting(key: string): Promise<string> {
  const all = await getAllSettings();
  return all[key] ?? DEFAULT_SETTINGS[key] ?? "";
}

export async function saveSingleSetting(key: string, value: string): Promise<{ ok: boolean }> {
  return saveSettings({ [key]: value });
}

/** Limpa cache de memória (útil em testes) */
export function clearSettingsCache(): void {
  memorySettings = null;
}
