import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, type FeeTable } from "@contracts/types";
import { minPrice, availableColors, optimizeImageUrl, getImageSrcSet, isImportedEua } from "@/lib/shop";

export default function ProductCard({
  product,
  installmentsMax,
  fees,
  priority = false,
}: {
  product: ProductWithVariants;
  installmentsMax: number;
  fees: FeeTable;
  priority?: boolean;
}) {
  const price = minPrice(product);
  const colors = availableColors(product);
  const fee12 = fees["12"] ?? fees[String(installmentsMax)] ?? 0;
  const installment12 =
    price != null
      ? installmentFromFees(price, 12, fee12)
      : null;

  const batteryHealth = product.variants.find((v) => v.batteryHealth)?.batteryHealth;
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) {
      setIsLoaded(true);
    }
  }, []);

  const rawUrl = product.imageUrl;
  // Imagem ultra-leve e progressiva para visualização rápida no catálogo
  const optimizedUrl = optimizeImageUrl(rawUrl, 360, 75);
  const srcSet = getImageSrcSet(rawUrl);

  return (
    <Link
      to={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_0_#141414] transition active:scale-[0.99] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#141414]"
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {!isLoaded && rawUrl && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200" />
        )}
        {rawUrl ? (
          <img
            ref={imgRef}
            src={optimizedUrl}
            srcSet={srcSet}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            alt={product.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={(e) => {
              // Se o proxy falhar por algum motivo, fallback imediato para a URL original
              if (rawUrl && e.currentTarget.src !== rawUrl) {
                e.currentTarget.src = rawUrl;
              }
            }}
            className={`h-full w-full object-contain pt-10 pb-2 px-3 transition-opacity duration-200 group-hover:scale-105 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-300">
            Sem foto
          </div>
        )}

        {/* Badges superiores organizados sem colisão */}
        <div className="absolute left-2 top-2 right-2 z-10 flex items-start justify-between gap-1 pointer-events-none">
          {product.condition === "seminovo" || product.category === "iphone_seminovo" ? (
            <>
              {isImportedEua(product) ? (
                <span className="truncate rounded-full border-2 border-ink bg-blue-600 px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-white shadow-[2px_2px_0_0_#141414]">
                  🇺🇸 EUA (1 Ano)
                </span>
              ) : (
                <span className="truncate rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-ink shadow-[2px_2px_0_0_#141414]">
                  🔄 Seminovo
                </span>
              )}
              <span className="shrink-0 rounded-full border-2 border-ink bg-emerald-300 px-2 py-0.5 text-[9px] font-black text-ink shadow-[2px_2px_0_0_#141414]">
                🔋 {batteryHealth ? `${batteryHealth}` : "80%+"}
              </span>
            </>
          ) : (
            <>
              <span className="truncate rounded-full border-2 border-ink bg-brand px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-ink shadow-[2px_2px_0_0_#141414]">
                ✨ Lacrado
              </span>
              <span className="shrink-0 rounded-full border-2 border-ink bg-amber-300 px-2 py-0.5 text-[9px] font-black text-ink shadow-[2px_2px_0_0_#141414]">
                🛡️ 1 Ano
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            {product.brand}
          </span>
          {colors.length > 0 && (
            <div className="flex gap-1">
              {colors.slice(0, 4).map((c) => (
                <span
                  key={c.color}
                  title={c.color}
                  className="h-3.5 w-3.5 rounded-full border border-ink/30"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
        </div>

        <h3 className="font-display text-base font-bold leading-snug text-ink">
          {product.name}
        </h3>

        <div className="mt-auto pt-1">
          {price != null ? (
            <>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">No cartão</p>
              <p className="font-display text-xl font-bold text-ink">
                12x de {formatBRL(installment12 ?? 0)}
              </p>
              <p className="text-xs font-semibold text-neutral-500 mt-0.5">
                ou <span className="font-bold text-neutral-800">{formatBRL(price)}</span> à vista
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-neutral-400">Indisponível no momento</p>
          )}
        </div>
      </div>
    </Link>
  );
}
