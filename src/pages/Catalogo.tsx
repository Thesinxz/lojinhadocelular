import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import ProductCard from "@/components/ProductCard";
import { useShopSettings } from "@/lib/shop";
import { CATEGORIES, BRANDS } from "@contracts/types";

export default function Catalogo() {
  const s = useShopSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoria = searchParams.get("categoria") ?? "";
  const [brand, setBrand] = useState("");
  const [search, setSearch] = useState("");

  const query = trpc.shop.products.useQuery(
    {
      ...(categoria ? { category: categoria } : {}),
      ...(brand ? { brand } : {}),
    },
    { staleTime: 1000 * 30 },
  );

  const products = useMemo(() => {
    const list = query.data ?? [];
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        p.variants.some(
          (v) =>
            v.storage.toLowerCase().includes(term) ||
            v.version.toLowerCase().includes(term) ||
            v.color.toLowerCase().includes(term),
        ),
    );
  }, [query.data, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-ink">Catálogo</h1>
      <p className="mt-1 text-neutral-600">
        Estoque atualizado das duas unidades. Toque no produto para ver versões, cores e preços.
      </p>

      {/* Busca */}
      <div className="mt-6 flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-4 py-3 shadow-[3px_3px_0_0_#141414]">
        <Search className="h-5 w-5 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por modelo, cor, armazenamento..."
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-neutral-400"
        />
      </div>

      {/* Filtros de categoria */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip
          active={categoria === ""}
          onClick={() => setSearchParams({})}
          label="Todos"
        />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c.value}
            active={categoria === c.value}
            onClick={() => setSearchParams({ categoria: c.value })}
            label={c.label}
          />
        ))}
      </div>

      {/* Filtros de marca */}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip small active={brand === ""} onClick={() => setBrand("")} label="Todas as marcas" />
        {BRANDS.map((b) => (
          <FilterChip key={b} small active={brand === b} onClick={() => setBrand(b)} label={b} />
        ))}
      </div>

      {/* Grid */}
      {query.isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-neutral-200" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="mt-16 rounded-2xl border-2 border-dashed border-neutral-300 p-12 text-center">
          <p className="font-display text-lg font-bold text-neutral-500">
            Nenhum produto encontrado
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            Tente outra busca ou fale com a gente no WhatsApp — pode ter chegado estoque novo!
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              installmentsMax={s.installmentsMax}
              fees={s.fees}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  small,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border-2 border-ink font-semibold transition ${
        small ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm"
      } ${active ? "bg-ink text-brand" : "bg-white text-ink hover:bg-brand"}`}
    >
      {label}
    </button>
  );
}
