import { Link } from "react-router";
import { AlertTriangle, BatteryWarning, CheckCircle2, ChevronRight, ImageOff, PackageX } from "lucide-react";
import type { ComponentType } from "react";
import { DashboardSection } from "./DashboardSection";
import type { DashboardData } from "./dashboardUi";

interface AttentionRow {
  key: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  count: number;
  names?: string[];
}

interface AttentionListProps {
  late: number;
  slaHours: number;
  issues: DashboardData["catalogIssues"] | null;
}

/** "Precisa de atenção": avaliações atrasadas + pendências da vitrine. */
export function AttentionList({ late, slaHours, issues }: AttentionListProps) {
  const rows: AttentionRow[] = [
    {
      key: "late",
      to: "/admin/avaliacoes?late=1",
      icon: AlertTriangle,
      tone: "bg-red-100 text-red-600",
      title: `Avaliações sem resposta há mais de ${slaHours} h`,
      count: late,
    },
  ];
  if (issues) {
    rows.push(
      {
        key: "noPhoto",
        to: "/admin/produtos?filtro=sem-foto",
        icon: ImageOff,
        tone: "bg-amber-100 text-amber-700",
        title: "Produtos visíveis sem foto",
        count: issues.noPhoto.total,
        names: issues.noPhoto.items.map((i) => i.name),
      },
      {
        key: "noBattery",
        to: "/admin/produtos?filtro=sem-bateria",
        icon: BatteryWarning,
        tone: "bg-amber-100 text-amber-700",
        title: "Seminovos sem bateria informada",
        count: issues.noBattery.total,
        names: issues.noBattery.items.map((i) => i.name),
      },
      {
        key: "soldOut",
        to: "/admin/produtos?filtro=esgotado-visivel",
        icon: PackageX,
        tone: "bg-neutral-200 text-neutral-700",
        title: "Esgotados ainda visíveis na vitrine",
        count: issues.soldOutVisible.total,
        names: issues.soldOutVisible.items.map((i) => i.name),
      },
    );
  }

  const pending = rows.filter((r) => r.count > 0);

  return (
    <DashboardSection
      title="Precisa de atenção"
      description="Tarefas que deixam o atendimento e a vitrine mais profissionais."
      icon={AlertTriangle}
    >
      {pending.length === 0 ? (
        <div className="flex items-center gap-3 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-semibold">Tudo em dia por aqui! 🎉</span>
        </div>
      ) : (
        <ul className="-mx-1 divide-y divide-[#f0f0f2]">
          {pending.map((row) => (
            <li key={row.key}>
              <Link
                to={row.to}
                className="group flex min-h-14 items-center gap-3 rounded-xl px-1 py-2.5 transition hover:bg-[#fafafa]"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.tone}`}>
                  <row.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#1d1d1f]">{row.title}</span>
                  {row.names && row.names.length > 0 && (
                    <span className="block truncate text-[11px] text-[#86868b]">
                      {row.names.slice(0, 3).join(" • ")}
                      {row.count > 3 ? ` e mais ${row.count - 3}` : ""}
                    </span>
                  )}
                </span>
                <span className="rounded-full bg-[#1d1d1f] px-2 py-0.5 text-xs font-bold tabular-nums text-white">
                  {row.count}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc] group-hover:text-[#1d1d1f]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
