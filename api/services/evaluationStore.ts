/**
 * Acesso às avaliações (Troca Fácil) para o painel.
 * Drizzle com fallback para SQL direto (bancos antigos sem as colunas novas ainda),
 * e armazenamento em memória durante os testes.
 */
import { and, count, desc, eq, isNull, like, lt, or, type SQL } from "drizzle-orm";
import { evaluations } from "@db/schema";
import type { EvaluationStatus } from "@contracts/types";
import { ensureTables, getDb, getPool } from "../queries/connection";
import type { EvaluationUnit, WorkflowState } from "../evaluationWorkflow";

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
    faceId: "",
    screenOriginal: "",
    batteryOriginal: "",
    camerasOk: "",
    audioOk: "",
    chargingPortOk: "",
    openedBefore: "",
    hasBox: "",
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
