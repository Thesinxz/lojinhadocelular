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

        return await db.query.products.findMany({
          where: and(...filters),
          with: { variants: true },
          orderBy: (p, { desc }) => [desc(p.featured), desc(p.createdAt)],
        });
      } catch (err) {
        console.error("Erro ao buscar produtos públicos:", err);
        return [];
      }
    }),

  featured: publicQuery.query(async () => {
    try {
      const db = getDb();
      await ensureTables();
      return await db.query.products.findMany({
        where: and(eq(products.active, true), eq(products.featured, true)),
        with: { variants: true },
        orderBy: (p, { desc }) => [desc(p.createdAt)],
        limit: 8,
      });
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
