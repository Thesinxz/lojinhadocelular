import { ArrowLeft, ArrowRight, Check, Smartphone, Sparkles } from "lucide-react";
import { POPULAR_IPHONE_MODELS, type IphoneColorSpec, type IphoneModelSpec } from "@/lib/iphoneCatalog";
import { Field } from "../parts";
import type { EvaluationData } from "../constants";

interface ModelStepProps {
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  selectPopularModel: (popName: string) => void;
  detectedModel: IphoneModelSpec | null;
  previewImage: string | null | undefined;
  storageOptions: string[];
  colorOptions: IphoneColorSpec[];
  error: string;
  goNext: () => void;
  goBack: () => void;
}

export default function ModelStep({ data, updateField, selectPopularModel, detectedModel, previewImage, storageOptions, colorOptions, error, goNext, goBack }: ModelStepProps) {
  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        Prazer, {data.name.trim() || "amigo"}! Qual é o seu iPhone?
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
        Toque no modelo ou digite o nome do aparelho que você tem hoje.
      </p>

      <div className="mt-5 space-y-4">
        {/* Campo de busca do modelo */}
        <Field label="Modelo do aparelho" icon={<Smartphone className="h-4 w-4" />}>
          <input
            value={data.model}
            onChange={e => updateField("model", e.target.value)}
            placeholder="Ex.: iPhone 15 Pro, iPhone 13..."
            autoComplete="off"
            className="w-full bg-transparent text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none"
          />
        </Field>

        {/* Chips de modelos populares */}
        <div>
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
            Modelos mais comuns
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {POPULAR_IPHONE_MODELS.map(popName => {
              const isSelected =
                detectedModel?.name.toLowerCase() === popName.toLowerCase() ||
                data.model.toLowerCase().trim() === popName.toLowerCase();
              return (
                <button
                  key={popName}
                  type="button"
                  onClick={() => selectPopularModel(popName)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-[#1d1d1f] text-white shadow-xs scale-102"
                      : "border border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:border-neutral-400 hover:bg-white"
                  }`}
                >
                  {popName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card de visualização do aparelho em tempo real */}
        {detectedModel && (
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-neutral-50 p-4 shadow-xs animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              {previewImage ? (
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-xs border border-neutral-100">
                  <img
                    key={previewImage}
                    src={previewImage}
                    alt={detectedModel.name}
                    className="h-full w-full object-contain drop-shadow-sm"
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-white p-3 shadow-xs border border-neutral-100">
                  <Smartphone className="h-10 w-10 text-[#0071e3]" />
                </div>
              )}
              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="inline-flex items-center gap-1 rounded-full bg-blue-100/80 px-2 py-0.5 text-[10.5px] font-semibold text-[#0071e3]">
                  <Sparkles className="h-3 w-3" /> Modelo reconhecido
                </div>
                <h3 className="font-display text-base font-bold text-[#1d1d1f] mt-0.5">
                  {detectedModel.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1 text-[11px] text-[#6e6e73]">
                  <span className="rounded bg-white border border-neutral-200 px-1.5 py-0.5 font-medium">
                    Ano {detectedModel.year}
                  </span>
                  <span className="rounded bg-white border border-neutral-200 px-1.5 py-0.5 font-medium">
                    Tela {detectedModel.screen}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Armazenamento */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6e6e73]">Capacidade</span>
            {data.storage && (
              <span className="text-xs font-bold text-[#0071e3]">{data.storage}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {storageOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => updateField("storage", option)}
                className={`h-11 rounded-xl border text-xs font-semibold transition-all ${
                  data.storage === option
                    ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]"
                    : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Cores Oficiais */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6e6e73]">Cor do aparelho</span>
            {data.color && (
              <span className="text-xs font-bold text-[#0071e3]">{data.color}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {colorOptions.map(c => {
              const isSelected = data.color === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => updateField("color", c.name)}
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
                  <span className="truncate flex-1">{c.name}</span>
                  {isSelected && <Check className="h-3 w-3 text-[#0071e3]" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="flex h-12 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <button
          type="button"
          onClick={goNext}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black font-semibold text-white transition-all shadow-sm"
        >
          Continuar <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
