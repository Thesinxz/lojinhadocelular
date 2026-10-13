import { ArrowRight, Check, Phone, RotateCcw, Smartphone } from "lucide-react";
import SEO from "@/components/SEO";
import { waLink } from "@/lib/shop";
import { formatBRL, type getGradeBadgeConfig } from "@/lib/iphoneKeys";
import type { ValuationResult } from "@contracts/valuation";
import { targetDetailsText, type EvaluationData } from "./constants";

interface SuccessScreenProps {
  data: EvaluationData;
  previewImage: string | null | undefined;
  showPrices: boolean;
  gradeConfig: ReturnType<typeof getGradeBadgeConfig>;
  valuation: ValuationResult;
  photoWarning: string;
  customerHighlights: string[];
  whatsappUrl: string;
  destination: string;
  mainStoreUrl: string;
  onReset: () => void;
}

export default function SuccessScreen({
  data,
  previewImage,
  showPrices,
  gradeConfig,
  valuation,
  photoWarning,
  customerHighlights,
  whatsappUrl,
  destination,
  mainStoreUrl,
  onReset,
}: SuccessScreenProps) {
  return (
    <main className="min-h-[100dvh] bg-[#fbfbfd] px-4 py-8 text-[#1d1d1f] sm:py-16">
      <SEO
        title="Resultado da Avaliação | Troca Fácil Lojinha do Celular"
        description="Confira a pré-avaliação do seu iPhone na Lojinha do Celular e combine os detalhes no WhatsApp."
      />
      <div className="mx-auto flex min-h-[75dvh] w-full max-w-[540px] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 animate-scaleIn">
          <Check className="h-8 w-8 stroke-[2.5]" />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-[#86868b]">
          TROCA FÁCIL LOJINHA DO CELULAR
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">
          Pré-Avaliação Concluída!
        </h1>
        <p className="mt-2 max-w-sm text-xs sm:text-sm text-[#6e6e73]">
          Sua proposta foi registrada no sistema. Confirme o envio da mensagem no WhatsApp para concluir o contato com a equipe.
        </p>

        {/* CARD DE RESULTADO DA PRÉ-AVALIAÇÃO */}
        <div className="mt-6 w-full rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 text-left shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#fbfbfd] p-2 border border-[#e5e5e7]">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt={data.model}
                  className="h-full w-full object-contain drop-shadow-xs"
                />
              ) : (
                <Smartphone className="h-9 w-9 text-[#86868b]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#1d1d1f]">
                  {data.model}
                </h3>
                {showPrices && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${gradeConfig.badgeBg} ${gradeConfig.badgeText} ${gradeConfig.badgeBorder}`}
                  >
                    <span>{gradeConfig.iconText}</span>
                    <span>{gradeConfig.label}</span>
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#6e6e73]">
                {data.storage || "Capacidade padrão"} • Cor: {data.color || "Padrão"}
              </p>
              {data.purchaseLocation && (
                <p className="mt-1 text-[11px] text-neutral-500">
                  Comprado em: {data.purchaseLocation}
                </p>
              )}
            </div>
          </div>

          {/* FAIXA DE VALOR OU CONFIRMAÇÃO DE ENVIO */}
          {!showPrices ? (
            <div className="mt-5 rounded-2xl border border-blue-500/25 bg-blue-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0071e3] flex items-center gap-1.5">
                  ✨ Diagnóstico Registrado
                </span>
                <span className="text-[10px] font-semibold text-blue-800 bg-white border border-blue-200 px-2 py-0.5 rounded-md">
                  Cotação em andamento
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-[#1d1d1f] font-medium leading-relaxed">
                {photoWarning
                  ? `Sua avaliação foi registrada com sucesso. ${photoWarning}`
                  : "As informações e fotos do seu aparelho foram enviadas com sucesso! Nossa equipe técnica está analisando os dados e passará a proposta oficial e o valor da volta diretamente no seu WhatsApp em instantes."}
              </p>
              {data.targetModel && (
                <div className="mt-3 rounded-xl border border-purple-200/80 bg-purple-50/70 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">
                    🎯 Aparelho de interesse para troca
                  </span>
                  <span className="mt-0.5 font-display text-base font-bold text-purple-950 block">
                    {data.targetModel}
                    {targetDetailsText(data) && (
                      <span className="block text-xs font-medium text-purple-800">{targetDetailsText(data)}</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  💰 Faixa Estimada de Pré-Avaliação
                </span>
                <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-emerald-950">
                  {formatBRL(valuation.minEstimatedValue)} a {formatBRL(valuation.maxEstimatedValue)}
                </div>
                <p className="mt-1 text-[11px] text-emerald-900/80">
                  {valuation.disclaimer}
                </p>
              </div>

              {/* SE HOUVER APARELHO DESEJADO PARA TROCA */}
              {valuation.targetModelName && valuation.minTradeDelta !== undefined && (
                <div className="mt-3 rounded-2xl border border-purple-200/80 bg-purple-50/70 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                    🎯 Troca pelo {valuation.targetModelName}
                  </span>
                  <div className="mt-1 font-display text-xl sm:text-2xl font-bold text-purple-950">
                    Volta estimada de {formatBRL(valuation.minTradeDelta)} a {formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}
                  </div>
                  <p className="mt-1 text-[11px] text-purple-900/80">
                    Entregando seu {data.model}, essa é a estimativa da diferença a pagar.
                  </p>
                </div>
              )}
            </>
          )}

          {/* PONTOS FORTES E BÔNUS */}
          {customerHighlights.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3 text-[11px]">
              {customerHighlights.map((hl, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-lg bg-[#f5f5f7] px-2.5 py-1 font-medium text-[#1d1d1f]"
                >
                  {hl}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="mt-6 flex flex-col gap-3 w-full sm:flex-row">
          <a
            href={whatsappUrl || waLink(destination, `Olá! Acabei de fazer a pré-avaliação do meu ${data.model} no site Troca Fácil da Lojinha do Celular. Gostaria de confirmar a proposta!`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" /> Abrir WhatsApp novamente
          </a>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white px-5 py-3.5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-neutral-50 shadow-xs cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" /> Nova avaliação
          </button>
          <a
            href={mainStoreUrl}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1d1d1f] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-black shadow-sm"
          >
            Vitrine da Loja <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <p className="mt-4 text-[11px] text-[#86868b]">
          Unidade Jardim/MS: Av. Duque de Caxias, 486 • Unidade Guia Lopes/MS: Rua Macias Barbosa, 2185
        </p>
      </div>
    </main>
  );
}
