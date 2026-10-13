import { detectIphoneModel } from "@/lib/iphoneCatalog";
import {
  getIphoneSpecs,
  PERFORMANCE_LABELS,
  type IphoneSpecSheet,
} from "@/lib/iphoneSpecs";

export function PerformanceBar({
  level,
}: {
  level: IphoneSpecSheet["performance"];
}) {
  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= level ? "bg-[#0071e3]" : "bg-neutral-200"}`}
          />
        ))}
      </div>
      <span className="mt-1 block text-xs text-neutral-500">
        {PERFORMANCE_LABELS[level]}
      </span>
    </div>
  );
}

/** Ficha técnica do modelo na página do produto. Não renderiza nada se o modelo não tiver ficha. */
export default function SpecSheet({ productName }: { productName: string }) {
  const sp = getIphoneSpecs(detectIphoneModel(productName)?.name);
  if (!sp) return null;

  const rows: [string, string][] = [
    ["Processador", sp.chip],
    ["Memória RAM", sp.ram],
    ["Tela", sp.screen],
    ["Câmeras traseiras", sp.rearCamera],
    ["Câmera frontal", sp.frontCamera],
    ["Bateria", sp.battery],
    ["Conector", sp.port],
  ];

  return (
    <div className="mt-5 rounded-2xl border border-neutral-200/90 bg-white p-4">
      <h3 className="font-display text-sm font-bold text-neutral-900">
        Ficha técnica do modelo
      </h3>
      <p className="mt-1 text-xs text-neutral-500">{sp.highlight}</p>
      <div className="mt-3">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
          Desempenho
        </span>
        <div className="mt-1.5">
          <PerformanceBar level={sp.performance} />
        </div>
      </div>
      <dl className="mt-3 divide-y divide-neutral-100 text-sm">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start justify-between gap-4 py-2"
          >
            <dt className="shrink-0 text-neutral-500">{label}</dt>
            <dd className="text-right font-semibold text-neutral-900">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-neutral-400">
        Especificações do fabricante, valores aproximados.
      </p>
    </div>
  );
}
