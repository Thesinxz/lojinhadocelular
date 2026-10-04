import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { EVALUATION_STATUSES, REFUSAL_REASONS, type EvaluationStatus } from "@contracts/types";
import { centsToReaisInput, maskReaisInput, reaisInputToCents, refusalLabel, STATUS_CONFIG } from "./evaluationUi";

interface NegotiationCardProps {
  status: EvaluationStatus;
  offeredValue: number | null;
  closedValue: number | null;
  refusalReason: string;
  savingValues: boolean;
  savingStatus: boolean;
  onSaveValues: (values: { offeredValue: number | null; closedValue: number | null }) => void;
  onSetStatus: (input: { status: EvaluationStatus; refusalReason?: string; closedValue?: number | null }) => void;
}

function MoneyInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-[#6e6e73]">
        {label}
      </label>
      <div className="flex h-11 items-center rounded-xl border border-[#e5e5e7] bg-white px-3 focus-within:border-[#0071e3] focus-within:ring-2 focus-within:ring-[#0071e3]/15">
        <span className="mr-1.5 text-sm font-semibold text-[#86868b]">R$</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(maskReaisInput(e.target.value))}
          className="h-full w-full bg-transparent text-sm font-semibold text-[#1d1d1f] outline-none placeholder:text-[#c7c7cc]"
        />
      </div>
    </div>
  );
}

/** Valores da negociação (digitados em reais, salvos em centavos) e status com motivo de recusa. */
export default function NegotiationCard({
  status,
  offeredValue,
  closedValue,
  refusalReason,
  savingValues,
  savingStatus,
  onSaveValues,
  onSetStatus,
}: NegotiationCardProps) {
  const [offered, setOffered] = useState(centsToReaisInput(offeredValue));
  const [closed, setClosed] = useState(centsToReaisInput(closedValue));
  const [pendingRefusal, setPendingRefusal] = useState(false);
  const [reason, setReason] = useState(refusalReason || "");

  useEffect(() => setOffered(centsToReaisInput(offeredValue)), [offeredValue]);
  useEffect(() => setClosed(centsToReaisInput(closedValue)), [closedValue]);
  useEffect(() => {
    setReason(refusalReason || "");
    setPendingRefusal(false);
  }, [refusalReason, status]);

  const offeredCents = reaisInputToCents(offered);
  const closedCents = reaisInputToCents(closed);
  const valuesChanged = offeredCents !== offeredValue || closedCents !== closedValue;

  function handleStatusChange(next: EvaluationStatus) {
    if (next === status) return;
    if (next === "recusado") {
      setPendingRefusal(true);
      setReason("");
      return;
    }
    setPendingRefusal(false);
    onSetStatus(next === "concluido" && closedCents !== closedValue ? { status: next, closedValue: closedCents } : { status: next });
  }

  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
      <h2 className="font-display text-base font-bold text-[#1d1d1f]">Negociação</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MoneyInput id="offered-value" label="Valor oferecido" value={offered} onChange={setOffered} />
        <MoneyInput id="closed-value" label="Valor fechado" value={closed} onChange={setClosed} />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!valuesChanged || savingValues}
          onClick={() => onSaveValues({ offeredValue: offeredCents, closedValue: closedCents })}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-40"
        >
          {savingValues && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar valores
        </button>
      </div>

      <div className="mt-4 border-t border-[#f0f0f2] pt-4">
        <p className="mb-2 text-xs font-semibold text-[#6e6e73]">Status</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Status da avaliação">
          {EVALUATION_STATUSES.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = pendingRefusal ? s === "recusado" : s === status;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={savingStatus}
                onClick={() => handleStatusChange(s)}
                className={`min-h-11 rounded-xl border px-2 text-xs font-semibold transition disabled:opacity-60 ${
                  active
                    ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-2 ring-black/10`
                    : "border-[#e5e5e7] bg-[#f5f5f7] text-[#6e6e73] hover:bg-white"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {status === "recusado" && !pendingRefusal && refusalReason && (
          <p className="mt-2 text-xs text-[#6e6e73]">
            Motivo: <strong className="text-[#1d1d1f]">{refusalLabel(refusalReason)}</strong>
          </p>
        )}

        {pendingRefusal && (
          <div className="mt-3 rounded-xl border border-neutral-200 bg-[#fbfbfd] p-3">
            <label htmlFor="refusal-reason" className="mb-1 block text-xs font-semibold text-[#1d1d1f]">
              Motivo da recusa (obrigatório)
            </label>
            <select
              id="refusal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#e5e5e7] bg-white px-3 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]"
            >
              <option value="">Selecione...</option>
              {REFUSAL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRefusal(false)}
                className="min-h-11 rounded-xl border border-[#e5e5e7] bg-white px-4 text-sm font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!reason || savingStatus}
                onClick={() => onSetStatus({ status: "recusado", refusalReason: reason })}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1d1d1f] px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-40"
              >
                {savingStatus && <Loader2 className="h-4 w-4 animate-spin" />}
                Marcar como recusado
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
