import { useEffect, useState } from "react";

const SLIDE_MS = 4500;

export default function HeroCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const count = images.length;

  useEffect(() => {
    if (count <= 1) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => window.clearInterval(t);
  }, [count]);

  // Pré-carrega as próximas imagens para a troca ser instantânea
  useEffect(() => {
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [images]);

  if (count === 0) return null;

  return (
    <div className="relative mx-auto w-full max-w-sm md:max-w-none">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border-4 border-ink bg-white shadow-[10px_10px_0_0_#141414] md:aspect-[5/5]">
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`iPhone ${i + 1} — Lojinha do Celular`}
            loading={i === 0 ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}

        {/* Selo */}
        <span className="absolute left-4 top-4 rounded-full border-2 border-ink bg-brand px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-ink">
          iPhones importados
        </span>

        {/* Indicadores */}
        {count > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Foto ${i + 1}`}
                className={`h-2.5 rounded-full border border-ink/40 transition-all ${
                  i === index ? "w-7 bg-brand" : "w-2.5 bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="absolute -bottom-4 -right-2 rotate-3 rounded-xl border-2 border-ink bg-ink px-4 py-2 font-display text-sm font-bold text-brand shadow-[4px_4px_0_0_rgba(20,20,20,0.3)]">
        Jardim • Guia Lopes
      </div>
    </div>
  );
}
