import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  ids: number[];
  onDone: () => void;
}

function minutes(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return m === 1 ? "cerca de 1 minuto" : `cerca de ${m} minutos`;
}

/** Confirma o envio em lote de "avaliação recebida": mostra quem recebe, quem é pulado e o texto. */
export default function BatchReceiptDialog({ open, onClose, ids, onDone }: Props) {
  const utils = trpc.useUtils();
  const preview = trpc.admin.evaluationBatchMessagePreview.useQuery({ ids }, { enabled: open && ids.length > 0, staleTime: 0 });
  const send = trpc.admin.evaluationBatchMessage.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.queued > 0
          ? `${res.queued} mensagem(ns) na fila. O envio leva ${minutes(res.estimatedSeconds)}; acompanhe em cada avaliação.`
          : "Ninguém para enviar: todos já receberam ou não podem receber.",
      );
      utils.admin.evaluationMessages.invalidate();
      onDone();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  const plan = preview.data;
  const skipped = plan ? plan.alreadySent.length + plan.invalidNumber.length + plan.closed.length + plan.missing.length : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !send.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar “avaliação recebida” aos selecionados</DialogTitle>
          <DialogDescription>
            As mensagens saem pelo WhatsApp da loja, uma a uma, com intervalo de alguns segundos entre elas.
          </DialogDescription>
        </DialogHeader>

        {preview.isLoading || !plan ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#86868b]" />
        ) : (
          <div className="space-y-3 text-sm text-[#1d1d1f]">
            {!plan.evolutionConfigured && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                A Evolution API não está configurada no servidor: nada será enviado.
              </p>
            )}
            <ul className="space-y-1 text-xs">
              <li>
                <strong className="text-emerald-700">{plan.eligible.length}</strong> vão receber
                {plan.eligible.length > 0 && <> · envio leva {minutes(plan.estimatedSeconds)}</>}
              </li>
              {skipped > 0 && (
                <li className="text-[#6e6e73]">
                  {skipped} serão puladas:
                  {plan.alreadySent.length > 0 && <> {plan.alreadySent.length} já receberam;</>}
                  {plan.invalidNumber.length > 0 && <> {plan.invalidNumber.length} com WhatsApp inválido;</>}
                  {plan.closed.length > 0 && <> {plan.closed.length} já concluídas/recusadas;</>}
                  {plan.missing.length > 0 && <> {plan.missing.length} não encontradas;</>}
                </li>
              )}
              {plan.queued > 0 && <li className="text-amber-700">Já existem {plan.queued} mensagens na fila de outro lote.</li>}
            </ul>
            {plan.sample && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Exemplo (primeira da lista)</p>
                <p className="whitespace-pre-wrap rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-3 text-xs text-[#424245]">{plan.sample}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={send.isPending}
            className="min-h-11 rounded-xl border border-[#d2d2d7] px-4 text-sm font-semibold text-[#424245] hover:bg-[#f5f5f7] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={send.isPending || !plan || plan.eligible.length === 0 || !plan.evolutionConfigured}
            onClick={() => send.mutate({ ids })}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar para {plan?.eligible.length ?? 0}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
