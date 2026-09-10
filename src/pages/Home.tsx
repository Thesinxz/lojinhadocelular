import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Search,
  ArrowUpDown,
  MessageCircle,
  MapPin,
  Wrench,
  Smartphone,
  ArrowRight,
  WifiOff,
  AlertCircle,
  PackageOpen,
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
  { label: "iPhones", value: "iphone_lacrado" },
  { label: "Seminovos", value: "iphone_seminovo" },
  { label: "Android", value: "android" },
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

  const catalogStatusQuery = trpc.shop.catalogStatus.useQuery(undefined, {
    staleTime: 1000 * 30,
  });

  const isErpEnabled = !!catalogStatusQuery.data?.erpEnabled;
  const catalogStatus = catalogStatusQuery.data?.status;

  // Requisito 8: Quando ERP_CATALOG_ENABLED=true, não misturar DEMO_PRODUCTS na vitrine pública
  const allProducts = useMemo(() => {
    const dbList = (productsQuery.data ?? []) as ProductWithVariants[];
    if (isErpEnabled) {
      return dbList;
    }

    const dbIds = new Set(dbList.map((p) => p.id));
    const dbNames = new Set(dbList.map((p) => p.name.trim().toLowerCase()));

    const demoList = (DEMO_PRODUCTS as unknown as ProductWithVariants[]).filter(
      (p) => !dbIds.has(p.id) && !dbNames.has(p.name.trim().toLowerCase()),
    );

    return [...dbList, ...demoList];
  }, [productsQuery.data, isErpEnabled]);

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
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f]">
      <SEO
        title="Lojinha do Celular — Vitrine de iPhones e Celulares em Jardim-MS"
        description="iPhones lacrados e seminovos com 1 ano de garantia, pronta entrega e assistência técnica especializada em Jardim e Guia Lopes da Laguna."
      />

      {/* 1. HERO COM VÍDEO E PROVA SOCIAL */}
      <HeroBlk />

      {/* 2. SEÇÃO VITRINE INTEGRADA (CLEAN / LIGHT) */}
      <section id="vitrine" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        <div className="flex flex-col gap-4">
          {/* Cabeçalho da Seção */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
                Vitrine de Produtos
              </h2>
              <p className="text-xs text-neutral-500 sm:text-sm">
                Aparelhos selecionados à pronta entrega com garantia e procedência verificada.
              </p>
            </div>
            <span className="text-xs text-neutral-400 font-medium">
              {filteredProducts.length} {filteredProducts.length === 1 ? "produto disponível" : "produtos disponíveis"}
            </span>
          </div>

          {/* Controles de Busca e Ordenação no estilo BLK Store */}
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Campo de Busca com fundo cinza claro arredondado */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar na loja"
                className="w-full rounded-full border border-transparent bg-[#f5f5f7] py-3.5 pl-11 pr-4 text-sm text-[#1d1d1f] placeholder:text-neutral-400 outline-none transition-all duration-200 focus:border-[#0071e3] focus:bg-white focus:ring-4 focus:ring-[#0071e3]/15"
              />
            </div>

            {/* Seletor de Ordenação */}
            <div className="relative flex items-center shrink-0">
              <ArrowUpDown className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-neutral-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-full border border-transparent bg-[#f5f5f7] py-3.5 pl-9 pr-6 text-xs font-semibold text-neutral-800 outline-none cursor-pointer transition-all duration-200 hover:bg-neutral-200/70 focus:border-[#0071e3] focus:bg-white focus:ring-4 focus:ring-[#0071e3]/15"
              >
                <option value="relevancia">Lançamentos / Relevância</option>
                <option value="menor_preco">Menor Preço</option>
                <option value="maior_preco">Maior Preço</option>
                <option value="modelo_recente">Modelo Recente</option>
              </select>
            </div>
          </div>

          {/* Pílulas de Categoria (Chips exatamente como na BLK Store) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_PILLS.map((pill) => {
              const isActive = selectedCategory === pill.value;
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setSelectedCategory(pill.value)}
                  className={`shrink-0 cursor-pointer rounded-full px-5 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-[#1d1d1f] text-white shadow-sm"
                      : "bg-white border border-neutral-200/80 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Grid de Produtos ou Estado Vazio */}
          {filteredProducts.length === 0 ? (
            isErpEnabled && catalogStatus === "offline" ? (
              <div className="mt-8 rounded-3xl border border-amber-200/80 bg-amber-50/70 p-8 text-center sm:p-12 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <WifiOff className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-neutral-900 sm:text-xl">
                  Sincronização em atualização
                </h3>
                <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-neutral-600">
                  A comunicação em tempo real com nosso estoque físico está passando por manutenção preventiva.
                  Por segurança e para evitar informações desatualizadas, consulte nossos atendentes diretamente no WhatsApp.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <a
                    href={waLink(
                      whatsapp,
                      "Olá! Gostaria de consultar a lista de iPhones e celulares disponíveis na Lojinha do Celular hoje.",
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-xs sm:text-sm font-semibold text-white transition hover:bg-[#20ba59] shadow-sm"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Consultar estoque no WhatsApp</span>
                  </a>
                </div>
              </div>
            ) : isErpEnabled && catalogStatus === "config_error" ? (
              <div className="mt-8 rounded-3xl border border-blue-200/80 bg-blue-50/70 p-8 text-center sm:p-12 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-neutral-900 sm:text-xl">
                  Configuração do ERP pendente
                </h3>
                <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-neutral-600">
                  O catálogo está configurado para ler dados do ERP Gestão Celular, mas o identificador da loja (ERP_STORE_SLUG) ainda não foi preenchido no servidor.
                </p>
              </div>
            ) : isErpEnabled && (catalogStatus === "empty" || (allProducts.length === 0 && !search && !selectedCategory)) ? (
              <div className="mt-8 rounded-3xl border border-neutral-200/80 bg-white p-8 text-center sm:p-12 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600">
                  <PackageOpen className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-neutral-900 sm:text-xl">
                  Estoque em renovação
                </h3>
                <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-neutral-500">
                  Todos os aparelhos deste lote já foram vendidos ou reservados. Novos modelos chegam semanalmente em nossas lojas de Jardim e Guia Lopes!
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <a
                    href={waLink(
                      whatsapp,
                      "Olá! Gostaria de consultar os próximos iPhones que vão chegar na Lojinha do Celular.",
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-xs sm:text-sm font-semibold text-white transition hover:bg-[#20ba59] shadow-sm"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Encomendar no WhatsApp</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-neutral-200/80 bg-white p-8 text-center sm:p-12 shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-neutral-900 sm:text-xl">
                  Nenhum produto encontrado
                </h3>
                <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-neutral-500">
                  Não encontramos aparelhos com esses critérios. Fale conosco no WhatsApp para consultar novas entradas ou encomendar o seu!
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {(search || selectedCategory) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setSelectedCategory(undefined);
                      }}
                      className="cursor-pointer rounded-full border border-neutral-200 bg-neutral-100 px-5 py-2.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-200"
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
                    className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#20ba59] shadow-sm"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Consultar no WhatsApp</span>
                  </a>
                </div>
              </div>
            )
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
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

      {/* 3. BANNER DE TROCA / TRADE-IN (CLEAN) */}
      <section className="border-t border-neutral-100 bg-[#f5f5f7]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-900 shadow-sm border border-neutral-200/60">
              <Smartphone className="h-6 w-6 text-neutral-800" />
            </div>
            <div>
              <p className="font-display text-lg font-extrabold text-neutral-900 sm:text-xl">
                Seu aparelho usado vale desconto no novo.
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Faça uma pré-avaliação online em poucos minutos e use o valor na troca por outro celular com garantia.
              </p>
            </div>
          </div>
          <a
            href="https://trocafacil.lojinhadocelular.com"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-3 font-display text-sm font-semibold text-white transition hover:bg-neutral-800 shadow-sm"
          >
            Avaliar meu aparelho <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* 4. SERVIÇOS DE ASSISTÊNCIA TÉCNICA (CLEAN) */}
      <section id="servicos" className="border-t border-neutral-100 bg-white">
        <div className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#0066cc]">
                Assistência Especializada
              </span>
              <h2 className="mt-1 font-display text-2xl font-black text-neutral-900 md:text-3xl">
                Serviços de Manutenção
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Reparos em iPhone, Xiaomi, Realme, Tecno e outras marcas com peças de qualidade e agilidade.
              </p>
            </div>
            <a
              href={waLink(
                whatsapp,
                "Olá! Gostaria de fazer um orçamento de assistência técnica na Lojinha do Celular.",
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-full border border-neutral-200 bg-neutral-50 px-5 py-2.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-100 md:self-auto"
            >
              <Wrench className="h-4 w-4 text-neutral-600" />
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
                className="rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4 text-center text-xs sm:text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
              >
                {service}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. NOSSAS UNIDADES (CLEAN) */}
      <section id="unidades" className="border-t border-neutral-100 bg-[#fbfbfd]">
        <div className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
          <div className="text-center md:text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0066cc]">
              Lojas Físicas
            </span>
            <h2 className="mt-1 font-display text-2xl font-black text-neutral-900 md:text-3xl">
              Nossas Unidades
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
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
                className="flex flex-col justify-between rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <h3 className="font-display text-lg font-bold text-neutral-900">
                    {u.city}
                  </h3>
                  <p className="mt-2 flex items-start gap-2 text-sm text-neutral-500">
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
                      className="flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-center text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                    >
                      Ver no mapa
                    </a>
                  ) : null}
                  <a
                    href={`https://wa.me/${u.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-full bg-[#25D366] px-4 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-[#20ba59] shadow-sm"
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
