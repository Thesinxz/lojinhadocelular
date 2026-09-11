import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import {
  Lock,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Settings,
  Package,
  RefreshCw,
  Smartphone,
  Search,
  ExternalLink,
  Flame,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatBRL, CATEGORIES } from "@contracts/types";
import { minPrice } from "@/lib/shop";
import { safeStorage } from "@/lib/storage";
import AdminProductEditor from "@/components/admin/AdminProductEditor";
import { AdminErpProductEditor } from "@/components/admin/AdminErpProductEditor";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminEvaluations from "@/components/admin/AdminEvaluations";
import type { ShopProduct } from "../../api/erp/types";

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState(() => safeStorage.getItem("admin_token") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [editingErpProduct, setEditingErpProduct] = useState<ShopProduct | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "visiveis" | "ocultos" | "destaques">("todos");

  const tab =
    (searchParams.get("tab") as "produtos" | "avaliacoes" | "config") ||
    "produtos";
  const editingRaw = searchParams.get("editing");
  const editing: number | string | "novo" | null =
    editingRaw === "novo"
      ? "novo"
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

  function setTab(t: "produtos" | "avaliacoes" | "config") {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", t);
        return next;
      },
      { replace: true }
    );
  }


  const utils = trpc.useUtils();
  const login = trpc.admin.login.useMutation({
    onSuccess: (data) => {
      safeStorage.setItem("admin_token", data.token);
      setToken(data.token);
      setError("");
    },
    onError: (err) => setError(err.message || "Senha incorreta. Tente novamente."),
  });

  const products = trpc.admin.products.useQuery(undefined, {
    enabled: !!token,
    retry: 1,
  });

  const catalogStatusQuery = trpc.shop.catalogStatus.useQuery(undefined, {
    staleTime: 1000 * 30,
  });

  const evaluationsQuery = trpc.admin.evaluations.useQuery(undefined, {
    enabled: !!token,
    retry: 1,
    refetchInterval: 30000,
  });

  const pendingEvaluationsCount = (evaluationsQuery.data ?? []).filter(
    (e) => (e.status || "pendente") === "pendente"
  ).length;


  useEffect(() => {
    if (products.error) {
      const isUnauthorized =
        (products.error as { data?: { httpStatus?: number } })?.data?.httpStatus === 401 ||
        products.error.message.includes("UNAUTHORIZED") ||
        products.error.message.includes("Não autorizado");

      if (isUnauthorized) {
        safeStorage.removeItem("admin_token");
        setToken("");
        setError("Sessão expirada. Digite a senha para entrar.");
      }
    }
  }, [products.error]);

  const deleteProduct = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => utils.admin.products.invalidate(),
  });

  const toggleActiveMutation = trpc.admin.toggleActive.useMutation({
    onSuccess: () => {
      utils.admin.products.invalidate();
      utils.shop.products.invalidate();
      utils.shop.featured.invalidate();
    },
  });

  const toggleFeaturedMutation = trpc.admin.toggleFeatured.useMutation({
    onSuccess: () => {
      utils.admin.products.invalidate();
      utils.shop.products.invalidate();
      utils.shop.featured.invalidate();
    },
  });

  const refreshErpMutation = trpc.admin.refreshErpCatalog.useMutation({
    onSuccess: () => {
      utils.admin.products.invalidate();
      utils.shop.products.invalidate();
      utils.shop.catalogStatus.invalidate();
    },
  });

  function logout() {
    safeStorage.removeItem("admin_token");
    setToken("");
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    safeStorage.removeItem("admin_token");
    setToken("");
    setError("");
    login.mutate({ password: password.trim() });
  }

  // ===== TELA DE LOGIN =====
  if (!token) {
    return (
      <div className="flex min-h-[75dvh] items-center justify-center px-4 py-12 bg-[#fbfbfd]">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-3xl border border-[#e5e5e7] bg-white p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07)]"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d1d1f] text-white shadow-md">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-center font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">
            Painel da Loja
          </h1>
          <p className="mt-1.5 text-center text-sm text-[#86868b]">
            Área de administração restrita da Lojinha do Celular.
          </p>

          <div className="mt-6">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold tracking-wide text-[#6e6e73]">
                Senha de administrador
              </span>
              <div className="group flex h-12 items-center rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 transition-all duration-200 focus-within:border-[#0071e3] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0071e3]/15">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoFocus
                  className="w-full bg-transparent text-[15px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:outline-none focus:ring-0 border-none shadow-none ring-0"
                />
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 animate-fadeIn">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending || !password}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#1d1d1f] hover:bg-black font-display font-semibold text-white transition-all shadow-[0_10px_25px_-10px_rgba(0,0,0,0.3)] active:scale-[0.99] disabled:opacity-50"
          >
            {login.isPending ? "Entrando..." : "Acessar Painel"}
          </button>
        </form>
      </div>
    );
  }

  // ===== EDITOR ABERTO =====
  if (editing !== null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
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

  // ===== PAINEL =====
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">
            Painel da Loja
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#86868b]">
            Gerencie o catálogo de produtos, estoque e dados de atendimento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/tv"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#1d1d1f] shadow-2xs hover:bg-[#f5f5f7] transition active:scale-[0.98]"
          >
            📺 Modo TV
          </a>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e5e7] bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#6e6e73] hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex items-center justify-between border-b border-[#e5e5e7] pb-4">
        <div className="inline-flex rounded-xl bg-[#f5f5f7] p-1 border border-[#e5e5e7]">
          <button
            onClick={() => setTab("produtos")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              tab === "produtos"
                ? "bg-white text-[#1d1d1f] shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            <Package className="h-4 w-4" /> Produtos
          </button>
          <button
            onClick={() => setTab("avaliacoes")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              tab === "avaliacoes"
                ? "bg-white text-[#1d1d1f] shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            <Smartphone className="h-4 w-4" /> Avaliações
            {pendingEvaluationsCount > 0 && (
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                {pendingEvaluationsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("config")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              tab === "config"
                ? "bg-white text-[#1d1d1f] shadow-xs"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            <Settings className="h-4 w-4" /> Configurações
          </button>
        </div>

        {tab === "produtos" && (
          <button
            onClick={() => setEditing("novo")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black px-4 sm:px-5 py-2 sm:py-2.5 font-display text-xs sm:text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Adicionar produto
          </button>
        )}
      </div>

      {tab === "config" ? (
        <AdminSettings />
      ) : tab === "avaliacoes" ? (
        <AdminEvaluations onOpenConfig={() => setTab("config")} />
      ) : (
        <div className="mt-6">
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
                  href="https://gestaocelular.com.br"
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

            const filtered = allProducts.filter((p) => {
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

                  {filtered.map((p) => {
                    const price = minPrice(p);
                    const isErpProduct = (p as unknown as { source?: string }).source === "erp";
                    const productIdOrExternal = isErpProduct
                      ? (p as unknown as ShopProduct).externalId || String(p.id)
                      : p.id;

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
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="h-16 w-16 rounded-xl border border-[#e5e5e7] object-contain p-1 bg-[#fbfbfd]" />
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

                            {/* Botão de Toggle Rápido de Promoção / Destaque */}
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
                            {p.variants?.[0]?.batteryHealth && (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                🔋 {p.variants[0].batteryHealth}
                              </span>
                            )}
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
                                href="https://gestaocelular.com.br"
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                                title="Abrir página no Gestão Celular ERP"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                ERP
                              </a>
                              <a
                                href={`/produto/${p.id}`}
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
