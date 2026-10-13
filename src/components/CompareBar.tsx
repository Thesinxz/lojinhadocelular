import { Link, useLocation } from "react-router";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/lib/compare";

/** Barra flutuante que aparece quando há aparelhos marcados para comparar. */
export default function CompareBar() {
  const { ids, clear } = useCompare();
  const { pathname } = useLocation();
  if (ids.length === 0 || pathname === "/comparar") return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#1d1d1f] py-2 pl-5 pr-2 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <Scale className="h-4 w-4 text-white/70" />
        <span className="text-xs font-semibold sm:text-sm">
          {ids.length} {ids.length === 1 ? "aparelho" : "aparelhos"} para comparar
        </span>
        {ids.length >= 2 ? (
          <Link
            to="/comparar"
            className="rounded-full bg-[#0071e3] px-4 py-2 text-xs font-semibold transition hover:bg-[#0077ed] sm:text-sm"
          >
            Comparar
          </Link>
        ) : (
          <span className="text-[11px] text-white/60">escolha mais um</span>
        )}
        <button
          type="button"
          onClick={clear}
          aria-label="Limpar comparação"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
