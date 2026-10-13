import { StepActions } from "../parts";
import type { EvaluationData } from "../constants";

interface BatteryStepProps {
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  goNext: () => void;
  goBack: () => void;
}

const BATTERY_PRESETS = [100, 95, 90, 85, 80, 75, 70];

export default function BatteryStep({ data, updateField, goNext, goBack }: BatteryStepProps) {
  const setPercent = (value: number) => updateField("batteryPercent", Math.min(100, Math.max(50, value)));

  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        Como está a saúde da bateria?
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
        Veja em Ajustes › Bateria › Saúde da bateria.
      </p>

      <div className="mt-8 space-y-6">
        {!data.batteryUnknown ? (
          <div className="rounded-2xl border border-neutral-100 bg-[#fbfbfd] p-5">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-5xl font-extrabold tracking-tight text-[#1d1d1f]">
                {data.batteryPercent}%
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  data.batteryPercent >= 90
                    ? "bg-emerald-100 text-emerald-700"
                    : data.batteryPercent >= 80
                    ? "bg-blue-100 text-blue-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {data.batteryPercent >= 90
                  ? "Bateria ótima"
                  : data.batteryPercent >= 80
                  ? "Bateria boa"
                  : "Manutenção recomendada"}
              </span>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPercent(data.batteryPercent - 1)}
                aria-label="Diminuir 1%"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e5e5e7] bg-white text-xl font-semibold text-[#1d1d1f] transition active:scale-95"
              >
                −
              </button>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={data.batteryPercent}
                onChange={e => updateField("batteryPercent", Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-[#1d1d1f]"
              />
              <button
                type="button"
                onClick={() => setPercent(data.batteryPercent + 1)}
                aria-label="Aumentar 1%"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e5e5e7] bg-white text-xl font-semibold text-[#1d1d1f] transition active:scale-95"
              >
                +
              </button>
            </div>
            <div className="mt-1 flex justify-between px-14 text-[11px] font-semibold text-[#86868b]">
              <span>50%</span>
              <span>100%</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {BATTERY_PRESETS.map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPercent(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                    data.batteryPercent === value
                      ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                      : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-center">
            <p className="text-xs font-semibold text-[#0071e3]">
              Opção "Não sei informar" selecionada. Nossa equipe fará a checagem no atendimento.
            </p>
          </div>
        )}

        {/* Alternar Não sei */}
        <button
          type="button"
          onClick={() => updateField("batteryUnknown", !data.batteryUnknown)}
          className={`w-full rounded-xl border py-2.5 text-xs font-semibold transition ${
            data.batteryUnknown
              ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
              : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          {data.batteryUnknown ? "Quero informar a porcentagem" : "Não sei informar a porcentagem"}
        </button>
      </div>

      <StepActions onBack={goBack} onNext={goNext} />
    </div>
  );
}
