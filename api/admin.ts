import { adminProcedure, createRouter, publicQuery } from "./middleware";
import { getDb, ensureTables } from "./queries/connection";
import { products, variants } from "../db/schema";
import { eq } from "drizzle-orm";
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
  revokeUserSessions,
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
import { getErpCatalog, clearErpCache } from "./erp/service";
import { getErpOverride, saveErpOverride, type ErpProductOverride } from "./erp/overrides";
import type { ShopProduct } from "./erp/types";
import { getAdminSettings, saveSettings } from "./services/settingsStore";
import { evaluationProcedures } from "./adminEvaluations";
import { parseValuationConfig } from "./valuation/config";
import { loadValuationConfig, valuationProcedures } from "./adminValuation";
import { dashboardProcedures } from "./adminDashboard";
import { erpOverviewProcedures } from "./erpOverview";
import { getErpStatus, loadAdminProducts } from "./services/adminCatalog";

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

/** Devolve as configurações com a do motor já completa (padrões aplicados), para o editor. */
async function withResolvedValuation(settings: Record<string, string>): Promise<Record<string, string>> {
  return { ...settings, [SETTING_KEYS.valuationConfig]: JSON.stringify(await loadValuationConfig()) };
}

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

  /** "Sair de todos os dispositivos": invalida todos os tokens da própria conta (inclusive este). */
  endMySessions: adminProcedure.mutation(async ({ ctx }) => {
    await revokeUserSessions(ctx.user.id);
    await logAction(ctx.user, {
      action: "user.revokeSessions",
      entityType: "user",
      entityId: ctx.user.id,
      summary: `${ctx.user.name} saiu de todos os dispositivos`,
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
          userId: z.number().int().positive().optional(),
          action: z.string().max(60).optional(),
          search: z.string().max(100).optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          beforeId: z.number().int().positive().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const opts = input ?? {};
      // Vendedor vê apenas o histórico das avaliações
      const entityType = can(ctx.user, "users.manage") ? opts.entityType : "evaluation";
      return await listAudit({ ...opts, limit: opts.limit ?? 50, entityType });
    }),

  products: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "products.editMedia");
    // ERP oficial quando ativado, senão banco local
    return await loadAdminProducts();
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

      const before = id ? await loadProductForCheck(id) : null;
      if (id && !before) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      }
      const beforeVariantIds = new Set((before?.variants ?? []).map((v) => v.id));
      const beforeVariantById = new Map((before?.variants ?? []).map((v) => [v.id, v]));

      const productPayload = {
        name: data.name.trim(),
        brand: data.brand.trim(),
        category: data.category,
        condition: data.condition.trim(),
        description: data.description ? data.description.trim() : null,
        imageUrl: data.imageUrl ? data.imageUrl.trim() : null,
        videoUrl: data.videoUrl ? data.videoUrl.trim() : null,
        // Sem garantia informada, mantém a atual (edição) ou usa o padrão (criação)
        warranty: data.warranty ? data.warranty.trim() : (before?.warranty ?? "1 ano de garantia"),
        featured: data.featured,
        active: data.active,
      };

      const variantRows = variantList.map((v) => ({
        // Mantém o id das variantes existentes para que fiquem estáveis entre edições
        ...(typeof v.id === "number" && beforeVariantIds.has(v.id) ? { id: v.id } : {}),
        version: v.version || "",
        storage: v.storage,
        color: v.color,
        // Sem cor informada, mantém a da variante existente (ou o padrão)
        colorHex:
          v.colorHex ??
          (typeof v.id === "number" ? beforeVariantById.get(v.id)?.colorHex : undefined) ??
          "#111111",
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
    return await withResolvedValuation(await getAdminSettings());
  }),

  updateSettings: adminProcedure
    .input(z.object({ values: z.record(z.string(), z.string()) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "settings.manage");
      // A senha única antiga não é mais usada para login; não pode ser alterada por aqui.
      const values = { ...input.values };
      delete values[SETTING_KEYS.adminPassword];
      // A configuração do motor é saneada no servidor (valores inválidos voltam ao padrão).
      if (SETTING_KEYS.valuationConfig in values) {
        values[SETTING_KEYS.valuationConfig] = JSON.stringify(parseValuationConfig(values[SETTING_KEYS.valuationConfig]));
      }
      const current = await withResolvedValuation(await getAdminSettings());
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

  ...evaluationProcedures,
  ...valuationProcedures,

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

  /** Mostrar/ocultar e destacar vários produtos de uma vez (máx. 100). */
  bulkSetProducts: adminProcedure
    .input(
      z
        .object({
          ids: z.array(z.union([z.number(), z.string()])).min(1).max(100),
          active: z.boolean().optional(),
          featured: z.boolean().optional(),
        })
        .refine((v) => v.active !== undefined || v.featured !== undefined, "Nada para alterar"),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "products.editMedia");
      if (input.featured !== undefined) assertCan(ctx.user, "products.manage");

      const patch: { active?: boolean; featured?: boolean } = {};
      if (input.active !== undefined) patch.active = input.active;
      if (input.featured !== undefined) patch.featured = input.featured;

      const failed: { id: string; message: string }[] = [];
      let done = 0;
      for (const id of [...new Set(input.ids.map(String))]) {
        try {
          const raw = /^\d+$/.test(id) ? Number(id) : id;
          if (isErpProductId(raw)) {
            await saveErpOverride(id, patch);
          } else {
            const db = getDb();
            await ensureTables();
            await db.update(products).set(patch).where(eq(products.id, Number(id)));
          }
          done++;
        } catch (err) {
          failed.push({ id, message: err instanceof Error ? err.message : "Erro inesperado" });
        }
      }
      clearErpCache();
      const parts: string[] = [];
      if (patch.active !== undefined) parts.push(patch.active ? "visíveis" : "ocultos");
      if (patch.featured !== undefined) parts.push(patch.featured ? "destacados" : "sem destaque");
      await logAction(ctx.user, {
        action: "product.bulk",
        entityType: "product",
        summary: `${done} produto(s) marcados como ${parts.join(" e ")} (em lote)`,
      });
      return { ok: failed.length === 0, done, failed };
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

  /** Status do ERP com a última sincronização (painel). */
  erpStatus: adminProcedure.query(async () => getErpStatus()),

  ...dashboardProcedures,
  ...erpOverviewProcedures,
});
