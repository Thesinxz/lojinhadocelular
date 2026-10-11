import { useState } from "react";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SETTING_KEYS } from "@contracts/types";
import { trpc } from "@/providers/trpc";

const field =
  "w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-2 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:bg-white";

interface Props {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

/** LGPD: guarda máxima dos dados do Troca Fácil, canal do titular e exclusão a pedido. */
export default function PrivacySection({ values, onChange }: Props) {
  const utils = trpc.useUtils();
  const preview = trpc.admin.privacyRetentionPreview.useQuery(undefined, { staleTime: 0 });
  const run = trpc.admin.privacyRetentionRun.useMutation({
    onSuccess: (res) => {
      toast.success(res.deleted > 0 ? `${res.deleted} avaliação(ões) apagada(s).` : "Nada vencido para apagar.");
      utils.admin.privacyRetentionPreview.invalidate();
      utils.admin.evaluationsPage.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [holder, setHolder] = useState("");
  const [lookup, setLookup] = useState("");
  const holderPreview = trpc.admin.privacyHolderPreview.useQuery({ whatsapp: lookup }, { enabled: lookup.length >= 8 });
  const erase = trpc.admin.privacyHolderErase.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.deleted} avaliação(ões) do titular apagada(s).`);
      setHolder("");
      setLookup("");
      utils.admin.evaluationsPage.invalidate();
      utils.admin.privacyHolderPreview.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const monthsInput = (key: string, label: string, hint: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#6e6e73]">{label}</span>
      <input
        type="number"
        min={0}
        max={120}
        value={values[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value)}
        className={field}
      />
      <span className="mt-1 block text-[11px] text-[#86868b]">{hint}</span>
    </label>
  );

  const p = preview.data;

  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1d1f]">
        <ShieldCheck className="h-5 w-5 text-emerald-600" /> Dados pessoais e LGPD
      </h3>
      <p className="mt-1 text-xs text-[#86868b]">
        Quanto tempo guardamos os dados do Troca Fácil (nome, WhatsApp, fotos, anotações e mensagens). Os prazos aparecem na Política
        de Privacidade do site. O ERP guarda as vendas; aqui é só a pré-avaliação.
      </p>

      <label className="mt-4 flex items-start gap-2.5 text-sm text-[#1d1d1f] cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={(values[SETTING_KEYS.retentionAuto] ?? "0") === "1"}
          onChange={(e) => onChange(SETTING_KEYS.retentionAuto, e.target.checked ? "1" : "0")}
        />
        <span>
          <strong>Apagar automaticamente</strong> as avaliações com prazo vencido (a cada 12 horas)
          <span className="block text-[11px] text-[#86868b]">
            Desligado por padrão. Confira os prazos abaixo e o número em “Prazo vencido agora” antes de ligar.
          </span>
        </span>
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {monthsInput(SETTING_KEYS.retentionOpenMonths, "Avaliações não concluídas: apagar após (meses)", "Pendentes, em atendimento e recusadas. 0 = nunca apagar.")}
        {monthsInput(SETTING_KEYS.retentionClosedMonths, "Avaliações concluídas: apagar após (meses)", "Contado a partir da última movimentação. 0 = nunca apagar.")}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#6e6e73]">Encarregado de dados (nome, opcional)</span>
          <input value={values[SETTING_KEYS.privacyOfficerName] ?? ""} onChange={(e) => onChange(SETTING_KEYS.privacyOfficerName, e.target.value)} className={field} maxLength={80} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#6e6e73]">E-mail para pedidos do titular (opcional)</span>
          <input type="email" value={values[SETTING_KEYS.privacyEmail] ?? ""} onChange={(e) => onChange(SETTING_KEYS.privacyEmail, e.target.value)} className={field} maxLength={120} placeholder="privacidade@..." />
          <span className="mt-1 block text-[11px] text-[#86868b]">Só aparece na Política de Privacidade se você preencher.</span>
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-4 text-xs">
        <p className="font-semibold text-[#1d1d1f]">Prazo vencido agora</p>
        {preview.isLoading || !p ? (
          <Loader2 className="mt-2 h-4 w-4 animate-spin text-[#86868b]" />
        ) : (
          <>
            <p className="mt-1 text-[#6e6e73]">
              <strong className="text-[#1d1d1f]">{p.expired}</strong> avaliação(ões) além do prazo salvo
              {p.expired > 0 && ` (${p.expiredOpen} não concluídas, ${p.expiredClosed} concluídas)`}. Com “Apagar automaticamente” ligado, a rotina apaga isso a cada 12 horas.
              Salve as configurações antes de apagar, para valer o prazo novo.
            </p>
            <button
              type="button"
              disabled={p.expired === 0 || run.isPending}
              onClick={() => {
                if (window.confirm(`Apagar ${p.expired} avaliação(ões) com prazo vencido, incluindo fotos, anotações e mensagens? Isso não pode ser desfeito.`)) run.mutate();
              }}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-200 px-3 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Apagar agora
            </button>
          </>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-4 text-xs">
        <p className="font-semibold text-[#1d1d1f]">Pedido de exclusão do titular</p>
        <p className="mt-1 text-[#6e6e73]">
          Quando um cliente pedir para apagar os dados dele, informe o WhatsApp usado nas avaliações. Apaga avaliações, fotos, anotações e mensagens daquele número.
          O cadastro e as vendas no ERP seguem as regras fiscais e se tratam por lá.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="holder-phone">WhatsApp do titular</label>
          <input
            id="holder-phone"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="(67) 99999-0000"
            inputMode="tel"
            className={`${field} max-w-[220px]`}
          />
          <button
            type="button"
            disabled={holder.replace(/\D/g, "").length < 10}
            onClick={() => setLookup(holder)}
            className="min-h-11 rounded-xl border border-[#d2d2d7] px-3 font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
          >
            Buscar
          </button>
        </div>
        {lookup && holderPreview.data && (
          <div className="mt-2">
            {holderPreview.data.count === 0 ? (
              <p className="text-[#6e6e73]">Nenhuma avaliação encontrada para esse número.</p>
            ) : (
              <>
                <p className="text-[#1d1d1f]">
                  Encontradas <strong>{holderPreview.data.count}</strong> avaliação(ões)
                  {holderPreview.data.photos > 0 && ` e ${holderPreview.data.photos} foto(s)`}.
                </p>
                <button
                  type="button"
                  disabled={erase.isPending}
                  onClick={() => {
                    if (window.confirm(`Apagar definitivamente ${holderPreview.data!.count} avaliação(ões) desse titular, com fotos, anotações e mensagens?`)) {
                      erase.mutate({ whatsapp: lookup, confirm: true });
                    }
                  }}
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-200 px-3 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  {erase.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Apagar dados deste titular
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
