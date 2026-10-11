import { useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { buildTemplateVars, renderTemplate, type WhatsappTemplate } from "@/lib/whatsappTemplates";
import SendWhatsappDialog from "./SendWhatsappDialog";

interface WhatsappTemplatesCardProps {
  evaluationId: number;
  templates: WhatsappTemplate[];
  clientPhone: string;
  evaluation: { name: string; model: string; storage?: string | null; unit?: string | null; offeredValue?: number | null };
  sellerName: string;
  addresses: { jardim: string; gll: string };
}

/** Mensagens prontas: abre a revisão e envia pela Evolution. */
export default function WhatsappTemplatesCard({
  evaluationId,
  templates,
  clientPhone,
  evaluation,
  sellerName,
  addresses,
}: WhatsappTemplatesCardProps) {
  const [selected, setSelected] = useState<{ title: string; text: string } | null>(null);
  const vars = useMemo(
    () => buildTemplateVars({ evaluation, sellerName, addresses }),
    [evaluation, sellerName, addresses],
  );

  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#1d1d1f]">
        <MessageCircle className="h-4 w-4 text-[#25D366]" />
        Mensagens prontas
      </h2>
      <p className="mt-0.5 text-xs text-[#86868b]">Escolha um modelo, revise o texto e envie pelo WhatsApp da loja.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {templates.map((tpl) => {
          const text = renderTemplate(tpl.body, vars);
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelected({ title: tpl.label, text })}
              title={text}
              className="flex min-h-11 flex-col justify-center rounded-xl border border-emerald-600/20 bg-emerald-50/60 px-3 py-2 text-left transition hover:bg-emerald-100/70"
            >
              <span className="text-sm font-semibold text-emerald-900">{tpl.label}</span>
              <span className="line-clamp-2 text-[11px] text-emerald-900/70">{text}</span>
            </button>
          );
        })}
      </div>
      {vars.valor_oferecido === "" && templates.some((t) => t.body.includes("{valor_oferecido}")) && (
        <p className="mt-2 text-[11px] text-amber-700">Preencha o valor oferecido para completar a mensagem de proposta.</p>
      )}
      <SendWhatsappDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        evaluationId={evaluationId}
        clientPhone={clientPhone}
        title={selected?.title ?? ""}
        initialText={selected?.text ?? ""}
      />
    </section>
  );
}
