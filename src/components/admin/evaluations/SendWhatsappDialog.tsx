import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { buildWhatsappLink } from "@/lib/whatsappTemplates";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SendWhatsappDialogProps {
  open: boolean;
  onClose: () => void;
  evaluationId: number;
  clientPhone: string;
  title: string;
  initialText: string;
}

/** Revisa a mensagem e a envia pelo WhatsApp da loja (Evolution); o WhatsApp Web fica como reserva. */
export default function SendWhatsappDialog({
  open,
  onClose,
  evaluationId,
  clientPhone,
  title,
  initialText,
}: SendWhatsappDialogProps) {
  const utils = trpc.useUtils();
  const [text, setText] = useState(initialText);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setText(initialText);
      setError("");
    }
  }, [open, initialText]);

  const send = trpc.admin.sendEvaluationMessage.useMutation({
    onSuccess: (res) => {
      utils.admin.evaluationMessages.invalidate({ id: evaluationId });
      if (res.ok) {
        toast.success("Mensagem enviada pelo WhatsApp da loja.");
        onClose();
      } else {
        setError(res.error);
      }
    },
    onError: (err) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !send.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Revise o texto, se quiser edite, e envie. Fica registrado no histórico da avaliação.</DialogDescription>
        </DialogHeader>
        <label htmlFor="send-wa-text" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="send-wa-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          maxLength={2000}
          className="w-full rounded-xl border border-[#d2d2d7] bg-white p-3 text-sm text-[#1d1d1f] focus:border-emerald-600 focus:outline-none"
        />
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
            Não foi possível enviar pela Evolution: {error}. Você ainda pode abrir no WhatsApp e enviar à mão.
          </p>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <a
            href={buildWhatsappLink(clientPhone, text)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#d2d2d7] px-3 text-xs font-semibold text-[#424245] hover:bg-[#f5f5f7]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir no WhatsApp
          </a>
          <button
            type="button"
            disabled={send.isPending || !text.trim()}
            onClick={() => {
              setError("");
              send.mutate({ id: evaluationId, text });
            }}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar pelo WhatsApp da loja
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
