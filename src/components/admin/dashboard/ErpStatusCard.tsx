import { RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { timeAgo } from "@/components/admin/evaluations/evaluationUi";
import { DashboardSection } from "./DashboardSection";
import type { DashboardData } from "./dashboardUi";

const STATUS: Record<string, { label: string; className: string }> = {
  ok: { label: "Conectado", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  empty: { label: "Estoque vazio", className: "border-slate-300 bg-slate-50 text-slate-700" },
  offline: { label: "Offline", className: "border-amber-300 bg-amber-50 text-amber-800" },
  config_error: { label: "Configuração pendente", className: "border-red-300 bg-red-50 text-red-800" },
};

/** Status da integração com o Gestão Celular ERP. */
export function ErpStatusCard({ erp }: { erp: DashboardData["erp"] }) {
  const utils = trpc.useUtils();
  const refresh = trpc.admin.refreshErpCatalog.useMutation({
    onSuccess: (res) => {
      toast.success(res.status === "ok" ? `ERP sincronizado: ${res.count} aparelhos` : "ERP consultado");
      utils.admin.dashboard.invalidate();
      utils.admin.products.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const status = STATUS[erp.status] ?? STATUS.offline;

  return (
    <DashboardSection
      title="Gestão Celular ERP"
      description="Estoque e preços oficiais"
      icon={Server}
      action={
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e5e5e7] bg-white px-2.5 text-xs font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
          Sincronizar
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 py-1">
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
        {erp.status === "ok" && (
          <span className="text-xs font-semibold text-[#1d1d1f]">{erp.count} aparelhos no catálogo</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-[#86868b]">
        {erp.lastSyncAt ? `Última sincronização ${timeAgo(erp.lastSyncAt)}` : erp.message || "Sem sincronização recente"}
      </p>
    </DashboardSection>
  );
}
