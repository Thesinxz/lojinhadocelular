import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Search, ArrowUpDown, RefreshCw, AlertCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import ProductCard from "@/components/ProductCard";
import { useShopSettings, sortProducts, type SortOption } from "@/lib/shop";
import { CATEGORIES, BRANDS } from "@contracts/types";

import SEO from "@/components/SEO";

type CategoryType = "iphone_lacrado" | "iphone_seminovo" | "android" | "acessorio";

export default function Catalogo() {
  const s = useShopSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaRaw = searchParams.get("categoria") ?? "";
  const categoria = (
    ["iphone_lacrado", "iphone_seminovo", "android", "acessorio"].includes(categoriaRaw)
      ? categoriaRaw
      : undefined
  ) as CategoryType | undefined;

  const [brand, setBrand] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("relevancia");

  const query = trpc.shop.products.useQuery(
    {
      ...(categoria ? { category: categoria } : {}),
      ...(brand ? { brand } : {}),
    },
    { staleTime: 1000 * 30 },
  );

  const products = useMemo(() => {
    const list = query.data ?? [];
    let filtered = list;
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = list.filter(
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
    }
    return sortProducts(filtered, sortBy);
  }, [query.data, search, sortBy]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <SEO
        title="Catálogo de Celulares e iPhones — Jardim-MS e Guia Lopes"
        description="Confira nosso estoque de iPhones lacrados, seminovos revisados com garantia, Xiaomi, Realme, Tecno e acessórios na Lojinha do Celular."
      />
      <h1 className="font-display text-3xl font-bold text-ink">Catálogo</h1>
      <p className="mt-1 text-neutral-600">
        Estoque atualizado das duas unidades. Toque no produto para ver versões, cores e preços.
      </p>

      {/* Busca e Ordenação */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-xl border-2 border-ink bg-white px-4 py-3 shadow-[3px_3px_0_0_#141414]">
          <Search className="h-5 w-5 text-neutral-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por modelo, cor, armazenamento..."
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-neutral-400"
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-2.5 shadow-[3px_3px_0_0_#141414] shrink-0">
          <ArrowUpDown className="h-4 w-4 text-ink" />
          <span className="text-xs font-bold text-neutral-500">Ordem:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-transparent text-xs font-bold text-ink outline-none cursor-pointer"
          >
            <option value="relevancia">⭐ Lançamentos & Lacrados primeiro</option>
            <option value="modelo_recente">📱 Modelo mais recente (16 ➔ 15 ➔ 14)</option>
            <option value="lacrados_primeiro">✨ Todos os Lacrados primeiro</option>
            <option value="menor_preco">💲 Menor Preço</option>
            <option value="maior_preco">💰 Maior Preço</option>
          </select>
        </div>
      </div>

      {/* Filtros de categoria */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip
          active={!categoria}
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

      {/* Estados do Grid: Loading, Erro, Vazio e Sucesso */}
      {query.isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-neutral-200" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="mt-12 rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-[4px_4px_0_0_#141414]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink bg-brand">
            <AlertCircle className="h-6 w-6 text-ink" />
          </div>
          <h2 className="mt-3 font-display text-lg font-bold text-ink">
            Não foi possível carregar os produtos
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Verifique sua conexão ou tente recarregar os dados.
          </p>
          <button
            onClick={() => query.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-ink px-5 py-2.5 font-display text-sm font-bold text-brand shadow-[2px_2px_0_0_rgba(20,20,20,0.3)] hover:-translate-y-0.5 transition"
          >
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
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
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              installmentsMax={s.installmentsMax}
              fees={s.fees}
              priority={i < 6}
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
      className={`shrink-0 inline-flex items-center justify-center rounded-full border-2 border-ink font-semibold transition active:scale-95 ${
        small ? "min-h-[36px] px-3 py-1 text-xs" : "min-h-[42px] px-4 py-2 text-sm"
      } ${active ? "bg-ink text-brand" : "bg-white text-ink hover:bg-brand"}`}
    >
      {label}
    </button>
  );
}
