import { ERP_APP_URL, erpProductUrl } from "@/lib/erpLinks";
import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Package,
  RefreshCw,
  Search,
  ExternalLink,
  Flame,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatBRL, CATEGORIES } from "@contracts/types";
import { minPrice } from "@/lib/shop";
import { useAdminSession } from "@/lib/adminSession";
import { createProductShareSlug } from "@/lib/productUrls";
import type { ShopProduct } from "../../../api/erp/types";
import {
  computeCatalogIssues,
  type CatalogIssueProduct,
  type CatalogIssues,
} from "@contracts/catalogIssues";
import {
  ADMIN_PRODUCTS_BATCH_SIZE,
  type AdminProductStatusFilter,
  applyOptimisticBulkProducts,
  applyOptimisticProductToggle,
  filterAdminProducts,
  sliceAdminBatch,
} from "@/lib/adminOptimistic";
import {
  prefetchAdminErpProductEditor,
  prefetchAdminProductEditor,
} from "@/lib/adminPrefetch";

const AdminProductEditor = lazy(() => import("@/components/admin/AdminProductEditor"));
const AdminErpProductEditor = lazy(() =>
  import("@/components/admin/AdminErpProductEditor").then((m) => ({
    default: m.AdminErpProductEditor,
  })),
);

/** Filtros vindos do dashboard (`/admin/produtos?filtro=...`). */
const ISSUE_FILTERS: { value: string; key: keyof CatalogIssues; label: string }[] = [
  { value: "sem-foto", key: "noPhoto", label: "produtos sem foto" },
  { value: "sem-bateria", key: "noBattery", label: "seminovos sem bateria informada" },
  { value: "esgotado-visivel", key: "soldOutVisible", label: "esgotados ainda visíveis" },
];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useAdminSession();
  const canManage = can("products.manage");
  const [editingErpProduct, setEditingErpProduct] = useState<ShopProduct | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminProductStatusFilter>("todos");
  const [visibleCount, setVisibleCount] = useState(ADMIN_PRODUCTS_BATCH_SIZE);

  const editingRaw = searchParams.get("editing");
  const editing: number | string | "novo" | null =
    editingRaw === "novo"
      ? canManage
        ? "novo"
        : null
      : editingRaw
        ? Number.isNaN(Number(editingRaw))
          ? editingRaw
          : Number(editingRaw)
        : null;

  function setEditing(val: number | string | "novo" | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val === null) {
          next.delete("editing");
        } else {
          next.set("editing", String(val));
        }
        return next;
      },
      { replace: true }
    );
  }

  const utils = trpc.useUtils();
  type AdminProductsCache = ReturnType<typeof utils.admin.products.getData>;
  type AdminProductListItem = NonNullable<AdminProductsCache>[number];
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const invalidateCatalog = () => {
    utils.admin.products.invalidate();
    utils.shop.products.invalidate();
    utils.shop.featured.invalidate();
  };

  function createOptimisticProductHandlers<TVars>(
    applyPatch: (
      items: readonly AdminProductListItem[] | undefined,
      vars: TVars,
    ) => AdminProductListItem[],
    onSettled = invalidateCatalog,
  ) {
    return {
      onMutate: async (vars: TVars) => {
        await utils.admin.products.cancel();
        const prev = utils.admin.products.getData();
        utils.admin.products.setData(
          undefined,
          (cur) => applyPatch(cur as readonly AdminProductListItem[] | undefined, vars) as typeof cur,
        );
        return { prev };
      },
      onError: (err: { message: string }, _vars: TVars, ctx: { prev: AdminProductsCache } | undefined) => {
        if (ctx?.prev !== undefined) {
          utils.admin.products.setData(undefined, ctx.prev);
        }
        toast.error(err.message);
      },
      onSettled,
    };
  }

  const bulkMutation = trpc.admin.bulkSetProducts.useMutation({
    ...createOptimisticProductHandlers(
      (cur, vars: { ids: (string | number)[]; active?: boolean; featured?: boolean }) =>
        applyOptimisticBulkProducts(cur, vars.ids, {
          ...(vars.active !== undefined ? { active: vars.active } : {}),
          ...(vars.featured !== undefined ? { featured: vars.featured } : {}),
        }),
      () => {
        utils.admin.products.invalidate();
      },
    ),
    onSuccess: (res) => {
      if (res.failed.length) toast.error(`${res.done} atualizados, ${res.failed.length} com erro.`);
      else toast.success(`${res.done} produto(s) atualizado(s).`);
      setSelectedKeys([]);
      utils.shop.products.invalidate();
      utils.shop.featured.invalidate();
      utils.shop.catalogStatus.invalidate();
    },
  });
  const toggleKey = (key: string) =>
    setSelectedKeys((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : cur.length >= 100 ? cur : [...cur, key]));

  const products = trpc.admin.products.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  });

  const catalogStatusQuery = trpc.shop.catalogStatus.useQuery(undefined, {
    staleTime: 1000 * 30,
  });

  const deleteProduct = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => {
      toast.success("Produto excluído.");
      utils.admin.products.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleActiveMutation = trpc.admin.toggleActive.useMutation(
    createOptimisticProductHandlers((cur, vars: { id: string | number; active: boolean }) =>
      applyOptimisticProductToggle(cur, vars.id, { active: vars.active }),
    ),
  );

  const toggleFeaturedMutation = trpc.admin.toggleFeatured.useMutation(
    createOptimisticProductHandlers((cur, vars: { id: string | number; featured: boolean }) =>
      applyOptimisticProductToggle(cur, vars.id, { featured: vars.featured }),
    ),
  );

  const refreshErpMutation = trpc.admin.refreshErpCatalog.useMutation({
    onSuccess: () => {
      toast.success("Catálogo do ERP sincronizado.");
      utils.admin.products.invalidate();
      utils.shop.products.invalidate();
      utils.shop.catalogStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // ===== EDITOR ABERTO =====
  if (editing !== null) {
    return (
      <div className="mx-auto max-w-4xl">
        <Suspense
          fallback={
            <div className="space-y-4 rounded-2xl border border-[#e5e5e7] bg-white p-6">
              <div className="h-6 w-48 animate-pulse rounded-lg bg-[#f5f5f7]" />
              <div className="h-44 animate-pulse rounded-xl bg-[#f5f5f7]" />
            </div>
          }
        >
          <AdminProductEditor
            productId={typeof editing === "number" ? editing : null}
            onClose={() => {
              setEditing(null);
              utils.admin.products.invalidate();
            }}
          />
        </Suspense>
      </div>
    );
  }

  // ===== LISTA =====
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#86868b]">
          Gerencie o catálogo de produtos, fotos, vídeos e visibilidade na vitrine.
        </p>
        {canManage && (
          <button
            onClick={() => setEditing("novo")}
            onMouseEnter={prefetchAdminProductEditor}
            onFocus={prefetchAdminProductEditor}
            onTouchStart={prefetchAdminProductEditor}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1d1d1f] px-5 font-display text-sm font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Adicionar produto
          </button>
        )}
      </div>

      <div>
          {catalogStatusQuery.data?.erpEnabled && (
            <div
              className={`mb-5 rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs transition-all ${
                catalogStatusQuery.data.status === "ok"
                  ? "border-blue-200 bg-blue-50/80"
                  : catalogStatusQuery.data.status === "offline"
                    ? "border-amber-300 bg-amber-50/90"
                    : "border-red-200 bg-red-50/90"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    catalogStatusQuery.data.status === "ok"
                      ? "bg-blue-100 text-blue-700"
                      : catalogStatusQuery.data.status === "offline"
                        ? "bg-amber-200 text-amber-900"
                        : "bg-red-200 text-red-900"
                  }`}
                >
                  <RefreshCw
                    className={`h-5 w-5 ${
                      refreshErpMutation.isPending ? "animate-spin" : ""
                    }`}
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-neutral-900">
                      Gestão Celular ERP
                    </h3>
                    {catalogStatusQuery.data.status === "ok" ? (
                      <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        🟢 Conectado ({catalogStatusQuery.data.count} aparelhos)
                      </span>
                    ) : catalogStatusQuery.data.status === "offline" ? (
                      <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        🟡 Offline / Sincronizando
                      </span>
                    ) : catalogStatusQuery.data.status === "empty" ? (
                      <span className="rounded-full bg-slate-100 border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        ⚪ Estoque vazio
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-800">
                        🔴 Configuração Pendente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-700 mt-1 max-w-2xl leading-relaxed">
                    {catalogStatusQuery.data.status === "ok" ? (
                      <>
                        Estoque e preços lidos oficialmente do ERP. Personalize <strong>fotos reais</strong>, <strong>vídeos</strong>, <strong>saúde da bateria</strong> ou <strong>destaque</strong> abaixo.
                      </>
                    ) : catalogStatusQuery.data.status === "empty" ? (
                      "A API do ERP respondeu corretamente, mas não há aparelhos disponíveis para exibir no momento."
                    ) : (
                      <>
                        {catalogStatusQuery.data.message || "Tentando comunicação com a API do ERP."}
                        <br />
                        <span className="text-[11px] text-neutral-500 font-mono">
                          Certifique-se de configurar: ERP_API_URL=https://api.gestaocelular.com.br e ERP_STORE_SLUG no servidor.
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={refreshErpMutation.isPending}
                  onClick={() => refreshErpMutation.mutate()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 px-3.5 py-2 text-xs font-semibold shadow-2xs transition active:scale-95 disabled:opacity-50"
                  title="Limpa o cache e consulta o ERP novamente"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshErpMutation.isPending ? "animate-spin text-blue-600" : ""}`} />
                  <span>{refreshErpMutation.isPending ? "Sincronizando..." : "Sincronizar"}</span>
                </button>

                <a
                  href={ERP_APP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white px-3.5 py-2 text-xs font-semibold shadow-2xs transition active:scale-95"
                >
                  Painel ERP ↗
                </a>
              </div>
            </div>
          )}

          {/* Barra de Busca e Filtros de Status */}
          {(() => {
            const allProducts = (products.data ?? []) as readonly AdminProductListItem[];

            const issueFilter = ISSUE_FILTERS.find((f) => f.value === searchParams.get("filtro")) ?? null;
            const issueIds = issueFilter
              ? new Set(
                  computeCatalogIssues(allProducts as unknown as CatalogIssueProduct[])[issueFilter.key].map(
                    (item) => item.id,
                  ),
                )
              : null;
            const clearIssueFilter = () => {
              const next = new URLSearchParams(searchParams);
              next.delete("filtro");
              setSearchParams(next, { replace: true });
              setVisibleCount(ADMIN_PRODUCTS_BATCH_SIZE);
            };

            const { filtered, counts } = filterAdminProducts(allProducts, {
              issueIds,
              statusFilter,
              search: productSearch,
            });
            const displayed = sliceAdminBatch(filtered, visibleCount);

            return (
              <>
                {issueFilter && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    <span className="font-semibold">
                      Mostrando: {issueFilter.label} ({issueIds?.size ?? 0})
                    </span>
                    <button
                      type="button"
                      onClick={clearIssueFilter}
                      className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 font-semibold transition hover:bg-amber-100"
                    >
                      Limpar filtro ✕
                    </button>
                  </div>
                )}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setVisibleCount(ADMIN_PRODUCTS_BATCH_SIZE);
                      }}
                      placeholder="Buscar por modelo, cor, capacidade ou SKU..."
                      className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-10 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductSearch("");
                          setVisibleCount(ADMIN_PRODUCTS_BATCH_SIZE);
                        }}
                        aria-label="Limpar busca"
                        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("todos");
                        setVisibleCount(ADMIN_PRODUCTS_BATCH_SIZE);
                      }}
                      className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                        statusFilter === "todos"
                          ? "bg-neutral-900 text-white shadow-xs"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      Todos ({counts.all})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("visiveis");
                        setVisibleCount(ADMIN_PRODUCTS_BATCH_SIZE);
                      }}
                      className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                        statusFilter === "visiveis"
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      Visíveis ({counts.visible})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("ocultos");
                        setVisibleCount(ADMIN_PRODUCTS_BATCH_SIZE);
                      }}
                      className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                        statusFilter === "ocultos"
                          ? "bg-neutral-700 text-white shadow-xs"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      Ocultos ({counts.hidden})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("destaques");
                        setVisibleCount(ADMIN_PRODUCTS_BATCH_SIZE);
                      }}
                      className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                        statusFilter === "destaques"
                          ? "bg-red-600 text-white shadow-xs"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      🔥 Promoções ({counts.featured})
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {products.isLoading &&
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#f5f5f7] border border-[#e5e5e7]" />
                    ))}

                  {products.isError && !products.error.message.includes("UNAUTHORIZED") && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                      <p className="font-semibold text-red-700">Erro ao carregar produtos do servidor.</p>
                      <button
                        onClick={() => products.refetch()}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] shadow-xs hover:bg-[#f5f5f7]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
                      </button>
                    </div>
                  )}

                  {filtered.length === 0 && !products.isLoading && (
                    <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-xs text-[#86868b]">
                      Nenhum produto encontrado com os filtros selecionados.
                      <button
                        onClick={() => products.refetch()}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-4 py-2 text-xs font-semibold text-[#1d1d1f] shadow-xs hover:bg-[#f5f5f7]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
                      </button>
                    </div>
                  )}

                  {filtered.length > 0 && (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 px-1 text-xs font-semibold text-[#6e6e73]">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={
                          filtered.length > 0 &&
                          filtered.slice(0, 100).every((p) => {
                            const isErp = (p as unknown as { source?: string }).source === "erp";
                            return selectedKeys.includes(String(isErp ? (p as unknown as ShopProduct).externalId || p.id : p.id));
                          })
                        }
                        onChange={(e) =>
                          setSelectedKeys(
                            e.target.checked
                              ? filtered.slice(0, 100).map((p) => {
                                  const isErp = (p as unknown as { source?: string }).source === "erp";
                                  return String(isErp ? (p as unknown as ShopProduct).externalId || p.id : p.id);
                                })
                              : [],
                          )
                        }
                      />
                      Selecionar todos os exibidos (máx. 100)
                    </label>
                  )}

                  {displayed.map((p) => {
                    const price = minPrice(p);
                    const isErpProduct = (p as unknown as { source?: string }).source === "erp";
                    const productIdOrExternal = isErpProduct
                      ? (p as unknown as ShopProduct).externalId || String(p.id)
                      : p.id;
                    const rowKey = String(productIdOrExternal);
                    const prefetchEditor = isErpProduct ? prefetchAdminErpProductEditor : prefetchAdminProductEditor;

                    return (
                      <div
                        key={p.id}
                        onMouseEnter={prefetchEditor}
                        onTouchStart={prefetchEditor}
                        onClick={() => {
                          if (isErpProduct) {
                            setEditingErpProduct(p as unknown as ShopProduct);
                          } else {
                            setEditing(p.id);
                          }
                        }}
                        className={`group flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 shadow-2xs transition-all sm:flex-row sm:items-center sm:gap-4 ${
                          p.active !== false
                            ? "border-[#e5e5e7] bg-white hover:border-neutral-400 hover:shadow-xs"
                            : "border-dashed border-neutral-300 bg-neutral-50/80 opacity-75 hover:opacity-100 hover:border-neutral-400"
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${p.name}`}
                            className="mt-1 h-4 w-4 shrink-0 sm:mt-0"
                            checked={selectedKeys.includes(rowKey)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleKey(rowKey)}
                          />
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-14 w-14 shrink-0 rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] object-contain p-1 sm:h-16 sm:w-16"
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] text-[11px] font-medium text-[#86868b] sm:h-16 sm:w-16 sm:text-xs">
                              Sem foto
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 font-display text-sm font-semibold text-[#1d1d1f] group-hover:text-black sm:truncate sm:text-base">
                              {p.name}
                            </p>
                            <p className="mt-0.5 text-xs text-[#86868b]">
                              {CATEGORIES.find((c) => c.value === p.category)?.label} •{" "}
                              {p.variants.length} variante(s)
                              {price != null ? ` • a partir de ${formatBRL(price)}` : ""}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {/* Botão de Toggle Rápido de Visibilidade */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleActiveMutation.mutate({
                                    id: productIdOrExternal,
                                    active: p.active === false,
                                  });
                                }}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition active:scale-95 ${
                                  p.active !== false
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100"
                                    : "border-neutral-300 bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                                }`}
                                title={p.active !== false ? "Clique para ocultar da vitrine" : "Clique para reativar na vitrine"}
                              >
                                {p.active !== false ? (
                                  <>
                                    <Eye className="h-3 w-3" /> Visível
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="h-3 w-3" /> Oculto (Clique para ativar)
                                  </>
                                )}
                              </button>

                              {/* Botão de Toggle Rápido de Promoção / Destaque (somente dono) */}
                              {canManage ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFeaturedMutation.mutate({
                                    id: productIdOrExternal,
                                    featured: !p.featured,
                                  });
                                }}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition active:scale-95 ${
                                  p.featured
                                    ? "border-red-300 bg-red-50 text-red-700 shadow-2xs hover:bg-red-100"
                                    : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                                }`}
                                title={
                                  p.featured
                                    ? "Aparelho em PROMOÇÃO! Clique para remover da promoção"
                                    : "Clique para colocar este aparelho em PROMOÇÃO (exibe selo vermelho e sobe na vitrine)"
                                }
                              >
                                <Flame
                                  className={`h-3 w-3 ${
                                    p.featured ? "fill-red-600 text-red-600" : "text-neutral-400"
                                  }`}
                                />
                                {p.featured ? "🔥 Em Promoção" : "☆ Ativar Promoção"}
                              </button>
                              ) : (
                                p.featured && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-700">
                                    <Flame className="h-3 w-3 fill-red-600 text-red-600" /> Em Promoção
                                  </span>
                                )
                              )}
                              {(() => {
                                const b = p.variants?.[0]?.batteryHealth || (p as { batteryHealth?: string | null })?.batteryHealth;
                                if (!b) return null;
                                return (
                                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    🔋 {b.includes("%") ? b : `${b.replace(/\D/g, "")}%`}
                                  </span>
                                );
                              })()}
                              {(p.videoUrl || p.variants?.[0]?.videoUrl) && (
                                <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                                  🎥 Vídeo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isErpProduct ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onMouseEnter={prefetchAdminErpProductEditor}
                                onFocus={prefetchAdminErpProductEditor}
                                onClick={() => setEditingErpProduct(p as unknown as ShopProduct)}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-black active:scale-95"
                                title="Editar foto, vídeo, bateria e detalhes da vitrine"
                              >
                                <Pencil className="h-3.5 w-3.5 text-amber-400" />
                                Editar Vitrine
                              </button>
                              <a
                                href={erpProductUrl((p as { externalId?: string }).externalId ?? String(p.id))}
                                target="_blank"
                                rel="noreferrer"
                                className="flex min-h-10 items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/60 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                title="Abrir este produto no Gestão Celular ERP"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                ERP
                              </a>
                              <a
                                href={`/produto/${createProductShareSlug(p.name, p.id)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex min-h-10 items-center rounded-xl border border-[#e5e5e7] bg-white px-3 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
                              >
                                Vitrine ↗
                              </a>
                            </div>
                          ) : (
                            <>
                              <button
                                onMouseEnter={prefetchAdminProductEditor}
                                onFocus={prefetchAdminProductEditor}
                                onClick={() => setEditing(p.id)}
                                className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[#e5e5e7] bg-white p-2.5 text-[#1d1d1f] shadow-2xs transition hover:border-[#0071e3] hover:bg-blue-50/50 hover:text-[#0071e3]"
                                aria-label="Editar"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {canManage && (
                              <button
                                onClick={() => {
                                  if (confirm(`Excluir "${p.name}"? Essa ação não pode ser desfeita.`)) {
                                    deleteProduct.mutate({ id: p.id as number });
                                  }
                                }}
                                className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[#e5e5e7] bg-white p-2.5 text-neutral-400 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                aria-label="Excluir"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filtered.length > displayed.length && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((c) => c + ADMIN_PRODUCTS_BATCH_SIZE)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-5 text-xs font-semibold text-[#1d1d1f] shadow-2xs transition hover:bg-[#f5f5f7]"
                      >
                        Ver mais produtos ({filtered.length - displayed.length} restante(s))
                      </button>
                    </div>
                  )}

                  {!products.isLoading && !products.isError && filtered.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-[#e5e5e7] bg-[#fbfbfd] p-12 text-center">
                      <Package className="mx-auto h-8 w-8 text-neutral-400" />
                      <p className="mt-3 text-sm font-semibold text-[#1d1d1f]">Nenhum produto encontrado</p>
                      <p className="mt-1 text-xs text-[#86868b]">Tente ajustar a busca ou o filtro de status selecionado.</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
      </div>

      {selectedKeys.length > 0 && (
        <div
          role="region"
          aria-label="Ações em lote"
          className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5e5e7] bg-white p-3 shadow-lg lg:bottom-3"
        >
          <strong className="mr-1 text-sm text-[#1d1d1f]">{selectedKeys.length} selecionado(s)</strong>
          <button
            type="button"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: selectedKeys, active: true })}
            className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 disabled:opacity-50"
          >
            Mostrar na vitrine
          </button>
          <button
            type="button"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: selectedKeys, active: false })}
            className="min-h-11 rounded-xl border border-neutral-300 bg-neutral-100 px-3 text-xs font-semibold text-neutral-700 disabled:opacity-50"
          >
            Ocultar
          </button>
          {canManage && (
            <>
              <button
                type="button"
                disabled={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ ids: selectedKeys, featured: true })}
                className="min-h-11 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 disabled:opacity-50"
              >
                Destacar
              </button>
              <button
                type="button"
                disabled={bulkMutation.isPending}
                onClick={() => bulkMutation.mutate({ ids: selectedKeys, featured: false })}
                className="min-h-11 rounded-xl border border-[#e5e5e7] px-3 text-xs font-semibold text-[#6e6e73] disabled:opacity-50"
              >
                Tirar destaque
              </button>
            </>
          )}
          <button type="button" onClick={() => setSelectedKeys([])} className="ml-auto min-h-11 px-2 text-xs font-semibold text-[#6e6e73]">
            Limpar
          </button>
        </div>
      )}

      {editingErpProduct && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#1d1d1f] shadow-lg">
                Carregando editor...
              </div>
            </div>
          }
        >
          <AdminErpProductEditor
            product={editingErpProduct}
            onClose={() => setEditingErpProduct(null)}
            onSaved={() => {
              setEditingErpProduct(null);
              products.refetch();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
