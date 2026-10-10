import { Link } from "react-router";
import { ChevronRight, Hand, Loader2, MapPin, Smartphone } from "lucide-react";
import { formatBRL } from "@contracts/types";
import { detectIphoneModel, getIphoneModelColorImage } from "@/lib/iphoneCatalog";
import AssigneeBadge from "./AssigneeBadge";
import { STATUS_CONFIG, timeAgo, unitLabel, type EvaluationRow } from "./evaluationUi";

interface EvaluationListItemProps {
  item: EvaluationRow;
  currentUserId: number;
  claiming: boolean;
  onClaim: (id: number) => void;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
}

/** Linha da lista: cliente, aparelho, unidade, tempo, atraso, responsável, valores e status. */
export default function EvaluationListItem({
  item,
  currentUserId,
  claiming,
  onClaim,
  selected = false,
  onToggleSelect,
}: EvaluationListItemProps) {
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pendente;
  const thumbUrl = getIphoneModelColorImage(detectIphoneModel(item.model), item.color ?? undefined);
  const device = [item.model, item.storage, item.color].filter(Boolean).join(" · ");

  return (
    <li
      className={`relative rounded-2xl border bg-white shadow-2xs transition hover:shadow-sm ${
        selected ? "border-[#0071e3] ring-2 ring-[#0071e3]/20" : "border-[#e5e5e7]"
      }`}
    >
      {onToggleSelect && (
        <label className="absolute right-1 top-1 z-10 flex h-11 w-11 cursor-pointer items-center justify-center">
          <span className="sr-only">Selecionar avaliação de {item.name}</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item.id)}
            className="h-4 w-4 cursor-pointer"
          />
        </label>
      )}
      <Link
        to={`/admin/avaliacoes/${item.id}`}
        className={`flex items-start gap-3 p-4 pr-10 sm:gap-4 ${
          item.assignedUserId === null ? "pb-16 sm:pb-4 sm:pr-36" : ""
        }`}
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-1">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <Smartphone className="h-7 w-7 text-[#86868b]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-display text-base font-bold text-[#1d1d1f]">{item.name}</h3>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.bg} ${status.text} ${status.border}`}
            >
              {status.label}
            </span>
            {item.isLate && (
              <span className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                Atrasada
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-[#1d1d1f]">{device}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#86868b]">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {unitLabel(item.unit) || "Sem unidade"}
            </span>
            <span title={new Date(item.createdAt).toLocaleString("pt-BR")}>{timeAgo(item.createdAt)}</span>
            {item.offeredValue !== null && <span>Oferecido {formatBRL(item.offeredValue)}</span>}
            {item.closedValue !== null && (
              <span className="font-semibold text-emerald-700">Fechado {formatBRL(item.closedValue)}</span>
            )}
          </div>
          <div className="mt-2">
            <AssigneeBadge name={item.assignedUserName} isMe={item.assignedUserId === currentUserId} />
          </div>
        </div>
      </Link>

      <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c7c7cc]" />

      {item.assignedUserId === null && (
        <button
          type="button"
          onClick={() => onClaim(item.id)}
          disabled={claiming}
          className="absolute bottom-3 right-9 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#0071e3] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0077ed] disabled:opacity-50"
        >
          {claiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hand className="h-3.5 w-3.5" />}
          Pegar
        </button>
      )}
    </li>
  );
}
