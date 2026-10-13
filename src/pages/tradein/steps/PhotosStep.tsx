import type { ChangeEvent, MutableRefObject } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PhotoSlotCard } from "../parts";
import type { EvaluationData, PhotoSlot, PhotoSlotKey } from "../constants";

interface PhotosStepProps {
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  photoSlots: PhotoSlot[];
  fileInputRefs: MutableRefObject<{ [key in PhotoSlotKey]?: HTMLInputElement | null }>;
  handlePhotoUpload: (key: PhotoSlotKey, e: ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (key: PhotoSlotKey) => void;
  goNext: () => void;
  goBack: () => void;
}

export default function PhotosStep({ data, updateField, photoSlots, fileInputRefs, handlePhotoUpload, removePhoto, goNext, goBack }: PhotosStepProps) {
  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        Fotos do seu aparelho
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
        As fotos da <strong className="text-[#1d1d1f]">Frente</strong> e da{" "}
        <strong className="text-[#1d1d1f]">Traseira</strong> são obrigatórias para a
        avaliação. As fotos são otimizadas automaticamente no seu navegador.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {photoSlots.slice(0, 4).map(slot => (
          <PhotoSlotCard
            key={slot.key}
            slot={slot}
            onTrigger={() => fileInputRefs.current[slot.key]?.click()}
            onRemove={() => removePhoto(slot.key)}
          />
        ))}
      </div>

      <div className="mt-2.5">
        <PhotoSlotCard
          slot={photoSlots[4]}
          onTrigger={() => fileInputRefs.current[photoSlots[4].key]?.click()}
          onRemove={() => removePhoto(photoSlots[4].key)}
          fullWidth
        />
      </div>

      {/* Inputs de arquivo ocultos */}
      {photoSlots.map(slot => (
        <input
          key={slot.key}
          ref={el => {
            fileInputRefs.current[slot.key] = el;
          }}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handlePhotoUpload(slot.key, e)}
        />
      ))}

      {/* Observação opcional */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-[#6e6e73] mb-1">
          Alguma observação? (opcional)
        </label>
        <textarea
          value={data.notes}
          onChange={e => updateField("notes", e.target.value)}
          placeholder="Ex.: tenho carregador original, pequeno trinco na película..."
          rows={2}
          className="w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-3 text-xs text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-[#0071e3] focus:bg-white resize-none"
        />
      </div>

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <button
          type="button"
          onClick={goNext}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black font-semibold text-white transition shadow-sm"
        >
          Continuar <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
