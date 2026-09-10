import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Lock, LogOut, Plus, Pencil, Trash2, Eye, EyeOff, Settings, Package, RefreshCw, Smartphone } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatBRL, CATEGORIES } from "@contracts/types";
import { minPrice } from "@/lib/shop";
import { safeStorage } from "@/lib/storage";
import AdminProductEditor from "@/components/admin/AdminProductEditor";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminEvaluations from "@/components/admin/AdminEvaluations";

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState(() => safeStorage.getItem("admin_token") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const tab =
    (searchParams.get("tab") as "produtos" | "avaliacoes" | "config") ||
    "produtos";
  const editingRaw = searchParams.get("editing");
  const editing: number | "novo" | null =
    editingRaw === "novo" ? "novo" : editingRaw ? Number(editingRaw) : null;

  function setEditing(val: number | "novo" | null) {
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

          <p className="mt-4 text-center text-[11.5px] text-[#86868b]">
            Senha inicial padrão: <code className="rounded bg-[#f5f5f7] px-1.5 py-0.5 font-mono text-[#1d1d1f]">lojinha123</code> ou <code className="rounded bg-[#f5f5f7] px-1.5 py-0.5 font-mono text-[#1d1d1f]">admin</code>
          </p>
        </form>
      </div>
    );
  }

  // ===== EDITOR ABERTO =====
  if (editing !== null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <AdminProductEditor
          productId={editing === "novo" ? null : editing}
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
        <AdminEvaluations />
      ) : (
        <div className="mt-6">

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

            {(products.data ?? []).map((p) => {
              const price = minPrice(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs hover:border-neutral-300 transition-all"
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-16 w-16 rounded-xl border border-[#e5e5e7] object-contain p-1 bg-[#fbfbfd]" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#f5f5f7] border border-[#e5e5e7] text-xs font-medium text-[#86868b]">
                      Sem foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-semibold text-[#1d1d1f]">{p.name}</p>
                    <p className="text-xs text-[#86868b] mt-0.5">
                      {CATEGORIES.find((c) => c.value === p.category)?.label} •{" "}
                      {p.variants.length} variante(s)
                      {price != null ? ` • a partir de ${formatBRL(price)}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <Eye className="h-3 w-3" /> Visível
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                          <EyeOff className="h-3 w-3" /> Oculto
                        </span>
                      )}
                      {p.featured && (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Destaque
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                          deleteProduct.mutate({ id: p.id });
                        }
                      }}
                      className="rounded-xl border border-[#e5e5e7] bg-white p-2.5 text-neutral-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition shadow-2xs"
                      aria-label="Excluir"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {!products.isLoading && !products.isError && products.data?.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-[#e5e5e7] bg-[#fbfbfd] p-12 text-center">
                <Package className="mx-auto h-8 w-8 text-neutral-400" />
                <p className="mt-3 text-sm font-semibold text-[#1d1d1f]">Nenhum produto cadastrado ainda</p>
                <p className="mt-1 text-xs text-[#86868b]">Clique em "Adicionar produto" para cadastrar seu primeiro aparelho ou acessório.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
