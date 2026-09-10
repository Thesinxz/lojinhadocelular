import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router";
import {
  Search,
  ArrowUpDown,
  MessageCircle,
  MapPin,
  Wrench,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import HeroBlk from "@/components/HeroBlk";
import ProductCard from "@/components/ProductCard";
import SEO from "@/components/SEO";
import { trpc, type ProductWithVariants } from "@/providers/trpc";
import { useShopSettings, sortProducts, type SortOption, waLink } from "@/lib/shop";
import { DEMO_PRODUCTS } from "@/lib/catalogDemo";
import type { CategoryValue } from "@contracts/types";

const CATEGORY_PILLS: { label: string; value: CategoryValue | undefined }[] = [
  { label: "Todos", value: undefined },
  { label: "iPhones Lacrados", value: "iphone_lacrado" },
  { label: "iPhones Seminovos", value: "iphone_seminovo" },
  { label: "Xiaomi & Android", value: "android" },
  { label: "Acessórios", value: "acessorio" },
];

export default function Home() {
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";

  const [searchParams] = useSearchParams();
  const initialCategory = useMemo(() => {
    const c = searchParams.get("categoria");
    if (
      c === "iphone_lacrado" ||
      c === "iphone_seminovo" ||
      c === "android" ||
      c === "acessorio"
    ) {
      return c as CategoryValue;
    }
    return undefined;
  }, [searchParams]);

  const [selectedCategory, setSelectedCategory] = useState<CategoryValue | undefined>(
    initialCategory,
  );
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("relevancia");

  const productsQuery = trpc.shop.products.useQuery(undefined, {
    staleTime: 1000 * 30,
  });

  // Combina produtos do banco com DEMO_PRODUCTS sem duplicar ID ou Nome
  const allProducts = useMemo(() => {
    const dbList = (productsQuery.data ?? []) as ProductWithVariants[];
    const dbIds = new Set(dbList.map((p) => p.id));
    const dbNames = new Set(dbList.map((p) => p.name.trim().toLowerCase()));

    const demoList = (DEMO_PRODUCTS as unknown as ProductWithVariants[]).filter(
      (p) => !dbIds.has(p.id) && !dbNames.has(p.name.trim().toLowerCase()),
    );

    return [...dbList, ...demoList];
  }, [productsQuery.data]);

  // Filtra por categoria e termo de busca, e ordena
  const filteredProducts = useMemo(() => {
    let list = allProducts;

    if (selectedCategory) {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(
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

    return sortProducts(list, sortBy);
  }, [allProducts, selectedCategory, search, sortBy]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <SEO
        title="Lojinha do Celular — Vitrine de iPhones e Celulares em Jardim-MS"
        description="iPhones lacrados e seminovos com 1 ano de garantia, pronta entrega e assistência técnica especializada em Jardim e Guia Lopes da Laguna."
      />

      {/* 1. HERO COM VÍDEO E PROVA SOCIAL */}
      <HeroBlk />

      {/* 2. SEÇÃO VITRINE INTEGRADA */}
      <section id="vitrine" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        <div className="flex flex-col gap-4">
          {/* Cabeçalho da Seção */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Vitrine de Produtos
              </h2>
              <p className="text-xs text-neutral-400 sm:text-sm">
                Aparelhos selecionados à pronta entrega com 1 ano de garantia e procedência garantida.
              </p>
            </div>
            <span className="text-xs text-neutral-500 font-medium">
              {filteredProducts.length} {filteredProducts.length === 1 ? "produto disponível" : "produtos disponíveis"}
            </span>
          </div>

          {/* Controles de Busca e Ordenação */}
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por modelo, cor, capacidade..."
                className="w-full rounded-full border border-white/10 bg-[#141414] py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-white/30 focus:bg-[#18181b]"
              />
            </div>

            {/* Seletor de Ordenação */}
            <div className="relative flex items-center shrink-0">
              <ArrowUpDown className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-neutral-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-full border border-white/10 bg-[#141414] py-2.5 pl-9 pr-4 text-xs font-semibold text-white outline-none cursor-pointer hover:border-white/20 focus:border-white/30 focus:bg-[#18181b]"
              >
                <option value="relevancia" className="bg-[#141414] text-white">
                  Lançamentos / Relevância
                </option>
                <option value="menor_preco" className="bg-[#141414] text-white">
                  Menor Preço
                </option>
                <option value="maior_preco" className="bg-[#141414] text-white">
                  Maior Preço
                </option>
                <option value="modelo_recente" className="bg-[#141414] text-white">
                  Modelo Recente
                </option>
              </select>
            </div>
          </div>

          {/* Pílulas de Categoria (scroll suave no mobile) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_PILLS.map((pill) => {
              const isActive = selectedCategory === pill.value;
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setSelectedCategory(pill.value)}
                  className={`shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-white text-black font-semibold rounded-full px-4 py-1.5 text-xs sm:text-sm transition"
                      : "bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 hover:text-white rounded-full px-4 py-1.5 text-xs sm:text-sm transition"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Grid de Produtos ou Estado Vazio */}
          {filteredProducts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#141414] p-8 text-center sm:p-12">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-neutral-400">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-white sm:text-xl">
                Nenhum produto encontrado
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-neutral-400">
                Não encontramos aparelhos com os critérios de busca selecionados. Fale conosco no WhatsApp para consultar novas entradas ou encomendas!
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {(search || selectedCategory) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSelectedCategory(undefined);
                    }}
                    className="cursor-pointer rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                  >
                    Limpar filtros
                  </button>
                )}
                <a
                  href={waLink(
                    whatsapp,
                    search
                      ? `Olá! Estou procurando por "${search}" na Lojinha do Celular. Vocês têm em estoque ou previsão?`
                      : "Olá! Gostaria de consultar a disponibilidade de aparelhos na Lojinha do Celular.",
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2 text-xs font-semibold text-white transition hover:brightness-105"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Consultar no WhatsApp</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((p, i) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  installmentsMax={s.installmentsMax}
                  fees={s.fees}
                  priority={i < 4}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. BANNER DE TROCA / TRADE-IN */}
      <section className="border-t border-white/10 bg-[#0d0d0d]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-10 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-white sm:text-xl">
                Seu aparelho usado vale desconto no novo.
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                Faça uma pré-avaliação online em poucos minutos e use o valor na troca por outro celular.
              </p>
            </div>
          </div>
          <Link
            to="/avaliacao"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 font-display text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            Avaliar meu aparelho <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 4. SERVIÇOS DE ASSISTÊNCIA TÉCNICA */}
      <section id="servicos" className="border-t border-white/10 bg-[#0a0a0a] text-white">
        <div className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Assistência Especializada
              </span>
              <h2 className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">
                Serviços de Manutenção
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                Reparos em iPhone, Xiaomi, Realme, Tecno e outras marcas com peças de alta qualidade.
              </p>
            </div>
            <a
              href={waLink(
                whatsapp,
                "Olá! Gostaria de fazer um orçamento de assistência técnica na Lojinha do Celular.",
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 md:self-auto"
            >
              <Wrench className="h-4 w-4 text-neutral-300" />
              <span>Pedir orçamento</span>
            </a>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              "Troca de tela",
              "Troca de bateria",
              "Conector de carga",
              "Vidro traseiro",
              "Câmeras e lentes",
              "Placa e reparo avançado",
              "Películas e capinhas",
              "Diagnóstico gratuito",
            ].map((service) => (
              <div
                key={service}
                className="rounded-2xl border border-white/10 bg-[#141414] p-4 text-center text-xs sm:text-sm font-medium text-white transition hover:border-white/25 hover:bg-[#18181b]"
              >
                {service}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. NOSSAS UNIDADES */}
      <section id="unidades" className="border-t border-white/10 bg-[#0a0a0a] text-white">
        <div className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
          <div className="text-center md:text-left">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Lojas Físicas
            </span>
            <h2 className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">
              Nossas Unidades
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Visite nossas lojas em Jardim e Guia Lopes da Laguna para testar os aparelhos em mãos.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                city: "Jardim-MS",
                address: s.addressJardim || "Av. Duque de Caxias, 486 - Jardim/MS",
                maps: s.mapsJardim,
                whatsapp: s.whatsappJardim || whatsapp,
              },
              {
                city: "Guia Lopes da Laguna-MS",
                address: s.addressGll || "Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS",
                maps: s.mapsGll,
                whatsapp: s.whatsappGll || whatsapp,
              },
            ].map((u) => (
              <div
                key={u.city}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#141414] p-6 transition hover:border-white/20"
              >
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    {u.city}
                  </h3>
                  <p className="mt-2 flex items-start gap-2 text-sm text-neutral-400">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <span>{u.address}</span>
                  </p>
                </div>

                <div className="mt-6 flex gap-3">
                  {u.maps ? (
                    <a
                      href={u.maps}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-white/10"
                    >
                      Ver no mapa
                    </a>
                  ) : null}
                  <a
                    href={`https://wa.me/${u.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-full bg-[#25D366] px-4 py-2.5 text-center text-xs font-semibold text-white transition hover:brightness-105"
                  >
                    Falar com a loja
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
