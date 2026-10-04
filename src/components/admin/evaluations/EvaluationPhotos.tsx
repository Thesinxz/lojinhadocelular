import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { EvaluationPhotoItem } from "@contracts/types";

interface LightboxProps {
  photos: EvaluationPhotoItem[];
  index: number;
  title: string;
  subtitle: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete?: (index: number) => void;
}

/** Visualizador em tela cheia com zoom, setas e atalhos (ESC / ← / →). */
export function EvaluationLightbox({ photos, index, title, subtitle, onIndexChange, onClose, onDelete }: LightboxProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const current = photos[index];

  const go = useCallback(
    (delta: number) => {
      if (!photos.length) return;
      onIndexChange((index + delta + photos.length) % photos.length);
      setZoomLevel(1);
    },
    [index, onIndexChange, photos.length],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, onClose]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotos do aparelho"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white animate-fadeIn backdrop-blur-md select-none"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 bg-black/40">
        <div className="flex flex-col min-w-0 pr-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-neutral-300 truncate">{title}</span>
            <span className="text-neutral-500">•</span>
            <span className="font-medium text-emerald-400 truncate">{subtitle}</span>
          </div>
          <h3 className="font-display text-sm sm:text-base font-bold text-white truncate">
            {current.label || `Foto ${index + 1}`}
            <span className="ml-2 text-xs font-normal text-neutral-400">
              ({index + 1} de {photos.length})
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setZoomLevel((prev) => (prev >= 2.5 ? 1 : prev + 0.5))}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/20 transition"
            title="Ampliar / Reduzir"
          >
            {zoomLevel > 1 ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
            <span>{zoomLevel > 1 ? `${zoomLevel.toFixed(1)}x` : "Zoom"}</span>
          </button>
          {current.url && (
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/20 transition"
              title="Abrir foto em nova aba"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova aba</span>
            </a>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(index)}
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs font-medium text-red-300 hover:bg-red-500/20 transition"
              title="Excluir esta foto"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
              <span className="hidden sm:inline">Excluir</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-red-500/30 transition"
            title="Fechar (ESC)"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden p-3 sm:p-6">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/85 transition backdrop-blur-xs shadow-lg"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div
          className="relative max-h-full max-w-full overflow-auto flex items-center justify-center transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <img
            src={current.url}
            alt={current.label}
            className="max-h-[68vh] sm:max-h-[72vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
          />
        </div>
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/85 transition backdrop-blur-xs shadow-lg"
            aria-label="Próxima foto"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-2.5 border-t border-white/10 bg-black/50 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] overflow-x-auto">
          {photos.map((p, idx) => (
            <button
              key={`${p.key}-${idx}`}
              type="button"
              onClick={() => {
                onIndexChange(idx);
                setZoomLevel(1);
              }}
              className={`relative h-12 w-14 sm:h-14 sm:w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                idx === index ? "border-[#0071e3] ring-2 ring-[#0071e3]/50" : "border-white/20 opacity-50 hover:opacity-100"
              }`}
              title={p.label || `Foto ${idx + 1}`}
            >
              <img src={p.url} alt={p.label} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface EvaluationPhotosProps {
  photos: EvaluationPhotoItem[];
  /** Quantidade informada pelo site (quando as fotos não foram salvas). */
  photosCount: number;
  clientName: string;
  modelName: string;
  uploading: boolean;
  migrating: boolean;
  canMigrate: boolean;
  onUpload: (files: FileList) => void;
  onDelete: (index: number) => void;
  onMigrate: () => void;
}

/** Galeria de fotos do aparelho com adicionar/remover, migração para o R2 e lightbox. */
export default function EvaluationPhotos({
  photos,
  photosCount,
  clientName,
  modelName,
  uploading,
  migrating,
  canMigrate,
  onUpload,
  onDelete,
  onMigrate,
}: EvaluationPhotosProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    if (!photos.length) setLightboxIndex(null);
    else if (lightboxIndex > photos.length - 1) setLightboxIndex(photos.length - 1);
  }, [photos.length, lightboxIndex]);

  const uploadInput = (label: string, className: string, icon = <Plus className="h-3.5 w-3.5" />) => (
    <label className={`${className} ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      <span>{uploading ? "Enviando..." : label}</span>
      <input
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          if (e.target.files?.length) onUpload(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-[#fbfbfd] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1d1d1f]">
          <Camera className="h-3.5 w-3.5 text-[#0071e3]" />
          Fotos do aparelho ({photos.length})
        </span>
        <div className="flex items-center gap-1">
          {canMigrate && (
            <button
              type="button"
              onClick={onMigrate}
              disabled={migrating}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {migrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Salvar no R2
            </button>
          )}
          {uploadInput(
            photos.length ? "Adicionar" : "Anexar fotos",
            "inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-[#0071e3] hover:bg-blue-50 transition",
          )}
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((photo, idx) => (
            <button
              key={`${photo.key}-${idx}`}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#e5e5e7] bg-white shadow-2xs hover:border-[#0071e3] transition"
              title={`Ampliar: ${photo.label || `Foto ${idx + 1}`}`}
            >
              <img
                src={photo.url}
                alt={photo.label || `Foto ${idx + 1}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100" />
              </div>
              <span className="absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/65 px-1 py-0.5 text-center text-[10px] font-medium text-white">
                {photo.label || `Foto ${idx + 1}`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#d2d2d7] bg-white p-4 text-center text-xs text-[#86868b]">
          {photosCount > 0
            ? `O cliente informou ${photosCount} foto(s) no site, mas elas não foram salvas. Peça pelo WhatsApp e anexe aqui.`
            : "Nenhuma foto anexada."}
        </p>
      )}

      {lightboxIndex !== null && (
        <EvaluationLightbox
          photos={photos}
          index={lightboxIndex}
          title={clientName}
          subtitle={modelName}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
