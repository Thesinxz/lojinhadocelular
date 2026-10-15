import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";

const PRESETS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

const SOURCE_LABEL: Record<string, string> = {
  direto: "Direto / link",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  google: "Google",
  tiktok: "TikTok",
  youtube: "YouTube",
  outros: "Outros sites",
};
const DEVICE_LABEL: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tablet" };
const SITE_LABEL: Record<string, string> = { loja: "Loja (vitrine)", trocafacil: "Troca Fácil" };

const nf = new Intl.NumberFormat("pt-BR");

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-[#1d1d1f]">{nf.format(value)}</p>
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
            <span className="shrink-0 font-semibold text-[#6e6e73]">{nf.format(item.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f0f0f2]">
            <div className="h-full rounded-full bg-[#1d1d1f]" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs">
      <h3 className="mb-3 font-display text-sm font-bold text-[#1d1d1f]">{title}</h3>
      {children}
    </section>
  );
}

function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

export default function TrafficPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError } = trpc.admin.traffic.useQuery({ days }, { staleTime: 60_000 });

  const maxViews = Math.max(1, ...(data?.daily.map((d) => d.views) ?? [1]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#86868b]">
          Acessos ao site, sem cookies e sem dados pessoais. Robôs não são contados.
        </p>
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${
                days === p.days
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                  : "border-[#e5e5e7] bg-white text-[#6e6e73] hover:bg-[#f5f5f7]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex h-40 items-center justify-center text-[#86868b]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {isError && <p className="text-sm text-red-600">Não foi possível carregar os acessos.</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Visitantes hoje" value={data.totals.visitorsToday} hint={`${nf.format(data.totals.visitsToday)} páginas vistas`} />
            <Stat label={`Visitantes (${days} dias)`} value={data.totals.visitors} hint="Soma dos visitantes de cada dia" />
            <Stat label={`Páginas vistas (${days} dias)`} value={data.totals.views} />
            <Stat
              label="Média por dia"
              value={Math.round(data.totals.visitors / data.days)}
              hint="Visitantes por dia"
            />
          </div>

          <Card title="Visitantes por dia">
            <div className="flex h-36 items-end gap-px sm:gap-0.5" role="img" aria-label="Gráfico de páginas vistas por dia">
              {data.daily.map((d) => (
                <div
                  key={d.day}
                  className="group relative flex h-full flex-1 items-end"
                  title={`${shortDay(d.day)}: ${d.visitors} visitantes, ${d.views} páginas`}
                >
                  <div
                    className="w-full rounded-t bg-[#d2d2d7]"
                    style={{ height: `${(d.views / maxViews) * 100}%`, minHeight: d.views ? 2 : 0 }}
                  >
                    <div className="w-full rounded-t bg-[#1d1d1f]" style={{ height: `${d.views ? (d.visitors / d.views) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-[#86868b]">
              <span>{shortDay(data.daily[0].day)}</span>
              <span>escuro = visitantes · cinza = páginas vistas</span>
              <span>{shortDay(data.daily[data.daily.length - 1].day)}</span>
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Páginas mais vistas">
              <Bars
                empty="Ainda sem acessos no período."
                items={data.topPages.map((p) => ({ label: p.path === "/" ? "/ (início)" : p.path, value: p.views }))}
              />
            </Card>
            <Card title="De onde vêm (visitas)">
              <Bars
                empty="Ainda sem acessos no período."
                items={data.sources.map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.visits }))}
              />
            </Card>
            <Card title="Aparelho (visitantes)">
              <Bars
                empty="Ainda sem acessos no período."
                items={data.devices.map((d) => ({ label: DEVICE_LABEL[d.device] ?? d.device, value: d.visitors }))}
              />
            </Card>
            <Card title="Loja x Troca Fácil (páginas vistas)">
              <Bars
                empty="Ainda sem acessos no período."
                items={data.sites.map((s) => ({ label: SITE_LABEL[s.site] ?? s.site, value: s.views }))}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
