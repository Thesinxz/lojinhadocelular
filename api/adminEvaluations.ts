/**
 * Procedimentos do painel para as avaliações (Troca Fácil).
 * Espalhados dentro de `adminRouter` (nomes continuam em `admin.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { evaluations } from "@db/schema";
import { can, STORE_UNITS, type SessionUser } from "@contracts/permissions";
import {
  DEFAULT_EVALUATION_SLA_HOURS,
  EVALUATION_STATUSES,
  EVALUATION_STATUS_LABELS,
  AUTO_MESSAGE_EVENTS,
  REFUSAL_REASONS,
  SETTING_KEYS,
  type EvaluationPhotoItem,
  type WhatsappTemplate,
} from "@contracts/types";
import { parseTemplates } from "@/lib/whatsappTemplates";
import { adminProcedure } from "./middleware";
import { ensureTables, getDb, getPool } from "./queries/connection";
import { assertCan } from "./permissions";
import { formatCents, listAudit, logAction, type AuditEntry } from "./services/auditLog";
import { getUserById } from "./services/userStore";
import { getSingleSetting } from "./services/settingsStore";
import {
  diffWorkflow,
  findEvaluationById,
  findEvaluationPage,
  findEvaluationReportRows,
  findRelatedEvaluations,
  updateEvaluationLoyalty,
  findEvaluationStatusRows,
  mapEvaluationSqlRow,
  toWorkflowState,
  updateEvaluationWorkflow,
  type EvaluationRecord,
} from "./services/evaluationStore";
import { addEvaluationNote, listEvaluationNotes, type EvaluationNote } from "./services/evaluationNotes";
import {
  applyClaim,
  applyStatus,
  applyUnassign,
  applyUnit,
  applyValues,
  isLate,
  parseSlaHours,
  validateNoteBody,
  WorkflowError,
  type WorkflowState,
} from "./evaluationWorkflow";
import {
  notifyEvaluationCreated,
  persistEvaluationNotificationStatus,
} from "./services/evaluationNotification";
import { computeEvaluationReport } from "./evaluationReport";
import { acquisitionInputSchema, createSeminovoEntry } from "./erp/acquisition";
import { ErpApiError, isErpServiceConfigured } from "./erp/client";
import { claimErpEntry, completeErpEntry, getErpEntry, releaseErpEntry } from "./services/evaluationErpEntries";
import { isValidCpf, onlyDigits } from "@contracts/brDocs";
import { runLoyaltyCheck } from "./services/loyaltyCheck";
import { LOYALTY_STATUS_LABELS } from "@contracts/loyalty";
import { dispatchCustomerEvent, dispatchCustomerEventInBackground } from "./services/autoMessages";
import { listEvaluationMessages, recordEvaluationMessage } from "./services/evaluationMessages";
import {
  eraseEvaluations,
  findEvaluationsOfHolder,
  findExpiredEvaluations,
  getRetentionPolicy,
  runRetention,
} from "./services/retention";
import { BATCH_MAX, enqueueBatchMessages, pendingBatchMessages, planBatchMessage } from "./services/batchMessages";
import { evolutionShortError, getEvolutionStatus, isEvolutionConfigured, normalizeBrazilNumber, sendEvolutionText } from "./services/evolution";
import {
  deleteEvaluationPhotoObjects,
  getPhotoObjectKey,
  hydrateEvaluationPhotos,
  isEvaluationPhotoStorageConfigured,
  parseStoredEvaluationPhotos,
  prepareEvaluationPhotosForStorage,
} from "./services/evaluationPhotoStorage";

/** Linha de avaliação devolvida ao painel. */
export type EvaluationRow = Omit<EvaluationRecord, "photos" | "unit"> & {
  photos: EvaluationPhotoItem[];
  unit: "jardim" | "gll" | "";
  isLate: boolean;
};

const statusSchema = z.enum(EVALUATION_STATUSES);
const unitSchema = z.enum(["jardim", "gll"]);
const centsSchema = z.number().int().min(0).max(100_000_000);
const idInput = z.object({ id: z.number().int().positive() });

function unitLabel(unit: string): string {
  return STORE_UNITS.find((u) => u.value === unit)?.label ?? "sem unidade";
}

function refusalLabel(reason: string): string {
  return REFUSAL_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

function centsLabel(value: number | null): string {
  return value === null ? "vazio" : formatCents(value);
}

async function getSlaHours(): Promise<number> {
  return parseSlaHours(await getSingleSetting(SETTING_KEYS.evaluationSlaHours), DEFAULT_EVALUATION_SLA_HOURS);
}

async function toRow(record: EvaluationRecord, slaHours: number, now: Date, includePhotos = true): Promise<EvaluationRow> {
  const stored = includePhotos ? parseStoredEvaluationPhotos(record.photos) : [];
  const photos = stored.length ? await hydrateEvaluationPhotos(stored) : [];
  const unit = record.unit === "jardim" || record.unit === "gll" ? record.unit : "";
  return { ...record, photos, unit, isLate: isLate(record, now, slaHours) };
}

async function loadOr404(id: number): Promise<EvaluationRecord> {
  const record = await findEvaluationById(id);
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Avaliação não encontrada" });
  return record;
}

function runWorkflow(fn: () => WorkflowState): WorkflowState {
  try {
    return fn();
  } catch (err) {
    if (err instanceof WorkflowError) {
      const conflict = err.message.startsWith("Já está com");
      throw new TRPCError({ code: conflict ? "CONFLICT" : "BAD_REQUEST", message: err.message });
    }
    throw err;
  }
}

/** Salva somente o que mudou; devolve se algo mudou. */
async function persist(id: number, before: WorkflowState, after: WorkflowState): Promise<boolean> {
  const patch = diffWorkflow(before, after);
  if (!Object.keys(patch).length) return false;
  await updateEvaluationWorkflow(id, patch);
  return true;
}

async function changeStatus(
  user: SessionUser,
  id: number,
  status: (typeof EVALUATION_STATUSES)[number],
  extra: { refusalReason?: string; closedValue?: number | null },
) {
  const record = await loadOr404(id);
  const before = toWorkflowState(record);
  const after = runWorkflow(() => applyStatus(before, status, new Date(), extra));
  const changed = await persist(id, before, after);
  if (changed) {
    let summary = `Status da avaliação #${id} alterado para ${EVALUATION_STATUS_LABELS[status]}`;
    if (status === "recusado") summary += ` (motivo: ${refusalLabel(after.refusalReason)})`;
    if (status === "concluido" && after.closedValue !== before.closedValue) {
      summary += ` (valor fechado: ${centsLabel(after.closedValue)})`;
    }
    await logAction(user, { action: "evaluation.status", entityType: "evaluation", entityId: id, summary });
    if (status === "concluido") dispatchCustomerEventInBackground("concluded", id);
    if (status === "recusado") dispatchCustomerEventInBackground("refused", id);
  }
  return { ok: true, changed };
}

const MAX_REPORT_DAYS = 366;

async function loadReportRows(from: Date, to: Date, unit?: "jardim" | "gll") {
  if (to < from) throw new TRPCError({ code: "BAD_REQUEST", message: "A data final é anterior à inicial" });
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_REPORT_DAYS) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Período máximo de 366 dias" });
  }
  return findEvaluationReportRows({ from, to, unit });
}

export const evaluationProcedures = {
  evaluations: adminProcedure.query(async ({ ctx }): Promise<EvaluationRow[]> => {
    assertCan(ctx.user, "evaluations.manage");
    const slaHours = await getSlaHours();
    const now = new Date();
    let records: EvaluationRecord[] = [];
    try {
      const db = getDb();
      await ensureTables();
      records = await db.select().from(evaluations).orderBy(desc(evaluations.createdAt));
    } catch (err) {
      console.warn(
        "Consulta de avaliações via Drizzle falhou, tentando fallback SQL direto:",
        err instanceof Error ? err.message : err,
      );
      try {
        const pool = getPool();
        if (pool) {
          const [rows] = await pool.query("SELECT * FROM evaluations ORDER BY created_at DESC");
          if (Array.isArray(rows)) records = (rows as Record<string, unknown>[]).map((r) => mapEvaluationSqlRow(r));
        }
      } catch (sqlErr) {
        console.error("Erro fatal no fallback SQL de avaliações:", sqlErr instanceof Error ? sqlErr.message : sqlErr);
      }
    }
    return Promise.all(records.map((r) => toRow(r, slaHours, now)));
  }),

  evaluationSummary: adminProcedure
    .input(z.object({ unit: unitSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      try {
        const [rows, slaHours] = await Promise.all([findEvaluationStatusRows(input?.unit), getSlaHours()]);
        const now = new Date();
        const countOf = (status: string) => rows.filter((row) => row.status === status).length;
        return {
          total: rows.length,
          pending: countOf("pendente"),
          atendimento: countOf("atendimento"),
          concluido: countOf("concluido"),
          recusado: countOf("recusado"),
          late: rows.filter((row) => isLate(row, now, slaHours)).length,
        };
      } catch (error) {
        console.error("Erro ao consultar resumo das avaliações:", error);
        return { total: 0, pending: 0, atendimento: 0, concluido: 0, recusado: 0, late: 0 };
      }
    }),

  evaluationsPage: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(30).default(20),
        status: statusSchema.optional(),
        search: z.string().max(100).optional().default(""),
        unit: unitSchema.optional(),
        assigned: z.enum(["me", "none", "any"]).optional().default("any"),
        late: z.boolean().optional().default(false),
        includePhotos: z.boolean().optional().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const slaHours = await getSlaHours();
      const now = new Date();
      const offset = (input.page - 1) * input.pageSize;
      try {
        const { rows, total } = await findEvaluationPage({
          page: input.page,
          pageSize: input.pageSize,
          status: input.status,
          search: input.search,
          unit: input.unit,
          assigned: input.assigned,
          userId: ctx.user.id,
          late: input.late,
          lateCutoff: new Date(now.getTime() - slaHours * 60 * 60 * 1000),
        });
        const items = await Promise.all(rows.map((r) => toRow(r, slaHours, now, input.includePhotos)));
        return { items, total, page: input.page, pageSize: input.pageSize, hasMore: offset + rows.length < total };
      } catch (err) {
        console.error("Erro fatal na consulta paginada de avaliações:", err instanceof Error ? err.message : err);
        return { items: [] as EvaluationRow[], total: 0, page: input.page, pageSize: input.pageSize, hasMore: false };
      }
    }),

  evaluationDetail: adminProcedure.input(idInput).query(async ({ ctx, input }) => {
    assertCan(ctx.user, "evaluations.manage");
    const record = await loadOr404(input.id);
    const [slaHours, notes, audit, related] = await Promise.all([
      getSlaHours(),
      listEvaluationNotes(input.id),
      listAudit({ entityType: "evaluation", entityId: String(input.id), limit: 100 }),
      findRelatedEvaluations(record.whatsapp, input.id),
    ]);
    const evaluation = await toRow(record, slaHours, new Date());
    return { evaluation, notes: notes as EvaluationNote[], audit: audit as AuditEntry[], related };
  }),

  /** SLA, mensagens prontas e dados das lojas (o vendedor não acessa getSettings). */
  evaluationConfig: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "evaluations.manage");
    const [sla, templates, addressJardim, addressGll, whatsappJardim, whatsappGll] = await Promise.all([
      getSingleSetting(SETTING_KEYS.evaluationSlaHours),
      getSingleSetting(SETTING_KEYS.whatsappTemplates),
      getSingleSetting(SETTING_KEYS.addressJardim),
      getSingleSetting(SETTING_KEYS.addressGll),
      getSingleSetting(SETTING_KEYS.whatsappJardim),
      getSingleSetting(SETTING_KEYS.whatsappGll),
    ]);
    return {
      slaHours: parseSlaHours(sla, DEFAULT_EVALUATION_SLA_HOURS),
      templates: parseTemplates(templates) as WhatsappTemplate[],
      stores: {
        jardim: { label: unitLabel("jardim"), address: addressJardim, whatsapp: whatsappJardim },
        gll: { label: unitLabel("gll"), address: addressGll, whatsapp: whatsappGll },
      },
    };
  }),

  evaluationClaim: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    assertCan(ctx.user, "evaluations.manage");
    const record = await loadOr404(input.id);
    const before = toWorkflowState(record);
    const after = runWorkflow(() => applyClaim(before, ctx.user, new Date()));
    const changed = await persist(input.id, before, after);
    if (changed) {
      await logAction(ctx.user, {
        action: "evaluation.claim",
        entityType: "evaluation",
        entityId: input.id,
        summary: `${ctx.user.name} assumiu a avaliação #${input.id} (${record.name} — ${record.model})`,
      });
      dispatchCustomerEventInBackground("assigned", input.id);
    }
    return { ok: true, changed };
  }),

  evaluationAssign: adminProcedure
    .input(z.object({ id: z.number().int().positive(), userId: z.number().int().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.assign");
      const record = await loadOr404(input.id);
      const before = toWorkflowState(record);
      let after: WorkflowState;
      let summary: string;
      if (input.userId === null) {
        after = applyUnassign(before);
        summary = `Removeu o responsável da avaliação #${input.id}`;
      } else {
        const target = await getUserById(input.userId);
        if (!target || !target.active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não encontrado ou inativo" });
        }
        after = runWorkflow(() => applyClaim(before, target, new Date(), { force: true }));
        summary = `Atribuiu a avaliação #${input.id} para ${target.name}`;
      }
      const changed = await persist(input.id, before, after);
      if (changed) {
        await logAction(ctx.user, { action: "evaluation.assign", entityType: "evaluation", entityId: input.id, summary });
        if (input.userId !== null) dispatchCustomerEventInBackground("assigned", input.id);
      }
      return { ok: true, changed };
    }),

  evaluationSetStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: statusSchema,
        refusalReason: z.string().max(40).optional(),
        closedValue: centsSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      return changeStatus(ctx.user, input.id, input.status, {
        refusalReason: input.refusalReason,
        closedValue: input.closedValue,
      });
    }),

  /** Compatibilidade com a tela antiga: recusa sem motivo vira "outro". */
  updateEvaluationStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: statusSchema,
        refusalReason: z.string().max(40).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const refusalReason = input.status === "recusado" ? input.refusalReason || "outro" : undefined;
      const result = await changeStatus(ctx.user, input.id, input.status, { refusalReason });
      return { ok: result.ok };
    }),

  evaluationSetValues: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        offeredValue: centsSchema.nullable().optional(),
        closedValue: centsSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const record = await loadOr404(input.id);
      const before = toWorkflowState(record);
      const after = runWorkflow(() =>
        applyValues(before, { offeredValue: input.offeredValue, closedValue: input.closedValue }),
      );
      const changed = await persist(input.id, before, after);
      if (changed) {
        const parts: string[] = [];
        if (after.offeredValue !== before.offeredValue) parts.push(`oferecido ${centsLabel(after.offeredValue)}`);
        if (after.closedValue !== before.closedValue) parts.push(`fechado ${centsLabel(after.closedValue)}`);
        await logAction(ctx.user, {
          action: "evaluation.values",
          entityType: "evaluation",
          entityId: input.id,
          summary: `Valores da avaliação #${input.id}: ${parts.join(", ")}`,
        });
        if (after.offeredValue !== before.offeredValue && after.offeredValue !== null) {
          dispatchCustomerEventInBackground("offered", input.id);
        }
      }
      return { ok: true, changed };
    }),

  evaluationAddNote: adminProcedure
    .input(z.object({ id: z.number().int().positive(), body: z.string().max(5000) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      await loadOr404(input.id);
      let body: string;
      try {
        body = validateNoteBody(input.body);
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Anotação inválida" });
      }
      const note = await addEvaluationNote(ctx.user, input.id, body);
      await logAction(ctx.user, {
        action: "evaluation.note",
        entityType: "evaluation",
        entityId: input.id,
        summary: `Anotação na avaliação #${input.id}: ${body.length > 120 ? `${body.slice(0, 117)}...` : body}`,
      });
      return { ok: true, note };
    }),

  evaluationSetUnit: adminProcedure
    .input(z.object({ id: z.number().int().positive(), unit: z.enum(["jardim", "gll", ""]) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const record = await loadOr404(input.id);
      const before = toWorkflowState(record);
      const after = runWorkflow(() => applyUnit(before, input.unit));
      const changed = await persist(input.id, before, after);
      if (changed) {
        await logAction(ctx.user, {
          action: "evaluation.unit",
          entityType: "evaluation",
          entityId: input.id,
          summary: `Unidade da avaliação #${input.id} alterada para ${unitLabel(input.unit)}`,
        });
      }
      return { ok: true, changed };
    }),

  deleteEvaluation: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    assertCan(ctx.user, "evaluations.manage");
    const db = getDb();
    await ensureTables();
    const evaluation = await findEvaluationById(input.id);
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
      const currentEvaluation = await findEvaluationById(input.id);
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
          .set({ photos: photosJson, photosCount: storedPhotos.length })
          .where(eq(evaluations.id, input.id));
      } catch {
        const pool = getPool();
        if (pool) {
          await pool.query("UPDATE evaluations SET photos = ?, photos_count = ? WHERE id = ?", [
            photosJson,
            storedPhotos.length,
            input.id,
          ]);
        }
      }
      const nextKeys = new Set(storedPhotos.map(getPhotoObjectKey).filter((key): key is string => Boolean(key)));
      const removedKeys = [...currentKeys].filter((key) => !nextKeys.has(key));
      try {
        await deleteEvaluationPhotoObjects(removedKeys);
      } catch (error) {
        console.error("As fotos removidas da avaliação não puderam ser excluídas do S3:", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return { ok: true, count: storedPhotos.length };
    }),

  migrateEvaluationPhotosToS3: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    assertCan(ctx.user, "evaluations.manage");
    if (!isEvaluationPhotoStorageConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Configure o armazenamento S3/R2 no Coolify antes de migrar as fotos.",
      });
    }
    const db = getDb();
    await ensureTables();
    const evaluation = await loadOr404(input.id);
    const photos = parseStoredEvaluationPhotos(evaluation.photos);
    const storedPhotos = await prepareEvaluationPhotosForStorage(photos);
    await db
      .update(evaluations)
      .set({ photos: JSON.stringify(storedPhotos), photosCount: storedPhotos.length })
      .where(eq(evaluations.id, input.id));
    return {
      ok: true,
      count: storedPhotos.length,
      migrated: storedPhotos.filter((photo) => photo.storage === "s3").length,
    };
  }),

  retryEvaluationNotification: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    assertCan(ctx.user, "evaluations.manage");
    const evaluation = await loadOr404(input.id);
    const result = await notifyEvaluationCreated({
      id: evaluation.id,
      name: evaluation.name,
      whatsapp: evaluation.whatsapp,
      model: evaluation.model,
      storage: evaluation.storage,
      targetModel: evaluation.targetModel,
      photosCount: evaluation.photosCount,
      unit: evaluation.unit === "jardim" || evaluation.unit === "gll" ? evaluation.unit : "",
    });
    try {
      await persistEvaluationNotificationStatus(evaluation.id, result);
    } catch (error) {
      const e = error as { code?: unknown; errno?: unknown; sqlState?: unknown };
      console.error("Não foi possível salvar o resultado da retentativa de notificação:", {
        code: e?.code,
        errno: e?.errno,
        sqlState: e?.sqlState,
      });
    }
    return { ok: result.status === "sent", status: result.status, error: result.error || null };
  }),

  /** Relatório do período (máx. 366 dias). O ranking por vendedor é só do dono. */
  evaluationReport: adminProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
        unit: unitSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const rows = await loadReportRows(input.from, input.to, input.unit);
      const report = computeEvaluationReport(rows);
      return { ...report, ranking: can(ctx.user, "reports.team") ? report.ranking : null };
    }),

  /** Linhas do período para exportação em CSV. */
  evaluationExport: adminProcedure
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date(), unit: unitSchema.optional() }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const rows = await loadReportRows(input.from, input.to, input.unit);
      await logAction(ctx.user, {
        action: "evaluation.export",
        entityType: "evaluation",
        summary: `Exportou ${rows.length} avaliações (${input.from.toISOString().slice(0, 10)} a ${input.to.toISOString().slice(0, 10)})`,
      });
      return rows;
    }),

  /** Ações em lote (máx. 50): pegar para mim, atribuir a alguém (dono) ou recusar. */
  evaluationBatch: adminProcedure
    .input(
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("claim"), ids: z.array(z.number().int().positive()).min(1).max(50) }),
        z.object({
          action: z.literal("assign"),
          ids: z.array(z.number().int().positive()).min(1).max(50),
          userId: z.number().int().positive(),
        }),
        z.object({
          action: z.literal("refuse"),
          ids: z.array(z.number().int().positive()).min(1).max(50),
          refusalReason: z.string().max(40),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      let target: Awaited<ReturnType<typeof getUserById>> = null;
      if (input.action === "assign") {
        assertCan(ctx.user, "evaluations.assign");
        target = await getUserById(input.userId);
        if (!target || !target.active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não encontrado ou inativo" });
        }
      }

      const ids = [...new Set(input.ids)];
      const failed: { id: number; message: string }[] = [];
      let done = 0;
      for (const id of ids) {
        try {
          if (input.action === "refuse") {
            const result = await changeStatus(ctx.user, id, "recusado", { refusalReason: input.refusalReason });
            if (result.changed) done++;
            continue;
          }
          const record = await loadOr404(id);
          const before = toWorkflowState(record);
          const assignee = input.action === "assign" ? target! : ctx.user;
          const after = runWorkflow(() =>
            applyClaim(before, assignee, new Date(), input.action === "assign" ? { force: true } : undefined),
          );
          if (await persist(id, before, after)) {
            done++;
            await logAction(ctx.user, {
              action: input.action === "assign" ? "evaluation.assign" : "evaluation.claim",
              entityType: "evaluation",
              entityId: id,
              summary:
                input.action === "assign"
                  ? `Atribuiu a avaliação #${id} para ${assignee.name} (em lote)`
                  : `${ctx.user.name} assumiu a avaliação #${id} (${record.name} — ${record.model}) (em lote)`,
            });
            dispatchCustomerEventInBackground("assigned", id);
          }
        } catch (err) {
          failed.push({ id, message: err instanceof Error ? err.message : "Erro inesperado" });
        }
      }
      return { ok: failed.length === 0, done, failed };
    }),

  /** LGPD: quantas avaliações já passaram do prazo de guarda (nada é apagado aqui). */
  privacyRetentionPreview: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "settings.manage");
    const policy = await getRetentionPolicy();
    const expired = await findExpiredEvaluations(policy);
    return {
      policy,
      expired: expired.length,
      expiredOpen: expired.filter((e) => e.status !== "concluido").length,
      expiredClosed: expired.filter((e) => e.status === "concluido").length,
    };
  }),

  /** LGPD: apaga agora as avaliações com prazo vencido (mesma regra da rotina automática). */
  privacyRetentionRun: adminProcedure.mutation(async ({ ctx }) => {
    assertCan(ctx.user, "settings.manage");
    return runRetention(new Date(), ctx.user);
  }),

  /** LGPD: o que existe de um titular (por WhatsApp), antes de apagar. Só contagens, modelos e datas. */
  privacyHolderPreview: adminProcedure
    .input(z.object({ whatsapp: z.string().min(8).max(30) }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "settings.manage");
      const items = await findEvaluationsOfHolder(input.whatsapp);
      return {
        count: items.length,
        oldest: items.length ? new Date(Math.min(...items.map((e) => e.createdAt.getTime()))) : null,
        photos: items.reduce((n, e) => n + parseStoredEvaluationPhotos(e.photos).length, 0),
      };
    }),

  /** LGPD: exclusão a pedido do titular. Apaga avaliações, anotações, mensagens e fotos do número. */
  privacyHolderErase: adminProcedure
    .input(z.object({ whatsapp: z.string().min(8).max(30), confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "settings.manage");
      const items = await findEvaluationsOfHolder(input.whatsapp);
      const deleted = await eraseEvaluations(items);
      await logAction(ctx.user, {
        action: "privacy.erase",
        entityType: "evaluation",
        summary: `${ctx.user.name} atendeu pedido de exclusão de dados do titular: ${deleted} avaliação(ões) apagada(s)`,
      });
      return { deleted };
    }),

  /** Pré-visualização do envio em lote de "avaliação recebida": quem receberia, quem será pulado e um exemplo do texto. */
  evaluationBatchMessagePreview: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(BATCH_MAX) }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const plan = await planBatchMessage("created", input.ids);
      return { ...plan, queued: pendingBatchMessages() };
    }),

  /** Envia "avaliação recebida" aos selecionados, um a um e com intervalo, em segundo plano. */
  evaluationBatchMessage: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(BATCH_MAX) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const plan = await planBatchMessage("created", input.ids);
      if (!plan.evolutionConfigured) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A Evolution API não está configurada no servidor." });
      }
      const queued = enqueueBatchMessages("created", plan.eligible);
      await logAction(ctx.user, {
        action: "evaluation.messageBatch",
        entityType: "evaluation",
        summary: `${ctx.user.name} enviou "avaliação recebida" em lote: ${queued} na fila, ${plan.alreadySent.length} já tinham recebido`,
      });
      return {
        queued,
        alreadySent: plan.alreadySent.length,
        invalidNumber: plan.invalidNumber.length,
        closed: plan.closed.length,
        estimatedSeconds: plan.estimatedSeconds,
      };
    }),

  /** Confere o bônus de fidelidade pelo CPF no ERP (o CPF não é gravado, só o resultado). */
  evaluationLoyaltyVerify: adminProcedure
    .input(z.object({ id: z.number().int().positive(), cpf: z.string().max(20) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      await loadOr404(input.id);
      if (!isValidCpf(input.cpf)) throw new TRPCError({ code: "BAD_REQUEST", message: "CPF inválido" });
      const result = await runLoyaltyCheck(input.id, input.cpf);
      await logAction(ctx.user, {
        action: "evaluation.loyaltyCheck",
        entityType: "evaluation",
        entityId: input.id,
        summary: `Conferiu a fidelidade da avaliação #${input.id}: ${LOYALTY_STATUS_LABELS[result.status]}`,
      });
      return result;
    }),

  /** A equipe confirma (ou nega) o bônus de fidelidade por conta própria. */
  evaluationLoyaltyConfirm: adminProcedure
    .input(z.object({ id: z.number().int().positive(), confirmed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const record = await loadOr404(input.id);
      const status = input.confirmed ? "manual" : "denied";
      await updateEvaluationLoyalty(input.id, {
        loyaltyStatus: status,
        loyaltyNote: `${input.confirmed ? "Confirmado" : "Negado"} por ${ctx.user.name}`,
        erpCustomerId: record.erpCustomerId ?? "",
      });
      await logAction(ctx.user, {
        action: "evaluation.loyaltyConfirm",
        entityType: "evaluation",
        entityId: input.id,
        summary: `${input.confirmed ? "Confirmou" : "Negou"} o bônus de fidelidade da avaliação #${input.id}`,
      });
      return { ok: true, status };
    }),

  /** Estado da entrada no estoque do ERP para uma troca concluída. */
  erpEntryState: adminProcedure.input(idInput).query(async ({ ctx, input }) => {
    assertCan(ctx.user, "evaluations.manage");
    await loadOr404(input.id);
    return {
      configured: isErpServiceConfigured(),
      entry: await getErpEntry(input.id),
      canEmitNfe: can(ctx.user, "products.manage"),
    };
  }),

  /** Dá entrada do aparelho comprado no estoque do ERP (ação manual, uma vez por avaliação). */
  erpEntryCreate: adminProcedure
    .input(z.object({ id: z.number().int().positive(), data: acquisitionInputSchema }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      if (input.data.emitirNfe) assertCan(ctx.user, "products.manage");
      if (!isErpServiceConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O usuário de serviço do ERP não está configurado." });
      }
      const record = await loadOr404(input.id);
      if (record.status !== "concluido") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível dar entrada de uma troca concluída." });
      }
      if (record.unit !== "jardim" && record.unit !== "gll") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Defina a unidade da avaliação antes de dar entrada no ERP." });
      }

      const imeiLast4 = onlyDigits(input.data.imei1).slice(-4);
      if (!(await claimErpEntry(input.id, ctx.user, imeiLast4))) {
        throw new TRPCError({ code: "CONFLICT", message: "Esta avaliação já tem entrada no ERP (ou uma está em andamento)." });
      }

      try {
        const result = await createSeminovoEntry(input.data, record.unit);
        await completeErpEntry(input.id, result.erpProductId);
        await logAction(ctx.user, {
          action: "evaluation.erpEntry",
          entityType: "evaluation",
          entityId: input.id,
          summary: `Deu entrada no ERP do ${input.data.brandName} ${input.data.modelName} (IMEI final ${imeiLast4}) da avaliação #${input.id}${input.data.emitirNfe ? " com NF-e" : ""}`,
        });
        return { ok: true, erpProductId: result.erpProductId };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro inesperado";
        if (err instanceof ErpApiError && err.status !== undefined) {
          // O ERP respondeu e recusou: nada foi criado, pode corrigir e tentar de novo.
          await releaseErpEntry(input.id);
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }
        // Sem resposta (queda/tempo esgotado): o ERP pode ter criado mesmo assim. Mantém a reserva por 2 min.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `${message}. Confira no ERP se o aparelho entrou antes de tentar de novo (nova tentativa liberada em 2 minutos).`,
        });
      }
    }),

  /** Endereço pelo CEP (inclui o código IBGE do município exigido pelo ERP). */
  lookupCep: adminProcedure
    .input(z.object({ cep: z.string().max(12) }))
    .query(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const cep = onlyDigits(input.cep);
      if (cep.length !== 8) throw new TRPCError({ code: "BAD_REQUEST", message: "CEP inválido" });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
        const data = (await res.json()) as Record<string, string | boolean | undefined>;
        if (!res.ok || data.erro) return null;
        return {
          logradouro: String(data.logradouro ?? ""),
          bairro: String(data.bairro ?? ""),
          cidade: String(data.localidade ?? ""),
          uf: String(data.uf ?? ""),
          ibge: String(data.ibge ?? ""),
        };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível consultar o CEP agora. Preencha manualmente." });
      } finally {
        clearTimeout(timer);
      }
    }),

  evaluationMessages: adminProcedure.input(idInput).query(async ({ ctx, input }) => {
    assertCan(ctx.user, "evaluations.manage");
    await loadOr404(input.id);
    return listEvaluationMessages(input.id);
  }),

  /** Reenvio manual de uma mensagem automática ao cliente (ignora liga/desliga e "já enviado"). */
  resendEvaluationMessage: adminProcedure
    .input(z.object({ id: z.number().int().positive(), event: z.enum(AUTO_MESSAGE_EVENTS) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      await loadOr404(input.id);
      const result = await dispatchCustomerEvent(input.event, input.id, { force: true });
      await logAction(ctx.user, {
        action: "evaluation.message",
        entityType: "evaluation",
        entityId: input.id,
        summary: `Reenviou mensagem "${input.event}" ao cliente da avaliação #${input.id}: ${result}`,
      });
      return { ok: result === "sent", result };
    }),

  /** Envio manual de uma mensagem (pronta ou editada) ao cliente pela Evolution; fica no histórico da avaliação. */
  sendEvaluationMessage: adminProcedure
    .input(z.object({ id: z.number().int().positive(), text: z.string().trim().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      const evaluation = await loadOr404(input.id);
      if (!isEvolutionConfigured()) {
        return { ok: false as const, error: "A Evolution API não está configurada no servidor." };
      }
      try {
        await sendEvolutionText(evaluation.whatsapp, input.text);
        await recordEvaluationMessage({
          evaluationId: input.id,
          event: "manual",
          recipient: "cliente",
          status: "sent",
          error: null,
          body: `${input.text}\n\n— enviada por ${ctx.user.name}`,
        });
        await logAction(ctx.user, {
          action: "evaluation.message",
          entityType: "evaluation",
          entityId: input.id,
          summary: `${ctx.user.name} enviou uma mensagem pelo WhatsApp ao cliente da avaliação #${input.id}`,
        });
        return { ok: true as const };
      } catch (error) {
        const message = evolutionShortError(error);
        await recordEvaluationMessage({
          evaluationId: input.id,
          event: "manual",
          recipient: "cliente",
          status: "failed",
          error: message,
          body: input.text,
        });
        return { ok: false as const, error: message };
      }
    }),

  /** Envia uma mensagem de teste pela Evolution para conferir a configuração de ponta a ponta. */
  evolutionTest: adminProcedure
    .input(z.object({ number: z.string().min(8).max(60) }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "settings.manage");
      if (!isEvolutionConfigured()) {
        return { ok: false, error: "A Evolution API não está configurada no servidor (faltam EVOLUTION_API_URL, EVOLUTION_API_KEY ou EVOLUTION_INSTANCE)." };
      }
      const number = normalizeBrazilNumber(input.number);
      if (!number) return { ok: false, error: "Número inválido. Use DDD + número (ou o ID de um grupo terminado em @g.us)." };
      try {
        await sendEvolutionText(number, `✅ Teste do painel da Lojinha do Celular. Se você recebeu esta mensagem, a Evolution está funcionando. (${ctx.user.name})`);
        await logAction(ctx.user, {
          action: "settings.evolutionTest",
          entityType: "settings",
          summary: `${ctx.user.name} enviou uma mensagem de teste pela Evolution`,
        });
        return { ok: true as const };
      } catch (error) {
        return { ok: false, error: evolutionShortError(error) };
      }
    }),

  evolutionStatus: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "settings.manage");
    return getEvolutionStatus();
  }),
};
