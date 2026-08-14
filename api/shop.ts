import { createRouter, publicQuery } from "./middleware";
import { getDb, ensureTables } from "./queries/connection";
import { products, settings } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { SETTING_KEYS, DEFAULT_SETTINGS } from "../contracts/types";

const PUBLIC_SETTING_KEYS = [
  SETTING_KEYS.whatsappJardim,
  SETTING_KEYS.whatsappGll,
  SETTING_KEYS.addressJardim,
  SETTING_KEYS.addressGll,
  SETTING_KEYS.mapsJardim,
  SETTING_KEYS.mapsGll,
  SETTING_KEYS.installmentsMax,
  SETTING_KEYS.installmentFees,
  SETTING_KEYS.debitPixFee,
  SETTING_KEYS.popupEnabled,
  SETTING_KEYS.heroImages,
] as const;

function getProductModelRank(name: string): number {
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Se for iPhone, extrai o número da geração (ex: "iphone 16 pro max" => 16)
  const iphoneMatch = n.match(/iphone\s*(\d+)/i);
  let gen = 0;
  if (iphoneMatch) {
    gen = parseInt(iphoneMatch[1], 10);
  } else if (n.includes("iphone x") || n.includes("iphone xs") || n.includes("iphone xr")) {
    gen = 10;
  } else if (n.includes("iphone 8")) {
    gen = 8;
  } else if (n.includes("iphone 7")) {
    gen = 7;
  } else if (n.includes("iphone se")) {
    gen = 9;
  }

  // Tier da versão (Pro Max = 0.9 > Pro = 0.8 > Plus = 0.3 > Normal = 0.1 > Mini = 0.05)
  let tier = 0.1;
  if (n.includes("pro max")) tier = 0.9;
  else if (n.includes("pro")) tier = 0.8;
  else if (n.includes("plus")) tier = 0.3;
  else if (n.includes("mini")) tier = 0.05;

  return gen * 100 + tier * 10;
}

function getProductGroupPriority(p: { brand?: string; name: string; category: string; condition: string }): number {
  const brand = (p.brand || "").toLowerCase();
  const name = p.name.toLowerCase();
  const isApple = brand.includes("apple") || name.includes("iphone") || p.category.includes("iphone");
  const isLacrado = p.condition === "lacrado" || p.condition === "novo" || p.category === "iphone_lacrado";
  const isSeminovo = p.condition === "seminovo" || p.category === "iphone_seminovo";

  if (isApple && isLacrado) {
    return 3; // 1º LUGAR: iPhones Lacrados
  }
  if (isApple || isSeminovo) {
    return 2; // 2º LUGAR: iPhones Seminovos
  }
  return 1;   // 3º LUGAR: Outras Marcas (Xiaomi, Realme, Tecno, Infinix, Androids, Acessórios)
}

function sortProductsBackend<
  T extends {
    name: string;
    brand?: string;
    condition: string;
    category: string;
    featured: boolean;
    variants: { priceCash: number; available: boolean }[];
  },
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    // 1º HIERARQUIA DE GRUPOS:
    //   - Grupo 3: iPhones Lacrados
    //   - Grupo 2: iPhones Seminovos
    //   - Grupo 1: Outras Marcas (Xiaomi, Realme, Tecno, Infinix...)
    const groupA = getProductGroupPriority(a);
    const groupB = getProductGroupPriority(b);
    if (groupA !== groupB) return groupB - groupA;

    // 2º Destaques (featured)
    const featA = a.featured ? 1 : 0;
    const featB = b.featured ? 1 : 0;
    if (featA !== featB) return featB - featA;

    // 3º Modelo mais recente primeiro (iPhone 16 > 15 > 14 > 13)
    const rankA = getProductModelRank(a.name);
    const rankB = getProductModelRank(b.name);
    if (rankA !== rankB) return rankB - rankA;

    const pricesA = a.variants.filter((v) => v.available).map((v) => v.priceCash);
    const pricesB = b.variants.filter((v) => v.available).map((v) => v.priceCash);
    const priceA = pricesA.length > 0 ? Math.min(...pricesA) : 0;
    const priceB = pricesB.length > 0 ? Math.min(...pricesB) : 0;
    return priceB - priceA;
  });
}

export const shopRouter = createRouter({
  // Catálogo público: só produtos ativos, com variantes
  products: publicQuery
    .input(
      z
        .object({
          category: z.enum(["iphone_lacrado", "iphone_seminovo", "android", "acessorio"]).optional(),
          brand: z.string().max(60).optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      ctx.resHeaders.set(
        "Cache-Control",
        "public, max-age=30, stale-while-revalidate=300",
      );
      try {
        const db = getDb();
        await ensureTables();
        const filters = [eq(products.active, true)];
        if (input?.category) {
          filters.push(eq(products.category, input.category));
        }
        if (input?.brand) {
          filters.push(eq(products.brand, input.brand));
        }

        const list = await db.query.products.findMany({
          where: and(...filters),
          with: { variants: true },
        });

        return sortProductsBackend(list);
      } catch (err) {
        console.error("Erro ao buscar produtos públicos:", err);
        return [];
      }
    }),

  featured: publicQuery.query(async () => {
    try {
      const db = getDb();
      await ensureTables();
      const list = await db.query.products.findMany({
        where: and(eq(products.active, true), eq(products.featured, true)),
        with: { variants: true },
        limit: 12,
      });
      return sortProductsBackend(list);
    } catch (err) {
      console.error("Erro ao buscar destaques públicos:", err);
      return [];
    }
  }),

  product: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      ctx.resHeaders.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
      try {
        const db = getDb();
        await ensureTables();
        const product = await db.query.products.findFirst({
          where: and(eq(products.id, input.id), eq(products.active, true)),
          with: { variants: true },
        });
        return product ?? null;
      } catch (err) {
        console.error("Erro ao consultar produto por ID:", err);
        return null;
      }
    }),

  // Configurações públicas da loja consultadas em batch único
  settings: publicQuery.query(async () => {
    try {
      const db = getDb();
      await ensureTables();
      const rows = await db
        .select()
        .from(settings)
        .where(inArray(settings.key, [...PUBLIC_SETTING_KEYS]));

      const result: Record<string, string> = {};
      for (const key of PUBLIC_SETTING_KEYS) {
        const found = rows.find((r) => r.key === key);
        result[key] = found?.value ?? DEFAULT_SETTINGS[key] ?? "";
      }
      return result;
    } catch (err) {
      console.error("Erro ao consultar settings públicas:", err);
      const fallback: Record<string, string> = {};
      for (const key of PUBLIC_SETTING_KEYS) {
        fallback[key] = DEFAULT_SETTINGS[key] ?? "";
      }
      return fallback;
    }
  }),
});
