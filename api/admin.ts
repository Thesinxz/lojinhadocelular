import { createRouter, publicQuery } from "./middleware";
import { getDb, ensureTables, getPool } from "./queries/connection";
import { products, variants, evaluations } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  checkPassword,
  createToken,
  verifyToken,
  tokenFromRequest,
  hashPassword,
} from "./auth";
import { SETTING_KEYS } from "../contracts/types";
import { env } from "./lib/env";
import { getErpCatalog, clearErpCache } from "./erp/service";
import { getErpOverride, saveErpOverride } from "./erp/overrides";
import { getAdminSettings, saveSettings } from "./services/settingsStore";
import {
  notifyEvaluationCreated,
  persistEvaluationNotificationStatus,
} from "./services/evaluationNotification";
import {
  deleteEvaluationPhotoObjects,
  getPhotoObjectKey,
  hydrateEvaluationPhotos,
  isEvaluationPhotoStorageConfigured,
  parseStoredEvaluationPhotos,
  prepareEvaluationPhotosForStorage,
} from "./services/evaluationPhotoStorage";

function requireAdmin(req: Request) {
  const token = tokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autorizado" });
  }
}

async function hydrateEvaluationRecord<T extends { photos?: unknown }>(record: T): Promise<T> {
  const photos = parseStoredEvaluationPhotos(record.photos);
  if (!photos.length) return record;
  return {
    ...record,
    photos: await hydrateEvaluationPhotos(photos),
  };
}

const variantInput = z.object({
  id: z.number().optional(),
  version: z.string().max(100).default(""),
  storage: z.string().min(1).max(50),
  color: z.string().min(1).max(50),
  colorHex: z.string().max(20).optional(),
  imageUrl: z.string().max(1000).optional(),
  videoUrl: z.string().max(1000).optional(),
  sku: z.string().max(60).optional(),
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
  videoUrl: z.string().max(1000).optional(),
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
      const hashedPassword = hashPassword(input.password);
      await saveSettings({ [SETTING_KEYS.adminPassword]: hashedPassword });
      return { ok: true };
    }),

  products: publicQuery.query(async ({ ctx }) => {
    requireAdmin(ctx.req);
    // Se o ERP estiver ativado, o catálogo oficial vem do ERP
    if (env.erpCatalogEnabled) {
      const erp = await getErpCatalog();
      if (erp.status === "ok") {
        return erp.products;
      }
      return [];
    }

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
        name: data.name.trim(),
        brand: data.brand.trim(),
        category: data.category,
        condition: data.condition.trim(),
        description: data.description ? data.description.trim() : null,
        imageUrl: data.imageUrl ? data.imageUrl.trim() : null,
        videoUrl: data.videoUrl ? data.videoUrl.trim() : null,
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
          videoUrl: v.videoUrl || null,
          sku: v.sku ? v.sku.trim() : "",
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
    return await getAdminSettings();
  }),

  updateSettings: publicQuery
    .input(z.object({ values: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      return await saveSettings(input.values);
    }),

  evaluations: publicQuery.query(async ({ ctx }) => {
    requireAdmin(ctx.req);
    try {
      const db = getDb();
      await ensureTables();
      const rows = await db
        .select()
        .from(evaluations)
        .orderBy(desc(evaluations.createdAt));
      return await Promise.all(rows.map(row => hydrateEvaluationRecord(row)));
    } catch (err: any) {
      console.warn("Consulta de avaliações via Drizzle falhou, tentando fallback SQL direto:", err?.message || err);
      try {
        const pool = getPool();
        if (pool) {
          const [rows]: any = await pool.query(
            "SELECT * FROM evaluations ORDER BY created_at DESC"
          );
          if (Array.isArray(rows)) {
            const mapped = rows.map((r: any) => ({
              id: Number(r.id),
              name: String(r.name || ""),
              whatsapp: String(r.whatsapp || ""),
              model: String(r.model || ""),
              storage: String(r.storage || ""),
              color: String(r.color || ""),
              purchaseLocation: String(r.purchase_location || ""),
              targetModel: String(r.target_model || ""),
              faceId: String(r.face_id || ""),
              screenOriginal: String(r.screen_original || ""),
              batteryOriginal: String(r.battery_original || ""),
              camerasOk: String(r.cameras_ok || ""),
              audioOk: String(r.audio_ok || ""),
              chargingPortOk: String(r.charging_port_ok || ""),
              openedBefore: String(r.opened_before || ""),
              hasBox: String(r.has_box || ""),
              visualCondition: String(r.visual_condition || ""),
              condition: String(r.condition || "Em análise"),
              battery: String(r.battery || ""),
              notes: r.notes ? String(r.notes) : null,
              photosCount: Number(r.photos_count || 0),
              photos: r.photos ? String(r.photos) : null,
              status: (r.status as any) || "pendente",
              notificationStatus: String(r.notification_status || "not_configured"),
              notificationError: r.notification_error ? String(r.notification_error) : null,
              notifiedAt: r.notified_at ? new Date(r.notified_at) : null,
              createdAt: r.created_at ? new Date(r.created_at) : new Date(),
            }));
            return await Promise.all(mapped.map(row => hydrateEvaluationRecord(row)));
          }
        }
      } catch (sqlErr: any) {
        console.error("Erro fatal no fallback SQL de avaliações:", sqlErr?.message || sqlErr);
      }
      return [];
    }
  }),

  updateEvaluationStatus: publicQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["pendente", "atendimento", "concluido", "recusado"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      await db
        .update(evaluations)
        .set({ status: input.status })
        .where(eq(evaluations.id, input.id));
      return { ok: true };
    }),

  deleteEvaluation: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      const evaluation = await db.query.evaluations.findFirst({
        where: eq(evaluations.id, input.id),
      });
      const objectKeys = parseStoredEvaluationPhotos(evaluation?.photos)
        .map(getPhotoObjectKey)
        .filter((key): key is string => Boolean(key));
      await db.delete(evaluations).where(eq(evaluations.id, input.id));
      try {
        await deleteEvaluationPhotoObjects(objectKeys);
      } catch (error) {
        console.error("Avaliação removida, mas não foi possível remover todas as fotos do S3:", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return { ok: true };
    }),

  addEvaluationPhotos: publicQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        photos: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            url: z.string(),
            storage: z.enum(["inline", "s3"]).optional(),
            objectKey: z.string().max(300).optional(),
            name: z.string().optional(),
            size: z.number().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      const currentEvaluation = await db.query.evaluations.findFirst({
        where: eq(evaluations.id, input.id),
      });
      const currentKeys = new Set(
        parseStoredEvaluationPhotos(currentEvaluation?.photos)
          .map(getPhotoObjectKey)
          .filter((key): key is string => Boolean(key)),
      );
      const storedPhotos = await prepareEvaluationPhotosForStorage(input.photos);
      const photosJson = JSON.stringify(storedPhotos);
      try {
        await db
          .update(evaluations)
          .set({
            photos: photosJson,
            photosCount: storedPhotos.length,
          })
          .where(eq(evaluations.id, input.id));
      } catch {
        const pool = getPool();
        if (pool) {
          await pool.query(
            "UPDATE evaluations SET photos = ?, photos_count = ? WHERE id = ?",
            [photosJson, storedPhotos.length, input.id],
          );
        }
      }
      const nextKeys = new Set(storedPhotos.map(getPhotoObjectKey).filter((key): key is string => Boolean(key)));
      const removedKeys = [...currentKeys].filter(key => !nextKeys.has(key));
      try {
        await deleteEvaluationPhotoObjects(removedKeys);
      } catch (error) {
        console.error("As fotos removidas da avaliação não puderam ser excluídas do S3:", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return { ok: true, count: storedPhotos.length };
    }),

  migrateEvaluationPhotosToS3: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      if (!isEvaluationPhotoStorageConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure o armazenamento S3/R2 no Coolify antes de migrar as fotos.",
        });
      }
      const db = getDb();
      await ensureTables();
      const evaluation = await db.query.evaluations.findFirst({
        where: eq(evaluations.id, input.id),
      });
      if (!evaluation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Avaliação não encontrada" });
      }

      const photos = parseStoredEvaluationPhotos(evaluation.photos);
      const storedPhotos = await prepareEvaluationPhotosForStorage(photos);
      await db
        .update(evaluations)
        .set({
          photos: JSON.stringify(storedPhotos),
          photosCount: storedPhotos.length,
        })
        .where(eq(evaluations.id, input.id));
      return {
        ok: true,
        count: storedPhotos.length,
        migrated: storedPhotos.filter(photo => photo.storage === "s3").length,
      };
    }),

  retryEvaluationNotification: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      const evaluation = await db.query.evaluations.findFirst({
        where: eq(evaluations.id, input.id),
      });

      if (!evaluation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Avaliação não encontrada" });
      }

      const result = await notifyEvaluationCreated({
        id: evaluation.id,
        name: evaluation.name,
        whatsapp: evaluation.whatsapp,
        model: evaluation.model,
        storage: evaluation.storage,
        targetModel: evaluation.targetModel,
        photosCount: evaluation.photosCount,
      });

      try {
        await persistEvaluationNotificationStatus(evaluation.id, result);
      } catch (error: any) {
        console.error("Não foi possível salvar o resultado da retentativa de notificação:", {
          code: error?.code,
          errno: error?.errno,
          sqlState: error?.sqlState,
        });
      }

      return {
        ok: result.status === "sent",
        status: result.status,
        error: result.error || null,
      };
    }),

  erpOverride: publicQuery
    .input(z.object({ externalId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      return await getErpOverride(input.externalId);
    }),

  saveErpOverride: publicQuery
    .input(
      z.object({
        externalId: z.string().min(1),
        imageUrl: z.string().max(2000).optional(),
        videoUrl: z.string().max(2000).optional(),
        batteryHealth: z.string().max(50).optional(),
        warranty: z.string().max(120).optional(),
        description: z.string().max(5000).optional(),
        featured: z.boolean().optional(),
        active: z.boolean().optional(),
        category: z.enum(["iphone_lacrado", "iphone_seminovo", "android", "acessorio"]).optional(),
        customName: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const { externalId, ...data } = input;
      await saveErpOverride(externalId, data);
      clearErpCache();
      return { ok: true };
    }),

  toggleActive: publicQuery
    .input(
      z.object({
        id: z.union([z.number(), z.string()]),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      const strId = String(input.id);
      const isErp = strId.startsWith("erp-") || isNaN(Number(input.id));
      if (isErp) {
        await saveErpOverride(strId, { active: input.active });
        clearErpCache();
      } else {
        await db.update(products).set({ active: input.active }).where(eq(products.id, Number(input.id)));
      }
      return { ok: true };
    }),

  toggleFeatured: publicQuery
    .input(
      z.object({
        id: z.union([z.number(), z.string()]),
        featured: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.req);
      const db = getDb();
      await ensureTables();
      const strId = String(input.id);
      const isErp = strId.startsWith("erp-") || isNaN(Number(input.id));
      if (isErp) {
        await saveErpOverride(strId, { featured: input.featured });
        clearErpCache();
      } else {
        await db.update(products).set({ featured: input.featured }).where(eq(products.id, Number(input.id)));
      }
      return { ok: true };
    }),

  refreshErpCatalog: publicQuery.mutation(async ({ ctx }) => {
    requireAdmin(ctx.req);
    clearErpCache();
    const res = await getErpCatalog();
    return {
      status: res.status,
      message: res.message,
      count: res.products.length,
    };
  }),
});
