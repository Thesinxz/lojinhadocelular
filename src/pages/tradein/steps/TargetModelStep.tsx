import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { detectIphoneModel } from "@/lib/iphoneCatalog";
import { StepActions } from "../parts";
import { MODEL_GROUPS, SELL_ONLY_LABEL, TARGET_IPHONE_MODELS, type EvaluationData } from "../constants";

const TARGET_SET = new Set(TARGET_IPHONE_MODELS);
/** Os mesmos modelos de troca de antes, agrupados por série e sem rolagem interna. */
const TARGET_GROUPS = MODEL_GROUPS.map(group => ({
  ...group,
  models: group.models.filter(name => TARGET_SET.has(name)),
})).filter(group => group.models.length > 0);

interface TargetModelStepProps {
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  autoAdvance: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  animatingSelection: string | null;
  error: string;
  goNext: () => void;
  goBack: () => void;
}

export default function TargetModelStep({ data, updateField, autoAdvance, animatingSelection, error, goNext, goBack }: TargetModelStepProps) {
  const sellOnly = data.targetModel === SELL_ONLY_LABEL;
  const targetSpec = data.targetModel && !sellOnly ? detectIphoneModel(data.targetModel) : null;
  const detailsRef = useRef<HTMLDivElement>(null);

  const storageOptions = targetSpec?.capacities.map(c => c.replace(/([0-9]+)\s*(gb|tb)/i, "$1 $2").toUpperCase()) ?? [];
  const colorOptions = targetSpec?.colors ?? [];

  // Ao escolher o modelo, leva o cliente até a capacidade e a cor.
  useEffect(() => {
    if (targetSpec) detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [targetSpec?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickModel(name: string) {
    if (name === data.targetModel) return;
    updateField("targetModel", name);
    updateField("targetStorage", "");
    updateField("targetColor", "");
  }

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
        onClick={() => {
          updateField("targetStorage", "");
          updateField("targetColor", "");
          autoAdvance("targetModel", SELL_ONLY_LABEL);
        }}
        className={`mt-4 flex w-full items-center justify-between rounded-2xl border p-3.5 text-left text-xs font-bold transition-all ${
          sellOnly
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
                    onClick={() => pickModel(targetName)}
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

      {/* Capacidade e cor do iPhone desejado */}
      {targetSpec && (
        <div ref={detailsRef} className="mt-6 scroll-mt-4 space-y-4 border-t border-neutral-100 pt-5 animate-fadeIn">
          <p className="font-display text-base font-bold text-[#1d1d1f]">{targetSpec.name}</p>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6e6e73]">Capacidade</span>
              {data.targetStorage && <span className="text-xs font-bold text-[#0071e3]">{data.targetStorage}</span>}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[...storageOptions, "Ainda não decidi"].map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateField("targetStorage", option)}
                  className={`min-h-11 rounded-xl border px-1 text-xs font-semibold transition-all ${
                    data.targetStorage === option
                      ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]"
                      : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6e6e73]">Cor</span>
              {data.targetColor && <span className="text-xs font-bold text-[#0071e3]">{data.targetColor}</span>}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {colorOptions.map(c => {
                const isSelected = data.targetColor === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => updateField("targetColor", c.name)}
                    className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition-all ${
                      isSelected
                        ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]"
                        : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-white"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    {isSelected && <Check className="h-3 w-3 text-[#0071e3]" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => updateField("targetColor", "Ainda não decidi")}
                className={`flex h-11 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-all ${
                  data.targetColor === "Ainda não decidi"
                    ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]"
                    : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-white"
                }`}
              >
                Ainda não decidi
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}

      {targetSpec ? (
        <StepActions onBack={goBack} onNext={goNext} />
      ) : (
        <div className="mt-6">
          <button
            type="button"
            onClick={goBack}
            className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
          >
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}
