import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MODEL_REPAIR_KEYS, MODEL_REPAIR_LABELS, type ModelRepairKey, type ValuationAdjustments, type ValuationConfig } from "@contracts/types";
import type { PriceListModel, PriceListRow } from "@contracts/valuation";
import { formatBRL, previousGenerationName } from "@/lib/iphoneKeys";

const SOURCE_LABEL: Record<PriceListRow["suggestedSource"], string> = {
  personalizado: "personalizado",
  tabela: "tabela oficial",
  calculado: "calculado pelo modelo",
  "sem-preco": "sem preço",
};

interface Props {
  /** Lista calculada no servidor (modelo × armazenamento × cor, com o valor atual de cada linha). */
  models: PriceListModel[];
  loading?: boolean;
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
export default function FixedPriceList({ models, loading, config, onChange, search, capacity, onlyEdited }: Props) {
  const custom = config.customBasePrices ?? {};
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [openRepairs, setOpenRepairs] = useState<Record<string, boolean>>({});
  const adjustments = (config.adjustments ?? { modelRepairs: {} }) as ValuationAdjustments;
  const modelRepairs = adjustments.modelRepairs ?? {};

  const setRepair = (modelKey: string, item: ModelRepairKey, raw: string) => {
    const value = Number(raw);
    const nextModel = { ...(modelRepairs[modelKey] ?? {}) };
    if (!raw || !(value > 0)) delete nextModel[item];
    else nextModel[item] = Math.round(value);
    const next = { ...modelRepairs };
    if (Object.keys(nextModel).length > 0) next[modelKey] = nextModel;
    else delete next[modelKey];
    onChange({ ...config, adjustments: { ...adjustments, modelRepairs: next } });
  };

  const copyRepairs = (fromKey: string, toKey: string) => {
    onChange({
      ...config,
      adjustments: { ...adjustments, modelRepairs: { ...modelRepairs, [toKey]: { ...(modelRepairs[fromKey] ?? {}) } } },
    });
  };
  const list = models;

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

  // Para modelos sem preço: copia o valor da mesma capacidade na geração anterior (ponto de partida para ajustar).
  const copyFromPrevious = (model: PriceListModel, previous: PriceListModel) => {
    const next = { ...custom };
    for (const row of model.rows) {
      if (next[row.key] > 0 || row.suggested > 0) continue;
      const source = previous.rows.find((r) => r.capacity === row.capacity);
      const value = source ? (custom[source.key] > 0 ? custom[source.key] : source.suggested) : 0;
      if (value > 0) next[row.key] = value;
    }
    onChange({ ...config, customBasePrices: next });
  };

  const q = search.toLowerCase().trim();
  const visible = list
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .map((m) => ({
      ...m,
      shown: m.rows.filter((r) => matchesCapacity(r.capacity, capacity) && (!onlyEdited || custom[r.key] > 0 || r.colors.some((c) => custom[c.key] > 0))),
    }))
    .filter((m) => m.shown.length > 0);

  if (loading && list.length === 0) {
    return <div className="h-40 animate-pulse rounded-xl border border-[#e5e5e7] bg-[#f5f5f7]" />;
  }

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
        const colorPrices = m.rows.reduce((n, r) => n + r.colors.filter((c) => custom[c.key] > 0).length, 0);
        const missing = m.rows.filter((r) => !(custom[r.key] > 0) && r.suggested <= 0).length;
        const repairsSet = Object.keys(modelRepairs[m.key] ?? {}).length;
        const repairsOpen = !!openRepairs[m.key];
        const previousName = previousGenerationName(m.name);
        const previous = previousName ? list.find((x) => x.name === previousName) : undefined;
        return (
          <section key={m.key} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h5 className="text-xs font-bold text-[#1d1d1f]">{m.name}</h5>
                <span className="text-[10px] text-[#86868b]">{m.year}</span>
                <span className="rounded-full border border-[#e5e5e7] bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-semibold text-[#6e6e73]">
                  {defined}/{m.rows.length} com preço próprio
                </span>
                {colorPrices > 0 && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                    {colorPrices} cor{colorPrices > 1 ? "es" : ""} com preço diferente
                  </span>
                )}
                {repairsSet > 0 && (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                    {repairsSet} custo{repairsSet > 1 ? "s" : ""} de reparo
                  </span>
                )}
                {missing > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    {missing} sem preço
                  </span>
                )}
              </div>
              {missing > 0 && previous && (
                <button
                  type="button"
                  onClick={() => copyFromPrevious(m, previous)}
                  className="text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
                  title="Copia o preço de cada capacidade do modelo anterior para as linhas sem preço; depois você ajusta"
                >
                  Copiar valores do {previous.name}
                </button>
              )}
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
                const colorsOwn = row.colors.filter((c) => custom[c.key] > 0).length;
                const open = !!openRows[row.key];
                return (
                  <li key={row.key} className="text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="w-16 font-semibold text-[#1d1d1f]">{row.capacity}</span>
                      <span className="min-w-0 flex-1 text-[11px] text-[#86868b]">
                        {own
                          ? "preço próprio"
                          : row.suggested > 0
                            ? `motor usa ${formatBRL(row.suggested)} (${SOURCE_LABEL[row.suggestedSource]})`
                            : "sob consulta até você definir"}
                      </span>
                      {row.colors.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setOpenRows((prev) => ({ ...prev, [row.key]: !open }))}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] px-2 py-1 text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#e5e5e7] cursor-pointer"
                        >
                          Cores ({colorsOwn > 0 ? `${colorsOwn}/` : ""}
                          {row.colors.length})
                          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
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
                    </div>
                    {open && (
                      <ul className="mt-1.5 space-y-1 rounded-lg border border-[#f0f0f2] bg-[#fbfbfd] p-2">
                        {row.colors.map((color) => {
                          const colorOwn = custom[color.key] > 0 ? custom[color.key] : "";
                          const effective = own || color.suggested;
                          return (
                            <li key={color.key} className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                                  style={{ backgroundColor: color.hex }}
                                />
                                <span className="truncate text-[#1d1d1f]">{color.name}</span>
                                <span className="hidden text-[11px] text-[#86868b] sm:inline">
                                  {colorOwn ? "preço próprio da cor" : effective > 0 ? `usa o valor de ${row.capacity}: ${formatBRL(effective)}` : "sob consulta"}
                                </span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-[#6e6e73]">R$</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={50}
                                  inputMode="numeric"
                                  aria-label={`${m.name} ${row.capacity} ${color.name}: preço de compra`}
                                  value={colorOwn}
                                  placeholder={effective > 0 ? String(effective) : "definir"}
                                  onChange={(e) => setPrice(color.key, e.target.value)}
                                  className={`w-24 rounded-lg border px-2.5 py-1 text-right text-xs font-semibold outline-none transition ${
                                    colorOwn
                                      ? "border-[#0071e3] bg-blue-50/50 text-[#0071e3]"
                                      : "border-[#e5e5e7] bg-white text-[#1d1d1f] focus:border-[#0071e3]"
                                  }`}
                                />
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-2 border-t border-[#f0f0f2] pt-2">
              <button
                type="button"
                aria-expanded={repairsOpen}
                onClick={() => setOpenRepairs((prev) => ({ ...prev, [m.key]: !repairsOpen }))}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline cursor-pointer"
              >
                Custos de reparo deste modelo {repairsSet > 0 ? `(${repairsSet})` : ""}
                {repairsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {repairsOpen && (
                <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                  <p className="text-[11px] text-[#6e6e73]">
                    Quanto descontar (em R$) quando o cliente informar o problema. Preenchido, o valor substitui a regra geral
                    para este modelo; vazio, vale a regra geral (percentual da seção “Descontos do motor”).
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {MODEL_REPAIR_KEYS.map((item) => (
                      <label key={item} className="flex items-center justify-between gap-2 text-xs text-[#1d1d1f]">
                        <span>{MODEL_REPAIR_LABELS[item]}</span>
                        <span className="flex items-center gap-1">
                          <span className="text-[#6e6e73]">R$</span>
                          <input
                            type="number"
                            min={0}
                            step={50}
                            inputMode="numeric"
                            aria-label={`${m.name}: custo de reparo, ${MODEL_REPAIR_LABELS[item]}`}
                            value={modelRepairs[m.key]?.[item] ?? ""}
                            placeholder="regra geral"
                            onChange={(e) => setRepair(m.key, item, e.target.value)}
                            className={`w-24 rounded-lg border px-2 py-1 text-right text-xs font-semibold outline-none transition ${
                              modelRepairs[m.key]?.[item]
                                ? "border-violet-500 bg-white text-violet-800"
                                : "border-[#e5e5e7] bg-white text-[#1d1d1f] focus:border-violet-500"
                            }`}
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                  {previous && repairsSet === 0 && Object.keys(modelRepairs[previous.key] ?? {}).length > 0 && (
                    <button
                      type="button"
                      onClick={() => copyRepairs(previous.key, m.key)}
                      className="mt-2 text-[11px] font-semibold text-violet-700 hover:underline cursor-pointer"
                    >
                      Copiar custos do {previous.name}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
