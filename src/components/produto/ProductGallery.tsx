import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Video, X, ZoomIn } from "lucide-react";
import { getImageSrcSet, optimizeImageUrl } from "@/lib/shop";
import type { getVideoEmbed } from "@/lib/videoEmbed";

export type ProductGalleryProps = {
  productName: string;
  images: string[];
  activeImage: string;
  onSelectImage: (url: string) => void;
  mediaTab: "photo" | "video";
  onChangeMediaTab: (tab: "photo" | "video") => void;
  videoEmbed: ReturnType<typeof getVideoEmbed>;
};

export default function ProductGallery({
  productName,
  images,
  activeImage,
  onSelectImage,
  mediaTab,
  onChangeMediaTab,
  videoEmbed,
}: ProductGalleryProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [failedSrcSetUrls, setFailedSrcSetUrls] = useState<Record<string, boolean>>({});
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({});

  const displayImage = activeImage || images[0] || "";
  const isImageBroken = Boolean(displayImage && brokenUrls[displayImage]);
  const disableSrcSet = Boolean(displayImage && failedSrcSetUrls[displayImage]);
  const currentIndex = images.indexOf(displayImage);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setZoomOpen(false);
      } else if (e.key === "ArrowRight" && images.length > 1) {
        const nextIndex = (Math.max(0, currentIndex) + 1) % images.length;
        onSelectImage(images[nextIndex]);
      } else if (e.key === "ArrowLeft" && images.length > 1) {
        const prevIndex = (Math.max(0, currentIndex) - 1 + images.length) % images.length;
        onSelectImage(images[prevIndex]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomOpen, images, currentIndex, onSelectImage]);

  const handleImgError = (imgEl: HTMLImageElement, rawSrc: string) => {
    if (!rawSrc) return;
    if (!failedSrcSetUrls[rawSrc]) {
      setFailedSrcSetUrls((prev) => ({ ...prev, [rawSrc]: true }));
      imgEl.removeAttribute("srcset");
      if (imgEl.src !== rawSrc) {
        imgEl.src = rawSrc;
        return;
      }
    }
    setBrokenUrls((prev) => ({ ...prev, [rawSrc]: true }));
  };

  return (
    <div className="md:sticky md:top-24">
      <div className="aspect-square w-full rounded-3xl bg-[#fbfbfd] border border-neutral-100 p-4 sm:p-8 flex items-center justify-center shadow-xs overflow-hidden relative">
        {videoEmbed && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full bg-black/75 p-1 backdrop-blur-md shadow-md">
            <button
              type="button"
              onClick={() => onChangeMediaTab("photo")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                mediaTab === "photo"
                  ? "bg-white text-black shadow-xs"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Foto
            </button>
            <button
              type="button"
              onClick={() => onChangeMediaTab("video")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                mediaTab === "video"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-white/80 hover:text-white"
              }`}
            >
              <Video className="h-3.5 w-3.5" /> Vídeo
            </button>
          </div>
        )}

        {mediaTab === "video" && videoEmbed ? (
          <div className="h-full w-full flex items-center justify-center bg-black rounded-2xl overflow-hidden">
            {videoEmbed.type === "youtube" ? (
              <iframe
                src={videoEmbed.src}
                title={`Vídeo demonstrativo de ${productName}`}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : videoEmbed.type === "video" ? (
              <video
                src={videoEmbed.src}
                controls
                autoPlay
                muted
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="text-center p-6 text-white">
                <Video className="mx-auto h-10 w-10 text-purple-400 mb-2" />
                <p className="text-sm font-semibold">Vídeo demonstrativo</p>
                <a
                  href={videoEmbed.src}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500"
                >
                  Assistir vídeo externo
                </a>
              </div>
            )}
          </div>
        ) : displayImage && !isImageBroken ? (
          <>
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label={`Ampliar foto de ${productName}`}
              className="group relative flex h-full w-full items-center justify-center cursor-zoom-in focus:outline-none"
            >
              <img
                key={displayImage}
                src={optimizeImageUrl(displayImage, 800, 85)}
                srcSet={disableSrcSet ? undefined : getImageSrcSet(displayImage)}
                sizes="(max-width: 768px) 92vw, 500px"
                alt={productName}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={(e) => handleImgError(e.currentTarget, displayImage)}
                className="h-full w-full max-h-full max-w-full object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.12)] transition duration-300 animate-in fade-in group-hover:scale-[1.02]"
              />
              <span className="pointer-events-none absolute bottom-1 right-1 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow-xs border border-neutral-200/80 backdrop-blur-sm">
                <ZoomIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ampliar</span>
              </span>
            </button>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-medium text-neutral-400">
            Sem foto
          </div>
        )}
      </div>

      {mediaTab === "photo" && images.length > 1 && (
        <div
          className="mt-3 flex items-center gap-2.5 overflow-x-auto pb-1 snap-x"
          role="list"
          aria-label="Fotos disponíveis do aparelho"
        >
          {images.map((url, idx) => {
            const selected = url === displayImage;
            return (
              <button
                key={url}
                type="button"
                onClick={() => onSelectImage(url)}
                aria-label={`Ver imagem ${idx + 1} de ${productName}`}
                aria-pressed={selected}
                className={`h-16 w-16 shrink-0 snap-start overflow-hidden rounded-2xl border bg-[#fbfbfd] p-1.5 transition cursor-pointer ${
                  selected
                    ? "border-[#1d1d1f] ring-2 ring-[#1d1d1f]/15"
                    : "border-neutral-200 opacity-75 hover:opacity-100"
                }`}
              >
                <img
                  src={optimizeImageUrl(url, 360, 80)}
                  alt={`${productName} miniatura ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              </button>
            );
          })}
        </div>
      )}

      {zoomOpen && displayImage && !isImageBroken && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização ampliada de ${productName}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            aria-label="Fechar visualização ampliada"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative flex max-h-[85dvh] w-full max-w-2xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const prevIndex =
                    (Math.max(0, currentIndex) - 1 + images.length) % images.length;
                  onSelectImage(images[prevIndex]);
                }}
                aria-label="Foto anterior"
                className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/75 transition cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            <img
              src={optimizeImageUrl(displayImage, 800, 90)}
              alt={`${productName} ampliado`}
              className="max-h-[82dvh] w-auto max-w-full rounded-2xl bg-white/5 object-contain p-2"
            />

            {images.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const nextIndex = (Math.max(0, currentIndex) + 1) % images.length;
                  onSelectImage(images[nextIndex]);
                }}
                aria-label="Próxima foto"
                className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/75 transition cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
