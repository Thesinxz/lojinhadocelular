/**
 * Histórico das mensagens automáticas enviadas por avaliação.
 * Em memória durante os testes ou sem DATABASE_URL.
 */
import { asc, eq } from "drizzle-orm";
import { evaluationMessages } from "@db/schema";
import { ensureTables, getDb } from "../queries/connection";

export type MessageRecipient = "cliente" | "equipe";
export type MessageStatus = "sent" | "failed";

export interface EvaluationMessage {
  id: number;
  evaluationId: number;
  event: string;
  recipient: MessageRecipient;
  status: MessageStatus;
  error: string | null;
  body: string | null;
  createdAt: Date;
}

export type NewEvaluationMessage = Omit<EvaluationMessage, "id" | "createdAt">;

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

let memoryMessages: EvaluationMessage[] = [];
let memoryNextId = 1;

export function resetEvaluationMessagesForTesting(): void {
  memoryMessages = [];
  memoryNextId = 1;
}

function mapRow(row: typeof evaluationMessages.$inferSelect): EvaluationMessage {
  return {
    id: Number(row.id),
    evaluationId: Number(row.evaluationId),
    event: String(row.event),
    recipient: row.recipient === "equipe" ? "equipe" : "cliente",
    status: row.status === "sent" ? "sent" : "failed",
    error: row.error ?? null,
    body: row.body ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
  };
}

export async function listEvaluationMessages(evaluationId: number): Promise<EvaluationMessage[]> {
  if (isMemoryMode()) {
    return memoryMessages.filter((m) => m.evaluationId === evaluationId).map((m) => ({ ...m }));
  }
  const db = getDb();
  await ensureTables();
  const rows = await db
    .select()
    .from(evaluationMessages)
    .where(eq(evaluationMessages.evaluationId, evaluationId))
    .orderBy(asc(evaluationMessages.createdAt), asc(evaluationMessages.id));
  return rows.map(mapRow);
}

export async function recordEvaluationMessage(message: NewEvaluationMessage): Promise<void> {
  const clean = {
    ...message,
    error: message.error ? message.error.slice(0, 500) : null,
    body: message.body ? message.body.slice(0, 5000) : null,
  };
  if (isMemoryMode()) {
    memoryMessages.push({ ...clean, id: memoryNextId++, createdAt: new Date() });
    return;
  }
  const db = getDb();
  await ensureTables();
  await db.insert(evaluationMessages).values(clean);
}
