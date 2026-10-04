import { MessageCircle, Plus, RotateCcw, Timer, Trash2 } from "lucide-react";
import { DEFAULT_WHATSAPP_TEMPLATES, type WhatsappTemplate } from "@/lib/whatsappTemplates";

const PLACEHOLDERS = ["{nome}", "{modelo}", "{loja}", "{endereco}", "{vendedor}", "{valor_oferecido}"];

const inputCls =
  "w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-2.5 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:bg-white focus:ring-4 focus:ring-[#0071e3]/15 transition-all";

interface EvaluationSettingsSectionProps {
  slaHours: string;
  templates: WhatsappTemplate[];
  onSlaChange: (value: string) => void;
  onTemplatesChange: (templates: WhatsappTemplate[]) => void;
}

/** Configurações do atendimento das avaliações: SLA e mensagens prontas (somente dono). */
export default function EvaluationSettingsSection({
  slaHours,
  templates,
  onSlaChange,
  onTemplatesChange,
}: EvaluationSettingsSectionProps) {
  function patch(index: number, change: Partial<WhatsappTemplate>) {
    onTemplatesChange(templates.map((tpl, i) => (i === index ? { ...tpl, ...change } : tpl)));
  }

  return (
    <section id="atendimento" className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1d1f]">
        <MessageCircle className="h-5 w-5 text-[#25D366]" />
        Atendimento das avaliações
      </h3>

      <div className="mt-4 max-w-xs">
        <label htmlFor="evaluation-sla" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#6e6e73]">
          <Timer className="h-3.5 w-3.5" />
          Prazo de resposta (horas)
        </label>
        <input
          id="evaluation-sla"
          inputMode="decimal"
          value={slaHours}
          onChange={(e) => onSlaChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className={inputCls}
          placeholder="2"
        />
        <p className="mt-1 text-[11px] text-[#86868b]">Avaliações pendentes há mais tempo que isso aparecem como “Atrasada”.</p>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#1d1d1f]">Mensagens prontas de WhatsApp</p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Restaurar as mensagens padrão? As mensagens atuais serão substituídas.")) {
                onTemplatesChange(DEFAULT_WHATSAPP_TEMPLATES.map((t) => ({ ...t })));
              }
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e5e5e7] px-3 text-xs font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[#86868b]">
          Variáveis disponíveis: {PLACEHOLDERS.map((p) => (
            <code key={p} className="mr-1 rounded bg-[#f5f5f7] px-1 py-0.5 text-[10px] text-[#1d1d1f]">
              {p}
            </code>
          ))}
        </p>

        <ul className="mt-3 space-y-3">
          {templates.map((tpl, index) => (
            <li key={tpl.id} className="rounded-xl border border-[#e5e5e7] p-3">
              <div className="flex items-center gap-2">
                <label htmlFor={`tpl-label-${tpl.id}`} className="sr-only">
                  Título da mensagem
                </label>
                <input
                  id={`tpl-label-${tpl.id}`}
                  value={tpl.label}
                  maxLength={60}
                  onChange={(e) => patch(index, { label: e.target.value })}
                  placeholder="Título do botão"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => onTemplatesChange(templates.filter((_, i) => i !== index))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e7] text-[#86868b] hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remover mensagem ${tpl.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <label htmlFor={`tpl-body-${tpl.id}`} className="sr-only">
                Texto da mensagem
              </label>
              <textarea
                id={`tpl-body-${tpl.id}`}
                value={tpl.body}
                maxLength={1000}
                rows={3}
                onChange={(e) => patch(index, { body: e.target.value })}
                placeholder="Olá {nome}! ..."
                className={`${inputCls} mt-2 resize-y`}
              />
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onTemplatesChange([...templates, { id: `tpl-${Date.now()}`, label: "", body: "" }])}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-dashed border-[#d2d2d7] px-4 text-sm font-semibold text-[#0071e3] hover:bg-blue-50"
        >
          <Plus className="h-4 w-4" />
          Adicionar mensagem
        </button>
      </div>
    </section>
  );
}
