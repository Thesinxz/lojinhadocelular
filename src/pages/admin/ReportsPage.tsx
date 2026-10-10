import { useMemo, useState } from "react";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatBRL, EVALUATION_STATUS_LABELS, REFUSAL_REASONS } from "@contracts/types";
import { useAdminUnit } from "@/lib/adminSession";
import { formatDateTime } from "@/components/admin/evaluations/evaluationUi";
import { formatMinutes, formatPercent } from "@/components/admin/dashboard/dashboardUi";

type Preset = "7" | "30" | "90" | "mes" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "mes", label: "Este mês" },
  { id: "custom", label: "Personalizado" },
];

const UNIT_LABEL: Record<string, string> = { jardim: "Jardim", gll: "Guia Lopes", "": "Sem loja definida" };

const inputCls =
  "min-h-11 rounded-xl border border-[#e5e5e7] bg-white px-3 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/15";

function dayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function rangeFor(preset: Preset, customFrom: string, customTo: string): { from: Date; to: Date } | null {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (preset === "custom") {
    if (!customFrom || !customTo) return null;
    return { from: new Date(`${customFrom}T00:00:00`), to: new Date(`${customTo}T23:59:59.999`) };
  }
  if (preset === "mes") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: end };
  const days = Number(preset);
  return { from: new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1)), to: end };
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-[#1d1d1f]">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[#86868b]">{hint}</p>}
    </div>
  );
}

function Bars({ items, empty }: { items: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-[#86868b]">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-[#1d1d1f]">{item.label}</span>
            <span className="shrink-0 font-semibold text-[#6e6e73]">{item.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f0f0f2]">
            <div className="h-full rounded-full bg-[#1d1d1f]" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
      <h3 className="mb-3 font-display text-sm font-bold text-[#1d1d1f]">{title}</h3>
      {children}
    </section>
  );
}

/** Relatórios das avaliações por período, com exportação em CSV. */
export default function ReportsPage() {
  const { unit } = useAdminUnit();
  const utils = trpc.useUtils();
  const [preset, setPreset] = useState<Preset>("30");
  const [customFrom, setCustomFrom] = useState(dayKey(new Date()));
  const [customTo, setCustomTo] = useState(dayKey(new Date()));
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const unitInput = unit === "todas" ? undefined : unit;
  const query = trpc.admin.evaluationReport.useQuery(
    { from: range?.from ?? new Date(0), to: range?.to ?? new Date(0), unit: unitInput },
    { enabled: Boolean(range), staleTime: 30_000 },
  );
  const report = query.data;

  async function exportCsv() {
    if (!range) return;
    setExporting(true);
    try {
      const rows = await utils.admin.evaluationExport.fetch({ ...range, unit: unitInput });
      const header = ["#", "Recebida em", "Cliente", "WhatsApp", "Aparelho", "Loja", "Status", "Motivo da recusa", "Valor oferecido", "Valor fechado", "Atendente"];
      const lines = rows.map((r) =>
        [
          r.id,
          formatDateTime(r.createdAt),
          r.name,
          r.whatsapp,
          [r.model, r.storage].filter(Boolean).join(" "),
          UNIT_LABEL[r.unit ?? ""] ?? "",
          EVALUATION_STATUS_LABELS[r.status],
          REFUSAL_REASONS.find((x) => x.value === r.refusalReason)?.label ?? "",
          r.offeredValue === null ? "" : formatBRL(r.offeredValue),
          r.closedValue === null ? "" : formatBRL(r.closedValue),
          r.assignedUserName ?? "",
        ]
          .map(csvCell)
          .join(";"),
      );
      const blob = new Blob(["﻿" + [header.map(csvCell).join(";"), ...lines].join("\r\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `avaliacoes-${dayKey(range.from)}-a-${dayKey(range.to)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} avaliações exportadas.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  }

  const t = report?.totals;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-[#1d1d1f]">
            <BarChart3 className="h-6 w-6" /> Relatórios
          </h2>
          <p className="mt-1 text-sm text-[#86868b]">
            Avaliações recebidas no período e como terminaram
            {unit === "todas" ? "." : unit === "jardim" ? " (só Jardim)." : " (só Guia Lopes)."}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!range || exporting}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e5e5e7] bg-white px-4 text-sm font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            aria-pressed={preset === p.id}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition ${
              preset === p.id ? "bg-[#1d1d1f] text-white" : "border border-[#e5e5e7] bg-white text-[#6e6e73] hover:bg-[#f5f5f7]"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <>
            <label className="sr-only" htmlFor="rep-from">De</label>
            <input id="rep-from" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className={inputCls} />
            <label className="sr-only" htmlFor="rep-to">Até</label>
            <input id="rep-to" type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className={inputCls} />
          </>
        )}
      </div>

      {query.isLoading && <div className="h-48 animate-pulse rounded-2xl bg-[#f5f5f7]" />}
      {query.isError && (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{query.error.message}</p>
      )}

      {report && t && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Recebidas" value={String(t.received)} hint={`${t.pending} pendentes · ${t.inProgress} em atendimento`} />
            <Stat label="Conversão" value={formatPercent(t.conversionRate)} hint={`${t.concluded} concluídas · ${t.refused} recusadas`} />
            <Stat label="Total fechado" value={formatBRL(t.totalClosedCents)} hint={t.avgTicketCents === null ? undefined : `Ticket médio ${formatBRL(t.avgTicketCents)}`} />
            <Stat
              label="1ª resposta"
              value={formatMinutes(t.avgResponseMinutes)}
              hint={t.medianResponseMinutes === null ? undefined : `Mediana ${formatMinutes(t.medianResponseMinutes)}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sem resposta" value={String(t.unanswered)} hint="Pendentes sem 1ª resposta" />
            <Stat label="Oferta média" value={t.avgOfferedCents === null ? "—" : formatBRL(t.avgOfferedCents)} />
            <Stat label="Clientes recorrentes" value={String(t.repeatCustomers)} hint="Mesmo WhatsApp, 2+ avaliações" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Recebidas por dia">
              <Bars
                items={report.byDay.map((d) => ({ label: d.date.split("-").reverse().slice(0, 2).join("/"), value: d.received }))}
                empty="Nenhuma avaliação no período."
              />
            </Panel>
            <Panel title="Motivos de recusa">
              <Bars
                items={report.refusalReasons.map((r) => ({
                  label: REFUSAL_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason,
                  value: r.count,
                }))}
                empty="Nenhuma recusa no período."
              />
            </Panel>
            <Panel title="Aparelhos mais avaliados">
              <Bars items={report.topModels.map((m) => ({ label: m.model, value: m.count }))} empty="Sem dados." />
            </Panel>
            <Panel title="Por loja">
              <ul className="divide-y divide-[#f0f0f2]">
                {report.byUnit.length === 0 && <li className="text-sm text-[#86868b]">Sem dados.</li>}
                {report.byUnit.map((u) => (
                  <li key={u.unit} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-medium text-[#1d1d1f]">{UNIT_LABEL[u.unit] ?? u.unit}</span>
                    <span className="text-xs text-[#6e6e73]">
                      {u.received} recebidas · {u.concluded} concluídas · {formatBRL(u.totalClosedCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {report.ranking && (
            <Panel title="Ranking por atendente">
              {report.ranking.length === 0 ? (
                <p className="text-sm text-[#86868b]">Nenhuma avaliação atribuída no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wider text-[#86868b]">
                      <tr>
                        <th className="py-2 pr-3">Atendente</th>
                        <th className="py-2 pr-3">Atendidas</th>
                        <th className="py-2 pr-3">Concluídas</th>
                        <th className="py-2">Fechado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f2]">
                      {report.ranking.map((r) => (
                        <tr key={`${r.userId}-${r.userName}`}>
                          <td className="py-2 pr-3 font-medium text-[#1d1d1f]">{r.userName}</td>
                          <td className="py-2 pr-3">{r.handled}</td>
                          <td className="py-2 pr-3">{r.concluded}</td>
                          <td className="py-2">{formatBRL(r.totalClosedCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
