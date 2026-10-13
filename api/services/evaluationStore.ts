/**
 * Acesso às avaliações (Troca Fácil) para o painel.
 * Drizzle com fallback para SQL direto (bancos antigos sem as colunas novas ainda),
 * e armazenamento em memória durante os testes.
 */
import { and, count, desc, eq, gte, inArray, isNull, like, lt, lte, or, type SQL } from "drizzle-orm";
import { evaluations } from "@db/schema";
import type { EvaluationStatus } from "@contracts/types";
import { ensureTables, getDb, getPool } from "../queries/connection";
import type { EvaluationUnit, WorkflowState } from "../evaluationWorkflow";
import type { EvalStatRow } from "../dashboard";
import type { ReportRow } from "../evaluationReport";

export type EvaluationRecord = typeof evaluations.$inferSelect;

export type EvaluationWorkflowFields = Pick<
  EvaluationRecord,
  | "status"
  | "unit"
  | "assignedUserId"
  | "assignedUserName"
  | "assignedAt"
  | "firstResponseAt"
  | "statusChangedAt"
  | "offeredValue"
  | "closedValue"
  | "refusalReason"
>;

export type AssignedFilter = "me" | "none" | "any";

export interface EvaluationPageFilters {
  page: number;
  pageSize: number;
  status?: EvaluationStatus;
  search?: string;
  unit?: "jardim" | "gll";
  assigned?: AssignedFilter;
  /** Usuário atual (para `assigned: "me"`). */
  userId: number;
  /** Somente pendentes criadas antes de `lateCutoff`. */
  late?: boolean;
  lateCutoff: Date;
}

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test";
}

// ===== Memória (testes) =====

let memoryRows: EvaluationRecord[] = [];
let memoryNextId = 1;

export function resetEvaluationStoreForTesting(): void {
  memoryRows = [];
  memoryNextId = 1;
}

export function seedEvaluationForTesting(patch: Partial<EvaluationRecord> = {}): EvaluationRecord {
  const row: EvaluationRecord = {
    id: memoryNextId++,
    name: "Cliente Teste",
    whatsapp: "67999990000",
    model: "iPhone 13",
    storage: "128GB",
    color: "Preto",
    purchaseLocation: "",
    targetModel: "",
    targetDetails: "",
    visitPreference: "",
    faceId: "",
    screenOriginal: "",
    batteryOriginal: "",
    camerasOk: "",
    audioOk: "",
    chargingPortOk: "",
    openedBefore: "",
    hasBox: "",
    icloudFree: "",
    loyaltyStatus: "",
    loyaltyNote: "",
    erpCustomerId: "",
    loyaltyCheckedAt: null,
    visualCondition: "",
    condition: "Em análise",
    battery: "90%",
    notes: null,
    photosCount: 0,
    photos: null,
    status: "pendente",
    notificationStatus: "not_configured",
    notificationError: null,
    notifiedAt: null,
    unit: "",
    assignedUserId: null,
    assignedUserName: "",
    assignedAt: null,
    firstResponseAt: null,
    statusChangedAt: null,
    offeredValue: null,
    closedValue: null,
    refusalReason: "",
    createdAt: new Date(),
    ...patch,
  };
  memoryRows.push(row);
  return { ...row };
}

function matchesFilters(row: EvaluationRecord, f: Omit<EvaluationPageFilters, "page" | "pageSize">): boolean {
  if (f.status && row.status !== f.status) return false;
  if (f.unit && row.unit !== f.unit) return false;
  if (f.assigned === "me" && row.assignedUserId !== f.userId) return false;
  if (f.assigned === "none" && row.assignedUserId !== null) return false;
  if (f.late && !(row.status === "pendente" && row.createdAt < f.lateCutoff)) return false;
  const q = (f.search ?? "").trim().toLowerCase();
  if (q) {
    const haystack = [row.name, row.whatsapp, row.model, row.color, row.storage]
      .map((v) => String(v ?? "").toLowerCase());
    if (!haystack.some((v) => v.includes(q))) return false;
  }
  return true;
}

// ===== SQL =====

/** Converte uma linha crua do MySQL (snake_case) no formato do Drizzle. */
export function mapEvaluationSqlRow(r: Record<string, unknown>): EvaluationRecord {
  const date = (v: unknown) => (v ? new Date(v as string) : null);
  const intOrNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const unit = String(r.unit || "");
  return {
    id: Number(r.id),
    name: String(r.name || ""),
    whatsapp: String(r.whatsapp || ""),
    model: String(r.model || ""),
    storage: String(r.storage || ""),
    color: String(r.color || ""),
    purchaseLocation: String(r.purchase_location || ""),
    targetModel: String(r.target_model || ""),
    targetDetails: String(r.target_details || ""),
    visitPreference: String(r.visit_preference || ""),
    faceId: String(r.face_id || ""),
    screenOriginal: String(r.screen_original || ""),
    batteryOriginal: String(r.battery_original || ""),
    camerasOk: String(r.cameras_ok || ""),
    audioOk: String(r.audio_ok || ""),
    chargingPortOk: String(r.charging_port_ok || ""),
    openedBefore: String(r.opened_before || ""),
    hasBox: String(r.has_box || ""),
    icloudFree: String(r.icloud_free || ""),
    loyaltyStatus: String(r.loyalty_status || ""),
    loyaltyNote: String(r.loyalty_note || ""),
    erpCustomerId: String(r.erp_customer_id || ""),
    loyaltyCheckedAt: r.loyalty_checked_at ? new Date(r.loyalty_checked_at as string) : null,
    visualCondition: String(r.visual_condition || ""),
    condition: String(r.condition || "Em análise"),
    battery: String(r.battery || ""),
    notes: r.notes ? String(r.notes) : null,
    photosCount: Number(r.photos_count || 0),
    photos: r.photos ? String(r.photos) : null,
    status: (r.status as EvaluationStatus) || "pendente",
    notificationStatus: String(r.notification_status || "not_configured"),
    notificationError: r.notification_error ? String(r.notification_error) : null,
    notifiedAt: date(r.notified_at),
    unit: unit === "jardim" || unit === "gll" ? unit : "",
    assignedUserId: intOrNull(r.assigned_user_id),
    assignedUserName: String(r.assigned_user_name || ""),
    assignedAt: date(r.assigned_at),
    firstResponseAt: date(r.first_response_at),
    statusChangedAt: date(r.status_changed_at),
    offeredValue: intOrNull(r.offered_value),
    closedValue: intOrNull(r.closed_value),
    refusalReason: String(r.refusal_reason || ""),
    createdAt: r.created_at ? new Date(r.created_at as string) : new Date(),
  };
}

function drizzleWhere(f: Omit<EvaluationPageFilters, "page" | "pageSize">): SQL | undefined {
  const filters: SQL[] = [];
  if (f.status) filters.push(eq(evaluations.status, f.status));
  if (f.unit) filters.push(eq(evaluations.unit, f.unit));
  if (f.assigned === "me") filters.push(eq(evaluations.assignedUserId, f.userId));
  if (f.assigned === "none") filters.push(isNull(evaluations.assignedUserId));
  if (f.late) {
    filters.push(eq(evaluations.status, "pendente"));
    filters.push(lt(evaluations.createdAt, f.lateCutoff));
  }
  const q = (f.search ?? "").trim();
  if (q) {
    const pattern = `%${q}%`;
    const searchFilter = or(
      like(evaluations.name, pattern),
      like(evaluations.whatsapp, pattern),
      like(evaluations.model, pattern),
      like(evaluations.color, pattern),
      like(evaluations.storage, pattern),
    );
    if (searchFilter) filters.push(searchFilter);
  }
  return filters.length ? and(...filters) : undefined;
}

function rawWhere(f: Omit<EvaluationPageFilters, "page" | "pageSize">): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (f.status) {
    parts.push("status = ?");
    params.push(f.status);
  }
  if (f.unit) {
    parts.push("unit = ?");
    params.push(f.unit);
  }
  if (f.assigned === "me") {
    parts.push("assigned_user_id = ?");
    params.push(f.userId);
  }
  if (f.assigned === "none") parts.push("assigned_user_id IS NULL");
  if (f.late) {
    parts.push("status = 'pendente' AND created_at < ?");
    params.push(f.lateCutoff);
  }
  const q = (f.search ?? "").trim();
  if (q) {
    const pattern = `%${q}%`;
    parts.push("(name LIKE ? OR whatsapp LIKE ? OR model LIKE ? OR color LIKE ? OR storage LIKE ?)");
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
  return { sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "", params };
}

// ===== API =====

export async function findEvaluationPage(
  f: EvaluationPageFilters,
): Promise<{ rows: EvaluationRecord[]; total: number }> {
  const offset = (f.page - 1) * f.pageSize;

  if (isMemoryMode()) {
    const all = memoryRows
      .filter((row) => matchesFilters(row, f))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
    return { rows: all.slice(offset, offset + f.pageSize).map((r) => ({ ...r })), total: all.length };
  }

  try {
    const db = getDb();
    await ensureTables();
    const where = drizzleWhere(f);
    const [rows, totals] = await Promise.all([
      db.select().from(evaluations).where(where).orderBy(desc(evaluations.createdAt)).limit(f.pageSize).offset(offset),
      db.select({ total: count() }).from(evaluations).where(where),
    ]);
    return { rows, total: Number(totals[0]?.total || 0) };
  } catch (err) {
    console.warn("Consulta paginada de avaliações via Drizzle falhou:", err instanceof Error ? err.message : err);
    const pool = getPool();
    if (!pool) throw err;
    const { sql, params } = rawWhere(f);
    const [rows] = await pool.query(
      `SELECT * FROM evaluations${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, f.pageSize, offset],
    );
    const [totals] = await pool.query(`SELECT COUNT(*) AS total FROM evaluations${sql}`, params);
    return {
      rows: (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).map((r) => mapEvaluationSqlRow(r)),
      total: Number((totals as Array<{ total?: number }>)?.[0]?.total || 0),
    };
  }
}

/** Status e data de criação (para contadores e atrasos). */
export async function findEvaluationStatusRows(
  unit?: "jardim" | "gll",
): Promise<Array<{ status: EvaluationStatus; createdAt: Date }>> {
  if (isMemoryMode()) {
    return memoryRows
      .filter((r) => !unit || r.unit === unit)
      .map((r) => ({ status: r.status, createdAt: r.createdAt }));
  }
  try {
    const db = getDb();
    await ensureTables();
    return await db
      .select({ status: evaluations.status, createdAt: evaluations.createdAt })
      .from(evaluations)
      .where(unit ? eq(evaluations.unit, unit) : undefined);
  } catch (err) {
    const pool = getPool();
    if (!pool) throw err;
    const [rows] = await pool.query(
      `SELECT status, created_at FROM evaluations${unit ? " WHERE unit = ?" : ""}`,
      unit ? [unit] : [],
    );
    return (Array.isArray(rows) ? rows : []).map((r) => {
      const row = r as { status?: string; created_at?: string };
      return {
        status: (row.status as EvaluationStatus) || "pendente",
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      };
    });
  }
}

/** Colunas usadas pelos indicadores do dashboard (sem fotos). */
export async function findEvaluationStatRows(unit?: "jardim" | "gll"): Promise<EvalStatRow[]> {
  const pick = (r: EvaluationRecord): EvalStatRow => ({
    status: r.status,
    createdAt: r.createdAt,
    firstResponseAt: r.firstResponseAt,
    statusChangedAt: r.statusChangedAt,
    assignedAt: r.assignedAt,
    closedValue: r.closedValue,
    assignedUserId: r.assignedUserId,
    assignedUserName: r.assignedUserName,
  });
  if (isMemoryMode()) {
    return memoryRows.filter((r) => !unit || r.unit === unit).map(pick);
  }
  try {
    const db = getDb();
    await ensureTables();
    return await db
      .select({
        status: evaluations.status,
        createdAt: evaluations.createdAt,
        firstResponseAt: evaluations.firstResponseAt,
        statusChangedAt: evaluations.statusChangedAt,
        assignedAt: evaluations.assignedAt,
        closedValue: evaluations.closedValue,
        assignedUserId: evaluations.assignedUserId,
        assignedUserName: evaluations.assignedUserName,
      })
      .from(evaluations)
      .where(unit ? eq(evaluations.unit, unit) : undefined);
  } catch (err) {
    const pool = getPool();
    if (!pool) throw err;
    const [rows] = await pool.query(
      `SELECT * FROM evaluations${unit ? " WHERE unit = ?" : ""}`,
      unit ? [unit] : [],
    );
    return (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).map((r) =>
      pick(mapEvaluationSqlRow(r)),
    );
  }
}

/** Avaliações recebidas no período (sem fotos), para relatórios e exportação. */
export async function findEvaluationReportRows(opts: {
  from: Date;
  to: Date;
  unit?: "jardim" | "gll";
}): Promise<ReportRow[]> {
  const pick = (r: EvaluationRecord): ReportRow => ({
    id: Number(r.id),
    name: r.name,
    whatsapp: r.whatsapp,
    model: r.model,
    storage: r.storage,
    unit: r.unit,
    status: r.status,
    refusalReason: r.refusalReason,
    offeredValue: r.offeredValue,
    closedValue: r.closedValue,
    createdAt: r.createdAt,
    firstResponseAt: r.firstResponseAt,
    statusChangedAt: r.statusChangedAt,
    assignedUserId: r.assignedUserId,
    assignedUserName: r.assignedUserName,
  });
  const inRange = (r: EvaluationRecord) => r.createdAt >= opts.from && r.createdAt <= opts.to;
  if (isMemoryMode()) {
    return memoryRows.filter((r) => inRange(r) && (!opts.unit || r.unit === opts.unit)).map(pick);
  }
  try {
    const db = getDb();
    await ensureTables();
    const filters: SQL[] = [gte(evaluations.createdAt, opts.from), lte(evaluations.createdAt, opts.to)];
    if (opts.unit) filters.push(eq(evaluations.unit, opts.unit));
    return await db
      .select({
        id: evaluations.id,
        name: evaluations.name,
        whatsapp: evaluations.whatsapp,
        model: evaluations.model,
        storage: evaluations.storage,
        unit: evaluations.unit,
        status: evaluations.status,
        refusalReason: evaluations.refusalReason,
        offeredValue: evaluations.offeredValue,
        closedValue: evaluations.closedValue,
        createdAt: evaluations.createdAt,
        firstResponseAt: evaluations.firstResponseAt,
        statusChangedAt: evaluations.statusChangedAt,
        assignedUserId: evaluations.assignedUserId,
        assignedUserName: evaluations.assignedUserName,
      })
      .from(evaluations)
      .where(and(...filters))
      .orderBy(desc(evaluations.createdAt))
      .then((rows) => rows.map((r) => ({ ...r, id: Number(r.id) })));
  } catch (err) {
    const pool = getPool();
    if (!pool) throw err;
    const [rows] = await pool.query(
      `SELECT * FROM evaluations WHERE created_at >= ? AND created_at <= ?${opts.unit ? " AND unit = ?" : ""} ORDER BY created_at DESC`,
      opts.unit ? [opts.from, opts.to, opts.unit] : [opts.from, opts.to],
    );
    return (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).map((r) =>
      pick(mapEvaluationSqlRow(r)),
    );
  }
}

export interface RelatedEvaluation {
  id: number;
  model: string;
  storage: string | null;
  status: EvaluationStatus;
  closedValue: number | null;
  createdAt: Date;
}

/** Outras avaliações do mesmo WhatsApp (compara os 8 últimos dígitos), da mais recente para a mais antiga. */
export async function findRelatedEvaluations(whatsapp: string, excludeId: number, limit = 10): Promise<RelatedEvaluation[]> {
  const digits = String(whatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 8) return [];
  const key = digits.slice(-8);
  const sameKey = (value: string) => String(value ?? "").replace(/\D/g, "").slice(-8) === key;
  const pick = (r: EvaluationRecord): RelatedEvaluation => ({
    id: Number(r.id),
    model: r.model,
    storage: r.storage,
    status: r.status,
    closedValue: r.closedValue,
    createdAt: r.createdAt,
  });
  const byRecent = (a: RelatedEvaluation, b: RelatedEvaluation) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id;

  if (isMemoryMode()) {
    return memoryRows
      .filter((r) => r.id !== excludeId && sameKey(r.whatsapp))
      .map(pick)
      .sort(byRecent)
      .slice(0, limit);
  }
  try {
    const db = getDb();
    await ensureTables();
    // O número é guardado com máscara; o final (últimos 4 dígitos) continua contíguo.
    const rows = await db
      .select({
        id: evaluations.id,
        whatsapp: evaluations.whatsapp,
        model: evaluations.model,
        storage: evaluations.storage,
        status: evaluations.status,
        closedValue: evaluations.closedValue,
        createdAt: evaluations.createdAt,
      })
      .from(evaluations)
      .where(like(evaluations.whatsapp, `%${digits.slice(-4)}`))
      .orderBy(desc(evaluations.createdAt))
      .limit(200);
    return rows
      .filter((r) => Number(r.id) !== excludeId && sameKey(r.whatsapp))
      .map((r) => ({
        id: Number(r.id),
        model: r.model,
        storage: r.storage,
        status: r.status,
        closedValue: r.closedValue,
        createdAt: r.createdAt,
      }))
      .sort(byRecent)
      .slice(0, limit);
  } catch (err) {
    console.error("Falha ao buscar avaliações do mesmo cliente:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function findEvaluationById(id: number): Promise<EvaluationRecord | null> {
  if (isMemoryMode()) {
    const row = memoryRows.find((r) => r.id === id);
    return row ? { ...row } : null;
  }
  try {
    const db = getDb();
    await ensureTables();
    const rows = await db.select().from(evaluations).where(eq(evaluations.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (err) {
    const pool = getPool();
    if (!pool) throw err;
    const [rows] = await pool.query("SELECT * FROM evaluations WHERE id = ? LIMIT 1", [id]);
    const first = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
    return first ? mapEvaluationSqlRow(first) : null;
  }
}

const WORKFLOW_COLUMNS: Record<keyof EvaluationWorkflowFields, string> = {
  status: "status",
  unit: "unit",
  assignedUserId: "assigned_user_id",
  assignedUserName: "assigned_user_name",
  assignedAt: "assigned_at",
  firstResponseAt: "first_response_at",
  statusChangedAt: "status_changed_at",
  offeredValue: "offered_value",
  closedValue: "closed_value",
  refusalReason: "refusal_reason",
};

export async function updateEvaluationWorkflow(
  id: number,
  patch: Partial<EvaluationWorkflowFields>,
): Promise<void> {
  const keys = Object.keys(patch) as (keyof EvaluationWorkflowFields)[];
  if (!keys.length) return;

  if (isMemoryMode()) {
    const row = memoryRows.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    return;
  }
  try {
    const db = getDb();
    await ensureTables();
    await db.update(evaluations).set(patch).where(eq(evaluations.id, id));
  } catch (err) {
    const pool = getPool();
    if (!pool) throw err;
    const sets = keys.map((k) => `\`${WORKFLOW_COLUMNS[k]}\` = ?`).join(", ");
    await pool.query(`UPDATE evaluations SET ${sets} WHERE id = ?`, [...keys.map((k) => patch[k]), id]);
  }
}

export interface LoyaltyPatch {
  loyaltyStatus: string;
  loyaltyNote: string;
  erpCustomerId: string;
}

/** Grava o resultado da conferência do bônus de fidelidade (nunca o CPF). */
export async function updateEvaluationLoyalty(id: number, patch: LoyaltyPatch): Promise<void> {
  const values = { ...patch, loyaltyCheckedAt: new Date() };
  if (isMemoryMode()) {
    const row = memoryRows.find((r) => r.id === id);
    if (row) Object.assign(row, values);
    return;
  }
  const db = getDb();
  await ensureTables();
  await db.update(evaluations).set(values).where(eq(evaluations.id, id));
}

// ===== Conversões com as regras puras =====

export function toWorkflowState(row: EvaluationRecord): WorkflowState {
  const unit = row.unit === "jardim" || row.unit === "gll" ? row.unit : "";
  return {
    status: row.status,
    unit: unit as EvaluationUnit,
    assignedUserId: row.assignedUserId ?? null,
    assignedUserName: row.assignedUserName ?? "",
    assignedAt: row.assignedAt ?? null,
    firstResponseAt: row.firstResponseAt ?? null,
    statusChangedAt: row.statusChangedAt ?? null,
    offeredValue: row.offeredValue ?? null,
    closedValue: row.closedValue ?? null,
    refusalReason: row.refusalReason ?? "",
    createdAt: row.createdAt,
  };
}

/** Somente os campos que mudaram entre dois estados. */
export function diffWorkflow(before: WorkflowState, after: WorkflowState): Partial<EvaluationWorkflowFields> {
  const patch: Partial<EvaluationWorkflowFields> = {};
  const keys = Object.keys(WORKFLOW_COLUMNS) as (keyof EvaluationWorkflowFields)[];
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    const same = a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
    if (!same) (patch as Record<string, unknown>)[key] = b;
  }
  return patch;
}

// ===== Guarda e exclusão de dados pessoais (LGPD) =====

export interface ErasableEvaluation {
  id: number;
  status: EvaluationStatus;
  createdAt: Date;
  statusChangedAt: Date | null;
  photos: string | null;
}

/** Avaliações criadas antes de `before` (candidatas à guarda máxima). */
export async function listEvaluationsCreatedBefore(before: Date): Promise<ErasableEvaluation[]> {
  if (isMemoryMode()) {
    return memoryRows
      .filter((r) => r.createdAt < before)
      .map((r) => ({ id: r.id, status: r.status, createdAt: r.createdAt, statusChangedAt: r.statusChangedAt, photos: r.photos }));
  }
  const db = getDb();
  await ensureTables();
  const rows = await db
    .select({
      id: evaluations.id,
      status: evaluations.status,
      createdAt: evaluations.createdAt,
      statusChangedAt: evaluations.statusChangedAt,
      photos: evaluations.photos,
    })
    .from(evaluations)
    .where(lt(evaluations.createdAt, before));
  return rows.map((r) => ({ ...r, id: Number(r.id), photos: r.photos ?? null }));
}

/** Avaliações de um número de WhatsApp (compara só os dígitos, ignorando máscara e DDI). */
export async function listEvaluationsByWhatsapp(digits: string): Promise<ErasableEvaluation[]> {
  const wanted = String(digits).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (wanted.length < 10) return [];
  const same = (value: string) => String(value).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") === wanted;
  if (isMemoryMode()) {
    return memoryRows
      .filter((r) => same(r.whatsapp))
      .map((r) => ({ id: r.id, status: r.status, createdAt: r.createdAt, statusChangedAt: r.statusChangedAt, photos: r.photos }));
  }
  const db = getDb();
  await ensureTables();
  const rows = await db
    .select({
      id: evaluations.id,
      whatsapp: evaluations.whatsapp,
      status: evaluations.status,
      createdAt: evaluations.createdAt,
      statusChangedAt: evaluations.statusChangedAt,
      photos: evaluations.photos,
    })
    .from(evaluations);
  return rows
    .filter((r) => same(r.whatsapp))
    .map((r) => ({ id: Number(r.id), status: r.status, createdAt: r.createdAt, statusChangedAt: r.statusChangedAt, photos: r.photos ?? null }));
}

/** Remove as linhas das avaliações (as fotos, anotações e mensagens são apagadas por quem chama). */
export async function deleteEvaluationRows(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  if (isMemoryMode()) {
    memoryRows = memoryRows.filter((r) => !ids.includes(r.id));
    return;
  }
  const db = getDb();
  await ensureTables();
  await db.delete(evaluations).where(inArray(evaluations.id, ids));
}
