import { useEffect, useState } from "react";
import {
  Save,
  KeyRound,
  CreditCard,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
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

        {/* Preços Base dos Modelos Mais Populares */}
        <div className="mt-6 border-t border-[#e5e5e7] pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="font-display text-sm font-bold text-[#1d1d1f]">
                Tabela de Preços Base por Modelo (iPhone)
              </h4>
              <p className="text-xs text-[#86868b]">
                Personalize o valor base (128GB Grau A) de cada modelo. Se deixar zerado ou vazio, o valor padrão de mercado é usado.
              </p>
            </div>
            <input
              type="text"
              placeholder="Filtrar modelo (ex: 15 Pro)..."
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="max-w-xs rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-1.5 text-xs outline-none focus:border-[#0071e3] focus:bg-white"
            />
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-[#e5e5e7] bg-white divide-y divide-[#f0f0f2]">
            {POPULAR_CONFIG_IPHONES.filter((m) =>
              m.name.toLowerCase().includes(modelFilter.toLowerCase().trim())
            ).map((m) => {
              const currentCustom = valuationConfig.customBasePrices?.[m.id];
              const hasCustom = typeof currentCustom === "number" && currentCustom > 0;
              return (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 hover:bg-[#f9f9fb] transition"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-[#1d1d1f] block">{m.name}</span>
                    <span className="text-[11px] text-[#86868b]">
                      Padrão de referência: <strong>{formatBRL(m.defaultBasePrice)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-[#86868b]">R$</span>
                      <input
                        type="number"
                        step="50"
                        placeholder={String(m.defaultBasePrice)}
                        value={hasCustom ? currentCustom : ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                          setValuationConfig((prev) => {
                            const nextPrices = { ...(prev.customBasePrices || {}) };
                            if (val <= 0 || isNaN(val)) {
                              delete nextPrices[m.id];
                            } else {
                              nextPrices[m.id] = val;
                            }
                            return { ...prev, customBasePrices: nextPrices };
                          });
                        }}
                        className={`w-28 rounded-lg border px-2.5 py-1 text-xs font-semibold text-right outline-none transition ${
                          hasCustom
                            ? "border-[#0071e3] bg-blue-50/50 text-[#0071e3]"
                            : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] focus:border-[#0071e3] focus:bg-white"
                        }`}
                      />
                    </div>
                    {hasCustom && (
                      <button
                        type="button"
                        onClick={() =>
                          setValuationConfig((prev) => {
                            const nextPrices = { ...(prev.customBasePrices || {}) };
                            delete nextPrices[m.id];
                            return { ...prev, customBasePrices: nextPrices };
                          })
                        }
                        title="Restaurar preço padrão"
                        className="rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] hover:bg-[#e5e5e7] px-2 py-1 text-[10px] font-medium text-[#6e6e73] transition cursor-pointer"
                      >
                        Resetar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
