/**
 * Anotações internas das avaliações (timeline do atendimento).
 * Em memória durante os testes ou sem DATABASE_URL.
 */
import { asc, eq } from "drizzle-orm";
import { evaluationNotes } from "@db/schema";
import type { SessionUser } from "@contracts/permissions";
import { ensureTables, getDb } from "../queries/connection";

export interface EvaluationNote {
  id: number;
  evaluationId: number;
  userId: number | null;
  userName: string;
  body: string;
  createdAt: Date;
}

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

let memoryNotes: EvaluationNote[] = [];
let memoryNextId = 1;

export function resetEvaluationNotesForTesting(): void {
  memoryNotes = [];
  memoryNextId = 1;
}

/** Anotações de uma avaliação, da mais antiga para a mais recente. */
export async function listEvaluationNotes(evaluationId: number): Promise<EvaluationNote[]> {
  if (isMemoryMode()) {
    return memoryNotes
      .filter((n) => n.evaluationId === evaluationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
      .map((n) => ({ ...n }));
  }
  const db = getDb();
  await ensureTables();
  const rows = await db
    .select()
    .from(evaluationNotes)
    .where(eq(evaluationNotes.evaluationId, evaluationId))
    .orderBy(asc(evaluationNotes.createdAt), asc(evaluationNotes.id));
  return rows.map((r) => ({
    id: Number(r.id),
    evaluationId: Number(r.evaluationId),
    userId: r.userId === null ? null : Number(r.userId),
    userName: r.userName,
    body: r.body,
    createdAt: r.createdAt,
  }));
}

/** Grava uma anotação (o texto já deve vir validado). */
export async function addEvaluationNote(
  user: Pick<SessionUser, "id" | "name">,
  evaluationId: number,
  body: string,
): Promise<EvaluationNote> {
  const note = {
    evaluationId,
    userId: user.id,
    userName: user.name.slice(0, 80),
    body,
  };
  if (isMemoryMode()) {
    const saved: EvaluationNote = { ...note, id: memoryNextId++, createdAt: new Date() };
    memoryNotes.push(saved);
    return { ...saved };
  }
  const db = getDb();
  await ensureTables();
  const result = await db.insert(evaluationNotes).values(note);
  return { ...note, id: Number(result[0]?.insertId ?? 0), createdAt: new Date() };
}
