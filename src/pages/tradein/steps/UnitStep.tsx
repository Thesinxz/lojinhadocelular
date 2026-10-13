import { ArrowLeft, Check } from "lucide-react";
import { STORE_UNITS } from "@contracts/permissions";
import type { useShopSettings } from "@/lib/shop";
import type { EvaluationData } from "../constants";

interface UnitStepProps {
  data: EvaluationData;
  autoAdvance: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  animatingSelection: string | null;
  settings: ReturnType<typeof useShopSettings>;
  goBack: () => void;
}

export default function UnitStep({ data, autoAdvance, animatingSelection, settings, goBack }: UnitStepProps) {
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
          const isAnimating = animatingSelection === opt.value;
          const address = opt.value === "jardim" ? settings.addressJardim : settings.addressGll;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => autoAdvance("unit", opt.value)}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-semibold transition-all ${
                isSelected || isAnimating
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white scale-[0.99] shadow-xs"
                  : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:border-neutral-300 hover:bg-[#fbfbfd]"
              }`}
            >
              <span className="flex flex-col">
                <span>{opt.label}</span>
                {address && (
                  <span
                    className={`mt-0.5 text-[11px] font-normal ${
                      isSelected || isAnimating ? "text-white/75" : "text-[#86868b]"
                    }`}
                  >
                    {address}
                  </span>
                )}
              </span>
              {(isSelected || isAnimating) && <Check className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <span className="text-xs text-[#86868b]">Toque numa opção pra continuar →</span>
      </div>
    </div>
  );
}
