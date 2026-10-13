import { useEffect, useState, useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  Save,
  CreditCard,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Store,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import {
  SETTING_KEYS,
  parseAutoMessages,
  type AutoMessagesConfig,
  DEFAULT_AUTO_MESSAGES,
  parseFees,
  type ValuationConfig,
} from "@contracts/types";
import { parseTemplates, type WhatsappTemplate } from "@/lib/whatsappTemplates";
import ValuationAdjustmentsEditor from "@/components/admin/ValuationAdjustmentsEditor";
import FixedPriceList from "@/components/admin/FixedPriceList";
import PrivacySection from "@/components/admin/PrivacySection";
import ValuationSimulator from "@/components/admin/ValuationSimulator";
import EvaluationSettingsSection from "@/components/admin/evaluations/EvaluationSettingsSection";
import AutoMessagesSection from "@/components/admin/evaluations/AutoMessagesSection";

const TABS = [
  { id: "loja", label: "Loja", icon: Store },
  { id: "tradein", label: "Trade-in e preços", icon: Sparkles },
  { id: "pagamento", label: "Pagamento", icon: CreditCard },
  { id: "mensagens", label: "Mensagens", icon: MessageCircle },
] as const;
type TabId = (typeof TABS)[number]["id"];

function initialTab(): TabId {
  try {
    const hash = window.location.hash.replace("#", "");
    return TABS.some((t) => t.id === hash) ? (hash as TabId) : "loja";
  } catch {
    return "loja";
  }
}

/** Placeholder neutro enquanto a configuração carrega do servidor (não são os valores reais). */
const EMPTY_VALUATION_CONFIG: ValuationConfig = {
  globalMultiplier: 1,
  loyaltyBonusPercent: 0,
  boxBonusReais: 0,
  minBatteryThreshold: 80,
  batteryPenaltyUnder80: 0,
  customBasePrices: {},
};

/** O servidor já devolve a configuração completa (padrões aplicados); aqui só se lê o JSON. */
function readResolvedConfig(raw: string | undefined): ValuationConfig {
  try {
    return raw ? { ...EMPTY_VALUATION_CONFIG, ...(JSON.parse(raw) as ValuationConfig) } : EMPTY_VALUATION_CONFIG;
  } catch {
    return EMPTY_VALUATION_CONFIG;
  }
}

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const query = trpc.admin.getSettings.useQuery();
  const [values, setValues] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [heroText, setHeroText] = useState("");
  // Neutra só até carregar: os padrões e os valores reais vêm do servidor (nada fica no navegador de visitantes).
  const [valuationConfig, setValuationConfig] = useState<ValuationConfig>(EMPTY_VALUATION_CONFIG);
  const [modelFilter, setModelFilter] = useState("");
  const [selectedCapacity, setSelectedCapacity] = useState<string>("all");
  const [onlyCustomFilter, setOnlyCustomFilter] = useState(false);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [autoMessages, setAutoMessages] = useState<AutoMessagesConfig>(DEFAULT_AUTO_MESSAGES);
  const [tab, setTabState] = useState<TabId>(initialTab);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setTab = (next: TabId) => {
    setTabState(next);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {}
  };

  // Tudo o que é editável nesta tela, para detectar alterações não salvas.
  const snapshot = useMemo(
    () => JSON.stringify({ values, fees, heroText, valuationConfig, templates, autoMessages }),
    [values, fees, heroText, valuationConfig, templates, autoMessages],
  );
  const dirty = baseline !== null && snapshot !== baseline;

  useEffect(() => {
    if (baseline === null && query.data && Object.keys(values).length > 0) setBaseline(snapshot);
  }, [baseline, query.data, values, snapshot]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      setBaseline(snapshot);
      utils.admin.getSettings.invalidate();
      utils.shop.settings.invalidate();
      utils.admin.evaluationConfig.invalidate();
      setSaveError(null);
      setSaved(true);
      toast.success("Configurações salvas.");
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      setSaveError(err.message || "Erro ao salvar configurações");
      toast.error(err.message || "Erro ao salvar configurações");
    },
  });

  useEffect(() => {
    if (query.data && Object.keys(values).length === 0) {
      setValues(query.data);
      setTemplates(parseTemplates(query.data[SETTING_KEYS.whatsappTemplates]));
      setAutoMessages(parseAutoMessages(query.data[SETTING_KEYS.autoMessages]));
      const parsed = parseFees(query.data[SETTING_KEYS.installmentFees]);
      setFees(
        Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, String(v).replace(".", ",")]),
        ),
      );
      if (query.data[SETTING_KEYS.valuationConfig]) {
        setValuationConfig(readResolvedConfig(query.data[SETTING_KEYS.valuationConfig]));
      }
      try {
        const imgs = JSON.parse(query.data[SETTING_KEYS.heroImages] ?? "[]");
        setHeroText(Array.isArray(imgs) ? imgs.join("\n") : "");
      } catch {
        setHeroText("");
      }
    }
  }, [query.data, values]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  // Lista de preços calculada no servidor, com um pequeno atraso para não consultar a cada tecla.
  const [debouncedCustomPrices, setDebouncedCustomPrices] = useState<Record<string, number>>({});
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomPrices(valuationConfig.customBasePrices ?? {}), 350);
    return () => clearTimeout(timer);
  }, [valuationConfig.customBasePrices]);
  const priceListQuery = trpc.admin.priceList.useQuery(
    { customBasePrices: debouncedCustomPrices },
    { placeholderData: keepPreviousData, staleTime: 0 },
  );
  const priceList = priceListQuery.data ?? [];

  // Modelos com algum armazenamento sem preço: ficam "sob consulta" para o cliente até serem definidos.
  const pendingPriceModels = useMemo(() => {
    const custom = valuationConfig.customBasePrices ?? {};
    return priceList.filter((m) => m.rows.some((r) => !(custom[r.key] > 0) && r.suggested <= 0));
  }, [priceList, valuationConfig.customBasePrices]);

  const discardChanges = () => {
    if (baseline === null) return;
    try {
      const saved = JSON.parse(baseline) as {
        values: Record<string, string>;
        fees: Record<string, string>;
        heroText: string;
        valuationConfig: ValuationConfig;
        templates: WhatsappTemplate[];
        autoMessages: AutoMessagesConfig;
      };
      setValues(saved.values);
      setFees(saved.fees);
      setHeroText(saved.heroText);
      setValuationConfig(saved.valuationConfig);
      setTemplates(saved.templates);
      setAutoMessages(saved.autoMessages);
    } catch {}
  };

  if (query.isLoading) {
    return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-neutral-200" />;
  }

  return (
    <div className="mt-6 space-y-6">
      <div role="tablist" aria-label="Seções das configurações" className="flex gap-1 overflow-x-auto rounded-2xl border border-[#e5e5e7] bg-white p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
              tab === t.id ? "bg-[#1d1d1f] text-white" : "text-[#6e6e73] hover:bg-[#f5f5f7]"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === "loja" ? "space-y-6" : "hidden"}>
      {/* Lojas */}
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
        <h3 className="font-display text-lg font-bold text-[#1d1d1f]">Unidades</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="WhatsApp Jardim (com DDD, só números)">
            <input value={values[SETTING_KEYS.whatsappJardim] ?? ""} onChange={set(SETTING_KEYS.whatsappJardim)} className={inputCls} placeholder="5567999999999" />
          </Field>
          <Field label="Endereço Jardim">
            <input value={values[SETTING_KEYS.addressJardim] ?? ""} onChange={set(SETTING_KEYS.addressJardim)} className={inputCls} />
          </Field>
          <Field label="Link Google Maps Jardim">
            <input value={values[SETTING_KEYS.mapsJardim] ?? ""} onChange={set(SETTING_KEYS.mapsJardim)} className={inputCls} />
          </Field>
          <div />
          <Field label="WhatsApp Guia Lopes (com DDD, só números)">
            <input value={values[SETTING_KEYS.whatsappGll] ?? ""} onChange={set(SETTING_KEYS.whatsappGll)} className={inputCls} placeholder="5567988888888" />
          </Field>
          <Field label="Endereço Guia Lopes">
            <input value={values[SETTING_KEYS.addressGll] ?? ""} onChange={set(SETTING_KEYS.addressGll)} className={inputCls} />
          </Field>
          <Field label="Link Google Maps Guia Lopes">
            <input value={values[SETTING_KEYS.mapsGll] ?? ""} onChange={set(SETTING_KEYS.mapsGll)} className={inputCls} />
          </Field>
        </div>
      </section>

      </div>

      <div className={tab === "tradein" ? "space-y-6" : "hidden"}>
      {/* Motor de Avaliação Inteligente */}
      <section id="avaliacao" className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5e5e7] pb-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1d1f]">
              <Sparkles className="h-5 w-5 text-[#0071e3]" /> Motor de Avaliação Inteligente (Troca Fácil)
            </h3>
            <p className="mt-1 text-xs text-[#86868b]">
              Configure o algoritmo de pré-avaliação de iPhones aceitos para compra e troca. Ajuste margens, bônus e preços base.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-500/25">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Algoritmo Ativo
          </span>
        </div>

        {pendingPriceModels.length > 0 && (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <span>
              <strong>
                {pendingPriceModels.length} modelo{pendingPriceModels.length > 1 ? "s" : ""} com armazenamento sem preço
              </strong>
              : {pendingPriceModels.map((m) => m.name).join(", ")}. O cliente que escolher
              {pendingPriceModels.length > 1 ? " esses modelos fica" : " esse modelo fica"} sem cotação (“sob consulta”).
            </span>
            <button
              type="button"
              onClick={() => document.getElementById("tabela-precos")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 cursor-pointer"
            >
              Definir agora
            </button>
          </div>
        )}

        {/* Parâmetros Globais */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Multiplicador Global */}
          <div className="rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-4">
            <span className="block text-xs font-semibold text-[#6e6e73]">Multiplicador Geral</span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="50"
                max="150"
                value={Math.round((valuationConfig.globalMultiplier ?? 1.0) * 100)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setValuationConfig((prev) => ({
                    ...prev,
                    globalMultiplier: isNaN(val) ? 1.0 : Number((val / 100).toFixed(2)),
                  }));
                }}
                className={inputCls}
              />
              <span className="font-bold text-sm text-[#1d1d1f]">%</span>
            </div>
            <p className="mt-1.5 text-[11px] text-[#86868b]">
              100% = padrão. 95% = mais margem para a loja. 105% = avaliação mais alta.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {[90, 95, 100, 105].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    setValuationConfig((prev) => ({
                      ...prev,
                      globalMultiplier: pct / 100,
                    }))
                  }
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                    Math.round(valuationConfig.globalMultiplier * 100) === pct
                      ? "bg-[#1d1d1f] text-white"
                      : "bg-[#e5e5e7] text-[#1d1d1f] hover:bg-[#d5d5d7]"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Bônus Fidelidade */}
          <div className="rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-4">
            <span className="block text-xs font-semibold text-[#6e6e73]">Bônus Fidelidade Lojinha</span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="30"
                value={valuationConfig.loyaltyBonusPercent ?? 5}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setValuationConfig((prev) => ({
                    ...prev,
                    loyaltyBonusPercent: isNaN(val) ? 5 : val,
                  }));
                }}
                className={inputCls}
              />
              <span className="font-bold text-sm text-[#1d1d1f]">%</span>
            </div>
            <p className="mt-1.5 text-[11px] text-[#86868b]">
              Bônus extra concedido a quem comprou anteriormente na Lojinha do Celular.
            </p>
          </div>

          {/* Bônus Caixa Original */}
          <div className="rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-4">
            <span className="block text-xs font-semibold text-[#6e6e73]">Bônus por Caixa Original</span>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-bold text-sm text-[#6e6e73]">R$</span>
              <input
                type="number"
                step="10"
                min="0"
                max="500"
                value={valuationConfig.boxBonusReais ?? 80}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setValuationConfig((prev) => ({
                    ...prev,
                    boxBonusReais: isNaN(val) ? 80 : val,
                  }));
                }}
                className={inputCls}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[#86868b]">
              Adicional pago caso o cliente entregue a caixa original do aparelho.
            </p>
          </div>

          {/* Desconto de Bateria Degradada */}
          <div className="rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-4">
            <span className="block text-xs font-semibold text-[#6e6e73]">Deságio máximo da bateria</span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                max="50"
                value={valuationConfig.batteryPenaltyUnder80 ?? 18}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setValuationConfig((prev) => ({
                    ...prev,
                    batteryPenaltyUnder80: isNaN(val) ? 18 : val,
                  }));
                }}
                className={inputCls}
              />
              <span className="font-bold text-sm text-[#1d1d1f]">%</span>
            </div>
            <p className="mt-1.5 text-[11px] text-[#86868b]">
              Desconto máximo, aplicado quando a bateria está bem abaixo do limite (veja “Descontos do motor”).
            </p>
          </div>
        </div>

        {/* Disclaimer / Aviso no site */}
        <div className="mt-4">
          <Field label="Aviso Legal / Disclaimer exibido ao cliente">
            <textarea
              rows={2}
              value={valuationConfig.disclaimerText ?? ""}
              onChange={(e) =>
                setValuationConfig((prev) => ({ ...prev, disclaimerText: e.target.value }))
              }
              placeholder="Pré-avaliação online estimada. O valor exato é confirmado após a conferência física e testes rápidos na Lojinha do Celular."
              className={`${inputCls} resize-none`}
            />
          </Field>
        </div>

        {/* Ocultar Valores Estimados para o Cliente */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={valuationConfig.hidePricesToClient !== false}
              onChange={(e) =>
                setValuationConfig((prev) => ({
                  ...prev,
                  hidePricesToClient: e.target.checked,
                }))
              }
              className="mt-0.5 h-4 w-4 rounded border-amber-300 text-[#0071e3] focus:ring-[#0071e3]"
            />
            <div>
              <span className="text-xs font-bold text-[#1d1d1f] block">
                Ocultar valores monetários (R$) e volta estimada para o cliente
              </span>
              <p className="mt-0.5 text-xs text-[#6e6e73] leading-relaxed">
                <strong>Recomendado para segurança da loja:</strong> O cliente envia todos os dados técnicos, fotos e modelo de interesse pelo site, mas <strong>não vê valores em R$</strong> nem no site nem no WhatsApp. A equipe da Lojinha avalia as fotos e passa a proposta comercial diretamente no WhatsApp, evitando divergências em caso de erro na pré-avaliação automática. A equipe continua vendo as estimativas no painel.
              </p>
            </div>
          </label>
        </div>

        {/* Preços Base dos Modelos Mais Populares & Matriz Completa (GB e Cores) */}
        <ValuationAdjustmentsEditor config={valuationConfig} onChange={setValuationConfig} />

        <ValuationSimulator config={valuationConfig} models={priceList} />

        <div id="tabela-precos" className="mt-6 scroll-mt-24 border-t border-[#e5e5e7] pt-5">
          <div className="mb-4">
            <h4 className="font-display text-sm font-bold text-[#1d1d1f]">Tabela de preços por modelo, armazenamento e cor (iPhone)</h4>
            <p className="mt-1 max-w-2xl text-xs text-[#86868b]">
              Um preço por modelo e armazenamento, e, se quiser, um preço diferente por cor. Campo vazio = o motor calcula. Estes valores
              ficam só no servidor: visitantes do site não conseguem ver a tabela.
            </p>
          </div>

          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <label htmlFor="price-search" className="sr-only">Buscar modelo</label>
              <input
                id="price-search"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                placeholder="Buscar modelo (ex.: 16 Pro Max)"
                className="w-full rounded-xl border border-[#e5e5e7] bg-white px-3 py-2 text-xs outline-none focus:border-[#0071e3]"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {(["all", "128GB", "256GB", "512GB", "1TB", "2TB"] as const).map((cap) => (
                <button
                  key={cap}
                  type="button"
                  onClick={() => setSelectedCapacity(cap)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    selectedCapacity === cap
                      ? "bg-[#1d1d1f] text-white"
                      : "border border-[#e5e5e7] bg-white text-[#6e6e73] hover:bg-[#f5f5f7]"
                  }`}
                >
                  {cap === "all" ? "Todos" : cap}
                </button>
              ))}
            </div>
            <label className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-[#e5e5e7] bg-white px-2.5 py-1 text-xs font-medium text-[#1d1d1f]">
              <input type="checkbox" checked={onlyCustomFilter} onChange={(e) => setOnlyCustomFilter(e.target.checked)} />
              Só editados
            </label>
          </div>

          <FixedPriceList
            models={priceList}
            loading={priceListQuery.isLoading}
            config={valuationConfig}
            onChange={setValuationConfig}
            search={modelFilter}
            capacity={selectedCapacity}
            onlyEdited={onlyCustomFilter}
          />
        </div>
      </section>

      </div>

      <div className={tab === "pagamento" ? "space-y-6" : "hidden"}>
      {/* Preços */}
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1d1f]">
          <CreditCard className="h-5 w-5 text-[#0071e3]" /> Taxas da maquininha
        </h3>
        <p className="mt-1 text-xs text-[#86868b]">
          O site calcula as parcelas repassando a taxa: <strong>total = à vista ÷ (1 − taxa%)</strong>,{" "}
          parcela = total ÷ nº de parcelas. Edite conforme a tabela da sua maquininha.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nº máximo de parcelas exibido no site">
            <input
              type="number"
              min={1}
              max={21}
              value={values[SETTING_KEYS.installmentsMax] ?? "21"}
              onChange={set(SETTING_KEYS.installmentsMax)}
              className={inputCls}
            />
          </Field>
          <Field label="Taxa Débito/PIX (%) — informativa">
            <input
              value={values[SETTING_KEYS.debitPixFee] ?? "2,39"}
              onChange={set(SETTING_KEYS.debitPixFee)}
              className={inputCls}
              placeholder="2,39"
            />
          </Field>
        </div>

        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-[#86868b]">
          Taxa por quantidade de parcelas (%)
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 21 }, (_, i) => String(i + 1)).map((n) => (
            <label key={n} className="block">
              <span className="mb-1 block text-[11px] font-bold text-[#1d1d1f]">
                {n === "1" ? "À vista" : `${n}x`}
              </span>
              <input
                value={fees[n] ?? ""}
                onChange={(e) => setFees((f) => ({ ...f, [n]: e.target.value }))}
                inputMode="decimal"
                className="w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-2.5 py-1.5 text-xs font-semibold text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:bg-white focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
                placeholder="0,00"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Mensagem de Garantia & Confiança */}
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1d1f]">
          <ShieldCheck className="h-5 w-5 text-emerald-600" /> Mensagem de Garantia & Confiança
        </h3>
        <p className="mt-1 text-xs text-[#86868b]">
          Texto exibido no selo de garantia do carrinho de compras e no box de detalhes de cada aparelho.
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Texto de Garantia e Procedência">
            <input
              value={values[SETTING_KEYS.warrantyBadgeText] ?? ""}
              onChange={set(SETTING_KEYS.warrantyBadgeText)}
              className={inputCls}
              placeholder="Garantia de 1 ano e procedência verificada."
            />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-[#86868b]">Sugestões rápidas:</span>
            {[
              "Garantia de até 1 ano e procedência verificada.",
              "Garantia e procedência verificada.",
              "1 ano para lacrados e 6 meses para seminovos.",
              "Garantia de 6 meses e procedência verificada.",
              "Garantia de 3 meses e procedência verificada.",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() =>
                  setValues((v) => ({ ...v, [SETTING_KEYS.warrantyBadgeText]: preset }))
                }
                className="rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] hover:bg-[#e5e5e7] px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] transition cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </section>

      </div>

      <div className={tab === "mensagens" ? "space-y-6" : "hidden"}>
      <EvaluationSettingsSection
        slaHours={values[SETTING_KEYS.evaluationSlaHours] ?? "2"}
        templates={templates}
        onSlaChange={(value) => setValues((v) => ({ ...v, [SETTING_KEYS.evaluationSlaHours]: value }))}
        onTemplatesChange={setTemplates}
      />
        <AutoMessagesSection
          config={autoMessages}
          onChange={setAutoMessages}
          teamNumbers={values[SETTING_KEYS.teamNotifyNumbers] ?? ""}
          onTeamNumbersChange={(value) => setValues((v) => ({ ...v, [SETTING_KEYS.teamNotifyNumbers]: value }))}
        />
      </div>

      <div className={tab === "loja" ? "space-y-6" : "hidden"}>
      {/* Quem já comprou */}
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
        <h3 className="font-display text-lg font-bold text-[#1d1d1f]">Faixa “Quem já comprou com a gente”</h3>
        <p className="mt-1 text-xs text-[#86868b]">
          Mostra na página inicial o primeiro nome, a inicial do sobrenome e o celular que clientes reais compraram, vindos do ERP.
          Só aparece com 3 ou mais nomes. Quem pedir para sair é marcado como “não divulgar” no cadastro do cliente no ERP.
        </p>
        <label className="mt-3 flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={(values[SETTING_KEYS.socialProofEnabled] ?? "0") === "1"}
            onChange={(e) =>
              setValues((v) => ({ ...v, [SETTING_KEYS.socialProofEnabled]: e.target.checked ? "1" : "0" }))
            }
            className="h-5 w-5 accent-[#0071e3] rounded"
          />
          <span className="text-sm font-medium text-[#1d1d1f]">Mostrar a faixa na página inicial</span>
        </label>
        <Field label="Título da faixa">
          <input
            value={values[SETTING_KEYS.socialProofTitle] ?? ""}
            onChange={set(SETTING_KEYS.socialProofTitle)}
            maxLength={80}
            className={inputCls}
            placeholder="Quem confia e já faz parte da família Lojinha ❤️"
          />
        </Field>
      </section>

      <PrivacySection
        values={values}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
      />

      {/* Popup */}
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
        <h3 className="font-display text-lg font-bold text-[#1d1d1f]">Popup de boas-vindas</h3>
        <label className="mt-3 flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={(values[SETTING_KEYS.popupEnabled] ?? "1") === "1"}
            onChange={(e) =>
              setValues((v) => ({ ...v, [SETTING_KEYS.popupEnabled]: e.target.checked ? "1" : "0" }))
            }
            className="h-5 w-5 accent-[#0071e3] rounded"
          />
          <span className="text-sm font-medium text-[#1d1d1f]">
            Mostrar popup de WhatsApp/localização ao abrir o site
          </span>
        </label>
      </section>

      {/* Fotos do hero */}
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
        <h3 className="font-display text-lg font-bold text-[#1d1d1f]">Fotos da página inicial</h3>
        <p className="mt-1 text-xs text-[#86868b]">
          As fotos que ficam alternando no topo da loja. Cole <strong>uma URL por linha</strong>.
        </p>
        <textarea
          value={heroText}
          onChange={(e) => setHeroText(e.target.value)}
          rows={5}
          placeholder={"https://exemplo.com/foto1.jpg\nhttps://exemplo.com/foto2.jpg"}
          className={`${inputCls} mt-3 font-mono text-xs`}
        />
        {heroText.trim() && (
          <div className="mt-3 flex flex-wrap gap-2">
            {heroText.split("\n").filter((u) => u.trim()).slice(0, 6).map((u) => (
              <img
                key={u}
                src={u.trim()}
                alt=""
                className="h-16 w-16 rounded-xl border border-[#e5e5e7] object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")}
              />
            ))}
          </div>
        )}
      </section>

      </div>

      <div className="sticky bottom-0 z-20 -mx-2 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e5e5e7] bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <button
          onClick={() => {
            const slaHours = Number(String(values[SETTING_KEYS.evaluationSlaHours] ?? "2").replace(",", "."));
            if (!Number.isFinite(slaHours) || slaHours <= 0 || slaHours > 720) {
              toast.error("Prazo de resposta inválido: informe um número de horas entre 0 e 720.");
              return;
            }
            const cleanTemplates = templates
              .map((t) => ({ ...t, label: t.label.trim(), body: t.body.trim() }))
              .filter((t) => t.label && t.body);
            if (cleanTemplates.length !== templates.length) {
              toast.error("Preencha o título e o texto de todas as mensagens prontas (ou remova as vazias).");
              return;
            }
            const feesJson = JSON.stringify(
              Object.fromEntries(
                Object.entries(fees).map(([k, v]) => [
                  k,
                  Number(v.replace(",", ".")) || 0,
                ]),
              ),
            );
            update.mutate({
              values: {
                ...values,
                [SETTING_KEYS.installmentFees]: feesJson,
                [SETTING_KEYS.heroImages]: JSON.stringify(
                  heroText.split("\n").map((u) => u.trim()).filter(Boolean),
                ),
                [SETTING_KEYS.valuationConfig]: JSON.stringify(valuationConfig),
                [SETTING_KEYS.evaluationSlaHours]: String(slaHours),
                [SETTING_KEYS.whatsappTemplates]: JSON.stringify(cleanTemplates),
                [SETTING_KEYS.autoMessages]: JSON.stringify(autoMessages),
              },
            });
          }}
          disabled={update.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black px-6 py-3 font-display font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {update.isPending ? "Salvando configurações..." : saved ? "Salvo com sucesso!" : "Salvar configurações"}
        </button>
        {dirty && !update.isPending && (
          <>
            <span className="text-xs font-semibold text-amber-700" role="status">
              Alterações não salvas (valem para todas as abas).
            </span>
            <button
              type="button"
              onClick={discardChanges}
              className="rounded-xl border border-[#d2d2d7] px-4 py-2.5 text-sm font-semibold text-[#424245] hover:bg-[#f5f5f7] cursor-pointer"
            >
              Descartar
            </button>
          </>
        )}
      </div>
      {saveError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{saveError}</span>
        </div>
      )}

    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-2.5 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:bg-white focus:ring-4 focus:ring-[#0071e3]/15 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">
        {label}
      </span>
      {children}
    </label>
  );
}
