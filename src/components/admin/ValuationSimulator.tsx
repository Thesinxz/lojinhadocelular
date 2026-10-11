import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import type { ValuationConfig } from "@contracts/types";
import {
  evaluateDevice,
  formatBRL,
  IPHONE_REFERENCE_PRICES,
  POPULAR_CONFIG_IPHONES,
  type ValuationResult,
} from "@/lib/valuationEngine";

const VISUAL_OPTIONS = [
  "Parece novo, sem marcas",
  "Pouquíssimas marcas de uso",
  "Marcas normais do dia a dia",
  "Riscos ou amassados visíveis",
  "Tela ou tampa com trinco",
];
const FALLBACK_STORAGE = ["128GB", "256GB", "512GB", "1TB"];

const fieldCls =
  "w-full rounded-lg border border-[#e5e5e7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3]";

function rangeText(r: ValuationResult): string {
  return r.priceable ? `${formatBRL(r.minEstimatedValue)} a ${formatBRL(r.maxEstimatedValue)}` : "Sob consulta";
}

interface ValuationSimulatorProps {
  /** Configuração em edição (ainda não salva). */
  config: ValuationConfig;
  /** Configuração já salva, para comparar o efeito das alterações. */
  savedConfig: ValuationConfig;
}

/** Mostra o valor que o motor ofereceria, com os números em edição, antes de salvar. */
export default function ValuationSimulator({ config, savedConfig }: ValuationSimulatorProps) {
  const [model, setModel] = useState("iPhone 13");
  const [storage, setStorage] = useState("128GB");
  const [battery, setBattery] = useState(90);
  const [visual, setVisual] = useState(VISUAL_OPTIONS[1]);
  const [hasBox, setHasBox] = useState(false);
  const [loyal, setLoyal] = useState(false);

  const storageOptions = useMemo(() => {
    const caps = Array.from(new Set(IPHONE_REFERENCE_PRICES.filter((p) => p.model === model).map((p) => p.capacity)));
    return caps.length ? caps : FALLBACK_STORAGE;
  }, [model]);
  const effectiveStorage = storageOptions.includes(storage) ? storage : storageOptions[0];

  const input = {
    model,
    storage: effectiveStorage,
    batteryPercent: battery,
    visualCondition: visual,
    faceId: "Sim",
    screenOriginal: "Sim",
    batteryOriginal: "Sim",
    camerasOk: "Sim",
    audioOk: "Sim",
    chargingPortOk: "Sim",
    openedBefore: "Não",
    icloudFree: "Sim",
    hasBox: hasBox ? "Sim" : "Não",
    purchaseLocation: loyal ? "Lojinha do Celular" : "",
  };
  const now = useMemo(() => evaluateDevice(input, config), [input.model, effectiveStorage, battery, visual, hasBox, loyal, config]);
  const before = useMemo(() => evaluateDevice(input, savedConfig), [input.model, effectiveStorage, battery, visual, hasBox, loyal, savedConfig]);
  const changed = now.priceable && before.priceable && (now.minEstimatedValue !== before.minEstimatedValue || now.maxEstimatedValue !== before.maxEstimatedValue);
  const delta = now.minEstimatedValue - before.minEstimatedValue;

  return (
    <div className="mt-5 rounded-xl border border-[#0071e3]/25 bg-[#0071e3]/[0.04] p-4">
      <h4 className="flex items-center gap-2 text-sm font-bold text-[#1d1d1f]">
        <Calculator className="h-4 w-4 text-[#0071e3]" /> Simulador: quanto o motor oferece?
      </h4>
      <p className="mt-0.5 text-[11px] text-[#86868b]">
        Usa os números desta tela, mesmo antes de salvar. Aparelho sem defeitos, só o que você escolher abaixo muda.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-[11px] font-semibold text-[#6e6e73]">Modelo</span>
          <select value={model} onChange={(e) => setModel(e.target.value)} className={fieldCls}>
            {POPULAR_CONFIG_IPHONES.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#6e6e73]">Capacidade</span>
          <select value={effectiveStorage} onChange={(e) => setStorage(e.target.value)} className={fieldCls}>
            {storageOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-[#6e6e73]">Bateria (%)</span>
          <input
            type="number"
            min={50}
            max={100}
            value={battery}
            onChange={(e) => setBattery(Math.min(100, Math.max(50, Number(e.target.value) || 100)))}
            className={fieldCls}
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-[11px] font-semibold text-[#6e6e73]">Estado visual</span>
          <select value={visual} onChange={(e) => setVisual(e.target.value)} className={fieldCls}>
            {VISUAL_OPTIONS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#1d1d1f]">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={hasBox} onChange={(e) => setHasBox(e.target.checked)} /> Tem caixa original
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={loyal} onChange={(e) => setLoyal(e.target.checked)} /> Cliente da Lojinha (bônus de fidelidade)
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-[#e5e5e7] bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Oferta com estes números</p>
        <p className="font-display text-xl font-bold text-[#1d1d1f]">{rangeText(now)}</p>
        {!now.priceable && (
          <p className="mt-1 text-xs text-amber-700">Este modelo ainda não tem preço base: defina na tabela abaixo.</p>
        )}
        {changed && (
          <p className={`mt-1 text-xs font-semibold ${delta < 0 ? "text-red-700" : "text-emerald-700"}`}>
            Antes de alterar (salvo): {rangeText(before)} · {delta > 0 ? "+" : ""}
            {formatBRL(delta)} no valor mínimo
          </p>
        )}
        {now.priceable && !changed && <p className="mt-1 text-[11px] text-[#86868b]">Sem diferença para o que está salvo.</p>}
        {now.priceable && now.highlights.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[11px] text-[#6e6e73]">
            {now.highlights.map((h) => (
              <li key={h}>• {h}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
