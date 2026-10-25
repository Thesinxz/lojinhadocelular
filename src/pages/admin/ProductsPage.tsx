import { ERP_APP_URL, erpProductUrl } from "@/lib/erpLinks";
import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatBRL, CATEGORIES } from "@contracts/types";
import { minPrice } from "@/lib/shop";
import { useAdminSession } from "@/lib/adminSession";
import { createProductShareSlug } from "@/lib/productUrls";
import AdminProductEditor from "@/components/admin/AdminProductEditor";
import { AdminErpProductEditor } from "@/components/admin/AdminErpProductEditor";
import type { ShopProduct } from "../../../api/erp/types";
import {
  computeCatalogIssues,
  type CatalogIssueProduct,
  type CatalogIssues,
} from "@contracts/catalogIssues";

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
  const [statusFilter, setStatusFilter] = useState<"todos" | "visiveis" | "ocultos" | "destaques">("todos");

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
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const bulkMutation = trpc.admin.bulkSetProducts.useMutation({
    onSuccess: (res) => {
      if (res.failed.length) toast.error(`${res.done} atualizados, ${res.failed.length} com erro.`);
      else toast.success(`${res.done} produto(s) atualizado(s).`);
      setSelectedKeys([]);
      utils.admin.products.invalidate();
      utils.shop.products.invalidate();
      utils.shop.featured.invalidate();
      utils.shop.catalogStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const toggleKey = (key: string) =>
    setSelectedKeys((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : cur.length >= 100 ? cur : [...cur, key]));

  const products = trpc.admin.products.useQuery(undefined, {
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

  const invalidateCatalog = () => {
    utils.admin.products.invalidate();
    utils.shop.products.invalidate();
    utils.shop.featured.invalidate();
  };

  const toggleActiveMutation = trpc.admin.toggleActive.useMutation({
    onSuccess: invalidateCatalog,
    onError: (err) => toast.error(err.message),
  });

  const toggleFeaturedMutation = trpc.admin.toggleFeatured.useMutation({
    onSuccess: invalidateCatalog,
    onError: (err) => toast.error(err.message),
  });

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
        <AdminProductEditor
          productId={typeof editing === "number" ? editing : null}
          onClose={() => {
            setEditing(null);
            utils.admin.products.invalidate();
          }}
        />
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
            const allProducts = products.data ?? [];
            const visibleCount = allProducts.filter((p) => p.active !== false).length;
            const hiddenCount = allProducts.filter((p) => p.active === false).length;
            const featuredCount = allProducts.filter((p) => p.featured).length;

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
            };

            const filtered = allProducts.filter((p) => {
              if (issueIds && !issueIds.has(String(p.id))) return false;
              if (statusFilter === "visiveis" && p.active === false) return false;
              if (statusFilter === "ocultos" && p.active !== false) return false;
              if (statusFilter === "destaques" && !p.featured) return false;

              if (productSearch.trim()) {
                const q = productSearch.toLowerCase().trim();
                const matchName = p.name.toLowerCase().includes(q);
                const matchCategory = p.category.toLowerCase().includes(q);
                const matchSku = p.variants.some((v) => (v.sku || "").toLowerCase().includes(q));
                const matchStorage = p.variants.some((v) => (v.storage || "").toLowerCase().includes(q));
                return matchName || matchCategory || matchSku || matchStorage;
              }
              return true;
            });

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
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar por modelo, cor, capacidade ou SKU..."
                      className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("todos")}
                      className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                        statusFilter === "todos"
                          ? "bg-neutral-900 text-white shadow-xs"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      Todos ({allProducts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("visiveis")}
                      className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                        statusFilter === "visiveis"
                          ? "bg-emerald-700 text-white shadow-xs"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      Visíveis ({visibleCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("ocultos")}
                      className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                        statusFilter === "ocultos"
                          ? "bg-neutral-700 text-white shadow-xs"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      Ocultos ({hiddenCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("destaques")}
                      className={`rounded-xl px-3 py-1.5 font-semibold transition ${
                        statusFilter === "destaques"
                          ? "bg-red-600 text-white shadow-xs"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      🔥 Promoções ({featuredCount})
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

                  {filtered.map((p) => {
                    const price = minPrice(p);
                    const isErpProduct = (p as unknown as { source?: string }).source === "erp";
                    const productIdOrExternal = isErpProduct
                      ? (p as unknown as ShopProduct).externalId || String(p.id)
                      : p.id;
                    const rowKey = String(productIdOrExternal);

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isErpProduct) {
                            setEditingErpProduct(p as unknown as ShopProduct);
                          } else {
                            setEditing(p.id);
                          }
                        }}
                        className={`group flex cursor-pointer items-center gap-4 rounded-2xl border p-4 shadow-2xs transition-all ${
                          p.active !== false
                            ? "border-[#e5e5e7] bg-white hover:border-neutral-400 hover:shadow-xs"
                            : "border-dashed border-neutral-300 bg-neutral-50/80 opacity-75 hover:opacity-100 hover:border-neutral-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${p.name}`}
                          className="h-4 w-4 shrink-0"
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
                            className="h-16 w-16 rounded-xl border border-[#e5e5e7] object-contain p-1 bg-[#fbfbfd]"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#f5f5f7] border border-[#e5e5e7] text-xs font-medium text-[#86868b]">
                            Sem foto
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-base font-semibold text-[#1d1d1f] group-hover:text-black">
                            {p.name}
                          </p>
                          <p className="text-xs text-[#86868b] mt-0.5">
                            {CATEGORIES.find((c) => c.value === p.category)?.label} •{" "}
                            {p.variants.length} variante(s)
                            {price != null ? ` • a partir de ${formatBRL(price)}` : ""}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
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
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
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
                                  ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 shadow-2xs"
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

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {isErpProduct ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingErpProduct(p as unknown as ShopProduct)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition active:scale-95"
                                title="Editar foto, vídeo, bateria e detalhes da vitrine"
                              >
                                <Pencil className="h-3.5 w-3.5 text-amber-400" />
                                Editar Vitrine
                              </button>
                              <a
                                href={erpProductUrl((p as { externalId?: string }).externalId ?? String(p.id))}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                                title="Abrir este produto no Gestão Celular ERP"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                ERP
                              </a>
                              <a
                                href={`/produto/${createProductShareSlug(p.name, p.id)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-[#e5e5e7] bg-white px-3 py-2 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] transition"
                              >
                                Vitrine ↗
                              </a>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditing(p.id)}
                                className="rounded-xl border border-[#e5e5e7] bg-white p-2.5 text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3] hover:bg-blue-50/50 transition shadow-2xs"
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
                                className="rounded-xl border border-[#e5e5e7] bg-white p-2.5 text-neutral-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition shadow-2xs"
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
          className="sticky bottom-3 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5e5e7] bg-white p-3 shadow-lg"
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
        <AdminErpProductEditor
          product={editingErpProduct}
          onClose={() => setEditingErpProduct(null)}
          onSaved={() => {
            setEditingErpProduct(null);
            products.refetch();
          }}
        />
      )}
    </div>
  );
}
