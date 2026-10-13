import {
  DEFECT_KEYS,
  DEFECT_LABELS,
  VISUAL_ADJUSTMENT_KEYS,
  VISUAL_ADJUSTMENT_LABELS,
  type DefectKey,
  type DefectRule,
  type ValuationAdjustments,
  type ValuationConfig,
  type VisualAdjustmentKey,
} from "@contracts/types";

const cell =
  "w-20 rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] px-2 py-1 text-right text-xs font-semibold text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:bg-white";

interface Props {
  config: ValuationConfig;
  onChange: (next: ValuationConfig) => void;
}

/** Editor dos descontos do motor: estado visual, defeitos (% e R$), bateria e faixa de valores. */
export default function ValuationAdjustmentsEditor({ config, onChange }: Props) {
  // O servidor devolve a configuração completa (padrões aplicados). Enquanto ela carrega, a tela de
  // configurações usa um placeholder sem `adjustments`: não há o que editar ainda.
  if (!config.adjustments) return null;
  const adj = config.adjustments as ValuationAdjustments;
  const setAdj = (patch: Partial<ValuationAdjustments>) =>
    onChange({ ...config, adjustments: { ...adj, ...patch } });
  const setVisual = (key: VisualAdjustmentKey, value: string) =>
    setAdj({ visual: { ...adj.visual, [key]: Number(value) || 0 } });
  const setDefect = (key: DefectKey, patch: Partial<DefectRule>) =>
    setAdj({ defects: { ...adj.defects, [key]: { ...adj.defects[key], ...patch } } });

  return (
    <div className="mt-5 space-y-5 rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-4">
      <div>
        <h4 className="font-display text-sm font-bold text-[#1d1d1f]">Descontos do motor</h4>
        <p className="mt-0.5 text-[11px] text-[#86868b]">
          O que o motor desconta quando o aparelho não está perfeito. Teste cada mudança no simulador antes de salvar.
        </p>
      </div>

      <section>
        <h5 className="text-xs font-bold text-[#1d1d1f]">Estado visual (% sobre o valor)</h5>
        <p className="text-[11px] text-[#86868b]">Negativo desconta, positivo acrescenta.</p>
        <div className="mt-2 divide-y divide-[#f0f0f2] rounded-lg border border-[#e5e5e7] bg-white">
          {VISUAL_ADJUSTMENT_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-[#1d1d1f]">
              <span>{VISUAL_ADJUSTMENT_LABELS[key]}</span>
              <span className="flex items-center gap-1">
                <input type="number" step="1" min={-90} max={30} value={adj.visual[key]} onChange={(e) => setVisual(key, e.target.value)} className={cell} />%
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h5 className="text-xs font-bold text-[#1d1d1f]">Defeitos e peças trocadas</h5>
        <p className="text-[11px] text-[#86868b]">
          Aplicado quando o cliente responde que o item <b>não funciona</b> ou <b>não é original</b>. O desconto é o percentual mais o valor fixo (por exemplo, o custo da peça).
          Com “Conferir na loja” marcado, a avaliação sai com o aviso para a equipe decidir o desconto pessoalmente.
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-[#e5e5e7] bg-white">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b border-[#f0f0f2] text-left text-[11px] text-[#6e6e73]">
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-2 py-2 font-semibold">Desconto %</th>
                <th className="px-2 py-2 font-semibold">+ R$ fixo</th>
                <th className="px-2 py-2 font-semibold">Conferir na loja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f2]">
              {DEFECT_KEYS.map((key) => (
                <tr key={key}>
                  <td className="px-3 py-2 text-[#1d1d1f]">{DEFECT_LABELS[key]}</td>
                  <td className="px-2 py-2">
                    <input type="number" step="1" min={0} max={90} aria-label={`${DEFECT_LABELS[key]}: desconto em %`} value={adj.defects[key].percent} onChange={(e) => setDefect(key, { percent: Number(e.target.value) || 0 })} className={cell} />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" step="50" min={0} max={20000} aria-label={`${DEFECT_LABELS[key]}: desconto fixo em R$`} value={adj.defects[key].reais} onChange={(e) => setDefect(key, { reais: Number(e.target.value) || 0 })} className={cell} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" aria-label={`${DEFECT_LABELS[key]}: conferir na loja`} checked={adj.defects[key].manual} onChange={(e) => setDefect(key, { manual: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-[#6e6e73]">Bateria: limite considerado bom (%)</span>
          <input type="number" min={60} max={95} value={config.minBatteryThreshold} onChange={(e) => onChange({ ...config, minBatteryThreshold: Math.min(95, Math.max(60, Number(e.target.value) || 80)) })} className={cell} />
          <span className="mt-1 block text-[11px] text-[#86868b]">Abaixo disso o desconto cai de forma gradual até o máximo.</span>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-[#6e6e73]">Cliente não sabe a bateria (desconto %)</span>
          <input type="number" min={0} max={50} value={adj.batteryUnknownPercent} onChange={(e) => setAdj({ batteryUnknownPercent: Number(e.target.value) || 0 })} className={cell} />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-semibold text-[#6e6e73]">Faixa mostrada: valor ± (%)</span>
          <input type="number" min={0} max={25} value={adj.rangePercent} onChange={(e) => setAdj({ rangePercent: Number(e.target.value) || 0 })} className={cell} />
          <span className="mt-1 block text-[11px] text-[#86868b]">Com 5%, um valor de R$ 2.000 vira R$ 1.900 a R$ 2.100.</span>
        </label>
      </section>
    </div>
  );
}
