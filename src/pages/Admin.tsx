import { useState } from "react";
import { useSearchParams } from "react-router";
import { Lock, LogOut, Plus, Pencil, Trash2, Eye, EyeOff, Settings, Package } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatBRL, CATEGORIES } from "@contracts/types";
import { minPrice } from "@/lib/shop";
import AdminProductEditor from "@/components/admin/AdminProductEditor";
import AdminSettings from "@/components/admin/AdminSettings";

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState(() => localStorage.getItem("admin_token") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const tab = (searchParams.get("tab") as "produtos" | "config") || "produtos";
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

  function setTab(t: "produtos" | "config") {
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
      localStorage.setItem("admin_token", data.token);
      setToken(data.token);
      setError("");
    },
    onError: (err) => setError(err.message || "Senha incorreta. Tente novamente."),
  });

  const products = trpc.admin.products.useQuery(undefined, { enabled: !!token });
  const deleteProduct = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => utils.admin.products.invalidate(),
  });

  function logout() {
    localStorage.removeItem("admin_token");
    setToken("");
  }

  // ===== TELA DE LOGIN =====
  if (!token) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ password });
          }}
          className="w-full max-w-sm rounded-3xl border-2 border-ink bg-white p-8 shadow-[6px_6px_0_0_#141414]"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-brand">
            <Lock className="h-6 w-6 text-ink" />
          </div>
          <h1 className="mt-4 text-center font-display text-2xl font-bold text-ink">
            Painel da Loja
          </h1>
          <p className="mt-1 text-center text-sm text-neutral-500">
            Área restrita — digite a senha de administrador.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            autoFocus
            className="mt-6 w-full rounded-xl border-2 border-ink px-4 py-3 text-sm font-medium outline-none focus:bg-brand/20"
          />
          {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={login.isPending || !password}
            className="mt-4 w-full rounded-xl border-2 border-ink bg-ink py-3 font-display font-bold text-brand transition hover:opacity-90 disabled:opacity-50"
          >
            {login.isPending ? "Entrando..." : "Entrar"}
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Painel da Loja</h1>
        <div className="flex gap-2">
          <a
            href="/tv"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-brand px-4 py-2 text-sm font-semibold text-ink shadow-[2px_2px_0_0_#141414] hover:-translate-y-0.5 transition"
          >
            📺 Modo TV
          </a>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setTab("produtos")}
          className={`inline-flex items-center gap-2 rounded-xl border-2 border-ink px-4 py-2.5 text-sm font-bold ${
            tab === "produtos" ? "bg-ink text-brand" : "bg-white text-ink hover:bg-brand"
          }`}
        >
          <Package className="h-4 w-4" /> Produtos
        </button>
        <button
          onClick={() => setTab("config")}
          className={`inline-flex items-center gap-2 rounded-xl border-2 border-ink px-4 py-2.5 text-sm font-bold ${
            tab === "config" ? "bg-ink text-brand" : "bg-white text-ink hover:bg-brand"
          }`}
        >
          <Settings className="h-4 w-4" /> Configurações
        </button>
      </div>

      {tab === "config" ? (
        <AdminSettings />
      ) : (
        <>
          <button
            onClick={() => setEditing("novo")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-brand px-5 py-3 font-display font-bold text-ink shadow-[3px_3px_0_0_#141414] transition hover:-translate-y-0.5"
          >
            <Plus className="h-5 w-5" /> Adicionar produto
          </button>

          <div className="mt-6 space-y-3">
            {products.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-200" />
              ))}

            {(products.data ?? []).map((p) => {
              const price = minPrice(p);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 rounded-2xl border-2 border-ink bg-white p-4 shadow-[3px_3px_0_0_#141414]"
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-16 w-16 rounded-xl border border-ink/20 object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-400">
                      Sem foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold text-ink">{p.name}</p>
                    <p className="text-xs text-neutral-500">
                      {CATEGORIES.find((c) => c.value === p.category)?.label} •{" "}
                      {p.variants.length} variante(s)
                      {price != null ? ` • a partir de ${formatBRL(price)}` : ""}
                    </p>
                    <div className="mt-1 flex gap-1.5">
                      {p.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                          <Eye className="h-3 w-3" /> Visível
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                          <EyeOff className="h-3 w-3" /> Oculto
                        </span>
                      )}
                      {p.featured && (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-ink">
                          Destaque
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(p.id)}
                      className="rounded-xl border-2 border-ink bg-white p-2.5 text-ink hover:bg-brand"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir "${p.name}"? Essa ação não pode ser desfeita.`)) {
                          deleteProduct.mutate({ id: p.id });
                        }
                      }}
                      className="rounded-xl border-2 border-ink bg-white p-2.5 text-red-600 hover:bg-red-50"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {products.data?.length === 0 && (
              <p className="rounded-2xl border-2 border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
                Nenhum produto cadastrado ainda. Clique em "Adicionar produto".
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
