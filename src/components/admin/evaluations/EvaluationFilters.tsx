import { AlertTriangle, Search } from "lucide-react";
import type { AssignedFilter, StatusFilter } from "./evaluationUi";

interface Counts {
  total: number;
  pending: number;
  atendimento: number;
  concluido: number;
  recusado: number;
  late: number;
}

interface EvaluationFiltersProps {
  status: StatusFilter;
  assigned: AssignedFilter;
  late: boolean;
  search: string;
  counts: Counts | undefined;
  onStatusChange: (status: StatusFilter) => void;
  onAssignedChange: (assigned: AssignedFilter) => void;
  onLateChange: (late: boolean) => void;
  onSearchChange: (search: string) => void;
}

const STATUS_CHIPS: { value: StatusFilter; label: string; key: keyof Counts; active: string }[] = [
  { value: "todos", label: "Todas", key: "total", active: "text-[#1d1d1f]" },
  { value: "pendente", label: "Pendentes", key: "pending", active: "text-amber-700" },
  { value: "atendimento", label: "Em atendimento", key: "atendimento", active: "text-blue-700" },
  { value: "concluido", label: "Concluídas", key: "concluido", active: "text-emerald-700" },
  { value: "recusado", label: "Recusadas", key: "recusado", active: "text-neutral-700" },
];

const ASSIGNED_OPTIONS: { value: AssignedFilter; label: string }[] = [
  { value: "me", label: "Minhas" },
  { value: "none", label: "Sem responsável" },
  { value: "any", label: "Todas" },
];

/** Chips de status com contadores, responsável, atrasadas e busca. */
export default function EvaluationFilters({
  status,
  assigned,
  late,
  search,
  counts,
  onStatusChange,
  onAssignedChange,
  onLateChange,
  onSearchChange,
}: EvaluationFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-max items-center gap-1 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-1">
          {STATUS_CHIPS.map((chip) => {
            const selected = status === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onStatusChange(chip.value)}
                className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition ${
                  selected ? `bg-white shadow-xs ${chip.active}` : "text-[#6e6e73] hover:text-[#1d1d1f]"
                }`}
              >
                {chip.label}
                {counts && <span className="ml-1 tabular-nums opacity-70">({counts[chip.key]})</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-1" role="group" aria-label="Responsável">
          {ASSIGNED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={assigned === opt.value}
              onClick={() => onAssignedChange(opt.value)}
              className={`min-h-10 flex-1 rounded-lg px-3 text-xs font-semibold transition sm:flex-none ${
                assigned === opt.value ? "bg-white text-[#1d1d1f] shadow-xs" : "text-[#6e6e73] hover:text-[#1d1d1f]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-pressed={late}
          onClick={() => onLateChange(!late)}
          className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
            late ? "border-red-500/30 bg-red-50 text-red-700" : "border-[#e5e5e7] bg-white text-[#6e6e73] hover:bg-[#f5f5f7]"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Atrasadas
          {counts && <span className="tabular-nums">({counts.late})</span>}
        </button>

        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar cliente, fone ou modelo..."
            aria-label="Buscar avaliações"
            className="h-11 w-full rounded-xl border border-[#e5e5e7] bg-white pl-9 pr-3 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15"
          />
        </div>
      </div>
    </div>
  );
}
