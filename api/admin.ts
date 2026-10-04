import { adminProcedure, createRouter, publicQuery } from "./middleware";
import { getDb, ensureTables, getPool } from "./queries/connection";
import { products, variants, evaluations } from "../db/schema";
import { and, count, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  authenticate,
  checkLoginRateLimit,
  clearLoginRateLimit,
  clientIpFromRequest,
  createToken,
  verifyPasswordHash,
} from "./auth";
import {
  getUserById,
  normalizeUsername,
  setUserPassword,
  toSessionUser,
  touchLastLogin,
} from "./services/userStore";
import { listAudit, logAction, summarizeProductChanges } from "./services/auditLog";
import {
  assertCan,
  checkErpOverrideUpdate,
  checkProductUpdate,
  type ProductLike,
} from "./permissions";
import { can } from "@contracts/permissions";
import { SETTING_KEYS } from "@contracts/types";
import { adminUsersRouter } from "./adminUsers";
import { env } from "./lib/env";
import { getErpCatalog, clearErpCache } from "./erp/service";
import { getErpOverride, saveErpOverride, type ErpProductOverride } from "./erp/overrides";
import type { ShopProduct } from "./erp/types";
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

function forbidden(message: string): TRPCError {
  return new TRPCError({ code: "FORBIDDEN", message });
}

function isErpProductId(id: number | string): boolean {
  const strId = String(id);
  return strId.startsWith("erp-") || Number.isNaN(Number(id));
}

type ProductRowWithVariants = {
  name: string;
  brand: string;
  category: string;
  condition: string;
  description: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  warranty: string | null;
  featured: boolean;
  active: boolean;
  variants: Array<{
    id: number;
    version: string;
    storage: string;
    color: string;
    colorHex: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
    sku: string | null;
    batteryHealth: string | null;
    warranty: string | null;
    condition: string | null;
    notes: string | null;
    priceCash: number;
    quantity: number;
    available: boolean;
  }>;
};

function productRowToLike(row: ProductRowWithVariants): ProductLike {
  return {
    name: row.name,
    brand: row.brand,
    category: row.category,
    condition: row.condition,
    description: row.description,
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    warranty: row.warranty,
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    variants: row.variants.map((v) => ({
      id: Number(v.id),
      version: v.version,
      storage: v.storage,
      color: v.color,
      colorHex: v.colorHex,
      imageUrl: v.imageUrl,
      videoUrl: v.videoUrl,
      sku: v.sku,
      batteryHealth: v.batteryHealth,
      warranty: v.warranty,
      condition: v.condition,
      notes: v.notes,
      priceCash: Number(v.priceCash),
      quantity: Number(v.quantity),
      available: Boolean(v.available),
    })),
  };
}

async function loadProductForCheck(id: number): Promise<ProductLike | null> {
  const db = getDb();
  await ensureTables();
  const row = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: { variants: true },
  });
  return row ? productRowToLike(row as ProductRowWithVariants) : null;
}

async function findErpProduct(externalId: string): Promise<ShopProduct | null> {
  try {
    const erp = await getErpCatalog();
    if (erp.status !== "ok") return null;
    return (
      erp.products.find(
        (p) =>
          p.externalId === externalId ||
          String(p.id) === externalId ||
          (p.alternateIds ?? []).includes(externalId),
      ) ?? null
    );
  } catch {
    return null;
  }
}

const ERP_OVERRIDE_DEFAULTS: Partial<ErpProductOverride> = { featured: false, active: true };

/** Nome legível do produto para o histórico (nunca lança erro). */
async function describeProduct(id: number | string): Promise<string> {
  const strId = String(id);
  try {
    if (isErpProductId(id)) {
      return (await findErpProduct(strId))?.name || `Produto ${strId}`;
    }
    const db = getDb();
    const row = await db.query.products.findFirst({
      where: eq(products.id, Number(id)),
      columns: { name: true },
    });
    return row?.name || `Produto #${strId}`;
  } catch {
    return `Produto ${strId}`;
  }
}

function normalizeOverrideValue(value: unknown): unknown {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  return value;
}

/**
 * Chaves do override que realmente mudam em relação ao produto efetivo
 * (catálogo do ERP já com override aplicado; sem ERP, o override salvo).
 * Assim, reenviar valores atuais de campos restritos não é tratado como alteração.
 */
async function changedErpOverrideKeys(
  externalId: string,
  data: Partial<ErpProductOverride>,
): Promise<{ keys: string[]; product: ShopProduct | null }> {
  const override = (await getErpOverride(externalId)) ?? {};
  const product = await findErpProduct(externalId);
  const effective: Partial<Record<keyof ErpProductOverride, unknown>> = product
    ? {
        imageUrl: product.imageUrl,
        videoUrl: product.videoUrl ?? product.variants?.[0]?.videoUrl,
        batteryHealth: product.variants?.[0]?.batteryHealth ?? product.batteryHealth,
        warranty: product.warranty || product.variants?.[0]?.warranty || "1 ano de garantia",
        description: product.description,
        featured: Boolean(product.featured),
        active: product.active !== false,
        category: product.category,
        customName: product.name,
      }
    : {};

  const keys: string[] = [];
  for (const [key, value] of Object.entries(data) as [keyof ErpProductOverride, unknown][]) {
    if (value === undefined) continue;
    const current =
      key in effective
        ? effective[key]
        : key in override
          ? override[key]
          : ERP_OVERRIDE_DEFAULTS[key];
    if (normalizeOverrideValue(current) !== normalizeOverrideValue(value)) keys.push(key);
  }
  return { keys, product };
}

const ERP_FIELD_LABELS: Record<string, string> = {
  imageUrl: "foto",
  videoUrl: "vídeo",
  batteryHealth: "bateria",
  warranty: "garantia",
  description: "descrição",
  featured: "destaque",
  active: "visibilidade",
  category: "categoria",
  customName: "nome",
};

const EVALUATION_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  atendimento: "Em atendimento",
  concluido: "Concluído",
  recusado: "Recusado",
};

async function hydrateEvaluationRecord<T extends { photos?: unknown }>(record: T): Promise<T> {
  const photos = parseStoredEvaluationPhotos(record.photos);
  if (!photos.length) return record;
  return {
    ...record,
    photos: await hydrateEvaluationPhotos(photos),
  };
}

function mapEvaluationSqlRow(r: any) {
  return {
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
    .input(
      z.object({
        username: z.string().min(1).max(60),
        password: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rateKey = `${clientIpFromRequest(ctx.req)}|${normalizeUsername(input.username)}`;
      if (!checkLoginRateLimit(rateKey)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.",
        });
      }
      const user = await authenticate(input.username, input.password);
      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha incorretos" });
      }
      clearLoginRateLimit(rateKey);
      try {
        await touchLastLogin(user.id);
      } catch (err) {
        console.error("[Admin] Não foi possível registrar o último acesso:", err);
      }
      const sessionUser = toSessionUser(user);
      await logAction(sessionUser, {
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
        summary: `${user.name} entrou no painel`,
      });
      return { token: createToken(user.id), user: sessionUser };
    }),

  me: adminProcedure.query(({ ctx }) => ctx.user),

  changeOwnPassword: adminProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres").max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const record = await getUserById(ctx.user.id);
      if (!record || !verifyPasswordHash(input.currentPassword, record.passwordHash)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Senha atual incorreta" });
      }
      await setUserPassword(ctx.user.id, input.newPassword);
      await logAction(ctx.user, {
        action: "user.changePassword",
        entityType: "user",
        entityId: ctx.user.id,
        summary: `${ctx.user.name} trocou a própria senha`,
      });
      return { ok: true };
    }),

  /** @deprecated Use `changeOwnPassword`. Mantido para o painel atual até a Etapa 2. */
  changePassword: adminProcedure
    .input(z.object({ password: z.string().min(6).max(128) }))
    .mutation(async ({ ctx, input }) => {
      await setUserPassword(ctx.user.id, input.password);
      await logAction(ctx.user, {
        action: "user.changePassword",
        entityType: "user",
        entityId: ctx.user.id,
        summary: `${ctx.user.name} trocou a própria senha`,
      });
      return { ok: true };
    }),

  users: adminUsersRouter,

  auditLog: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).optional(),
          entityType: z.string().max(30).optional(),
          entityId: z.string().max(60).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const opts = input ?? {};
      // Vendedor vê apenas o histórico das avaliações
      const entityType = can(ctx.user, "users.manage") ? opts.entityType : "evaluation";
      return await listAudit({ limit: opts.limit ?? 50, entityType, entityId: opts.entityId });
    }),

  products: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "products.editMedia");
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

  upsertProduct: adminProcedure
    .input(productInput)
    .mutation(async ({ ctx, input }) => {
      const { variants: variantList, id, ...data } = input;

      // Criação exige products.manage — checado antes de tocar no banco
      if (!id) {
        const denied = checkProductUpdate(ctx.user, null, { ...data, variants: variantList });
        if (denied) throw forbidden(denied);
      }

      const db = getDb();
      await ensureTables();

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

      const before = id ? await loadProductForCheck(id) : null;
      if (id && !before) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      }
      const beforeVariantIds = new Set((before?.variants ?? []).map((v) => v.id));

      const variantRows = variantList.map((v) => ({
        // Mantém o id das variantes existentes para que fiquem estáveis entre edições
        ...(typeof v.id === "number" && beforeVariantIds.has(v.id) ? { id: v.id } : {}),
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
      }));

      const after: ProductLike = {
        ...productPayload,
        variants: variantList.map((v, idx) => ({ ...variantRows[idx], id: v.id ?? null })),
      };
      if (before) {
        const denied = checkProductUpdate(ctx.user, before, after);
        if (denied) throw forbidden(denied);
      }

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
      await db.insert(variants).values(variantRows.map((row) => ({ ...row, productId })));

      await logAction(ctx.user, {
        action: before ? "product.update" : "product.create",
        entityType: "product",
        entityId: productId,
        summary: summarizeProductChanges(before, after),
      });

      return { id: productId };
    }),

  deleteProduct: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const denied = checkProductUpdate(ctx.user, null, null);
      if (denied) throw forbidden(denied);
      const db = getDb();
      await ensureTables();
      const existing = await db.query.products.findFirst({
        where: eq(products.id, input.id),
        columns: { name: true },
      });
      await db.delete(variants).where(eq(variants.productId, input.id));
      await db.delete(products).where(eq(products.id, input.id));
      await logAction(ctx.user, {
        action: "product.delete",
        entityType: "product",
        entityId: input.id,
        summary: `Excluiu "${existing?.name ?? `produto #${input.id}`}"`,
      });
      return { ok: true };
    }),

  getSettings: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "settings.manage");
    return await getAdminSettings();
  }),

  updateSettings: adminProcedure
    .input(z.object({ values: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "settings.manage");
      // A senha única antiga não é mais usada para login; não pode ser alterada por aqui.
      const values = { ...input.values };
      delete values[SETTING_KEYS.adminPassword];
      const current = await getAdminSettings();
      const changedKeys = Object.keys(values).filter(
        (key) => key in current && current[key] !== values[key],
      );
      const result = await saveSettings(values);
      if (changedKeys.length) {
        await logAction(ctx.user, {
          action: "settings.update",
          entityType: "settings",
          summary: `Configurações alteradas: ${changedKeys.join(", ")}`,
        });
      }
      return result;
    }),

  evaluations: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "evaluations.manage");
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
            const mapped = rows.map(mapEvaluationSqlRow);
            return await Promise.all(mapped.map(row => hydrateEvaluationRecord(row)));
          }
        }
      } catch (sqlErr: any) {
        console.error("Erro fatal no fallback SQL de avaliações:", sqlErr?.message || sqlErr);
      }
      return [];
    }
  }),

  evaluationSummary: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "evaluations.manage");
    try {
      const db = getDb();
      await ensureTables();
      const rows = await db
        .select({ id: evaluations.id, status: evaluations.status })
        .from(evaluations);
      return {
        total: rows.length,
        pending: rows.filter(row => row.status === "pendente").length,
        atendimento: rows.filter(row => row.status === "atendimento").length,
        concluido: rows.filter(row => row.status === "concluido").length,
        recusado: rows.filter(row => row.status === "recusado").length,
      };
    } catch (error) {
      console.error("Erro ao consultar resumo das avaliações:", error);
      return { total: 0, pending: 0, atendimento: 0, concluido: 0, recusado: 0 };
    }
  }),

  evaluationsPage: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(30).default(20),
        status: z.enum(["pendente", "atendimento", "concluido", "recusado"]).optional(),
        search: z.string().max(100).optional().default(""),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const offset = (input.page - 1) * input.pageSize;
      const searchTerm = input.search.trim();
      const filters = [];
      if (input.status) filters.push(eq(evaluations.status, input.status));
      if (searchTerm) {
        const pattern = `%${searchTerm}%`;
        filters.push(
          or(
            like(evaluations.name, pattern),
            like(evaluations.whatsapp, pattern),
            like(evaluations.model, pattern),
            like(evaluations.color, pattern),
            like(evaluations.storage, pattern),
          ),
        );
      }
      const where = filters.length > 0 ? and(...filters) : undefined;
      const sqlFilters: string[] = [];
      const sqlParams: unknown[] = [];
      if (input.status) {
        sqlFilters.push("status = ?");
        sqlParams.push(input.status);
      }
      if (searchTerm) {
        sqlFilters.push("(name LIKE ? OR whatsapp LIKE ? OR model LIKE ? OR color LIKE ? OR storage LIKE ?)");
        const pattern = `%${searchTerm}%`;
        sqlParams.push(pattern, pattern, pattern, pattern, pattern);
      }
      const sqlWhere = sqlFilters.length ? ` WHERE ${sqlFilters.join(" AND ")}` : "";
      try {
        const db = getDb();
        await ensureTables();
        const [rows, totals] = await Promise.all([
          db
            .select()
            .from(evaluations)
            .where(where)
            .orderBy(desc(evaluations.createdAt))
            .limit(input.pageSize)
            .offset(offset),
          db.select({ total: count() }).from(evaluations).where(where),
        ]);
        const total = Number(totals[0]?.total || 0);
        return {
          items: await Promise.all(rows.map(row => hydrateEvaluationRecord(row))),
          total,
          page: input.page,
          pageSize: input.pageSize,
          hasMore: offset + rows.length < total,
        };
      } catch (err: any) {
        console.warn("Consulta paginada de avaliações via Drizzle falhou:", err?.message || err);
        try {
          const pool = getPool();
          if (!pool) throw new Error("Pool do banco indisponível");
          const [rows]: any = await pool.query(
            `SELECT * FROM evaluations${sqlWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...sqlParams, input.pageSize, offset],
          );
          const [totals]: any = await pool.query(
            `SELECT COUNT(*) AS total FROM evaluations${sqlWhere}`,
            sqlParams,
          );
          const total = Number(totals?.[0]?.total || 0);
          const items = await Promise.all(
            (Array.isArray(rows) ? rows : []).map((row: any) =>
              hydrateEvaluationRecord(mapEvaluationSqlRow(row)),
            ),
          );
          return {
            items,
            total,
            page: input.page,
            pageSize: input.pageSize,
            hasMore: offset + items.length < total,
          };
        } catch (sqlErr: any) {
          console.error("Erro fatal na consulta paginada de avaliações:", sqlErr?.message || sqlErr);
          return { items: [], total: 0, page: input.page, pageSize: input.pageSize, hasMore: false };
        }
      }
    }),

  updateEvaluationStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["pendente", "atendimento", "concluido", "recusado"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const db = getDb();
      await ensureTables();
      await db
        .update(evaluations)
        .set({ status: input.status })
        .where(eq(evaluations.id, input.id));
      await logAction(ctx.user, {
        action: "evaluation.status",
        entityType: "evaluation",
        entityId: input.id,
        summary: `Status da avaliação #${input.id} alterado para ${EVALUATION_STATUS_LABELS[input.status]}`,
      });
      return { ok: true };
    }),

  deleteEvaluation: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
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
      await logAction(ctx.user, {
        action: "evaluation.delete",
        entityType: "evaluation",
        entityId: input.id,
        summary: evaluation
          ? `Excluiu a avaliação #${input.id} de ${evaluation.name} (${evaluation.model})`
          : `Excluiu a avaliação #${input.id}`,
      });
      return { ok: true };
    }),

  addEvaluationPhotos: adminProcedure
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
      assertCan(ctx.user, "evaluations.manage");
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

  migrateEvaluationPhotosToS3: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
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

  retryEvaluationNotification: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
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

  erpOverride: adminProcedure
    .input(z.object({ externalId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "products.editMedia");
      return await getErpOverride(input.externalId);
    }),

  saveErpOverride: adminProcedure
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
      assertCan(ctx.user, "products.editMedia");
      const { externalId, ...data } = input;
      const { keys: changedKeys, product } = await changedErpOverrideKeys(externalId, data);
      const denied = checkErpOverrideUpdate(ctx.user, changedKeys);
      if (denied) throw forbidden(denied);
      await saveErpOverride(externalId, data);
      clearErpCache();
      if (changedKeys.length) {
        const name = data.customName?.trim() || product?.name || `produto ${externalId}`;
        const labels = [...new Set(changedKeys.map((key) => ERP_FIELD_LABELS[key] ?? key))];
        await logAction(ctx.user, {
          action: "erp_product.update",
          entityType: "erp_product",
          entityId: externalId,
          summary: `${name} — alterado: ${labels.join(", ")}`,
        });
      }
      return { ok: true };
    }),

  toggleActive: adminProcedure
    .input(
      z.object({
        id: z.union([z.number(), z.string()]),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "products.editMedia");
      const strId = String(input.id);
      const isErp = isErpProductId(input.id);
      if (isErp) {
        await saveErpOverride(strId, { active: input.active });
        clearErpCache();
      } else {
        const db = getDb();
        await ensureTables();
        await db.update(products).set({ active: input.active }).where(eq(products.id, Number(input.id)));
      }
      const name = await describeProduct(input.id);
      await logAction(ctx.user, {
        action: "product.toggleActive",
        entityType: isErp ? "erp_product" : "product",
        entityId: strId,
        summary: `${name} — ${input.active ? "voltou a ficar visível" : "ocultado da vitrine"}`,
      });
      return { ok: true };
    }),

  toggleFeatured: adminProcedure
    .input(
      z.object({
        id: z.union([z.number(), z.string()]),
        featured: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "products.manage");
      const strId = String(input.id);
      const isErp = isErpProductId(input.id);
      if (isErp) {
        await saveErpOverride(strId, { featured: input.featured });
        clearErpCache();
      } else {
        const db = getDb();
        await ensureTables();
        await db.update(products).set({ featured: input.featured }).where(eq(products.id, Number(input.id)));
      }
      const name = await describeProduct(input.id);
      await logAction(ctx.user, {
        action: "product.toggleFeatured",
        entityType: isErp ? "erp_product" : "product",
        entityId: strId,
        summary: `${name} — ${input.featured ? "destacado" : "destaque removido"}`,
      });
      return { ok: true };
    }),

  refreshErpCatalog: adminProcedure.mutation(async ({ ctx }) => {
    assertCan(ctx.user, "products.editMedia");
    clearErpCache();
    const res = await getErpCatalog();
    return {
      status: res.status,
      message: res.message,
      count: res.products.length,
    };
  }),
});
