import { useEffect, useState, useRef } from "react";
import { optimizeImageUrl } from "@/lib/shop";

const SLIDE_MS = 4500;

export default function HeroCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const count = images.length;
  const preloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (count <= 1) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => window.clearInterval(t);
  }, [count]);

  // Pré-carrega as imagens uma única vez por URL
  useEffect(() => {
    images.forEach((src) => {
      const optimized = optimizeImageUrl(src, 900);
      if (optimized && !preloadedRef.current.has(optimized)) {
        preloadedRef.current.add(optimized);
        const img = new Image();
        img.src = optimized;
      }
    });
  }, [images]);

  if (count === 0) return null;

  return (
    <div className="relative mx-auto w-full max-w-sm overflow-visible md:max-w-none">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border-4 border-ink bg-white shadow-[10px_10px_0_0_#141414] md:aspect-[5/5]">
        {images.map((rawSrc, i) => {
          const src = optimizeImageUrl(rawSrc, 900);
          return (
            <img
              key={rawSrc}
              src={src}
              alt={`iPhone ${i + 1} — Lojinha do Celular`}
              loading={i === 0 ? "eager" : "lazy"}
              onError={(e) => {
                if (rawSrc && e.currentTarget.src !== rawSrc) {
                  e.currentTarget.src = rawSrc;
                }
              }}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
              style={{ opacity: i === index ? 1 : 0 }}
            />
          );
        })}

        {/* Selo */}
        <span className="absolute left-4 top-4 rounded-full border-2 border-ink bg-brand px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-ink">
          iPhones importados
        </span>

        {/* Indicadores com touch target acessível */}
        {count > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 p-1">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Foto ${i + 1}`}
                className="flex min-h-[24px] min-w-[24px] items-center justify-center p-1 cursor-pointer"
              >
                <span
                  className={`block h-2 rounded-full border border-ink/40 transition-all ${
                    i === index ? "w-6 bg-brand" : "w-2 bg-white/80"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="absolute -bottom-3 right-1 rotate-3 rounded-xl border-2 border-ink bg-ink px-4 py-2 font-display text-sm font-bold text-brand shadow-[4px_4px_0_0_rgba(20,20,20,0.3)]">
        Jardim • Guia Lopes
      </div>
    </div>
  );
}
