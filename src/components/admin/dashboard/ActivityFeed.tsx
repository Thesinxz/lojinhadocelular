import { Link } from "react-router";
import { History } from "lucide-react";
import { initials, timeAgo } from "@/components/admin/evaluations/evaluationUi";
import { DashboardSection } from "./DashboardSection";
import type { DashboardActivity } from "./dashboardUi";

function linkFor(entry: DashboardActivity): string | null {
  if (entry.entityType === "evaluation" && entry.entityId) return `/admin/avaliacoes/${entry.entityId}`;
  if (entry.entityType === "product" || entry.entityType === "erp_product") return "/admin/produtos";
  if (entry.entityType === "user") return "/admin/usuarios";
  if (entry.entityType === "settings") return "/admin/configuracoes";
  return null;
}

/** Últimas ações registradas no histórico. */
export function ActivityFeed({ activity, canOpen }: { activity: DashboardActivity[]; canOpen: (to: string) => boolean }) {
  return (
    <DashboardSection title="Atividade recente" description="Quem fez o quê no painel" icon={History}>
      {activity.length === 0 ? (
        <p className="py-3 text-sm text-[#86868b]">Nenhuma ação registrada ainda.</p>
      ) : (
        <ul className="-mx-1 divide-y divide-[#f0f0f2]">
          {activity.map((entry) => {
            const to = linkFor(entry);
            const content = (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[11px] font-bold text-[#1d1d1f]">
                  {initials(entry.userName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug text-[#1d1d1f]">
                    {entry.summary.startsWith(entry.userName) ? (
                      <>
                        <strong className="font-semibold">{entry.userName}</strong>
                        <span className="text-[#424245]">{entry.summary.slice(entry.userName.length)}</span>
                      </>
                    ) : (
                      <>
                        <strong className="font-semibold">{entry.userName}</strong>{" "}
                        <span className="text-[#424245]">{entry.summary}</span>
                      </>
                    )}
                  </span>
                  <span className="block text-[11px] text-[#86868b]">{timeAgo(entry.createdAt)}</span>
                </span>
              </>
            );
            return (
              <li key={entry.id}>
                {to && canOpen(to) ? (
                  <Link to={to} className="flex items-start gap-3 rounded-xl px-1 py-2.5 transition hover:bg-[#fafafa]">
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-1 py-2.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}
