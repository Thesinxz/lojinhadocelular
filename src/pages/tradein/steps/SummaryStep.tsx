import { Camera, CheckCircle2, ShieldCheck } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ValuationResult } from "@contracts/valuation";
import { formatBRL, type getGradeBadgeConfig } from "@/lib/iphoneKeys";
import { StepActions, SummaryRow } from "../parts";
import { formatVisit } from "@contracts/visit";
import { STEP, targetDetailsText, visitPreferenceValue, type EvaluationData, type PhotoSlot } from "../constants";

interface SummaryStepProps {
  data: EvaluationData;
  photoSlots: PhotoSlot[];
  filledPhotosCount: number;
  unitLabel: string;
  showPrices: boolean;
  loyaltyDeclared: boolean;
  gradeConfig: ReturnType<typeof getGradeBadgeConfig>;
  valuation: ValuationResult;
  isSubmitting: boolean;
  setStep: Dispatch<SetStateAction<number>>;
  goBack: () => void;
  submitEvaluation: () => void;
}

export default function SummaryStep({ data, photoSlots, filledPhotosCount, unitLabel, showPrices, loyaltyDeclared, gradeConfig, valuation, isSubmitting, setStep, goBack, submitEvaluation }: SummaryStepProps) {
  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        Última olhada antes de enviar
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">Confere se está tudo certinho.</p>

      {/* Tabela de conferência */}
      <div className="mt-5 divide-y divide-neutral-100 rounded-2xl border border-[#e5e5e7] bg-white text-xs">
        <SummaryRow label="Nome" value={data.name} />
        <SummaryRow label="WhatsApp" value={data.whatsapp} />
        <SummaryRow
          label="Modelo"
          value={`${data.model} ${data.storage ? data.storage : ""}`}
          highlight
        />
        <SummaryRow label="Comprou" value={data.purchaseLocation || "Não informado"} />
        <SummaryRow label="Cor" value={data.color || "Não informada"} />
        <SummaryRow
          label="Bateria"
          value={data.batteryUnknown ? "Não sei informar" : `${data.batteryPercent}%`}
        />
        <SummaryRow
          label="Quer trocar por"
          value={[data.targetModel || "Apenas vender", targetDetailsText(data)].filter(Boolean).join(" — ")}
          highlight
        />
        {visitPreferenceValue(data) && (
          <SummaryRow label="Visita preferida" value={formatVisit(visitPreferenceValue(data))} />
        )}
        <SummaryRow label="iCloud livre" value={data.icloudFree || "Não informado"} />
        <SummaryRow label="Estado" value={data.visualCondition || "Em análise"} />
        <SummaryRow label="Loja" value={unitLabel || "Não informada"} />
        <SummaryRow label="Fotos" value={`${filledPhotosCount} de 5`} />
      </div>

      {/* Fotos anexadas para conferência visual do aparelho */}
      {filledPhotosCount > 0 && (
        <div className="mt-4 rounded-2xl border border-neutral-200/80 bg-[#fbfbfd] p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#1d1d1f]">
              <Camera className="h-4 w-4 text-[#0071e3]" />
              Fotos do aparelho para conferência ({filledPhotosCount} de 5)
            </span>
            <button
              type="button"
              onClick={() => {
                setStep(STEP.photos);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-xs font-semibold text-[#0071e3] hover:underline cursor-pointer"
            >
              Alterar fotos
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {photoSlots
              .filter((s) => s.previewUrl || s.file || s.dataUrl)
              .map((slot) => (
                <div
                  key={slot.key}
                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xs"
                >
                  <img
                    src={slot.previewUrl || slot.dataUrl}
                    alt={slot.label}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 inset-x-1 truncate rounded bg-black/65 px-1 py-0.5 text-[9px] font-medium text-white text-center backdrop-blur-xs">
                    {slot.label}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Destaque da Pré-Avaliação */}
      {!showPrices ? (
        <div className="mt-4 rounded-2xl border border-blue-500/25 bg-blue-50/60 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0071e3] flex items-center gap-1.5">
            ✨ Quase lá
          </span>
          <div className="mt-2 text-xs sm:text-sm font-medium text-[#1d1d1f] leading-relaxed">
            Ao enviar, nossa equipe técnica{unitLabel ? ` de ${unitLabel}` : ""} analisa suas fotos e o diagnóstico e passa a proposta direto no seu WhatsApp. O valor é confirmado na conferência presencial.
          </div>
          {loyaltyDeclared && (
            <p className="mt-2 text-xs font-semibold text-purple-900 flex items-center gap-1">
              🎁 Você disse que comprou com a gente: vamos conferir seu cadastro para aplicar o bônus de fidelidade.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              💰 Pré-avaliação estimada
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${gradeConfig.badgeBg} ${gradeConfig.badgeText} ${gradeConfig.badgeBorder}`}
            >
              <span>{gradeConfig.iconText}</span>
              <span>{gradeConfig.label}</span>
            </span>
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-950">
            {formatBRL(valuation.minEstimatedValue)} a {formatBRL(valuation.maxEstimatedValue)}
          </div>
          {valuation.targetModelName && valuation.minTradeDelta !== undefined && (
            <p className="mt-1.5 text-xs font-medium text-purple-900">
              🎯 Volta estimada no {valuation.targetModelName}:{" "}
              <b>
                {formatBRL(valuation.minTradeDelta)} a {formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}
              </b>
            </p>
          )}
        </div>
      )}

      {/* Mini resumo do diagnóstico técnico */}
      <div className="mt-3 rounded-xl bg-[#f5f5f7] p-3 text-[11px] leading-relaxed text-[#6e6e73]">
        <span className="font-bold text-[#1d1d1f]">Diagnóstico: </span>
        iCloud ({data.icloudFree || "–"}), Face ID ({data.faceId || "–"}), Tela ({data.screenOriginal || "–"}), Bateria (
        {data.batteryOriginal || "–"}), Câmeras ({data.camerasOk || "–"}), Áudio (
        {data.audioOk || "–"}), Conector ({data.chargingPortOk || "–"}), Aberto (
        {data.openedBefore || "–"}), Caixa ({data.hasBox || "–"}).
      </div>

      {/* Box de Confidencialidade e LGPD */}
      <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <span className="text-[11px] leading-relaxed text-emerald-900">
          <b>Avaliação 100% segura e confidencial:</b> Seus dados e fotos são tratados com sigilo
          conforme a <b>LGPD (Lei nº 13.709/2018)</b> exclusivamente para análise técnica e contato
          via WhatsApp. Consulte nossa{" "}
          <a
            href="/privacidade"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline text-emerald-800 hover:text-emerald-950"
          >
            Política de Privacidade
          </a>.
        </span>
      </div>

      <StepActions
        onBack={goBack}
        onNext={submitEvaluation}
        loading={isSubmitting}
        loadingLabel="Enviando proposta..."
        nextIcon={<CheckCircle2 className="h-4 w-4" />}
        nextLabel="Enviar para avaliação"
      />
    </div>
  );
}
