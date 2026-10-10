import { useState } from "react";
import { Link } from "react-router";
import { Download, History, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAdminSession } from "@/lib/adminSession";
import { formatDateTime, initials } from "@/components/admin/evaluations/evaluationUi";

const PAGE_SIZE = 50;

const ENTITY_OPTIONS = [
  { value: "", label: "Tudo" },
  { value: "evaluation", label: "Avaliações" },
  { value: "product", label: "Produtos" },
  { value: "erp_product", label: "Produtos do ERP" },
  { value: "user", label: "Usuários" },
  { value: "settings", label: "Configurações" },
] as const;

const inputCls =
  "min-h-11 w-full rounded-xl border border-[#e5e5e7] bg-white px-3 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/15";

interface Entry {
  id: number;
  userId: number | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: Date;
}

function linkFor(entry: Entry, canManage: boolean): string | null {
  if (entry.entityType === "evaluation" && entry.entityId) return `/admin/avaliacoes/${entry.entityId}`;
  if ((entry.entityType === "product" || entry.entityType === "erp_product") && entry.entityId) {
    return `/admin/produtos?editing=${encodeURIComponent(entry.entityId)}`;
  }
  if (!canManage) return null;
  if (entry.entityType === "user") return "/admin/usuarios";
  if (entry.entityType === "settings") return "/admin/configuracoes";
  return null;
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(entries: Entry[]) {
  const header = ["Data", "Usuário", "Ação", "Tipo", "Item", "Resumo"];
  const rows = entries.map((e) =>
    [formatDateTime(e.createdAt), e.userName, e.action, e.entityType, e.entityId ?? "", e.summary].map(csvCell).join(";"),
  );
  const blob = new Blob(["﻿" + [header.map(csvCell).join(";"), ...rows].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `atividade-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Histórico completo de ações do painel, com filtros. Vendedor vê só o das avaliações. */
export default function ActivityPage() {
  const { can } = useAdminSession();
  const canManage = can("users.manage");
  const utils = trpc.useUtils();

  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [more, setMore] = useState<Entry[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const usersQuery = trpc.admin.users.list.useQuery(undefined, { enabled: canManage, staleTime: 60_000 });

  const filters = {
    entityType: entityType || undefined,
    userId: userId ? Number(userId) : undefined,
    search: search.trim() || undefined,
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999`) : undefined,
  };

  const query = trpc.admin.auditLog.useQuery({ ...filters, limit: PAGE_SIZE }, { staleTime: 15_000 });
  const first = (query.data ?? []) as Entry[];
  const entries = [...first, ...more];
  const hasMore = !exhausted && first.length === PAGE_SIZE;

  function resetPaging() {
    setMore([]);
    setExhausted(false);
  }

  async function loadMore() {
    const last = entries[entries.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const page = (await utils.admin.auditLog.fetch({ ...filters, limit: PAGE_SIZE, beforeId: last.id })) as Entry[];
      setMore((prev) => [...prev, ...page]);
      if (page.length < PAGE_SIZE) setExhausted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar mais");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-[#1d1d1f]">
            <History className="h-6 w-6" /> Atividade
          </h2>
          <p className="mt-1 text-sm text-[#86868b]">
            {canManage ? "Tudo o que a equipe fez no painel." : "Histórico das avaliações."}
          </p>
        </div>
        <button
          type="button"
          disabled={entries.length === 0}
          onClick={() => downloadCsv(entries)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-4 text-sm font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </div>

      <div
        className="grid gap-3 rounded-2xl border border-[#e5e5e7] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        onChange={resetPaging}
      >
        <label className="relative block lg:col-span-2">
          <span className="sr-only">Buscar no resumo</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar (ex.: iPhone, preço, nome)"
            className={`${inputCls} pl-9`}
          />
        </label>
        {canManage && (
          <label className="block">
            <span className="sr-only">Tipo</span>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={inputCls}>
              {ENTITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {canManage && (
          <label className="block">
            <span className="sr-only">Usuário</span>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
              <option value="">Todos os usuários</option>
              {(usersQuery.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#86868b]">De</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#86868b]">Até</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
      </div>

      <section className="rounded-2xl border border-[#e5e5e7] bg-white shadow-2xs">
        {query.isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-[#f5f5f7]" />
        ) : query.isError ? (
          <p className="p-6 text-sm text-red-600">Não foi possível carregar o histórico.</p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-[#86868b]">Nenhuma ação encontrada com esses filtros.</p>
        ) : (
          <ul className="divide-y divide-[#f0f0f2]">
            {entries.map((entry) => {
              const to = linkFor(entry, canManage);
              const body = (
                <>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[11px] font-bold text-[#1d1d1f]">
                    {initials(entry.userName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug text-[#1d1d1f]">
                      <strong className="font-semibold">{entry.userName}</strong>{" "}
                      <span className="text-[#424245]">
                        {entry.summary.startsWith(entry.userName) ? entry.summary.slice(entry.userName.length) : entry.summary}
                      </span>
                    </span>
                    <span className="block text-[11px] text-[#86868b]">
                      {formatDateTime(entry.createdAt)} · {entry.action}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={entry.id}>
                  {to ? (
                    <Link to={to} className="flex items-start gap-3 px-4 py-3 hover:bg-[#fafafa]">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && (
          <div className="border-t border-[#f0f0f2] p-3 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e5e5e7] px-5 text-sm font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Carregar mais
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
