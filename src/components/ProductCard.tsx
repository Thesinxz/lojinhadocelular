import { Link } from "react-router";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, type FeeTable } from "@contracts/types";
import { minPrice, availableColors } from "@/lib/shop";

export default function ProductCard({
  product,
  installmentsMax,
  fees,
}: {
  product: ProductWithVariants;
  installmentsMax: number;
  fees: FeeTable;
}) {
  const price = minPrice(product);
  const colors = availableColors(product);
  const fee = fees[String(installmentsMax)] ?? 0;
  const installment =
    price != null && installmentsMax > 1
      ? installmentFromFees(price, installmentsMax, fee)
      : null;

  return (
    <Link
      to={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_0_#141414] transition hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#141414]"
    >
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-300">
            Sem foto
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full border-2 border-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
            product.condition === "seminovo" ? "bg-white text-ink" : "bg-brand text-ink"
          }`}
        >
          {product.condition === "seminovo" ? "Seminovo" : product.condition === "lacrado" ? "Lacrado" : "Novo"}
        </span>
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
              <p className="text-xs text-neutral-500">a partir de</p>
              <p className="font-display text-xl font-bold text-ink">{formatBRL(price)}</p>
              {installment != null && (
                <p className="text-xs font-medium text-neutral-600">
                  ou {installmentsMax}x de {formatBRL(installment)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm font-semibold text-neutral-400">Indisponível no momento</p>
          )}
        </div>
      </div>
    </Link>
  );
}
