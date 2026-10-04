import { useMemo } from "react";
import { MessageCircle } from "lucide-react";
import {
  buildTemplateVars,
  buildWhatsappLink,
  renderTemplate,
  type WhatsappTemplate,
} from "@/lib/whatsappTemplates";

interface WhatsappTemplatesCardProps {
  templates: WhatsappTemplate[];
  clientPhone: string;
  evaluation: { name: string; model: string; storage?: string | null; unit?: string | null; offeredValue?: number | null };
  sellerName: string;
  addresses: { jardim: string; gll: string };
}

/** Botões que abrem o WhatsApp do cliente com a mensagem pronta preenchida. */
export default function WhatsappTemplatesCard({
  templates,
  clientPhone,
  evaluation,
  sellerName,
  addresses,
}: WhatsappTemplatesCardProps) {
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
      <p className="mt-0.5 text-xs text-[#86868b]">Abre o WhatsApp do cliente com o texto preenchido — revise antes de enviar.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {templates.map((tpl) => {
          const text = renderTemplate(tpl.body, vars);
          return (
            <a
              key={tpl.id}
              href={buildWhatsappLink(clientPhone, text)}
              target="_blank"
              rel="noreferrer"
              title={text}
              className="flex min-h-11 flex-col justify-center rounded-xl border border-emerald-600/20 bg-emerald-50/60 px-3 py-2 text-left transition hover:bg-emerald-100/70"
            >
              <span className="text-sm font-semibold text-emerald-900">{tpl.label}</span>
              <span className="line-clamp-2 text-[11px] text-emerald-900/70">{text}</span>
            </a>
          );
        })}
      </div>
      {vars.valor_oferecido === "" && templates.some((t) => t.body.includes("{valor_oferecido}")) && (
        <p className="mt-2 text-[11px] text-amber-700">Preencha o valor oferecido para completar a mensagem de proposta.</p>
      )}
    </section>
  );
}
