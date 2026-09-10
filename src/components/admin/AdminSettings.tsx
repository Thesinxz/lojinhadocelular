import { useEffect, useState } from "react";
import { Save, KeyRound, CreditCard, ShieldCheck, Check, AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { SETTING_KEYS, parseFees } from "@contracts/types";

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const query = trpc.admin.getSettings.useQuery();
  const [values, setValues] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [heroText, setHeroText] = useState("");
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
          <Field label="Texto de Garantia, Nota Fiscal e Procedência">
            <input
              value={values[SETTING_KEYS.warrantyBadgeText] ?? ""}
              onChange={set(SETTING_KEYS.warrantyBadgeText)}
              className={inputCls}
              placeholder="Garantia de 1 ano com nota fiscal e procedência."
            />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-[#86868b]">Sugestões rápidas:</span>
            {[
              "Garantia de 1 ano com nota fiscal e procedência.",
              "Garantia com nota fiscal e procedência verificada.",
              "1 ano para lacrados e 6 meses para seminovos.",
              "Garantia de 6 meses com nota fiscal e procedência.",
              "Garantia de 3 meses com nota fiscal e procedência.",
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
