import { useEffect, useRef, useState } from "react";
import { Check, Smartphone, Sparkles } from "lucide-react";
import type { IphoneColorSpec, IphoneModelSpec } from "@/lib/iphoneCatalog";
import { Field, StepActions } from "../parts";
import { MODEL_GROUPS, firstName, type EvaluationData } from "../constants";

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
  // `picked`: o cliente tocou num modelo da lista; a lista recolhe e aparecem capacidade e cor.
  const [picked, setPicked] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  const query = data.model.trim().toLowerCase();
  const exactMatch = Boolean(detectedModel) && detectedModel!.name.toLowerCase() === query;
  const groups = MODEL_GROUPS.map(group => ({
    ...group,
    models: !query || exactMatch ? group.models : group.models.filter(m => m.toLowerCase().includes(query)),
  })).filter(group => group.models.length > 0);
  // Modelo digitado que não está na lista: segue direto para capacidade e cor.
  const noMatch = Boolean(query) && groups.length === 0;
  const showDetails = picked || exactMatch || noMatch;

  // Ao escolher o modelo, leva o cliente até capacidade e cor (a barra "Continuar" já está à vista).
  useEffect(() => {
    if (picked) detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [picked]);

  function changeModel() {
    setPicked(false);
    updateField("model", "");
    updateField("storage", "");
  }

  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        Prazer, {firstName(data.name) || "amigo"}! Qual é o seu iPhone?
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
        {showDetails
          ? "Agora escolha a capacidade e a cor do seu aparelho."
          : "Toque no modelo ou digite o nome do aparelho que você tem hoje."}
      </p>

      <div className="mt-5 space-y-4">
        {!showDetails && (
          <>
            {/* Campo de busca do modelo */}
            <Field label="Buscar modelo" icon={<Smartphone className="h-4 w-4" />}>
              <input
                value={data.model}
                onChange={e => {
                  setPicked(false);
                  updateField("model", e.target.value);
                }}
                placeholder="Ex.: 15 Pro, 13, 11..."
                autoComplete="off"
                className="w-full bg-transparent text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none"
              />
            </Field>

            {/* Todos os modelos, por série */}
            <div className="space-y-3.5">
              {groups.map(group => (
                <div key={group.title}>
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                    {group.title}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {group.models.map(modelName => (
                      <button
                        key={modelName}
                        type="button"
                        onClick={() => {
                          setPicked(true);
                          selectPopularModel(modelName);
                        }}
                        className="rounded-full border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-2 text-xs font-semibold text-[#1d1d1f] transition-all hover:border-neutral-400 hover:bg-white active:scale-95"
                      >
                        {modelName.replace(/^iPhone /, "")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Modelo escolhido, em formato compacto */}
        {showDetails && (
          <div
            ref={detailsRef}
            className="flex scroll-mt-4 items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-neutral-50 p-3 animate-fadeIn">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white p-1.5 shadow-xs">
              {detectedModel && previewImage ? (
                <img
                  key={previewImage}
                  src={previewImage}
                  alt={detectedModel.name}
                  className="h-full w-full object-contain drop-shadow-sm"
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Smartphone className="h-7 w-7 text-[#0071e3]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {detectedModel && (
                <div className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#0071e3]">
                  <Sparkles className="h-3 w-3" /> Modelo reconhecido
                </div>
              )}
              <h3 className="truncate font-display text-base font-bold text-[#1d1d1f]">
                {detectedModel?.name ?? data.model}
              </h3>
              {detectedModel && (
                <p className="text-[11px] text-[#6e6e73]">
                  {detectedModel.year} • Tela {detectedModel.screen}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={changeModel}
              className="shrink-0 rounded-full border border-[#e5e5e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
            >
              Trocar
            </button>
          </div>
        )}

        {showDetails && (
          <>
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
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}

      {showDetails ? (
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
