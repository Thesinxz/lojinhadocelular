import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Settings2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { EVALUATION_STATUSES, type EvaluationStatus } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { useAdminSession, useAdminUnit } from "@/lib/adminSession";
import EvaluationFilters from "@/components/admin/evaluations/EvaluationFilters";
import EvaluationListItem from "@/components/admin/evaluations/EvaluationListItem";
import type { AssignedFilter, StatusFilter } from "@/components/admin/evaluations/evaluationUi";

const PAGE_SIZE = 20;

function parseStatus(value: string | null): StatusFilter {
  return value && (EVALUATION_STATUSES as readonly string[]).includes(value) ? (value as EvaluationStatus) : "todos";
}

function parseAssigned(value: string | null): AssignedFilter {
  return value === "me" || value === "none" ? value : "any";
}

export default function EvaluationsPage() {
  const { user, can } = useAdminSession();
  const { unit } = useAdminUnit();
  const utils = trpc.useUtils();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = parseStatus(searchParams.get("status"));
  const assigned = parseAssigned(searchParams.get("assigned"));
  const late = searchParams.get("late") === "1";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  function updateParams(patch: Record<string, string | null>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === "") next.delete(key);
          else next.set(key, value);
        }
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  const unitFilter = unit === "todas" ? undefined : unit;

  const listQuery = trpc.admin.evaluationsPage.useQuery(
    {
      page,
      pageSize: PAGE_SIZE,
      status: status === "todos" ? undefined : status,
      search,
      unit: unitFilter,
      assigned,
      late,
      includePhotos: false,
    },
    { staleTime: 1000 * 30, refetchInterval: 1000 * 60, placeholderData: (prev) => prev },
  );
  const summaryQuery = trpc.admin.evaluationSummary.useQuery(
    { unit: unitFilter },
    { staleTime: 1000 * 30, refetchInterval: 1000 * 60 },
  );

  const [claimingId, setClaimingId] = useState<number | null>(null);
  const claimMutation = trpc.admin.evaluationClaim.useMutation({
    onMutate: ({ id }) => setClaimingId(id),
    onSuccess: () => toast.success("Avaliação é sua agora."),
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      setClaimingId(null);
      utils.admin.evaluationsPage.invalidate();
      utils.admin.evaluationSummary.invalidate();
    },
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#6e6e73]">
          {summaryQuery.data ? (
            <>
              <strong className="text-[#1d1d1f]">{summaryQuery.data.pending}</strong> pendente(s)
              {summaryQuery.data.late > 0 && (
                <>
                  {" · "}
                  <strong className="text-red-600">{summaryQuery.data.late}</strong> atrasada(s)
                </>
              )}
            </>
          ) : (
            "Carregando..."
          )}
        </p>
        {can("settings.manage") && (
          <Link
            to="/admin/configuracoes"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e5e5e7] bg-white px-3 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Regras e mensagens
          </Link>
        )}
      </div>

      <EvaluationFilters
        status={status}
        assigned={assigned}
        late={late}
        search={searchInput}
        counts={summaryQuery.data}
        onStatusChange={(next) => updateParams({ status: next === "todos" ? null : next })}
        onAssignedChange={(next) => updateParams({ assigned: next === "any" ? null : next })}
        onLateChange={(next) => updateParams({ late: next ? "1" : null })}
        onSearchChange={(value) => {
          setSearchInput(value);
          if (page > 1) updateParams({});
        }}
      />

      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7]" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Não foi possível carregar as avaliações.{" "}
          <button type="button" onClick={() => listQuery.refetch()} className="font-semibold underline">
            Tentar novamente
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[#e5e5e7] bg-white p-10 text-center shadow-2xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-[#86868b]">
            <Smartphone className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold text-[#1d1d1f]">Nenhuma avaliação encontrada</h3>
          <p className="mt-1 text-xs text-[#86868b]">
            Ajuste os filtros ou aguarde novas avaliações do Troca Fácil (/avaliacao).
          </p>
        </div>
      ) : (
        <ul className={`space-y-3 ${listQuery.isFetching ? "opacity-70" : ""}`}>
          {items.map((item) => (
            <EvaluationListItem
              key={item.id}
              item={item}
              currentUserId={user?.id ?? 0}
              claiming={claimingId === item.id}
              onClaim={(id) => claimMutation.mutate({ id })}
            />
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-xl border border-[#e5e5e7] bg-white px-3 py-2 text-xs text-[#6e6e73]">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateParams({ page: page > 2 ? String(page - 1) : null })}
              disabled={page === 1 || listQuery.isFetching}
              className="min-h-11 rounded-lg border border-[#e5e5e7] px-3 font-semibold text-[#1d1d1f] disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => updateParams({ page: String(page + 1) })}
              disabled={!listQuery.data?.hasMore || listQuery.isFetching}
              className="min-h-11 rounded-lg border border-[#e5e5e7] px-3 font-semibold text-[#1d1d1f] disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
