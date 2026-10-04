import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Inbox,
  Percent,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { formatBRL } from "@contracts/types";
import { useAdminSession, useAdminUnit } from "@/lib/adminSession";
import { StatCard, StatCardSkeleton } from "@/components/admin/dashboard/StatCard";
import { AttentionList } from "@/components/admin/dashboard/AttentionList";
import { TeamRanking } from "@/components/admin/dashboard/TeamRanking";
import { ActivityFeed } from "@/components/admin/dashboard/ActivityFeed";
import { ErpStatusCard } from "@/components/admin/dashboard/ErpStatusCard";
import { formatMinutes, formatPercent, monthLabel } from "@/components/admin/dashboard/dashboardUi";

function greeting(date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Campo_Grande" }).format(date),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#86868b]">{children}</h3>;
}

export default function DashboardPage() {
  const { user, can } = useAdminSession();
  const { unit } = useAdminUnit();
  const query = trpc.admin.dashboard.useQuery(unit === "todas" ? undefined : { unit }, {
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
  const data = query.data;
  const firstName = user?.name.split(" ")[0] ?? "";
  const month = monthLabel();
  const canOpen = (to: string) => {
    if (to.startsWith("/admin/usuarios")) return can("users.manage");
    if (to.startsWith("/admin/configuracoes")) return can("settings.manage");
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#1d1d1f]">
            {greeting()}, {firstName}!
          </h2>
          <p className="mt-1 text-sm text-[#86868b]">
            Resumo {unit === "todas" ? "das duas lojas" : unit === "jardim" ? "da loja de Jardim" : "da loja de Guia Lopes"}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#e5e5e7] bg-white px-3 text-xs font-semibold text-[#1d1d1f] shadow-2xs transition hover:bg-[#f5f5f7] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {query.isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Não foi possível carregar o resumo: {query.error.message}
        </div>
      )}

      {/* Agora */}
      <div>
        <SectionTitle>Agora</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {!data ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Avaliações pendentes"
                value={data.now.pending}
                hint="Aguardando alguém pegar"
                icon={Inbox}
                tone={data.now.pending > 0 ? "amber" : "neutral"}
                to="/admin/avaliacoes?status=pendente"
              />
              <StatCard
                label="Atrasadas"
                value={data.now.late}
                hint={`Sem resposta há mais de ${data.slaHours} h`}
                icon={AlertTriangle}
                tone={data.now.late > 0 ? "red" : "neutral"}
                to="/admin/avaliacoes?late=1"
              />
              <div className="col-span-2 lg:col-span-1">
                <StatCard
                  label="Atendidas hoje"
                  value={data.now.respondedToday}
                  hint="Primeiro contato feito hoje"
                  icon={CheckCircle2}
                  tone="emerald"
                  to="/admin/avaliacoes?status=atendimento"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mês */}
      <div>
        <SectionTitle>{`Troca Fácil em ${month}`}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {!data ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Fechadas"
                value={data.month.concluded}
                hint={`${data.month.received} recebidas • ${data.month.refused} recusadas`}
                icon={BadgeCheck}
                tone="blue"
                to="/admin/avaliacoes?status=concluido"
              />
              <StatCard
                label="Taxa de fechamento"
                value={formatPercent(data.month.closeRate)}
                hint="Fechadas ÷ (fechadas + recusadas)"
                icon={Percent}
              />
              <StatCard
                label="Total comprado"
                value={<span className="text-xl sm:text-2xl">{formatBRL(data.month.totalClosedCents)}</span>}
                hint="Soma dos valores fechados"
                icon={Wallet}
                tone="emerald"
              />
              <StatCard
                label="Tempo médio de resposta"
                value={formatMinutes(data.month.avgResponseMinutes)}
                hint="Do envio até o primeiro contato"
                icon={Clock}
              />
            </>
          )}
        </div>
      </div>

      {data && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <AttentionList
              late={data.now.late}
              slaHours={data.slaHours}
              issues={can("products.editMedia") ? data.catalogIssues : null}
            />
            {data.ranking && <TeamRanking ranking={data.ranking} month={month} />}
          </div>
          <div className="space-y-4 lg:col-span-2">
            {data.erp.enabled && <ErpStatusCard erp={data.erp} />}
            <ActivityFeed activity={data.activity} canOpen={canOpen} />
          </div>
        </div>
      )}
    </div>
  );
}
