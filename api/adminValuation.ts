/**
 * Rotas do motor de avaliação para o painel (admin e funcionários logados).
 * Toda conta de preço acontece aqui, no servidor: nada disso vai para o navegador de visitantes.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { DEFECT_KEYS, SETTING_KEYS, type ValuationConfig } from "@contracts/types";
import { declaredLojinhaPurchase, loyaltyApplies } from "@contracts/loyalty";
import { adminProcedure } from "./middleware";
import { assertCan } from "./permissions";
import { getSingleSetting } from "./services/settingsStore";
import { findEvaluationById, type EvaluationRecord } from "./services/evaluationStore";
import { buildAdminWhatsAppMessage, evaluateDevice, parseValuationConfig } from "./valuation/engine";
import { buildPriceList } from "./valuation/priceList";
import type { ValuationInput } from "@contracts/valuation";

export async function loadValuationConfig(): Promise<ValuationConfig> {
  return parseValuationConfig(await getSingleSetting(SETTING_KEYS.valuationConfig));
}

/** Respostas da avaliação gravada → entrada do motor (o bônus só vale depois de confirmado). */
export function valuationInputFromEvaluation(record: EvaluationRecord): ValuationInput {
  const batteryNum = record.battery ? parseInt(String(record.battery).replace(/\D/g, ""), 10) : NaN;
  return {
    model: record.model,
    storage: record.storage ?? undefined,
    color: record.color ?? undefined,
    purchaseLocation:
      declaredLojinhaPurchase(record.purchaseLocation) && !loyaltyApplies(record.loyaltyStatus)
        ? ""
        : (record.purchaseLocation ?? undefined),
    batteryPercent: Number.isNaN(batteryNum) ? undefined : batteryNum,
    batteryUnknown: Number.isNaN(batteryNum) && /sei/i.test(record.battery ?? ""),
    targetModel: record.targetModel ?? undefined,
    visualCondition: record.visualCondition || record.condition || undefined,
    faceId: record.faceId ?? undefined,
    screenOriginal: record.screenOriginal ?? undefined,
    batteryOriginal: record.batteryOriginal ?? undefined,
    camerasOk: record.camerasOk ?? undefined,
    audioOk: record.audioOk ?? undefined,
    chargingPortOk: record.chargingPortOk ?? undefined,
    openedBefore: record.openedBefore ?? undefined,
    hasBox: record.hasBox ?? undefined,
    icloudFree: record.icloudFree ?? undefined,
    notes: record.notes ?? undefined,
  };
}

export const valuationProcedures = {
  /** Configuração completa do motor (com os padrões já aplicados), para o editor das configurações. */
  valuationConfig: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "settings.manage");
    return loadValuationConfig();
  }),

  /** Lista fixa modelo × armazenamento × cor, com o valor que o motor usa em cada linha. */
  priceList: adminProcedure
    .input(z.object({ customBasePrices: z.record(z.string().max(120), z.number().min(0).max(200000)).default({}) }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "settings.manage");
      return buildPriceList(input.customBasePrices);
    }),

  /** Simulador: quanto o motor ofereceria com os números em edição, e com os salvos. */
  simulateValuation: adminProcedure
    .input(
      z.object({
        model: z.string().max(120),
        storage: z.string().max(30),
        batteryPercent: z.number().min(0).max(100),
        visualCondition: z.string().max(100),
        hasBox: z.boolean(),
        loyal: z.boolean(),
        defects: z.array(z.enum(DEFECT_KEYS)).max(DEFECT_KEYS.length),
        config: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "settings.manage");
      const has = new Set(input.defects);
      const valuation: ValuationInput = {
        model: input.model,
        storage: input.storage,
        batteryPercent: input.batteryPercent,
        visualCondition: input.visualCondition,
        faceId: has.has("faceId") ? "Não" : "Sim",
        screenOriginal: has.has("screen") ? "Não" : "Sim",
        batteryOriginal: has.has("batteryOriginal") ? "Não" : "Sim",
        camerasOk: has.has("cameras") ? "Não" : "Sim",
        audioOk: has.has("audio") ? "Não" : "Sim",
        chargingPortOk: has.has("chargingPort") ? "Não" : "Sim",
        openedBefore: has.has("opened") ? "Sim" : "Não",
        icloudFree: "Sim",
        hasBox: input.hasBox ? "Sim" : "Não",
        purchaseLocation: input.loyal ? "Lojinha do Celular" : "",
      };
      const editing = parseValuationConfig(input.config as Partial<ValuationConfig> | null);
      const saved = await loadValuationConfig();
      return { now: evaluateDevice(valuation, editing), before: evaluateDevice(valuation, saved) };
    }),

  /** Estimativa interna de uma avaliação (e a mensagem pronta para o cliente). */
  evaluationValuation: adminProcedure
    .input(z.object({ id: z.number().int().positive(), stamp: z.string().max(300).optional() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const record = await findEvaluationById(input.id);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Avaliação não encontrada" });
      const config = await loadValuationConfig();
      const valuation = evaluateDevice(valuationInputFromEvaluation(record), config);
      const estimateMessage = buildAdminWhatsAppMessage(
        record.name,
        valuation,
        { model: record.model, storage: record.storage ?? undefined, color: record.color ?? undefined },
        config.loyaltyBonusPercent ?? 5,
      );
      return { valuation, estimateMessage };
    }),
};
