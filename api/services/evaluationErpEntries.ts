/**
 * Controle da entrada no estoque do ERP por avaliação.
 * Guarda só IDs e os 4 últimos dígitos do IMEI: CPF, endereço e demais dados do cliente
 * seguem direto para o ERP e NÃO ficam no nosso banco.
 * Em memória durante os testes ou sem DATABASE_URL.
 */
import { and, eq, inArray, lt } from "drizzle-orm";
import { evaluationErpEntries } from "@db/schema";
import { ensureTables, getDb } from "../queries/connection";

export interface ErpEntry {
  evaluationId: number;
  status: "sending" | "sent";
  erpProductId: string | null;
  imeiLast4: string | null;
  userName: string;
  createdAt: Date;
}

/** Uma tentativa "em andamento" há mais que isso é considerada travada e pode ser refeita. */
export const STALE_SENDING_MS = 2 * 60 * 1000;

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

let memory = new Map<number, ErpEntry>();

export function resetErpEntriesForTesting(): void {
  memory = new Map();
}

type Row = typeof evaluationErpEntries.$inferSelect;

function fromRow(row: Row): ErpEntry {
  return {
    evaluationId: Number(row.evaluationId),
    status: row.status === "sent" ? "sent" : "sending",
    erpProductId: row.erpProductId ?? null,
    imeiLast4: row.imeiLast4 ?? null,
    userName: row.userName ?? "",
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
  };
}

export async function getErpEntry(evaluationId: number): Promise<ErpEntry | null> {
  if (isMemoryMode()) {
    const found = memory.get(evaluationId);
    return found ? { ...found } : null;
  }
  const db = getDb();
  await ensureTables();
  const rows = await db.select().from(evaluationErpEntries).where(eq(evaluationErpEntries.evaluationId, evaluationId)).limit(1);
  return rows[0] ? fromRow(rows[0]) : null;
}

function isDuplicateKey(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: { code?: string; errno?: number } } | null;
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062;
}

/**
 * Reserva a entrada antes de chamar o ERP, para que dois cliques (ou duas pessoas) não
 * criem o aparelho duas vezes. Devolve `false` se já existe uma entrada válida.
 */
export async function claimErpEntry(
  evaluationId: number,
  user: { id: number; name: string },
  imeiLast4: string,
  now = new Date(),
): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - STALE_SENDING_MS);

  if (isMemoryMode()) {
    const current = memory.get(evaluationId);
    if (current && !(current.status === "sending" && current.createdAt < staleBefore)) return false;
    memory.set(evaluationId, {
      evaluationId,
      status: "sending",
      erpProductId: null,
      imeiLast4,
      userName: user.name,
      createdAt: now,
    });
    return true;
  }

  const db = getDb();
  await ensureTables();
  // Libera uma tentativa travada antes de reservar de novo.
  await db
    .delete(evaluationErpEntries)
    .where(
      and(
        eq(evaluationErpEntries.evaluationId, evaluationId),
        eq(evaluationErpEntries.status, "sending"),
        lt(evaluationErpEntries.createdAt, staleBefore),
      ),
    );
  try {
    await db.insert(evaluationErpEntries).values({
      evaluationId,
      status: "sending",
      imeiLast4,
      userId: user.id,
      userName: user.name.slice(0, 80),
    });
    return true;
  } catch (err) {
    if (isDuplicateKey(err)) return false;
    throw err;
  }
}

export async function completeErpEntry(evaluationId: number, erpProductId: string | null): Promise<void> {
  if (isMemoryMode()) {
    const current = memory.get(evaluationId);
    if (current) memory.set(evaluationId, { ...current, status: "sent", erpProductId });
    return;
  }
  const db = getDb();
  await ensureTables();
  await db
    .update(evaluationErpEntries)
    .set({ status: "sent", erpProductId })
    .where(eq(evaluationErpEntries.evaluationId, evaluationId));
}

/** Desfaz a reserva quando o ERP recusou (a pessoa pode corrigir e tentar de novo). */
export async function releaseErpEntry(evaluationId: number): Promise<void> {
  if (isMemoryMode()) {
    if (memory.get(evaluationId)?.status === "sending") memory.delete(evaluationId);
    return;
  }
  const db = getDb();
  await ensureTables();
  await db
    .delete(evaluationErpEntries)
    .where(and(eq(evaluationErpEntries.evaluationId, evaluationId), eq(evaluationErpEntries.status, "sending")));
}

/** Apaga o controle de entrada no ERP das avaliações removidas. */
export async function deleteErpEntriesFor(evaluationIds: number[]): Promise<void> {
  if (evaluationIds.length === 0) return;
  if (isMemoryMode()) {
    for (const id of evaluationIds) memory.delete(id);
    return;
  }
  const db = getDb();
  await ensureTables();
  await db.delete(evaluationErpEntries).where(inArray(evaluationErpEntries.evaluationId, evaluationIds));
}
