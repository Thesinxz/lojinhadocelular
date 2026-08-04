import { createRouter, publicQuery } from "./middleware";
import { getDb, ensureTables } from "./queries/connection";
import { products } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSetting } from "./auth";
import { SETTING_KEYS } from "../contracts/types";

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

function sortProductsBackend<
  T extends {
    name: string;
    condition: string;
    category: string;
    featured: boolean;
    variants: { priceCash: number; available: boolean }[];
  },
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const featA = a.featured ? 1 : 0;
    const featB = b.featured ? 1 : 0;
    if (featA !== featB) return featB - featA;

    const isLacradoA =
      a.condition === "lacrado" || a.condition === "novo" || a.category === "iphone_lacrado" ? 1 : 0;
    const isLacradoB =
      b.condition === "lacrado" || b.condition === "novo" || b.category === "iphone_lacrado" ? 1 : 0;
    if (isLacradoA !== isLacradoB) return isLacradoB - isLacradoA;

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
          category: z.string().optional(),
          brand: z.string().optional(),
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
        if (input?.category)
          filters.push(
            eq(
              products.category,
              input.category as
                | "iphone_lacrado"
                | "iphone_seminovo"
                | "android"
                | "acessorio",
            ),
          );
        if (input?.brand) filters.push(eq(products.brand, input.brand));

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
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      ctx.resHeaders.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
      const db = getDb();
      const product = await db.query.products.findFirst({
        where: and(eq(products.id, input.id), eq(products.active, true)),
        with: { variants: true },
      });
      return product ?? null;
    }),

  // Configurações públicas da loja (sem a senha do admin)
  settings: publicQuery.query(async () => {
    const entries = await Promise.all(
      PUBLIC_SETTING_KEYS.map(async (key) => [key, await getSetting(key)] as const),
    );
    return Object.fromEntries(entries) as Record<string, string>;
  }),
});
