import { useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import { STORE_UNITS } from "@contracts/permissions";
import { VISIT_PERIOD_LABELS, formatVisitDay, nextVisitDays, visitPeriodsFor, type VisitPeriod } from "@contracts/visit";
import type { useShopSettings } from "@/lib/shop";
import { StepActions } from "../parts";
import type { EvaluationData } from "../constants";

interface UnitStepProps {
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  settings: ReturnType<typeof useShopSettings>;
  error: string;
  goNext: () => void;
  goBack: () => void;
}

/** "AAAA-MM-DD" do dia de hoje no aparelho do cliente. */
function localTodayKey(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Períodos ainda disponíveis em `dateKey` (hoje, descarta o que já passou). */
function periodsAvailable(dateKey: string, now: Date): VisitPeriod[] {
  const periods = visitPeriodsFor(dateKey);
  if (dateKey !== localTodayKey(now)) return periods;
  const hour = now.getHours();
  return periods.filter(period => (period === "manha" ? hour < 11 : hour < 16));
}

export default function UnitStep({ data, updateField, settings, error, goNext, goBack }: UnitStepProps) {
  const now = useMemo(() => new Date(), []);
  const days = useMemo(
    () => nextVisitDays(localTodayKey(now)).filter(day => periodsAvailable(day, now).length > 0),
    [now],
  );
  const visitRef = useRef<HTMLDivElement>(null);
  const unitChosen = Boolean(data.unit);

  // Ao escolher a loja, leva o cliente até a escolha do dia da visita.
  useEffect(() => {
    if (unitChosen) visitRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [unitChosen]);

  const periods = data.visitDate ? periodsAvailable(data.visitDate, now) : [];

  function pickDay(day: string) {
    if (day === data.visitDate) return;
    updateField("visitDate", day);
    const allowed = periodsAvailable(day, now);
    // Mantém o período se ele existe nesse dia; senão o cliente escolhe de novo.
    if (data.visitPeriod && !allowed.includes(data.visitPeriod)) updateField("visitPeriod", "");
    if (allowed.length === 1) updateField("visitPeriod", allowed[0]);
  }

  function clearVisit() {
    updateField("visitDate", "");
    updateField("visitPeriod", "");
  }

  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        Qual loja fica melhor pra você?
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
        É lá que vamos conferir o aparelho e fechar a troca.
      </p>

      <div className="mt-5 space-y-2.5">
        {STORE_UNITS.map(opt => {
          const isSelected = data.unit === opt.value;
          const address = opt.value === "jardim" ? settings.addressJardim : settings.addressGll;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField("unit", opt.value)}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-semibold transition-all ${
                isSelected
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-xs"
                  : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:border-neutral-300 hover:bg-[#fbfbfd]"
              }`}
            >
              <span className="flex flex-col">
                <span>{opt.label}</span>
                {address && (
                  <span className={`mt-0.5 text-[11px] font-normal ${isSelected ? "text-white/75" : "text-[#86868b]"}`}>
                    {address}
                  </span>
                )}
              </span>
              {isSelected && <Check className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>

      {unitChosen && (
        <div ref={visitRef} className="mt-6 scroll-mt-4 border-t border-neutral-100 pt-5 animate-fadeIn">
          <h3 className="font-display text-base font-bold text-[#1d1d1f]">Quando você quer passar lá?</h3>
          <p className="mt-0.5 text-xs text-[#6e6e73]">
            Opcional. A equipe confirma o horário com você pelo WhatsApp.
          </p>

          <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {days.map(day => {
              const isSelected = data.visitDate === day;
              const [dayLabel, dateLabel] = formatVisitDay(day).split(", ");
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={`flex min-w-[72px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-center transition-all active:scale-95 ${
                    isSelected
                      ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                      : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f]"
                  }`}
                >
                  <span className="text-[11px] font-medium capitalize">{dayLabel.slice(0, 3)}</span>
                  <span className="text-sm font-bold">{dateLabel}</span>
                </button>
              );
            })}
          </div>

          {data.visitDate && (
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {periods.map(period => (
                <button
                  key={period}
                  type="button"
                  onClick={() => updateField("visitPeriod", period)}
                  className={`h-11 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                    data.visitPeriod === period
                      ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]"
                      : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f]"
                  }`}
                >
                  {VISIT_PERIOD_LABELS[period]}
                </button>
              ))}
            </div>
          )}

          {data.visitDate && !data.visitPeriod && (
            <p className="mt-2 text-[11px] text-[#86868b]">Escolha o período para registrar a visita.</p>
          )}

          <button
            type="button"
            onClick={clearVisit}
            className={`mt-3 w-full rounded-xl border py-2.5 text-xs font-semibold transition ${
              !data.visitDate
                ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Prefiro combinar pelo WhatsApp
          </button>
        </div>
      )}


      <StepActions onBack={goBack} onNext={goNext} disabled={!unitChosen} error={error} />
    </div>
  );
}
