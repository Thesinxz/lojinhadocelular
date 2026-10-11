import { useMemo } from "react";
import type { ValuationConfig } from "@contracts/types";
import { formatBRL } from "@/lib/valuationEngine";
import { buildPriceList, type PriceListRow } from "@/lib/priceList";

const SOURCE_LABEL: Record<PriceListRow["suggestedSource"], string> = {
  personalizado: "personalizado",
  tabela: "tabela oficial",
  calculado: "calculado pelo modelo",
  "sem-preco": "sem preço",
};

interface Props {
  config: ValuationConfig;
  onChange: (next: ValuationConfig) => void;
  search: string;
  capacity: string;
  onlyEdited: boolean;
}

function matchesCapacity(rowCapacity: string, selected: string): boolean {
  return selected === "all" || rowCapacity.toLowerCase() === selected.toLowerCase();
}

/** Lista fixa: um preço por modelo + armazenamento. Vazio = o motor calcula (valor sugerido aparece no campo). */
export default function FixedPriceList({ config, onChange, search, capacity, onlyEdited }: Props) {
  const custom = config.customBasePrices ?? {};
  const list = useMemo(() => buildPriceList(custom), [custom]);

  const setPrice = (key: string, raw: string) => {
    const value = Number(raw);
    const next = { ...custom };
    if (!raw || !(value > 0)) delete next[key];
    else next[key] = Math.round(value);
    onChange({ ...config, customBasePrices: next });
  };

  const fillModel = (rows: PriceListRow[]) => {
    const next = { ...custom };
    for (const row of rows) if (!(next[row.key] > 0) && row.suggested > 0) next[row.key] = row.suggested;
    onChange({ ...config, customBasePrices: next });
  };

  const q = search.toLowerCase().trim();
  const visible = list
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .map((m) => ({
      ...m,
      shown: m.rows.filter((r) => matchesCapacity(r.capacity, capacity) && (!onlyEdited || custom[r.key] > 0)),
    }))
    .filter((m) => m.shown.length > 0);

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-[#e5e5e7] bg-white p-8 text-center text-xs text-[#86868b]">
        Nenhum modelo encontrado com os filtros aplicados.
      </div>
    );
  }

  return (
    <div className="max-h-[560px] divide-y divide-[#f0f0f2] overflow-y-auto rounded-xl border border-[#e5e5e7] bg-white">
      {visible.map((m) => {
        const defined = m.rows.filter((r) => custom[r.key] > 0).length;
        const missing = m.rows.filter((r) => !(custom[r.key] > 0) && r.suggested <= 0).length;
        return (
          <section key={m.key} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h5 className="text-xs font-bold text-[#1d1d1f]">{m.name}</h5>
                <span className="text-[10px] text-[#86868b]">{m.year}</span>
                <span className="rounded-full border border-[#e5e5e7] bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-semibold text-[#6e6e73]">
                  {defined}/{m.rows.length} com preço próprio
                </span>
                {missing > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    {missing} sem preço
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fillModel(m.rows)}
                className="text-[11px] font-semibold text-[#0071e3] hover:underline cursor-pointer"
                title="Grava os valores sugeridos nas linhas ainda vazias, para você ajustar depois"
              >
                Preencher com os valores atuais
              </button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {m.shown.map((row) => {
                const own = custom[row.key] > 0 ? custom[row.key] : "";
                return (
                  <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="w-16 font-semibold text-[#1d1d1f]">{row.capacity}</span>
                    <span className="min-w-0 flex-1 text-[11px] text-[#86868b]">
                      {own
                        ? "preço próprio"
                        : row.suggested > 0
                          ? `motor usa ${formatBRL(row.suggested)} (${SOURCE_LABEL[row.suggestedSource]})`
                          : "sob consulta até você definir"}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-[#6e6e73]">R$</span>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        inputMode="numeric"
                        aria-label={`${m.name} ${row.capacity}: preço de compra`}
                        value={own}
                        placeholder={row.suggested > 0 ? String(row.suggested) : "definir"}
                        onChange={(e) => setPrice(row.key, e.target.value)}
                        className={`w-24 rounded-lg border px-2.5 py-1 text-right text-xs font-semibold outline-none transition ${
                          own
                            ? "border-[#0071e3] bg-blue-50/50 text-[#0071e3]"
                            : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] focus:border-[#0071e3] focus:bg-white"
                        }`}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
