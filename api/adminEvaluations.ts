/**
 * Procedimentos do painel para as avaliações (Troca Fácil).
 * Espalhados dentro de `adminRouter` (nomes continuam em `admin.*`).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { evaluations } from "@db/schema";
import { STORE_UNITS, type SessionUser } from "@contracts/permissions";
import {
  DEFAULT_EVALUATION_SLA_HOURS,
  EVALUATION_STATUSES,
  EVALUATION_STATUS_LABELS,
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
  }
  return { ok: true, changed };
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
    const [slaHours, notes, audit] = await Promise.all([
      getSlaHours(),
      listEvaluationNotes(input.id),
      listAudit({ entityType: "evaluation", entityId: String(input.id), limit: 100 }),
    ]);
    const evaluation = await toRow(record, slaHours, new Date());
    return { evaluation, notes: notes as EvaluationNote[], audit: audit as AuditEntry[] };
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
};
