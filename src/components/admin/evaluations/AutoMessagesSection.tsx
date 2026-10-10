import { Bot, Loader2, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { trpc } from "@/providers/trpc";
import {
  AUTO_MESSAGE_EVENTS,
  AUTO_MESSAGE_EVENT_LABELS,
  DEFAULT_AUTO_MESSAGES,
  type AutoMessageEvent,
  type AutoMessagesConfig,
} from "@contracts/types";

const PLACEHOLDERS = ["{nome}", "{modelo}", "{loja}", "{endereco}", "{vendedor}", "{valor_oferecido}"];

const EVENT_HINTS: Record<AutoMessageEvent, string> = {
  created: "Assim que o cliente envia a avaliação pelo site.",
  assigned: "Quando alguém assume ou recebe a avaliação.",
  offered: "Quando um valor oferecido é registrado. Não é enviada se os preços estiverem ocultos ao cliente.",
  concluded: "Quando a avaliação é marcada como concluída.",
  refused: "Quando a avaliação é marcada como recusada.",
};

const inputCls =
  "w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-2.5 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:bg-white focus:ring-4 focus:ring-[#0071e3]/15 transition-all";

interface AutoMessagesSectionProps {
  config: AutoMessagesConfig;
  onChange: (config: AutoMessagesConfig) => void;
}

function EvolutionBadge() {
  const status = trpc.admin.evolutionStatus.useQuery(undefined, { refetchOnWindowFocus: false });
  if (status.isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6e6e73]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando conexão…
      </span>
    );
  }
  const data = status.data;
  if (!data?.configured) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        <WifiOff className="h-3.5 w-3.5" /> Evolution API não configurada (EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          data.connected ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        }`}
        title={data.error}
      >
        {data.connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {data.connected ? "WhatsApp conectado" : `Desconectado (${data.state})`}
      </span>
      <button
        type="button"
        onClick={() => status.refetch()}
        className="text-xs font-semibold text-[#0071e3] hover:underline"
      >
        Testar conexão
      </button>
    </span>
  );
}

/** Mensagens automáticas via Evolution API: ao cliente em cada etapa e aviso à equipe. */
export default function AutoMessagesSection({ config, onChange }: AutoMessagesSectionProps) {
  const patchEvent = (event: AutoMessageEvent, change: Partial<AutoMessagesConfig["events"][AutoMessageEvent]>) =>
    onChange({ ...config, events: { ...config.events, [event]: { ...config.events[event], ...change } } });

  return (
    <section id="automaticas" className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1d1f]">
          <Bot className="h-5 w-5 text-[#25D366]" />
          Mensagens automáticas (Evolution API)
        </h3>
        <EvolutionBadge />
      </div>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.teamEnabled}
            onChange={(e) => onChange({ ...config, teamEnabled: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <span className="text-sm font-medium text-[#1d1d1f]">
            Avisar a equipe no WhatsApp da unidade quando chegar uma avaliação
            <span className="block text-[11px] font-normal text-[#86868b]">
              Usa os números das unidades. Só é usado se não houver webhook configurado.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.customerEnabled}
            onChange={(e) => onChange({ ...config, customerEnabled: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <span className="text-sm font-medium text-[#1d1d1f]">
            Enviar mensagens automáticas ao cliente
            <span className="block text-[11px] font-normal text-[#86868b]">
              Chave geral: desligada, nenhuma mensagem é enviada ao cliente.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#1d1d1f]">Mensagem de cada etapa</p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Restaurar as mensagens automáticas padrão? Os textos atuais serão substituídos.")) {
              onChange(structuredClone(DEFAULT_AUTO_MESSAGES));
            }
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e5e5e7] px-3 text-xs font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar padrão
        </button>
      </div>
      <p className="mt-1 text-[11px] text-[#86868b]">
        Variáveis: {PLACEHOLDERS.map((p) => (
          <code key={p} className="mr-1 rounded bg-[#f5f5f7] px-1 py-0.5 text-[10px] text-[#1d1d1f]">
            {p}
          </code>
        ))}
      </p>

      <ul className={`mt-3 space-y-3 ${config.customerEnabled ? "" : "opacity-50"}`}>
        {AUTO_MESSAGE_EVENTS.map((event) => (
          <li key={event} className="rounded-xl border border-[#e5e5e7] p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.events[event].enabled}
                onChange={(e) => patchEvent(event, { enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm font-semibold text-[#1d1d1f]">{AUTO_MESSAGE_EVENT_LABELS[event]}</span>
            </label>
            <p className="ml-6 text-[11px] text-[#86868b]">{EVENT_HINTS[event]}</p>
            <label htmlFor={`auto-${event}`} className="sr-only">
              Texto da mensagem: {AUTO_MESSAGE_EVENT_LABELS[event]}
            </label>
            <textarea
              id={`auto-${event}`}
              value={config.events[event].body}
              rows={3}
              maxLength={1000}
              onChange={(e) => patchEvent(event, { body: e.target.value })}
              className={`${inputCls} mt-2 resize-y`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
