import { createRouter, publicQuery } from "./middleware";
import { getDb, ensureTables, getPool } from "./queries/connection";
import { products, evaluations } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SETTING_KEYS } from "../contracts/types";
import { env } from "./lib/env";
import { getErpCatalog } from "./erp/service";
import { getShopPublicSettings } from "./services/settingsStore";

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
  SETTING_KEYS.warrantyBadgeText,
  SETTING_KEYS.valuationConfig,
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

export function sanitizePublicProduct<
  T extends { variants?: { notes?: unknown }[] }
>(prod: T): T {
  if (!prod || !Array.isArray(prod.variants)) return prod;
  return {
    ...prod,
    variants: prod.variants.map((v) => {
      const { notes: _notes, ...rest } = v;
      return rest;
    }),
  } as T;
}

export function sanitizePublicProducts<
  T extends { variants?: { notes?: unknown }[] }
>(list: T[]): T[] {
  return list.map((p) => sanitizePublicProduct(p));
}

function sortProductsBackend<
  T extends {
    name: string;
    brand?: string;
    condition: string;
    category: string;
    featured: boolean;
    variants: { priceCash: number; available: boolean; notes?: string | null }[];
  },
>(list: T[]): T[] {
  const sorted = [...list].sort((a, b) => {
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

  return sanitizePublicProducts(sorted);
}

// Rate Limiter em memória para envio de avaliações por IP (máx. 5 envios por 10 minutos)
const evaluationSubmissions = new Map<string, { count: number; resetTime: number }>();
const MAX_EVALUATIONS_PER_WINDOW = 5;
const EVALUATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

export function checkEvaluationRateLimit(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown-client";

  const now = Date.now();
  const record = evaluationSubmissions.get(ip);

  if (record && record.resetTime > now) {
    if (record.count >= MAX_EVALUATIONS_PER_WINDOW) {
      return false;
    }
    record.count += 1;
  } else {
    evaluationSubmissions.set(ip, { count: 1, resetTime: now + EVALUATION_WINDOW_MS });
  }

  if (evaluationSubmissions.size > 1000) {
    for (const [key, val] of evaluationSubmissions.entries()) {
      if (val.resetTime < now) evaluationSubmissions.delete(key);
    }
  }

  return true;
}

export function resetEvaluationRateLimitForTesting() {
  evaluationSubmissions.clear();
}

export const shopRouter = createRouter({
  // Status de conexão e integridade do catálogo da loja
  catalogStatus: publicQuery.query(async () => {
    if (!env.erpCatalogEnabled) {
      return {
        erpEnabled: false,
        status: "disabled" as const,
        count: 0,
      };
    }
    const erp = await getErpCatalog();
    return {
      erpEnabled: true,
      status: erp.status,
      message: erp.message,
      count: erp.products.length,
    };
  }),

  // Catálogo público: ERP oficial (quando ativado) ou banco local
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
        "public, max-age=30, stale-while-revalidate=60",
      );

      // Requisito 3 & 8: Quando ERP_CATALOG_ENABLED=true, o ERP é a fonte oficial
      if (env.erpCatalogEnabled) {
        const erp = await getErpCatalog();
        if (erp.status === "ok") {
          let list = erp.products.filter((p) => p.active !== false);
          if (input?.category) {
            list = list.filter((p) => p.category === input.category);
          }
          if (input?.brand) {
            list = list.filter((p) => p.brand.toLowerCase() === input.brand!.toLowerCase());
          }
          return sortProductsBackend(list);
        }
        // Se a API estiver fora do ar ou sem produtos, nunca exibe produtos antigos ou locais
        return [];
      }

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
    if (env.erpCatalogEnabled) {
      const erp = await getErpCatalog();
      if (erp.status === "ok") {
        const activeList = erp.products.filter((p) => p.active !== false);
        const explicitlyFeatured = activeList.filter((p) => p.featured);
        const list = explicitlyFeatured.length > 0 ? explicitlyFeatured : activeList.slice(0, 12);
        return sortProductsBackend(list);
      }
      return [];
    }

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
    .input(z.object({ id: z.union([z.string(), z.number()]) }))
    .query(async ({ input, ctx }) => {
      ctx.resHeaders.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      const idStr = String(input.id).trim();

      // Se ERP estiver ativo, busca no catálogo do ERP por externalId ou id
      if (env.erpCatalogEnabled) {
        const erp = await getErpCatalog();
        if (erp.status === "ok") {
          const found = erp.products.find(
            (p) => String(p.id) === idStr || p.externalId === idStr,
          );
          if (found && found.active !== false) {
            return sanitizePublicProduct(found);
          }
        }
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produto esgotado ou não encontrado no estoque.",
        });
      }

      const numId = Number(idStr);
      if (!Number.isNaN(numId) && numId > 0) {
        try {
          const db = getDb();
          await ensureTables();
          const product = await db.query.products.findFirst({
            where: and(eq(products.id, numId), eq(products.active, true)),
            with: { variants: true },
          });
          if (product) {
            return sanitizePublicProduct(product);
          }
          return null;
        } catch (err) {
          console.error("Erro ao consultar produto por ID:", err);
          return null;
        }
      }
      return null;
    }),

  // Configurações públicas da loja consultadas em batch único
  settings: publicQuery.query(async () => {
    return await getShopPublicSettings(PUBLIC_SETTING_KEYS);
  }),

  // Envio de proposta de avaliação de aparelho
  submitEvaluation: publicQuery
    .input(
      z.object({
        name: z.string().min(1).max(120),
        whatsapp: z.string().min(1).max(30),
        model: z.string().min(1).max(120),
        storage: z.string().max(30).optional().default(""),
        color: z.string().max(60).optional().default(""),
        purchaseLocation: z.string().max(100).optional().default(""),
        targetModel: z.string().max(120).optional().default(""),
        faceId: z.string().max(30).optional().default(""),
        screenOriginal: z.string().max(30).optional().default(""),
        batteryOriginal: z.string().max(30).optional().default(""),
        camerasOk: z.string().max(30).optional().default(""),
        audioOk: z.string().max(30).optional().default(""),
        chargingPortOk: z.string().max(30).optional().default(""),
        openedBefore: z.string().max(30).optional().default(""),
        hasBox: z.string().max(30).optional().default(""),
        visualCondition: z.string().max(100).optional().default(""),
        condition: z.string().min(1).max(60),
        battery: z.string().min(1).max(60),
        notes: z.string().max(1000).optional().default(""),
        photosCount: z.number().int().min(0).max(50).optional().default(0),
        photos: z
          .array(
            z.object({
              key: z.string().max(40),
              label: z.string().max(80),
              url: z.string().max(10_000_000),
              name: z.string().max(120).optional(),
              size: z.number().optional(),
            }),
          )
          .optional()
          .default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!checkEvaluationRateLimit(ctx.req)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Muitas propostas enviadas em um curto período. Por favor, aguarde alguns minutos antes de tentar novamente.",
        });
      }

      try {
        const db = getDb();
        await ensureTables();
        const photosCount =
          input.photos && input.photos.length > 0
            ? input.photos.length
            : (input.photosCount ?? 0);
        const photosJson =
          input.photos && input.photos.length > 0
            ? JSON.stringify(input.photos)
            : null;

        const res = await db.insert(evaluations).values({
          name: input.name.trim(),
          whatsapp: input.whatsapp.trim(),
          model: input.model.trim(),
          storage: (input.storage || "").trim(),
          color: (input.color || "").trim(),
          purchaseLocation: (input.purchaseLocation || "").trim(),
          targetModel: (input.targetModel || "").trim(),
          faceId: (input.faceId || "").trim(),
          screenOriginal: (input.screenOriginal || "").trim(),
          batteryOriginal: (input.batteryOriginal || "").trim(),
          camerasOk: (input.camerasOk || "").trim(),
          audioOk: (input.audioOk || "").trim(),
          chargingPortOk: (input.chargingPortOk || "").trim(),
          openedBefore: (input.openedBefore || "").trim(),
          hasBox: (input.hasBox || "").trim(),
          visualCondition: (input.visualCondition || "").trim(),
          condition: input.condition.trim(),
          battery: input.battery.trim(),
          notes: (input.notes || "").trim() || null,
          photosCount,
          photos: photosJson,
          status: "pendente",
        });
        return { ok: true, id: Number(res[0]?.insertId ?? 0) };
      } catch (err: any) {
        console.error("Erro ao salvar avaliação via Drizzle, tentando fallback SQL:", err?.message || err);
        try {
          const pool = getPool();
          if (pool) {
            const photosCount = input.photos?.length || input.photosCount || 0;
            const photosJson = input.photos && input.photos.length > 0 ? JSON.stringify(input.photos) : null;
            const [res]: any = await pool.query(
              `INSERT INTO evaluations (
                name, whatsapp, model, storage, color, purchase_location, target_model,
                face_id, screen_original, battery_original, cameras_ok, audio_ok,
                charging_port_ok, opened_before, has_box, visual_condition, \`condition\`,
                battery, notes, photos_count, photos, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
              [
                input.name.trim(),
                input.whatsapp.trim(),
                input.model.trim(),
                (input.storage || "").trim(),
                (input.color || "").trim(),
                (input.purchaseLocation || "").trim(),
                (input.targetModel || "").trim(),
                (input.faceId || "").trim(),
                (input.screenOriginal || "").trim(),
                (input.batteryOriginal || "").trim(),
                (input.camerasOk || "").trim(),
                (input.audioOk || "").trim(),
                (input.chargingPortOk || "").trim(),
                (input.openedBefore || "").trim(),
                (input.hasBox || "").trim(),
                (input.visualCondition || "").trim(),
                input.condition.trim(),
                input.battery.trim(),
                (input.notes || "").trim() || null,
                photosCount,
                photosJson,
              ]
            );
            return { ok: true, id: Number(res?.insertId ?? 0) };
          }
        } catch (sqlErr: any) {
          console.error("Erro no fallback SQL de inserção:", sqlErr);
        }
        return { ok: true, id: null };
      }
    }),
});
