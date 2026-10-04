import { useState, type FormEvent } from "react";
import { History, Loader2, MessageSquareText } from "lucide-react";
import { formatDateTime, initials, type EvaluationAuditItem, type EvaluationNoteItem } from "./evaluationUi";

const NOTE_MAX = 2000;

interface NotesTimelineProps {
  notes: EvaluationNoteItem[];
  adding: boolean;
  /** Deve resolver `true` quando a anotação foi salva (para limpar o campo). */
  onAdd: (body: string) => Promise<boolean>;
}

/** Anotações internas da equipe (mais antigas primeiro) + campo para nova anotação. */
export default function NotesTimeline({ notes, adding, onAdd }: NotesTimelineProps) {
  const [body, setBody] = useState("");
  const trimmed = body.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed || adding) return;
    if (await onAdd(trimmed)) setBody("");
  }

  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#1d1d1f]">
        <MessageSquareText className="h-4 w-4 text-[#0071e3]" />
        Anotações
      </h2>

      {notes.length === 0 ? (
        <p className="mt-3 text-xs text-[#86868b]">Nenhuma anotação ainda.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-2.5">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-[10px] font-bold text-white"
                aria-hidden="true"
              >
                {initials(note.userName)}
              </span>
              <div className="min-w-0 flex-1 rounded-xl bg-[#f5f5f7] px-3 py-2">
                <p className="text-[11px] text-[#86868b]">
                  <strong className="font-semibold text-[#1d1d1f]">{note.userName}</strong> · {formatDateTime(note.createdAt)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[#1d1d1f]">{note.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={handleSubmit} className="mt-4">
        <label htmlFor="new-note" className="sr-only">
          Nova anotação
        </label>
        <textarea
          id="new-note"
          value={body}
          maxLength={NOTE_MAX}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Ex.: cliente vem amanhã às 15h; ofereci R$ 1.800,00..."
          className="w-full resize-none rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3] focus:bg-white"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-[#86868b]">
            {body.length}/{NOTE_MAX}
          </span>
          <button
            type="submit"
            disabled={!trimmed || adding}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-40"
          >
            {adding && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar anotação
          </button>
        </div>
      </form>
    </section>
  );
}

/** Histórico de ações (audit_logs) da avaliação, mais recentes primeiro. */
export function EvaluationAuditList({ entries }: { entries: EvaluationAuditItem[] }) {
  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#1d1d1f]">
        <History className="h-4 w-4 text-[#86868b]" />
        Histórico
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-xs text-[#86868b]">Nenhuma ação registrada.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="border-l-2 border-[#e5e5e7] pl-3">
              <p className="text-sm text-[#1d1d1f]">{entry.summary}</p>
              <p className="text-[11px] text-[#86868b]">
                {entry.userName} · {formatDateTime(entry.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
