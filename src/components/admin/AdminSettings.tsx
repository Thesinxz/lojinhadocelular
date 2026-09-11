import { useEffect, useState, useMemo } from "react";
import {
  Save,
  KeyRound,
  CreditCard,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  RotateCcw,
  Layers,
  ListFilter,
  X,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import {
  SETTING_KEYS,
  parseFees,
  type ValuationConfig,
  DEFAULT_VALUATION_CONFIG,
} from "@contracts/types";
import {
  parseValuationConfig,
  POPULAR_CONFIG_IPHONES,
  formatBRL,
  IPHONE_REFERENCE_PRICES,
  getReferenceVariationKey,
  getDeviceColorHex,
  normalizeKey,
} from "@/lib/valuationEngine";

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const query = trpc.admin.getSettings.useQuery();
  const [values, setValues] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [heroText, setHeroText] = useState("");
  const [valuationConfig, setValuationConfig] = useState<ValuationConfig>(
    DEFAULT_VALUATION_CONFIG
  );
  const [modelFilter, setModelFilter] = useState("");
  const [selectedCapacity, setSelectedCapacity] = useState<string>("all");
  const [pricingViewMode, setPricingViewMode] = useState<"models" | "all">("models");
  const [onlyCustomFilter, setOnlyCustomFilter] = useState(false);
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const update = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      utils.admin.getSettings.invalidate();
      utils.shop.settings.invalidate();
      setSaveError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      setSaveError(err.message || "Erro ao salvar configurações");
    },
  });

  const changePassword = trpc.admin.changePassword.useMutation({
    onSuccess: () => {
      setNewPassword("");
      alert("Senha alterada com sucesso!");
    },
    onError: (err) => {
      alert(`Erro ao alterar senha: ${err.message || "Erro desconhecido"}`);
    },
  });

  useEffect(() => {
    if (query.data && Object.keys(values).length === 0) {
      setValues(query.data);
      const parsed = parseFees(query.data[SETTING_KEYS.installmentFees]);
      setFees(
        Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, String(v).replace(".", ",")]),
        ),
      );
      if (query.data[SETTING_KEYS.valuationConfig]) {
        setValuationConfig(parseValuationConfig(query.data[SETTING_KEYS.valuationConfig]));
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

  const customPricesCount = useMemo(() => {
    return Object.keys(valuationConfig.customBasePrices || {}).filter(
      (k) => (valuationConfig.customBasePrices?.[k] ?? 0) > 0
    ).length;
  }, [valuationConfig.customBasePrices]);

  const updateCustomPrice = (key: string, valueStr: string) => {
    const val = valueStr === "" ? 0 : Number(valueStr);
    setValuationConfig((prev) => {
      const nextPrices = { ...(prev.customBasePrices || {}) };
      if (val <= 0 || isNaN(val)) {
        delete nextPrices[key];
      } else {
        nextPrices[key] = val;
      }
      return { ...prev, customBasePrices: nextPrices };
    });
  };

  const resetCustomPrice = (key: string) => {
    setValuationConfig((prev) => {
      const nextPrices = { ...(prev.customBasePrices || {}) };
      delete nextPrices[key];
      return { ...prev, customBasePrices: nextPrices };
    });
  };

  const resetAllCustomPrices = () => {
    if (
      window.confirm(
        "Deseja restaurar todos os preços de iPhone para os valores padrão de referência da Lojinha?"
      )
    ) {
      setValuationConfig((prev) => ({ ...prev, customBasePrices: {} }));
    }
  };

  const toggleModelExpand = (modelId: string) => {
    setExpandedModels((prev) => ({ ...prev, [modelId]: !prev[modelId] }));
  };

  const toggleExpandAll = () => {
    const isAnyOpen = Object.values(expandedModels).some(Boolean);
    if (isAnyOpen) {
      setExpandedModels({});
    } else {
      const nextOpen: Record<string, boolean> = {};
      POPULAR_CONFIG_IPHONES.forEach((m) => {
        nextOpen[m.id] = true;
      });
      setExpandedModels(nextOpen);
    }
  };

  const filteredModels = useMemo(() => {
    return POPULAR_CONFIG_IPHONES.filter((m) => {
      const modelNorm = normalizeKey(m.name);
      const variations = IPHONE_REFERENCE_PRICES.filter(
        (item) => normalizeKey(item.model) === modelNorm
      );

      const q = modelFilter.toLowerCase().trim();
      if (q) {
        const nameMatches = m.name.toLowerCase().includes(q);
        const variationMatches = variations.some(
          (v) =>
            v.capacity.toLowerCase().includes(q) ||
            v.color.toLowerCase().includes(q)
        );
        if (!nameMatches && !variationMatches) return false;
      }

      if (selectedCapacity !== "all") {
        const capMatches = variations.some(
          (v) => v.capacity.toLowerCase() === selectedCapacity.toLowerCase()
        );
        if (!capMatches && variations.length > 0) return false;
      }

      if (onlyCustomFilter) {
        const hasModelCustom = (valuationConfig.customBasePrices?.[m.id] ?? 0) > 0;
        const hasVarCustom = variations.some((v) => {
          const k = getReferenceVariationKey(v.model, v.capacity, v.color);
          return (valuationConfig.customBasePrices?.[k] ?? 0) > 0;
        });
        if (!hasModelCustom && !hasVarCustom) return false;
      }

      return true;
    });
  }, [modelFilter, selectedCapacity, onlyCustomFilter, valuationConfig.customBasePrices]);

  const filteredVariations = useMemo(() => {
    return IPHONE_REFERENCE_PRICES.filter((item) => {
      const q = modelFilter.toLowerCase().trim();
      if (q) {
        const match =
          item.model.toLowerCase().includes(q) ||
          item.capacity.toLowerCase().includes(q) ||
          item.color.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (selectedCapacity !== "all") {
        if (item.capacity.toLowerCase() !== selectedCapacity.toLowerCase()) return false;
      }
      if (onlyCustomFilter) {
        const varKey = getReferenceVariationKey(item.model, item.capacity, item.color);
        if (!(valuationConfig.customBasePrices?.[varKey] ?? 0)) return false;
      }
      return true;
    });
  }, [modelFilter, selectedCapacity, onlyCustomFilter, valuationConfig.customBasePrices]);

  if (query.isLoading) {
    return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-neutral-200" />;
  }

  return (
    <div className="mt-6 space-y-6">
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
            <span className="block text-xs font-semibold text-[#6e6e73]">Deságio Bateria &lt; 80%</span>
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
              Desconto proporcional pelo custo de troca técnica da bateria degradada.
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

        {/* Preços Base dos Modelos Mais Populares & Matriz Completa (GB e Cores) */}
        <div className="mt-6 border-t border-[#e5e5e7] pt-5">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-display text-sm font-bold text-[#1d1d1f]">
                    Tabela de Preços por Modelo, GB & Cores (iPhone)
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#0071e3] border border-blue-100">
                    <Sparkles className="h-3 w-3" /> 98 variações oficiais
                  </span>
                </div>
                <p className="text-xs text-[#86868b] mt-1 max-w-2xl">
                  Configure os valores de referência da Lojinha do Celular para pré-avaliação e compra técnica.
                  Você pode personalizar o preço de qualquer modelo global, capacidade específica (GB) ou cor individual.
                </p>
              </div>

              {/* Botão de reset global caso haja personalizações */}
              {customPricesCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllCustomPrices}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50/80 hover:bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 transition shrink-0 cursor-pointer shadow-2xs"
                  title="Redefine todas as customizações para os valores padrão de referência"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                  Restaurar padrões ({customPricesCount})
                </button>
              )}
            </div>

            {/* Barra de Ferramentas / Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#e5e5e7] bg-[#fbfbfd] p-2.5">
              {/* Campo de Busca */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
                <input
                  type="text"
                  placeholder="Buscar modelo, GB ou cor (ex: 16 Pro Max, 256GB, Desert)..."
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  className="w-full rounded-lg border border-[#e5e5e7] bg-white pl-8 pr-7 py-1.5 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/15 transition"
                />
                {modelFilter && (
                  <button
                    type="button"
                    onClick={() => setModelFilter("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#1d1d1f]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro de Capacidades */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[11px] font-semibold text-[#86868b] mr-1 hidden lg:inline">GB:</span>
                {(["all", "128GB", "256GB", "512GB", "1TB"] as const).map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setSelectedCapacity(cap)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                      selectedCapacity === cap
                        ? "bg-[#1d1d1f] text-white"
                        : "bg-white border border-[#e5e5e7] text-[#6e6e73] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {cap === "all" ? "Todos GBs" : cap}
                  </button>
                ))}
              </div>

              {/* Toggle de Apenas Personalizados e Modo de Visualização */}
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] cursor-pointer select-none bg-white border border-[#e5e5e7] rounded-lg px-2.5 py-1">
                  <input
                    type="checkbox"
                    checked={onlyCustomFilter}
                    onChange={(e) => setOnlyCustomFilter(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                  />
                  <span>Só editados {customPricesCount > 0 ? `(${customPricesCount})` : ""}</span>
                </label>

                {/* Alternância de Modo de Visualização */}
                <div className="inline-flex rounded-lg border border-[#e5e5e7] bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setPricingViewMode("models")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                      pricingViewMode === "models"
                        ? "bg-[#1d1d1f] text-white"
                        : "text-[#6e6e73] hover:text-[#1d1d1f]"
                    }`}
                    title="Agrupado por Modelo (com gavetas expansíveis de variações)"
                  >
                    <Layers className="h-3 w-3" />
                    Modelos
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingViewMode("all")}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                      pricingViewMode === "all"
                        ? "bg-[#1d1d1f] text-white"
                        : "text-[#6e6e73] hover:text-[#1d1d1f]"
                    }`}
                    title="Matriz Completa (Tabela detalhada com todos os 98 itens)"
                  >
                    <ListFilter className="h-3 w-3" />
                    Matriz Completa
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-barra com ações e contagem */}
            <div className="flex items-center justify-between text-xs text-[#86868b] px-1">
              <span>
                {pricingViewMode === "models"
                  ? `Exibindo ${filteredModels.length} modelos`
                  : `Exibindo ${filteredVariations.length} de ${IPHONE_REFERENCE_PRICES.length} variações`}
              </span>
              {pricingViewMode === "models" && (
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="text-xs font-semibold text-[#0071e3] hover:underline cursor-pointer"
                >
                  {Object.values(expandedModels).some(Boolean)
                    ? "Recolher todas as gavetas"
                    : "Expandir todas as gavetas"}
                </button>
              )}
            </div>
          </div>

          {pricingViewMode === "models" ? (
            <div className="max-h-[500px] overflow-y-auto rounded-xl border border-[#e5e5e7] bg-white divide-y divide-[#f0f0f2]">
              {filteredModels.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#86868b]">
                  Nenhum modelo encontrado com os filtros aplicados.
                </div>
              ) : (
                filteredModels.map((m) => {
                  const modelNorm = normalizeKey(m.name);
                  const variations = IPHONE_REFERENCE_PRICES.filter(
                    (item) => normalizeKey(item.model) === modelNorm
                  );
                  const currentModelCustom = valuationConfig.customBasePrices?.[m.id];
                  const hasModelCustom = typeof currentModelCustom === "number" && currentModelCustom > 0;

                  // Quantas variações deste modelo têm preço personalizado
                  const customInVariationsCount = variations.filter((v) => {
                    const key = getReferenceVariationKey(v.model, v.capacity, v.color);
                    return (valuationConfig.customBasePrices?.[key] ?? 0) > 0;
                  }).length;

                  const isExpanded = !!expandedModels[m.id];

                  // Variações filtradas dentro deste modelo
                  const visibleVariations = variations.filter((v) => {
                    const q = modelFilter.toLowerCase().trim();
                    if (q) {
                      const match =
                        m.name.toLowerCase().includes(q) ||
                        v.capacity.toLowerCase().includes(q) ||
                        v.color.toLowerCase().includes(q);
                      if (!match) return false;
                    }
                    if (selectedCapacity !== "all") {
                      if (v.capacity.toLowerCase() !== selectedCapacity.toLowerCase()) return false;
                    }
                    if (onlyCustomFilter) {
                      const key = getReferenceVariationKey(v.model, v.capacity, v.color);
                      if (!(valuationConfig.customBasePrices?.[key] ?? 0)) return false;
                    }
                    return true;
                  });

                  // Capacidades únicas deste modelo para exibir resumo
                  const uniqueCaps = Array.from(new Set(variations.map((v) => v.capacity)));

                  return (
                    <div key={m.id} className="transition">
                      {/* Linha Principal do Modelo */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-[#fbfbfd]">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#1d1d1f]">{m.name}</span>
                            {variations.length > 0 && (
                              <span className="rounded-full bg-[#f5f5f7] border border-[#e5e5e7] px-2 py-0.5 text-[10px] font-semibold text-[#6e6e73]">
                                {variations.length} variações ({uniqueCaps.join(", ")})
                              </span>
                            )}
                            {customInVariationsCount > 0 && (
                              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                {customInVariationsCount} personalizada{customInVariationsCount > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#86868b] mt-0.5 block">
                            Padrão base (128GB Grau A): <strong>{formatBRL(m.defaultBasePrice)}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-[#86868b] hidden sm:inline">
                              Base:
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold text-[#86868b]">R$</span>
                              <input
                                type="number"
                                step="50"
                                placeholder={String(m.defaultBasePrice)}
                                value={hasModelCustom ? currentModelCustom : ""}
                                onChange={(e) => updateCustomPrice(m.id, e.target.value)}
                                className={`w-24 sm:w-28 rounded-lg border px-2.5 py-1 text-xs font-semibold text-right outline-none transition ${
                                  hasModelCustom
                                    ? "border-[#0071e3] bg-blue-50/50 text-[#0071e3]"
                                    : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] focus:border-[#0071e3] focus:bg-white"
                                }`}
                              />
                            </div>
                            {hasModelCustom && (
                              <button
                                type="button"
                                onClick={() => resetCustomPrice(m.id)}
                                title="Restaurar preço base padrão"
                                className="rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] hover:bg-[#e5e5e7] px-2 py-1 text-[10px] font-medium text-[#6e6e73] transition cursor-pointer"
                              >
                                Resetar
                              </button>
                            )}
                          </div>

                          {/* Botão para abrir/fechar gaveta de variações */}
                          {variations.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleModelExpand(m.id)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                                isExpanded
                                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                                  : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e5e5e7]"
                              }`}
                            >
                              <span>GB & Cores ({variations.length})</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Gaveta de Variações Detalhadas (GB & Cores) */}
                      {isExpanded && variations.length > 0 && (
                        <div className="border-t border-[#f0f0f2] bg-[#fbfbfd] px-4 py-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                              Variações oficiais tabeladas para {m.name} ({visibleVariations.length}):
                            </span>
                            <span className="text-[10px] text-[#86868b]">
                              Valores personalizados substituem o cálculo automático
                            </span>
                          </div>

                          {visibleVariations.length === 0 ? (
                            <p className="text-xs text-[#86868b] py-2 italic">
                              Nenhuma variação corresponde aos filtros de GB / Cor ativos.
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {visibleVariations.map((v) => {
                                const varKey = getReferenceVariationKey(v.model, v.capacity, v.color);
                                const currentVarCustom = valuationConfig.customBasePrices?.[varKey];
                                const hasVarCustom =
                                  typeof currentVarCustom === "number" && currentVarCustom > 0;
                                const colorHex = getDeviceColorHex(v.color);

                                return (
                                  <div
                                    key={varKey}
                                    className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition ${
                                      hasVarCustom
                                        ? "border-[#0071e3] bg-blue-50/40"
                                        : "border-[#e5e5e7] bg-white hover:border-[#d5d5d7]"
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="h-3.5 w-3.5 rounded-full border border-black/15 shrink-0 shadow-2xs"
                                          style={{ backgroundColor: colorHex }}
                                          title={v.color}
                                        />
                                        <span className="text-xs font-bold text-[#1d1d1f] truncate">
                                          {v.color}
                                        </span>
                                        <span className="rounded bg-[#f5f5f7] border border-[#e5e5e7] px-1.5 py-0.2 text-[10px] font-bold text-[#1d1d1f]">
                                          {v.capacity}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 text-[10px] text-[#86868b]">
                                        Tabela: <strong>{formatBRL(v.priceBrl)}</strong>{" "}
                                        <span className="text-[9px] text-[#a1a1a6]">
                                          (US$ {v.priceUsd.toFixed(0)})
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[11px] font-semibold text-[#86868b]">R$</span>
                                      <input
                                        type="number"
                                        step="50"
                                        placeholder={String(v.priceBrl)}
                                        value={hasVarCustom ? currentVarCustom : ""}
                                        onChange={(e) => updateCustomPrice(varKey, e.target.value)}
                                        className={`w-20 rounded-lg border px-2 py-1 text-xs font-semibold text-right outline-none transition ${
                                          hasVarCustom
                                            ? "border-[#0071e3] bg-white text-[#0071e3]"
                                            : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] focus:border-[#0071e3] focus:bg-white"
                                        }`}
                                      />
                                      {hasVarCustom && (
                                        <button
                                          type="button"
                                          onClick={() => resetCustomPrice(varKey)}
                                          title="Restaurar valor padrão da matriz"
                                          className="rounded border border-[#e5e5e7] bg-[#f5f5f7] hover:bg-[#e5e5e7] px-1.5 py-1 text-[9px] font-medium text-[#6e6e73] transition cursor-pointer"
                                        >
                                          Reset
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Visualização da Matriz Completa (Todos os 98 itens) */
            <div className="max-h-[500px] overflow-y-auto rounded-xl border border-[#e5e5e7] bg-white divide-y divide-[#f0f0f2]">
              {filteredVariations.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#86868b]">
                  Nenhuma variação encontrada com os filtros aplicados.
                </div>
              ) : (
                filteredVariations.map((v) => {
                  const varKey = getReferenceVariationKey(v.model, v.capacity, v.color);
                  const currentVarCustom = valuationConfig.customBasePrices?.[varKey];
                  const hasVarCustom =
                    typeof currentVarCustom === "number" && currentVarCustom > 0;
                  const colorHex = getDeviceColorHex(v.color);

                  return (
                    <div
                      key={varKey}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 transition ${
                        hasVarCustom ? "bg-blue-50/40" : "hover:bg-[#fbfbfd]"
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#1d1d1f]">{v.model}</span>
                        <span className="rounded bg-[#1d1d1f] px-2 py-0.5 text-[10px] font-bold text-white">
                          {v.capacity}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/15 shrink-0 shadow-2xs"
                            style={{ backgroundColor: colorHex }}
                          />
                          <span className="text-xs font-medium text-[#6e6e73]">{v.color}</span>
                        </div>
                        <span className="text-[11px] text-[#86868b] sm:ml-auto">
                          US$ {v.priceUsd.toFixed(0)} • Tabela: <strong>{formatBRL(v.priceBrl)}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <span className="text-xs font-semibold text-[#86868b]">R$</span>
                        <input
                          type="number"
                          step="50"
                          placeholder={String(v.priceBrl)}
                          value={hasVarCustom ? currentVarCustom : ""}
                          onChange={(e) => updateCustomPrice(varKey, e.target.value)}
                          className={`w-24 sm:w-28 rounded-lg border px-2.5 py-1 text-xs font-semibold text-right outline-none transition ${
                            hasVarCustom
                              ? "border-[#0071e3] bg-white text-[#0071e3]"
                              : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] focus:border-[#0071e3] focus:bg-white"
                          }`}
                        />
                        {hasVarCustom && (
                          <button
                            type="button"
                            onClick={() => resetCustomPrice(varKey)}
                            title="Restaurar valor padrão da matriz"
                            className="rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] hover:bg-[#e5e5e7] px-2 py-1 text-[10px] font-medium text-[#6e6e73] transition cursor-pointer"
                          >
                            Resetar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </section>

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
              value={values[SETTING_KEYS.installmentsMax] ?? "12"}
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

      <button
        onClick={() => {
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

      {saveError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Senha */}
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-6 shadow-2xs">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1d1f]">
          <KeyRound className="h-5 w-5 text-[#0071e3]" /> Trocar senha do painel
        </h3>
        <p className="mt-1 text-xs text-[#86868b]">
          Altere a senha de acesso a este painel administrativo.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova senha (mín. 4 caracteres)"
            className={`${inputCls} max-w-xs`}
          />
          <button
            onClick={() => newPassword.length >= 4 && changePassword.mutate({ password: newPassword })}
            disabled={newPassword.length < 4 || changePassword.isPending}
            className="rounded-xl bg-[#1d1d1f] hover:bg-black px-5 py-2.5 text-sm font-semibold text-white transition shadow-sm disabled:opacity-50"
          >
            Trocar senha
          </button>
        </div>
      </section>
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
