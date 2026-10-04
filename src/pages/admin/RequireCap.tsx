import type { ReactNode } from "react";
import { Link } from "react-router";
import { ShieldOff } from "lucide-react";
import { useAdminSession } from "@/lib/adminSession";
import type { Capability } from "@contracts/permissions";

export function NoPermission() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[#e5e5e7] bg-white p-8 text-center shadow-2xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f7] text-[#86868b]">
        <ShieldOff className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-lg font-bold text-[#1d1d1f]">Sem permissão</h2>
      <p className="mt-1 text-sm text-[#86868b]">Esta área é exclusiva do dono da loja.</p>
      <Link
        to="/admin"
        className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#1d1d1f] px-5 text-sm font-semibold text-white hover:bg-black"
      >
        Voltar ao início
      </Link>
    </div>
  );
}

/** Esconde a rota de quem não tem a permissão. A checagem real continua no servidor. */
export function RequireCap({ cap, children }: { cap: Capability; children: ReactNode }) {
  const { can } = useAdminSession();
  if (!can(cap)) return <NoPermission />;
  return <>{children}</>;
}
