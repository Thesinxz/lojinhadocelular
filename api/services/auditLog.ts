import { and, desc, eq, type SQL } from "drizzle-orm";
import type { SessionUser } from "@contracts/permissions";
import { auditLogs } from "@db/schema";
import { ensureTables, getDb } from "../queries/connection";
import type { ProductLike, VariantLike } from "../permissions";

export interface AuditEntry {
  id: number;
  userId: number | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: Date;
}

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  summary: string;
}

export interface ListAuditOptions {
  limit?: number;
  entityType?: string;
  entityId?: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SYSTEM_USER_NAME = "Sistema";

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

let memoryEntries: AuditEntry[] = [];
let memoryNextId = 1;

export function resetAuditLogForTesting(): void {
  memoryEntries = [];
  memoryNextId = 1;
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Registra uma ação no histórico. Nunca lança erro: falhas são apenas logadas,
 * para que o histórico jamais derrube a ação principal.
 */
export async function logAction(
  user: Pick<SessionUser, "id" | "name"> | null,
  e: AuditInput,
): Promise<void> {
  try {
    const entry = {
      userId: user ? user.id : null,
      userName: clip(user?.name || SYSTEM_USER_NAME, 80),
      action: clip(String(e.action || ""), 60),
      entityType: clip(String(e.entityType || ""), 30),
      entityId:
        e.entityId === undefined || e.entityId === null || e.entityId === ""
          ? null
          : clip(String(e.entityId), 60),
      summary: clip(String(e.summary || ""), 5000),
    };

    if (isMemoryMode()) {
      memoryEntries.push({ ...entry, id: memoryNextId++, createdAt: new Date() });
      if (memoryEntries.length > 5000) memoryEntries.splice(0, memoryEntries.length - 5000);
      return;
    }

    const db = getDb();
    await ensureTables();
    await db.insert(auditLogs).values(entry);
  } catch (err) {
    console.error("[Audit] Falha ao registrar ação no histórico:", {
      action: e?.action,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function listAudit(opts: ListAuditOptions = {}): Promise<AuditEntry[]> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  if (isMemoryMode()) {
    return memoryEntries
      .filter((entry) => !opts.entityType || entry.entityType === opts.entityType)
      .filter((entry) => !opts.entityId || entry.entityId === String(opts.entityId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
      .slice(0, limit)
      .map((entry) => ({ ...entry, createdAt: new Date(entry.createdAt) }));
  }

  const db = getDb();
  await ensureTables();
  const filters: SQL[] = [];
  if (opts.entityType) filters.push(eq(auditLogs.entityType, opts.entityType));
  if (opts.entityId) filters.push(eq(auditLogs.entityId, String(opts.entityId)));
  const rows = await db
    .select()
    .from(auditLogs)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit);
  return rows.map((row) => ({
    id: Number(row.id),
    userId: row.userId === null || row.userId === undefined ? null : Number(row.userId),
    userName: String(row.userName || ""),
    action: String(row.action),
    entityType: String(row.entityType),
    entityId: row.entityId === null || row.entityId === undefined ? null : String(row.entityId),
    summary: String(row.summary || ""),
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
  }));
}

// ===== Resumos legíveis =====
export function formatCents(cents: number): string {
  const value = (Number(cents) || 0) / 100;
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${formatted}`;
}

function norm(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function variantLabel(v: VariantLike): string {
  return [v.version, v.storage, v.color].map(norm).filter(Boolean).join(" ") || "variante";
}

/**
 * Gera uma frase em PT-BR descrevendo as mudanças de um produto.
 * Ex.: `iPhone 15 Pro — Preço 15 Pro 128GB Preto: R$ 3.200,00 → R$ 3.000,00; foto alterada`
 */
export function summarizeProductChanges(before: ProductLike | null, after: ProductLike): string {
  const name = norm(after.name) || "Produto";
  if (!before) {
    const count = after.variants.length;
    return `Criou "${name}" (${count} ${count === 1 ? "variante" : "variantes"})`;
  }

  const changes: string[] = [];
  const add = (text: string) => {
    if (!changes.includes(text)) changes.push(text);
  };

  if (norm(before.name) !== norm(after.name)) add(`Nome: "${norm(before.name)}" → "${norm(after.name)}"`);
  if (before.active !== after.active) add(after.active ? "voltou a ficar visível" : "ocultado da vitrine");
  if (before.featured !== after.featured) add(after.featured ? "destacado" : "destaque removido");
  if (norm(before.imageUrl) !== norm(after.imageUrl)) add("foto alterada");
  if (norm(before.videoUrl) !== norm(after.videoUrl)) add("vídeo alterado");
  for (const field of ["brand", "category", "condition", "warranty", "description"] as const) {
    if (norm(before[field]) !== norm(after[field])) add("dados do produto alterados");
  }

  const beforeById = new Map<number, VariantLike>();
  for (const v of before.variants) if (typeof v.id === "number") beforeById.set(v.id, v);
  const seen = new Set<number>();

  for (const next of after.variants) {
    const prev = typeof next.id === "number" ? beforeById.get(next.id) : undefined;
    if (!prev) {
      add(`variante adicionada: ${variantLabel(next)}`);
      continue;
    }
    seen.add(next.id as number);
    const label = variantLabel(next);
    if (Number(prev.priceCash) !== Number(next.priceCash)) {
      add(`Preço ${label}: ${formatCents(prev.priceCash)} → ${formatCents(next.priceCash)}`);
    }
    if (norm(prev.imageUrl) !== norm(next.imageUrl)) add("foto alterada");
    if (norm(prev.videoUrl) !== norm(next.videoUrl)) add("vídeo alterado");
    if (norm(prev.batteryHealth) !== norm(next.batteryHealth)) {
      add(`Bateria ${label}: ${norm(prev.batteryHealth) || "—"} → ${norm(next.batteryHealth) || "—"}`);
    }
    if (norm(prev.quantity ?? 1) !== norm(next.quantity ?? 1)) {
      add(`Quantidade ${label}: ${norm(prev.quantity ?? 1)} → ${norm(next.quantity ?? 1)}`);
    }
    if (prev.available !== next.available) {
      add(`${label} ${next.available ? "disponível" : "indisponível"}`);
    }
    if (norm(prev.notes) !== norm(next.notes)) add("observações alteradas");
    for (const field of ["version", "storage", "color", "colorHex", "sku", "warranty", "condition"] as const) {
      if (norm(prev[field]) !== norm(next[field])) add(`dados da variante ${label} alterados`);
    }
  }
  for (const prev of before.variants) {
    if (typeof prev.id === "number" && !seen.has(prev.id)) add(`variante removida: ${variantLabel(prev)}`);
  }

  return `${name} — ${changes.length ? changes.join("; ") : "sem alterações"}`;
}
