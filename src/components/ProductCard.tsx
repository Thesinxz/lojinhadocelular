import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, type FeeTable } from "@contracts/types";
import { minPrice, availableColors, optimizeImageUrl } from "@/lib/shop";

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
  const optimizedUrl = optimizeImageUrl(rawUrl, 600);

  return (
    <Link
      to={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_0_#141414] transition hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#141414]"
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {!isLoaded && rawUrl && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200" />
        )}
        {rawUrl ? (
          <img
            ref={imgRef}
            src={optimizedUrl}
            alt={product.name}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={(e) => {
              if (rawUrl && e.currentTarget.src !== rawUrl) {
                e.currentTarget.src = rawUrl;
              }
            }}
            className={`h-full w-full object-contain pt-10 pb-2 px-3 transition-opacity duration-300 group-hover:scale-105 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-300">
            Sem foto
          </div>
        )}
        {product.condition === "seminovo" ? (
          <>
            <span className="absolute left-2.5 top-2.5 z-10 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink shadow-[2px_2px_0_0_#141414]">
              📱 Seminovo
            </span>
            <span className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full border-2 border-ink bg-emerald-300 px-2 py-0.5 text-[9px] font-black text-ink shadow-[2px_2px_0_0_#141414]">
              🔋 {batteryHealth ? `Bat. ${batteryHealth}` : "Bat. 80%+"}
            </span>
          </>
        ) : (
          <>
            <span className="absolute left-2.5 top-2.5 z-10 rounded-full border-2 border-ink bg-brand px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink shadow-[2px_2px_0_0_#141414]">
              ✨ Lacrado Novo
            </span>
            <span className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full border-2 border-ink bg-amber-300 px-2 py-0.5 text-[9px] font-black text-ink shadow-[2px_2px_0_0_#141414]">
              🛡️ {product.warranty || "1 Ano Garantia"}
            </span>
          </>
        )}
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
