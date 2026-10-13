import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { declaredLojinhaPurchase } from "@contracts/loyalty";
import { isValidCpf, onlyDigits } from "@contracts/brDocs";
import { StepActions } from "../parts";
import { PURCHASE_ORIGIN_OPTIONS, type EvaluationData } from "../constants";

interface PurchaseStepProps {
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  autoAdvance: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  animatingSelection: string | null;
  setStep: Dispatch<SetStateAction<number>>;
  error: string;
  goNext: () => void;
  goBack: () => void;
}

export default function PurchaseStep({ data, updateField, autoAdvance, animatingSelection, setStep, error, goNext, goBack }: PurchaseStepProps) {
  const askCpf = declaredLojinhaPurchase(data.purchaseLocation);
  const cpfRef = useRef<HTMLDivElement>(null);

  // Ao marcar "Lojinha do Celular", leva o cliente até o campo do CPF (e à barra "Continuar").
  useEffect(() => {
    if (askCpf) cpfRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [askCpf]);

  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        Onde você comprou esse {data.model || "iPhone"}?
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
        Se foi com a gente, sua troca já começa com uma condição melhor.
      </p>

      <div className="mt-5 space-y-2.5">
        {PURCHASE_ORIGIN_OPTIONS.map(opt => {
          const isSelected = data.purchaseLocation === opt.id;
          const isAnimating = animatingSelection === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (declaredLojinhaPurchase(opt.id)) {
                  updateField("purchaseLocation", opt.id);
                } else {
                  updateField("cpf", "");
                  autoAdvance("purchaseLocation", opt.id);
                }
              }}
              className={`flex w-full flex-col justify-center rounded-2xl border p-4 text-left transition-all ${
                isSelected || isAnimating
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white scale-[0.99] shadow-sm"
                  : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:border-neutral-300 hover:bg-[#fbfbfd]"
              }`}
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              {opt.desc && (
                <span
                  className={`mt-1 text-xs ${
                    isSelected || isAnimating ? "text-neutral-300" : "text-[#86868b]"
                  }`}
                >
                  {opt.desc}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {askCpf && (
        <div ref={cpfRef} className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/60 p-4 animate-fadeIn">
          <label htmlFor="trocafacil-cpf" className="text-sm font-bold text-purple-950">
            🎁 Quer garantir o bônus de fidelidade?
          </label>
          <p className="mt-1 text-xs leading-relaxed text-purple-900/80">
            Informe seu CPF para a gente localizar sua compra. Usamos só para conferir o cadastro: <b>não guardamos</b> o seu CPF.
            É opcional.
          </p>
          <input
            id="trocafacil-cpf"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={data.cpf}
            onChange={e => updateField("cpf", e.target.value)}
            className="mt-3 min-h-[52px] w-full rounded-2xl border border-purple-200 bg-white px-4 text-base font-medium text-[#1d1d1f] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-200/60"
          />
          {data.cpf && onlyDigits(data.cpf).length === 11 && !isValidCpf(data.cpf) && (
            <p className="mt-1.5 text-xs font-semibold text-red-600">CPF inválido. Confira os números.</p>
          )}
          <button
            type="button"
            onClick={() => {
              updateField("cpf", "");
              setStep(curr => curr + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="mt-3 w-full py-2 text-center text-xs font-semibold text-purple-900 underline underline-offset-4"
          >
            Prefiro não informar
          </button>
        </div>
      )}


      {askCpf ? (
        <StepActions onBack={goBack} onNext={goNext} error={error} />
      ) : (
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
      )}
    </div>
  );
}
