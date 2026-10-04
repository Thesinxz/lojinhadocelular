import { Link } from "react-router";
import { ArrowRight, Package, Settings, Smartphone, Users } from "lucide-react";
import type { ComponentType } from "react";
import { trpc } from "@/providers/trpc";
import { useAdminSession } from "@/lib/adminSession";
import type { Capability } from "@contracts/permissions";

interface Shortcut {
  to: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  cap?: Capability;
}

const SHORTCUTS: Shortcut[] = [
  {
    to: "/admin/avaliacoes",
    title: "Avaliações",
    description: "Aparelhos enviados pelos clientes para troca.",
    icon: Smartphone,
  },
  {
    to: "/admin/produtos",
    title: "Produtos",
    description: "Fotos, vídeos, bateria e visibilidade na vitrine.",
    icon: Package,
  },
  {
    to: "/admin/usuarios",
    title: "Usuários",
    description: "Contas da equipe e permissões.",
    icon: Users,
    cap: "users.manage",
  },
  {
    to: "/admin/configuracoes",
    title: "Configurações",
    description: "Dados da loja, avaliação e integrações.",
    icon: Settings,
    cap: "settings.manage",
  },
];

/** Provisório: boas-vindas + atalhos. Indicadores chegam numa etapa futura. */
export default function DashboardPage() {
  const { user, can } = useAdminSession();
  const summary = trpc.admin.evaluationSummary.useQuery(undefined, { staleTime: 1000 * 30 });
  const pending = summary.data?.pending ?? 0;
  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-[#1d1d1f]">Olá, {firstName}!</h2>
        <p className="mt-1 text-sm text-[#86868b]">O que você quer fazer agora?</p>
      </div>

      {pending > 0 && (
        <Link
          to="/admin/avaliacoes"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
        >
          <span>
            {pending === 1 ? "1 avaliação aguardando atendimento" : `${pending} avaliações aguardando atendimento`}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {SHORTCUTS.filter((s) => !s.cap || can(s.cap)).map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group flex items-start gap-4 rounded-2xl border border-[#e5e5e7] bg-white p-5 shadow-2xs transition hover:border-neutral-400 hover:shadow-xs"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f7] text-[#1d1d1f]">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold text-[#1d1d1f]">{s.title}</p>
              <p className="mt-0.5 text-xs text-[#86868b]">{s.description}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#86868b] transition group-hover:translate-x-0.5 group-hover:text-[#1d1d1f]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
