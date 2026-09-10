import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, type FeeTable } from "@contracts/types";
import { minPrice, availableColors, optimizeImageUrl, getImageSrcSet } from "@/lib/shop";

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

  const isSeminovo =
    product.condition === "seminovo" || product.category === "iphone_seminovo";

  return (
    <Link
      to={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414] hover:border-white/25 hover:bg-[#18181b] transition-all duration-200 active:scale-[0.99]"
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-900/50 flex items-center justify-center p-3 sm:p-4 rounded-xl">
        {!isLoaded && rawUrl && (
          <div className="absolute inset-0 animate-pulse bg-neutral-800/40" />
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
            className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            Sem foto
          </div>
        )}

        {/* Badges superiores com posicionamento absoluto refinado */}
        <div className="absolute left-2.5 top-2.5 right-2.5 z-10 flex items-center justify-between gap-1 pointer-events-none">
          {isSeminovo ? (
            <>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                🔄 Seminovo
              </span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                🔋 {batteryHealth ? `${batteryHealth}` : "85%+"}
              </span>
            </>
          ) : (
            <>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-black">
                ✨ Lacrado
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                🛡️ 1 Ano
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            {product.brand}
          </span>
          {colors.length > 0 && (
            <div className="flex items-center gap-1">
              {colors.slice(0, 4).map((c) => (
                <span
                  key={c.color}
                  title={c.color}
                  className="h-3 w-3 rounded-full border border-white/20"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
        </div>

        <h3 className="font-display text-sm sm:text-base font-semibold leading-snug text-white line-clamp-1">
          {product.name}
        </h3>

        <div className="mt-auto pt-1">
          {price != null ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  PIX
                </span>
                <p className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {formatBRL(price)}
                </p>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                ou 12x de{" "}
                <span className="font-semibold text-neutral-200">
                  {formatBRL(installment12 ?? 0)}
                </span>
              </p>
            </>
          ) : (
            <p className="text-xs text-neutral-500">Indisponível no momento</p>
          )}
        </div>
      </div>
    </Link>
  );
}
