import { createRouter, publicQuery } from "./middleware";
import { getDb, ensureTables } from "./queries/connection";
import { products, variants, settings } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  checkPassword,
  createToken,
  verifyToken,
  tokenFromRequest,
  hashPassword,
} from "./auth";
import { SETTING_KEYS, DEFAULT_SETTINGS } from "../contracts/types";

function requireAdmin(req: Request) {
  const token = tokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autorizado" });
  }
}

const variantInput = z.object({
  id: z.number().optional(),
  version: z.string().max(100).default(""),
  storage: z.string().min(1).max(50),
  color: z.string().min(1).max(50),
  colorHex: z.string().max(20).optional(),
  imageUrl: z.string().max(1000).optional(),
  batteryHealth: z.string().max(50).optional(),
  warranty: z.string().max(100).optional(),
  condition: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  priceCash: z.number().int().min(0).max(100000000),
  quantity: z.number().int().min(0).max(10000).default(1),
  available: z.boolean(),
});

const productInput = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(255),
  brand: z.string().min(1).max(60),
  category: z.enum(["iphone_lacrado", "iphone_seminovo", "android", "acessorio"]),
  condition: z.string().min(1).max(50),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().max(1000).optional(),
  warranty: z.string().max(100).optional(),
  featured: z.boolean(),
  active: z.boolean(),
  variants: z.array(variantInput).min(1),
});

export const adminRouter = createRouter({
  login: publicQuery
    .input(z.object({ password: z.string().min(1).max(128) }))
    .mutation(async ({ input }) => {
      const ok = await checkPassword(input.password);
      if (!ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha incorreta" });
      }
      return { token: createToken() };
    }),

  changePassword: publicQuery
    .input(z.object({ password: z.string().min(4).max(128) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      const hashedPassword = hashPassword(input.password);
      await db
        .insert(settings)
        .values({ key: SETTING_KEYS.adminPassword, value: hashedPassword })
        .onDuplicateKeyUpdate({ set: { value: hashedPassword } });
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
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Falha ao carregar produtos do banco de dados.",
      });
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
        name: data.name.trim(),
        brand: data.brand.trim(),
        category: data.category,
        condition: data.condition.trim(),
        description: data.description ? data.description.trim() : null,
        imageUrl: data.imageUrl ? data.imageUrl.trim() : null,
        warranty: data.warranty ? data.warranty.trim() : "1 ano de garantia",
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

      // Atualização das variantes
      await db.delete(variants).where(eq(variants.productId, productId));
      await db.insert(variants).values(
        variantList.map((v) => ({
          productId,
          version: v.version || "",
          storage: v.storage,
          color: v.color,
          colorHex: v.colorHex ?? "#111111",
          imageUrl: v.imageUrl || null,
          batteryHealth: v.batteryHealth || "",
          warranty: v.warranty || "",
          condition: v.condition || "",
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
    const db = getDb();
    await ensureTables();
    // Retorna todas as configurações exceto a senha do admin para proteção
    const publicAndAdminKeys = Object.values(SETTING_KEYS).filter(
      (k) => k !== SETTING_KEYS.adminPassword,
    );
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, publicAndAdminKeys));

    const result: Record<string, string> = {};
    for (const key of publicAndAdminKeys) {
      const found = rows.find((r) => r.key === key);
      result[key] = found?.value ?? DEFAULT_SETTINGS[key] ?? "";
    }
    return result;
  }),

  updateSettings: publicQuery
    .input(z.object({ values: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      const allowed = new Set<string>(
        Object.values(SETTING_KEYS).filter((k) => k !== SETTING_KEYS.adminPassword),
      );
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
