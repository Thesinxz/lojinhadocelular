import type { ReactNode } from "react";
import { ArrowLeft, Camera, X } from "lucide-react";
import { formatFileSize } from "@/lib/imageCompressor";
import { SIMPLE_TRI_OPTIONS, type PhotoSlot } from "./constants";

// COMPONENTE PARA TELAS DE 3 OPÇÕES (SIM, NÃO, NÃO SEI)
export function TriChoiceStep({
  title,
  subtitle,
  value,
  animating,
  onSelect,
  onBack,
  options = SIMPLE_TRI_OPTIONS.map(opt => ({ value: opt, label: opt })),
}: {
  title: string;
  subtitle: string;
  value: string;
  animating: string | null;
  onSelect: (val: string) => void;
  onBack: () => void;
  options?: { value: string; label: string }[];
}) {
  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        {title}
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">{subtitle}</p>

      <div className="mt-6 space-y-2.5">
        {options.map(({ value: opt, label }) => {
          const isSelected = value === opt;
          const isAnimating = animating === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={`flex min-h-[52px] w-full items-center justify-center rounded-2xl border px-4 text-center text-sm font-semibold transition-all ${
                isSelected || isAnimating
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white scale-[0.99] shadow-xs"
                  : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:border-neutral-300 hover:bg-[#fbfbfd]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <span className="text-xs text-[#86868b]">Toque numa opção pra continuar →</span>
      </div>
    </div>
  );
}

// CARD DE SLOT DE FOTO INDIVIDUAL
export function PhotoSlotCard({
  slot,
  onTrigger,
  onRemove,
  fullWidth = false,
}: {
  slot: PhotoSlot;
  onTrigger: () => void;
  onRemove: () => void;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
        slot.previewUrl
          ? "border-emerald-500/50 bg-emerald-50/20"
          : slot.required
          ? "border-neutral-300 bg-[#fbfbfd] hover:border-[#1d1d1f] hover:bg-white"
          : "border-[#d5d5d7] bg-[#f5f5f7] hover:border-[#1d1d1f] hover:bg-white"
      } ${fullWidth ? "min-h-[116px]" : "min-h-[136px]"} p-2 text-center cursor-pointer`}
      onClick={onTrigger}
    >
      {slot.isCompressing ? (
        <div className="flex flex-col items-center justify-center p-3 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0071e3] border-t-transparent mb-2" />
          <span className="text-[11px] font-semibold text-[#1d1d1f]">Otimizando foto...</span>
          <span className="text-[10px] text-[#86868b]">Reduzindo tamanho</span>
        </div>
      ) : slot.previewUrl ? (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl group">
          <img
            src={slot.previewUrl}
            alt={slot.label}
            className="h-full w-full object-cover rounded-xl"
          />
          {slot.compressedSize && slot.originalSize && slot.originalSize > slot.compressedSize && (
            <div className="absolute bottom-1 left-1 right-1 bg-black/75 backdrop-blur-xs rounded-md px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 text-center">
              ✓ Otimizada ({formatFileSize(slot.compressedSize)})
            </div>
          )}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow-xs hover:bg-black"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-xs border border-neutral-200/60">
            <Camera className="h-4 w-4 text-[#1d1d1f]" />
          </div>
          <span className="mt-2 text-[11px] font-semibold text-[#1d1d1f] leading-tight px-1">
            {slot.label}
          </span>
          {slot.required ? (
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded-md mt-1">
              Obrigatória
            </span>
          ) : (
            <span className="text-[10px] font-medium text-[#86868b] mt-1">Opcional</span>
          )}
        </>
      )}
    </div>
  );
}

// LINHA DE RESUMO FINAL
export function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className="text-[#86868b] font-medium">{label}</span>
      <span
        className={`font-semibold text-right ${
          highlight ? "text-[#1d1d1f] font-bold" : "text-neutral-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// CAMPO GENÉRICO DE INPUT
export function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">{label}</span>
      <div className="group flex h-12 items-center gap-2.5 rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7] px-3.5 transition-all focus-within:border-[#1d1d1f] focus-within:bg-white focus-within:ring-2 focus-within:ring-black/5">
        <span className="shrink-0 text-[#86868b] transition-colors group-focus-within:text-[#1d1d1f]">
          {icon}
        </span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </label>
  );
}
