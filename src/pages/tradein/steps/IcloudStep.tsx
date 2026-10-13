import { ArrowLeft, ArrowRight, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { TriChoiceStep } from "../parts";
import type { EvaluationData } from "../constants";

interface IcloudStepProps {
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  autoAdvance: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  animatingSelection: string | null;
  mainStoreUrl: string;
  goBack: () => void;
}

export default function IcloudStep({ data, updateField, autoAdvance, animatingSelection, mainStoreUrl, goBack }: IcloudStepProps) {
  return (
    data.icloudFree === "Não" ? (
      <div className="rounded-3xl border border-red-200 bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
          Ainda não conseguimos avaliar esse iPhone
        </h2>
        <p className="mt-2 text-sm text-[#6e6e73] leading-relaxed">
          Não compramos nem recebemos em troca aparelhos com bloqueio de iCloud. Quando você conseguir sair da conta Apple e
          desativar o <b>Buscar iPhone</b> (Ajustes &gt; seu nome &gt; Buscar), é só fazer uma nova avaliação.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => updateField("icloudFree", "")}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-1 rounded-2xl border border-[#e5e5e7] px-4 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
          >
            <ArrowLeft className="h-4 w-4" /> Mudei a resposta
          </button>
          <a
            href={mainStoreUrl}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1d1d1f] px-4 text-sm font-semibold text-white transition hover:bg-black"
          >
            Vitrine da Loja <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    ) : (
      <TriChoiceStep
        title="O iPhone está livre de bloqueio do iCloud?"
        subtitle="Precisa estar sem a conta Apple de outra pessoa e com o Buscar iPhone desativado (ou que você consiga desativar)."
        options={[
          { value: "Sim", label: "Sim, está livre", icon: <CircleCheck className="h-5 w-5 text-emerald-500" /> },
          { value: "Não", label: "Não, está bloqueado ou não tenho a senha", icon: <CircleX className="h-5 w-5 text-rose-500" /> },
          { value: "Não sei", label: "Não sei", icon: <CircleHelp className="h-5 w-5 text-neutral-400" /> },
        ]}
        value={data.icloudFree}
        animating={animatingSelection}
        onSelect={val => (val === "Não" ? updateField("icloudFree", val) : autoAdvance("icloudFree", val))}
        onBack={goBack}
      />
    )
  );
}
