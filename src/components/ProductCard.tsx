import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import { Plus, Flame, BatteryCharging } from "lucide-react";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, type FeeTable } from "@contracts/types";
import { minPrice, availableColors, optimizeImageUrl, getImageSrcSet } from "@/lib/shop";
import { resolveProductImage } from "@/lib/iphoneCatalog";

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

  // Resolve imagem oficial limpa (Apple transparent PNG) caso a imagem do banco seja genérica
  const rawUrl = resolveProductImage(product.name, product.imageUrl, colors[0]?.color);
  const optimizedUrl = optimizeImageUrl(rawUrl, 440, 85);
  const srcSet = getImageSrcSet(rawUrl);

  const isSeminovo =
    product.condition === "seminovo" || product.category === "iphone_seminovo";

  return (
    <Link
      to={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-neutral-100 bg-white p-3 sm:p-4 shadow-[0_2px_14px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(0,0,0,0.09)] active:scale-[0.99]"
    >
      {/* Container da foto com fundo neutro claro e enquadramento destacado */}
      <div className="relative aspect-[4/5] sm:aspect-square w-full overflow-hidden rounded-2xl bg-[#fbfbfd] border border-neutral-100/60 p-3 pt-9 pb-3 flex items-center justify-center">
        {!isLoaded && rawUrl && (
          <div className="absolute inset-0 animate-pulse bg-neutral-100" />
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
              if (rawUrl && e.currentTarget.src !== rawUrl) {
                e.currentTarget.src = rawUrl;
              }
            }}
            className={`h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.09)] transition-all duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_14px_24px_rgba(0,0,0,0.14)] ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            Sem foto
          </div>
        )}

        {/* Badges superiores exatamente como na BLK Store */}
        <div className="absolute left-2.5 top-2.5 right-2.5 z-10 flex flex-col items-start gap-1 pointer-events-none">
          {/* Badge de Promoção Vermelha */}
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ff3b30] px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-white shadow-xs">
            <Flame className="h-3 w-3 fill-white" />
            PROMOÇÃO
          </span>

          {/* Badge de Condição */}
          {isSeminovo ? (
            <span className="rounded-full border border-neutral-200 bg-white/95 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-neutral-800 shadow-xs backdrop-blur-sm">
              Seminovo
            </span>
          ) : (
            <span className="rounded-full bg-[#1d1d1f] px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-white shadow-xs">
              Lacrado
            </span>
          )}
        </div>
      </div>

      {/* Conteúdo do Card */}
      <div className="flex flex-1 flex-col pt-3">
        {/* Marca & Paleta de Cores */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            {product.brand}
          </span>
          {colors.length > 0 && (
            <div className="flex items-center gap-1">
              {colors.slice(0, 4).map((c) => (
                <span
                  key={c.color}
                  title={c.color}
                  className="h-2.5 w-2.5 rounded-full border border-neutral-300 shadow-xs"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Nome do Produto */}
        <h3 className="mt-1 font-display text-sm sm:text-base font-bold leading-tight text-neutral-900 line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Saúde da bateria (caso seminovo) */}
        {isSeminovo && (
          <div className="mt-1 flex items-center gap-1 text-xs text-neutral-500 font-medium">
            <BatteryCharging className="h-3.5 w-3.5 text-neutral-400" />
            <span>Bateria {batteryHealth ? `${batteryHealth}` : "90%+"}</span>
          </div>
        )}

        {/* Bloco de Preço */}
        <div className="mt-auto pt-3">
          {price != null ? (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-neutral-950">
                  {formatBRL(price)}
                </span>
                <span className="rounded-full bg-[#e8f2ff] px-2 py-0.5 text-[11px] font-bold text-[#0066cc]">
                  12% OFF no Pix
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                no Pix · ou 12x de{" "}
                <span className="font-semibold text-neutral-800">
                  {formatBRL(installment12 ?? 0)}
                </span>{" "}
                sem juros
              </p>
            </>
          ) : (
            <p className="text-xs text-neutral-400 font-medium">Indisponível no momento</p>
          )}

          {/* Botão Azul Adicionar */}
          <div className="mt-3">
            <span className="w-full rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white py-2.5 px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-xs">
              <Plus className="h-4 w-4" />
              <span>Adicionar</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
