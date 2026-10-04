import { Trophy } from "lucide-react";
import { formatBRL } from "@contracts/types";
import { initials } from "@/components/admin/evaluations/evaluationUi";
import { DashboardSection } from "./DashboardSection";
import type { DashboardRankingEntry } from "./dashboardUi";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Ranking da equipe no mês (somente dono). */
export function TeamRanking({ ranking, month }: { ranking: DashboardRankingEntry[]; month: string }) {
  return (
    <DashboardSection title="Ranking da equipe" description={`Avaliações em ${month}`} icon={Trophy}>
      {ranking.length === 0 ? (
        <p className="py-3 text-sm text-[#86868b]">
          Ainda não há atendimentos com responsável neste mês. Peça para a equipe usar o botão{" "}
          <strong className="text-[#1d1d1f]">Pegar</strong> nas avaliações.
        </p>
      ) : (
        <ol className="-mx-1 divide-y divide-[#f0f0f2]">
          {ranking.map((entry, index) => (
            <li key={`${entry.userId ?? entry.userName}`} className="flex items-center gap-3 px-1 py-2.5">
              <span className="w-6 text-center text-base">{MEDALS[index] ?? <span className="text-xs font-bold text-[#86868b]">{index + 1}º</span>}</span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">
                {initials(entry.userName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#1d1d1f]">{entry.userName}</span>
                <span className="block text-[11px] text-[#86868b]">
                  {entry.handled} {entry.handled === 1 ? "atendimento" : "atendimentos"}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-bold tabular-nums text-emerald-700">
                  {entry.concluded} {entry.concluded === 1 ? "fechada" : "fechadas"}
                </span>
                <span className="block text-[11px] tabular-nums text-[#86868b]">{formatBRL(entry.totalClosedCents)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </DashboardSection>
  );
}
