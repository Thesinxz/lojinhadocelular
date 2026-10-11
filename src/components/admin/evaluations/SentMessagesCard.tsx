import { Bot, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { AUTO_MESSAGE_EVENTS, AUTO_MESSAGE_EVENT_LABELS, type AutoMessageEvent } from "@contracts/types";
import { formatDateTime } from "./evaluationUi";

function eventLabel(event: string): string {
  if (event === "manual") return "Mensagem manual";
  return AUTO_MESSAGE_EVENT_LABELS[event as AutoMessageEvent] ?? event;
}

/** Histórico de mensagens automáticas (Evolution API) da avaliação, com reenvio manual ao cliente. */
export default function SentMessagesCard({ evaluationId }: { evaluationId: number }) {
  const utils = trpc.useUtils();
  const query = trpc.admin.evaluationMessages.useQuery({ id: evaluationId });
  const resend = trpc.admin.resendEvaluationMessage.useMutation({
    onSuccess: (res) => {
      utils.admin.evaluationMessages.invalidate({ id: evaluationId });
      if (res.ok) toast.success("Mensagem enviada.");
      else if (res.result === "not_configured") toast.error("Evolution API não configurada.");
      else toast.error("Não foi possível enviar a mensagem.");
    },
    onError: (err) => toast.error(err.message),
  });
  const messages = query.data ?? [];

  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#1d1d1f]">
        <Bot className="h-4 w-4 text-[#25D366]" />
        Mensagens automáticas
      </h2>

      {query.isLoading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-[#86868b]" />
      ) : messages.length === 0 ? (
        <p className="mt-3 text-xs text-[#86868b]">Nenhuma mensagem automática enviada.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-[#e5e5e7] p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-semibold text-[#1d1d1f]">
                  {eventLabel(m.event)} · {m.recipient === "equipe" ? "equipe" : "cliente"}
                </span>
                <span className={m.status === "sent" ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                  {m.status === "sent" ? "enviada" : "falhou"} · {formatDateTime(m.createdAt)}
                </span>
              </div>
              {m.error && <p className="mt-1 text-red-600">{m.error}</p>}
              {m.body && <p className="mt-1 whitespace-pre-wrap text-[#6e6e73]">{m.body}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="resend-event" className="sr-only">
          Mensagem para reenviar ao cliente
        </label>
        <select
          id="resend-event"
          defaultValue="created"
          className="min-h-11 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3 text-xs font-semibold text-[#1d1d1f]"
        >
          {AUTO_MESSAGE_EVENTS.map((event) => (
            <option key={event} value={event}>
              {AUTO_MESSAGE_EVENT_LABELS[event]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => {
            const select = document.getElementById("resend-event") as HTMLSelectElement | null;
            const event = (select?.value ?? "created") as AutoMessageEvent;
            if (window.confirm(`Enviar agora "${eventLabel(event)}" ao cliente pelo WhatsApp?`)) {
              resend.mutate({ id: evaluationId, event });
            }
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e5e5e7] px-3 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Enviar ao cliente
        </button>
      </div>
    </section>
  );
}
