import type React from "react";
import { Link } from "react-router";
import { X } from "lucide-react";
import { trpc, type ProductWithVariants } from "@/providers/trpc";
import { useCompare } from "@/lib/compare";
import {
  useShopSettings,
  minPrice,
  availableColors,
  optimizeImageUrl,
} from "@/lib/shop";
import { resolveProductImage, detectIphoneModel } from "@/lib/iphoneCatalog";
import { getIphoneSpecs, type IphoneSpecSheet } from "@/lib/iphoneSpecs";
import { PerformanceBar } from "@/components/SpecSheet";
import { formatBRL } from "@contracts/types";
import SEO from "@/components/SEO";
import { createProductShareSlug } from "@/lib/productUrls";

const UNIT_LABEL: Record<string, string> = {
  jardim: "Jardim",
  guia_lopes: "Guia Lopes",
  ambas: "Jardim e Guia Lopes",
};

function batteryOf(p: ProductWithVariants): string {
  const raw = p.variants.find(v => v.batteryHealth)?.batteryHealth;
  if (!raw) return "—";
  return raw.includes("%") ? raw : `${raw.replace(/\D/g, "")}%`;
}

function specsOf(p: ProductWithVariants): IphoneSpecSheet | null {
  return getIphoneSpecs(detectIphoneModel(p.name)?.name);
}

export default function Comparar() {
  const s = useShopSettings();
  const { ids, remove, clear } = useCompare();
  const query = trpc.shop.products.useQuery(undefined, {
    staleTime: 1000 * 30,
  });

  const all = (query.data ?? []) as ProductWithVariants[];
  const products = ids
    .map(id => all.find(p => String(p.id) === id))
    .filter((p): p is ProductWithVariants => !!p);

  const prices = products.map(p => minPrice(p));
  const lowestPrice = Math.min(...prices.filter((x): x is number => x != null));
  const perfs = products.map(p => specsOf(p)?.performance ?? 0);
  const bestPerf = Math.max(...perfs);

  const Tag = ({ children }: { children: React.ReactNode }) => (
    <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      {children}
    </span>
  );

  const rows: {
    label: string;
    render: (p: ProductWithVariants) => React.ReactNode;
  }[] = [
    {
      label: "Preço no Pix",
      render: p => {
        const price = minPrice(p);
        if (price == null) return "Indisponível";
        return (
          <>
            <span className="block">a partir de {formatBRL(price)}</span>
            {products.length > 1 && price === lowestPrice && (
              <Tag>Menor preço</Tag>
            )}
          </>
        );
      },
    },
    {
      label: "Condição",
      render: p => (p.condition === "lacrado" ? "Lacrado" : "Seminovo"),
    },
    {
      label: "Capacidades",
      render: p =>
        [...new Set(p.variants.filter(v => v.available).map(v => v.storage))]
          .filter(Boolean)
          .join(", ") || "—",
    },
    {
      label: "Cores",
      render: p =>
        availableColors(p)
          .map(c => c.color)
          .join(", ") || "—",
    },
    { label: "Bateria", render: batteryOf },
    { label: "Garantia", render: p => p.warranty || "—" },
    {
      label: "Loja",
      render: p => UNIT_LABEL[p.unitAvailability ?? ""] ?? "—",
    },
  ];

  const specRows: {
    label: string;
    render: (sp: IphoneSpecSheet) => React.ReactNode;
  }[] = [
    { label: "Processador", render: sp => sp.chip },
    {
      label: "Desempenho",
      render: sp => (
        <>
          <PerformanceBar level={sp.performance} />
          {products.length > 1 &&
            bestPerf > 0 &&
            sp.performance === bestPerf &&
            new Set(perfs).size > 1 && <Tag>Mais potente</Tag>}
        </>
      ),
    },
    { label: "Memória RAM", render: sp => sp.ram },
    { label: "Tela", render: sp => sp.screen },
    { label: "Câmeras traseiras", render: sp => sp.rearCamera },
    { label: "Câmera frontal", render: sp => sp.frontCamera },
    { label: "Bateria (vídeo)", render: sp => sp.battery },
    { label: "Conector", render: sp => sp.port },
    { label: "Destaque", render: sp => sp.highlight },
  ];
  const anySpecs = products.some(p => specsOf(p));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SEO
        title="Comparar aparelhos"
        description="Compare iPhones e celulares lado a lado na Lojinha do Celular."
      />
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
            Comparar aparelhos
          </h1>
          <p className="text-xs text-neutral-500 sm:text-sm">
            Veja preço, capacidade, bateria e garantia lado a lado.
          </p>
        </div>
        {products.length > 0 && (
          <button
            onClick={clear}
            className="cursor-pointer text-xs font-semibold text-[#0066cc] underline underline-offset-4"
          >
            Limpar
          </button>
        )}
      </div>

      {query.isLoading ? (
        <div className="mt-8 h-64 animate-pulse rounded-3xl bg-neutral-100" />
      ) : products.length < 2 ? (
        <div className="mt-8 rounded-3xl border border-neutral-200/80 bg-white p-10 text-center shadow-sm">
          <p className="font-display text-lg font-bold text-neutral-900">
            Escolha pelo menos 2 aparelhos
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Use o botão "Comparar" nos cards da vitrine.
          </p>
          <Link
            to="/#vitrine"
            className="mt-5 inline-block rounded-full bg-[#0071e3] px-6 py-2.5 text-sm font-semibold text-white"
          >
            Voltar à vitrine
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-3xl border border-neutral-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[560px] table-fixed text-left text-sm">
            <thead>
              <tr>
                <th className="w-28 p-4 sm:w-36" />
                {products.map(p => {
                  const img = optimizeImageUrl(
                    resolveProductImage(
                      p.name,
                      p.imageUrl,
                      availableColors(p)[0]?.color
                    ),
                    320,
                    85
                  );
                  return (
                    <th key={p.id} className="relative p-4 align-top">
                      <button
                        onClick={() => remove(p.id)}
                        aria-label={`Remover ${p.name}`}
                        className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <Link to={`/produto/${createProductShareSlug(p.name, p.id)}`} className="block">
                        {img && (
                          <img
                            src={img}
                            alt={p.name}
                            className="mx-auto h-32 w-full object-contain"
                          />
                        )}
                        <span className="mt-2 block font-display text-sm font-bold leading-tight text-neutral-900">
                          {p.name}
                        </span>
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-t border-neutral-100">
                  <td className="p-4 text-xs font-bold uppercase tracking-wide text-neutral-400">
                    {row.label}
                  </td>
                  {products.map(p => (
                    <td key={p.id} className="p-4 font-medium text-neutral-800">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
              {anySpecs && (
                <tr className="border-t border-neutral-100 bg-[#fbfbfd]">
                  <td
                    colSpan={products.length + 1}
                    className="px-4 py-3 text-xs font-black uppercase tracking-wide text-neutral-900"
                  >
                    Ficha técnica do modelo
                  </td>
                </tr>
              )}
              {anySpecs &&
                specRows.map(row => (
                  <tr key={row.label} className="border-t border-neutral-100">
                    <td className="p-4 text-xs font-bold uppercase tracking-wide text-neutral-400">
                      {row.label}
                    </td>
                    {products.map(p => {
                      const sp = specsOf(p);
                      return (
                        <td
                          key={p.id}
                          className="p-4 align-top font-medium text-neutral-800"
                        >
                          {sp ? row.render(sp) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-center text-[11px] text-neutral-400">
        Especificações do fabricante, valores aproximados. Aparelhos de outras
        marcas aparecem sem ficha técnica. Valores à vista no Pix. Parcelamento
        em até {s.installmentsMax}x na finalização.
      </p>
    </div>
  );
}
