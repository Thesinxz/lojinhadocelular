import { Link } from "react-router";
import { X } from "lucide-react";
import { trpc, type ProductWithVariants } from "@/providers/trpc";
import { useCompare } from "@/lib/compare";
import { useShopSettings, minPrice, availableColors, optimizeImageUrl } from "@/lib/shop";
import { resolveProductImage } from "@/lib/iphoneCatalog";
import { formatBRL } from "@contracts/types";
import SEO from "@/components/SEO";

const UNIT_LABEL: Record<string, string> = {
  jardim: "Jardim",
  guia_lopes: "Guia Lopes",
  ambas: "Jardim e Guia Lopes",
};

function batteryOf(p: ProductWithVariants): string {
  const raw = p.variants.find((v) => v.batteryHealth)?.batteryHealth;
  if (!raw) return "—";
  return raw.includes("%") ? raw : `${raw.replace(/\D/g, "")}%`;
}

export default function Comparar() {
  const s = useShopSettings();
  const { ids, remove, clear } = useCompare();
  const query = trpc.shop.products.useQuery(undefined, { staleTime: 1000 * 30 });

  const all = (query.data ?? []) as ProductWithVariants[];
  const products = ids
    .map((id) => all.find((p) => String(p.id) === id))
    .filter((p): p is ProductWithVariants => !!p);

  const rows: { label: string; render: (p: ProductWithVariants) => string }[] = [
    {
      label: "Preço no Pix",
      render: (p) => {
        const price = minPrice(p);
        return price != null ? `a partir de ${formatBRL(price)}` : "Indisponível";
      },
    },
    { label: "Condição", render: (p) => (p.condition === "lacrado" ? "Lacrado" : "Seminovo") },
    {
      label: "Capacidades",
      render: (p) => [...new Set(p.variants.filter((v) => v.available).map((v) => v.storage))].filter(Boolean).join(", ") || "—",
    },
    {
      label: "Cores",
      render: (p) => availableColors(p).map((c) => c.color).join(", ") || "—",
    },
    { label: "Bateria", render: batteryOf },
    { label: "Garantia", render: (p) => p.warranty || "—" },
    { label: "Loja", render: (p) => UNIT_LABEL[p.unitAvailability ?? ""] ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SEO title="Comparar aparelhos" description="Compare iPhones e celulares lado a lado na Lojinha do Celular." />
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
            Comparar aparelhos
          </h1>
          <p className="text-xs text-neutral-500 sm:text-sm">Veja preço, capacidade, bateria e garantia lado a lado.</p>
        </div>
        {products.length > 0 && (
          <button onClick={clear} className="cursor-pointer text-xs font-semibold text-[#0066cc] underline underline-offset-4">
            Limpar
          </button>
        )}
      </div>

      {query.isLoading ? (
        <div className="mt-8 h-64 animate-pulse rounded-3xl bg-neutral-100" />
      ) : products.length < 2 ? (
        <div className="mt-8 rounded-3xl border border-neutral-200/80 bg-white p-10 text-center shadow-sm">
          <p className="font-display text-lg font-bold text-neutral-900">Escolha pelo menos 2 aparelhos</p>
          <p className="mt-1 text-sm text-neutral-500">Use o botão "Comparar" nos cards da vitrine.</p>
          <Link to="/#vitrine" className="mt-5 inline-block rounded-full bg-[#0071e3] px-6 py-2.5 text-sm font-semibold text-white">
            Voltar à vitrine
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[560px] table-fixed text-left text-sm">
            <thead>
              <tr>
                <th className="w-28 p-4 sm:w-36" />
                {products.map((p) => {
                  const img = optimizeImageUrl(resolveProductImage(p.name, p.imageUrl, availableColors(p)[0]?.color), 320, 85);
                  return (
                    <th key={p.id} className="relative p-4 align-top">
                      <button
                        onClick={() => remove(p.id)}
                        aria-label={`Remover ${p.name}`}
                        className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <Link to={`/produto/${p.id}`} className="block">
                        {img && <img src={img} alt={p.name} className="mx-auto h-32 w-full object-contain" />}
                        <span className="mt-2 block font-display text-sm font-bold leading-tight text-neutral-900">{p.name}</span>
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-neutral-100">
                  <td className="p-4 text-xs font-bold uppercase tracking-wide text-neutral-400">{row.label}</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 font-medium text-neutral-800">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-center text-[11px] text-neutral-400">
        Valores à vista no Pix. Parcelamento em até {s.installmentsMax}x na finalização.
      </p>
    </div>
  );
}
