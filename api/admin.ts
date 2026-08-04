import { createRouter, publicQuery } from "./middleware";
import { getDb, ensureTables } from "./queries/connection";
import { products, variants, settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  checkPassword,
  createToken,
  verifyToken,
  tokenFromRequest,
  getSetting,
} from "./auth";
import { SETTING_KEYS } from "../contracts/types";

function requireAdmin(req: Request) {
  const token = tokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autorizado" });
  }
}

const variantInput = z.object({
  id: z.number().optional(),
  version: z.string().default(""),
  storage: z.string().min(1),
  color: z.string().min(1),
  colorHex: z.string().optional(),
  imageUrl: z.string().optional(),
  batteryHealth: z.string().optional(),
  warranty: z.string().optional(),
  notes: z.string().optional(),
  priceCash: z.number().int().min(0),
  quantity: z.number().int().min(0).default(1),
  available: z.boolean(),
});

const productInput = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.enum(["iphone_lacrado", "iphone_seminovo", "android", "acessorio"]),
  condition: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  warranty: z.string().optional(),
  featured: z.boolean(),
  active: z.boolean(),
  variants: z.array(variantInput).min(1),
});

export const adminRouter = createRouter({
  login: publicQuery
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      const ok = await checkPassword(input.password);
      if (!ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha incorreta" });
      }
      return { token: createToken() };
    }),

  changePassword: publicQuery
    .input(z.object({ password: z.string().min(4) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      await db
        .insert(settings)
        .values({ key: SETTING_KEYS.adminPassword, value: input.password })
        .onDuplicateKeyUpdate({ set: { value: input.password } });
      return { ok: true };
    }),

  products: publicQuery.query(async ({ ctx }) => {
    requireAdmin(ctx.req);
    try {
      const db = getDb();
      await ensureTables();
      return await db.query.products.findMany({
        with: { variants: true },
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      });
    } catch (err) {
      console.error("Erro ao consultar produtos admin:", err);
      return [];
    }
  }),

  upsertProduct: publicQuery
    .input(productInput)
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      const { variants: variantList, id, ...data } = input;

      const productPayload = {
        name: data.name,
        brand: data.brand,
        category: data.category,
        condition: data.condition,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        warranty: data.warranty || "1 ano de garantia",
        featured: data.featured,
        active: data.active,
      };

      let productId: number;
      if (id) {
        await db.update(products).set(productPayload).where(eq(products.id, id));
        productId = id;
      } else {
        const result = await db.insert(products).values(productPayload);
        productId = Number(result[0].insertId);
      }

      // Remove variantes antigas e recria (simples e consistente)
      await db.delete(variants).where(eq(variants.productId, productId));
      await db.insert(variants).values(
        variantList.map((v) => ({
          productId,
          version: v.version,
          storage: v.storage,
          color: v.color,
          colorHex: v.colorHex ?? "#111111",
          imageUrl: v.imageUrl || null,
          batteryHealth: v.batteryHealth || "",
          warranty: v.warranty || "",
          notes: v.notes || "",
          priceCash: v.priceCash,
          quantity: typeof v.quantity === "number" ? v.quantity : 1,
          available: (v.quantity ?? 1) > 0 && v.available,
        })),
      );

      return { id: productId };
    }),

  deleteProduct: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await db.delete(variants).where(eq(variants.productId, input.id));
      await db.delete(products).where(eq(products.id, input.id));
      return { ok: true };
    }),

  getSettings: publicQuery.query(async ({ ctx }) => {
    requireAdmin(ctx.req);
    const keys = Object.values(SETTING_KEYS);
    const entries = await Promise.all(
      keys.map(async (key) => [key, await getSetting(key)] as const),
    );
    return Object.fromEntries(entries) as Record<string, string>;
  }),

  updateSettings: publicQuery
    .input(z.object({ values: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      const allowed = new Set<string>(Object.values(SETTING_KEYS));
      for (const [key, value] of Object.entries(input.values)) {
        if (!allowed.has(key)) continue;
        await db
          .insert(settings)
          .values({ key, value })
          .onDuplicateKeyUpdate({ set: { value } });
      }
      return { ok: true };
    }),
});
