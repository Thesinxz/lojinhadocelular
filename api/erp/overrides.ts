import fs from "node:fs/promises";
import path from "node:path";
import type { CategoryValue } from "../../contracts/types";
import type { ShopProduct } from "./types";
import { getDb, ensureTables } from "../queries/connection";
import { settings } from "../../db/schema";
import { eq } from "drizzle-orm";

export interface ErpProductOverride {
  imageUrl?: string;
  videoUrl?: string;
  batteryHealth?: string;
  warranty?: string;
  description?: string;
  featured?: boolean;
  active?: boolean;
  category?: CategoryValue;
  customName?: string;
}

const OVERRIDES_FILE = path.resolve(process.cwd(), "db", "erp_overrides.json");
const SETTINGS_KEY = "erp_product_overrides";

let memoryOverrides: Record<string, ErpProductOverride> | null = null;

async function loadFromFile(): Promise<Record<string, ErpProductOverride>> {
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveToFile(data: Record<string, ErpProductOverride>): Promise<void> {
  try {
    await fs.mkdir(path.dirname(OVERRIDES_FILE), { recursive: true });
    await fs.writeFile(OVERRIDES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Aviso: Falha ao salvar overrides em arquivo local:", err);
  }
}

export async function getErpOverrides(): Promise<Record<string, ErpProductOverride>> {
  if (memoryOverrides !== null) {
    return memoryOverrides;
  }

  // Tenta carregar do arquivo local primeiro (rápido e offline)
  const fileData = await loadFromFile();
  memoryOverrides = { ...fileData };

  // Se o banco de dados estiver configurado e não for ambiente de teste, tenta sincronizar
  if (process.env.DATABASE_URL && process.env.NODE_ENV !== "test") {
    try {
      const db = getDb();
      await ensureTables();
      const rows = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY));
      if (rows.length > 0 && rows[0].value) {
        const dbData = JSON.parse(rows[0].value) as Record<string, ErpProductOverride>;
        memoryOverrides = { ...fileData, ...dbData };
      }
    } catch {
      // Banco não disponível no momento, prossegue com dados do arquivo
    }
  }

  return memoryOverrides;
}

const DANGEROUS_OBJECT_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

export function isSafeOverrideKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim().toLowerCase();
  return trimmed.length > 0 && !DANGEROUS_OBJECT_KEYS.has(trimmed);
}

export async function getErpOverride(externalId: string): Promise<ErpProductOverride | null> {
  if (!isSafeOverrideKey(externalId)) return null;
  const all = await getErpOverrides();
  return Object.prototype.hasOwnProperty.call(all, externalId) ? all[externalId] : null;
}

export async function saveErpOverride(
  externalId: string,
  data: Partial<ErpProductOverride>,
): Promise<void> {
  if (!isSafeOverrideKey(externalId)) {
    throw new Error(`[SECURITY] Chave de override inválida ou reservada: "${externalId}"`);
  }

  const all = await getErpOverrides();
  const current = Object.prototype.hasOwnProperty.call(all, externalId) ? all[externalId] : {};

  all[externalId] = {
    ...current,
    ...data,
  };
  memoryOverrides = all;

  // Persiste no arquivo local
  await saveToFile(all);

  // Tenta persistir no banco de dados se conectado e não for teste
  if (process.env.DATABASE_URL && process.env.NODE_ENV !== "test") {
    try {
      const db = getDb();
      await ensureTables();
      const serialized = JSON.stringify(all);
      await db
        .insert(settings)
        .values({ key: SETTINGS_KEY, value: serialized })
        .onDuplicateKeyUpdate({ set: { value: serialized } });
    } catch {
      // Silencioso se banco estiver offline no ambiente de dev local
    }
  }
}

export function setMemoryOverridesForTesting(data: Record<string, ErpProductOverride> | null) {
  memoryOverrides = data;
}

export function applyOverridesToProducts(
  products: ShopProduct[],
  overrides: Record<string, ErpProductOverride>,
): ShopProduct[] {
  return products.map((p) => {
    const override = p.externalId ? overrides[p.externalId] : null;
    if (!override) return p;

    const updated = { ...p };

    if (override.customName) {
      updated.name = override.customName.trim();
    }
    if (override.category) {
      updated.category = override.category;
    }
    if (typeof override.featured === "boolean") {
      updated.featured = override.featured;
    }
    if (typeof override.active === "boolean") {
      updated.active = override.active;
    }
    if (override.description !== undefined) {
      updated.description = override.description ? override.description.trim() : null;
    }
    if (override.imageUrl !== undefined && override.imageUrl.trim()) {
      updated.imageUrl = override.imageUrl.trim();
    }
    if (override.videoUrl !== undefined) {
      updated.videoUrl = override.videoUrl ? override.videoUrl.trim() : null;
    }
    if (override.warranty !== undefined && override.warranty.trim()) {
      updated.warranty = override.warranty.trim();
    }

    // Aplica os overrides nas variantes filhas
    updated.variants = p.variants.map((v) => {
      const vUpdated = { ...v };
      if (override.imageUrl && override.imageUrl.trim()) {
        vUpdated.imageUrl = override.imageUrl.trim();
      }
      if (override.videoUrl !== undefined) {
        vUpdated.videoUrl = override.videoUrl ? override.videoUrl.trim() : null;
      }
      if (override.batteryHealth !== undefined && override.batteryHealth.trim()) {
        vUpdated.batteryHealth = override.batteryHealth.trim();
      }
      if (override.warranty !== undefined && override.warranty.trim()) {
        vUpdated.warranty = override.warranty.trim();
      }
      return vUpdated;
    });

    return updated;
  });
}
