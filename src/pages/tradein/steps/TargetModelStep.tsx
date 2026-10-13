import { ArrowLeft, Check } from "lucide-react";
import { MODEL_GROUPS, TARGET_IPHONE_MODELS, type EvaluationData } from "../constants";

const TARGET_SET = new Set(TARGET_IPHONE_MODELS);
/** Os mesmos modelos de troca de antes, agora agrupados por série e sem rolagem interna. */
const TARGET_GROUPS = MODEL_GROUPS.map(group => ({
  ...group,
  models: group.models.filter(name => TARGET_SET.has(name)),
})).filter(group => group.models.length > 0);

interface TargetModelStepProps {
  data: EvaluationData;
  autoAdvance: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  animatingSelection: string | null;
  error: string;
  goBack: () => void;
}

export default function TargetModelStep({ data, autoAdvance, animatingSelection, error, goBack }: TargetModelStepProps) {
  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        E pra qual iPhone você quer trocar?
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
        Pode ser um modelo mais novo ou mais antigo — aceitamos os dois.
      </p>

      {/* Botão de apenas venda em destaque */}
      <button
        type="button"
        onClick={() => autoAdvance("targetModel", "Quero apenas vender (sem troca)")}
        className={`mt-4 flex w-full items-center justify-between rounded-2xl border p-3.5 text-left text-xs font-bold transition-all ${
          data.targetModel === "Quero apenas vender (sem troca)"
            ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3]"
            : "border-blue-100 bg-blue-50/50 text-[#0071e3] hover:bg-blue-50"
        }`}
      >
        <span>💰 Quero apenas vender meu aparelho (sem troca)</span>
        <Check className="h-4 w-4" />
      </button>

      <div className="mt-5 space-y-3.5">
        {TARGET_GROUPS.map(group => (
          <div key={group.title}>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
              {group.title}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {group.models.map(targetName => {
                const isSelected = data.targetModel === targetName;
                const isAnimating = animatingSelection === targetName;
                return (
                  <button
                    key={targetName}
                    type="button"
                    onClick={() => autoAdvance("targetModel", targetName)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
                      isSelected || isAnimating
                        ? "border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-xs"
                        : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:border-neutral-400 hover:bg-white"
                    }`}
                  >
                    {targetName.replace(/^iPhone /, "")}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}

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
