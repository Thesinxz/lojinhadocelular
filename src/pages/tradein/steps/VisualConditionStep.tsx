import { ArrowLeft, Check } from "lucide-react";
import { VISUAL_CONDITION_OPTIONS, type EvaluationData } from "../constants";

interface VisualConditionStepProps {
  data: EvaluationData;
  autoAdvance: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  animatingSelection: string | null;
  goBack: () => void;
}

export default function VisualConditionStep({ data, autoAdvance, animatingSelection, goBack }: VisualConditionStepProps) {
  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        Como está o visual dele?
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
        Seja sincero — a conferência é presencial.
      </p>

      <div className="mt-5 space-y-2.5">
        {VISUAL_CONDITION_OPTIONS.map(opt => {
          const isSelected = data.visualCondition === opt;
          const isAnimating = animatingSelection === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => autoAdvance("visualCondition", opt)}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-semibold transition-all ${
                isSelected || isAnimating
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white scale-[0.99] shadow-xs"
                  : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:border-neutral-300 hover:bg-[#fbfbfd]"
              }`}
            >
              <span>{opt}</span>
              {(isSelected || isAnimating) && <Check className="h-4 w-4" />}
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
