import { useEffect, useState } from "react";
import { Save, KeyRound, CreditCard } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { SETTING_KEYS, parseFees } from "@contracts/types";

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const query = trpc.admin.getSettings.useQuery();
  const [values, setValues] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [heroText, setHeroText] = useState("");
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const update = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      utils.admin.getSettings.invalidate();
      utils.shop.settings.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const changePassword = trpc.admin.changePassword.useMutation({
    onSuccess: () => {
      setNewPassword("");
      alert("Senha alterada com sucesso!");
    },
  });

  useEffect(() => {
    if (query.data) {
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
  }, [query.data]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  if (query.isLoading) {
    return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-neutral-200" />;
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Lojas */}
      <section className="rounded-2xl border-2 border-ink bg-white p-6 shadow-[4px_4px_0_0_#141414]">
        <h3 className="font-display text-lg font-bold text-ink">Unidades</h3>
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
      <section className="rounded-2xl border-2 border-ink bg-white p-6 shadow-[4px_4px_0_0_#141414]">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <CreditCard className="h-5 w-5" /> Taxas da maquininha
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
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

        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-neutral-500">
          Taxa por quantidade de parcelas (%)
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 21 }, (_, i) => String(i + 1)).map((n) => (
            <label key={n} className="block">
              <span className="mb-0.5 block text-[11px] font-bold text-ink">
                {n === "1" ? "À vista" : `${n}x`}
              </span>
              <input
                value={fees[n] ?? ""}
                onChange={(e) => setFees((f) => ({ ...f, [n]: e.target.value }))}
                inputMode="decimal"
                className="w-full rounded-lg border-2 border-ink/20 px-2 py-1.5 text-sm font-medium outline-none focus:border-ink"
                placeholder="0,00"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Popup */}
      <section className="rounded-2xl border-2 border-ink bg-white p-6 shadow-[4px_4px_0_0_#141414]">
        <h3 className="font-display text-lg font-bold text-ink">Popup de boas-vindas</h3>
        <label className="mt-3 flex items-center gap-3">
          <input
            type="checkbox"
            checked={(values[SETTING_KEYS.popupEnabled] ?? "1") === "1"}
            onChange={(e) =>
              setValues((v) => ({ ...v, [SETTING_KEYS.popupEnabled]: e.target.checked ? "1" : "0" }))
            }
            className="h-5 w-5 accent-[#141414]"
          />
          <span className="text-sm font-semibold text-ink">
            Mostrar popup de WhatsApp/localização ao abrir o site
          </span>
        </label>
      </section>

      {/* Fotos do hero */}
      <section className="rounded-2xl border-2 border-ink bg-white p-6 shadow-[4px_4px_0_0_#141414]">
        <h3 className="font-display text-lg font-bold text-ink">Fotos da página inicial</h3>
        <p className="mt-1 text-xs text-neutral-500">
          As fotos que ficam alternando ao lado de "Seu próximo iPhone está aqui".
          Cole <strong>uma URL por linha</strong> (as imagens ficam hospedadas fora do site).
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
                className="h-16 w-16 rounded-lg border-2 border-ink/20 object-cover"
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
        className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-brand px-6 py-3 font-display font-bold text-ink shadow-[3px_3px_0_0_#141414] transition hover:-translate-y-0.5 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {update.isPending ? "Salvando..." : saved ? "Salvo!" : "Salvar configurações"}
      </button>

      {/* Senha */}
      <section className="rounded-2xl border-2 border-red-300 bg-red-50 p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <KeyRound className="h-5 w-5" /> Trocar senha do painel
        </h3>
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
            className="rounded-xl border-2 border-ink bg-ink px-5 py-2.5 text-sm font-bold text-brand disabled:opacity-50"
          >
            Trocar senha
          </button>
        </div>
      </section>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border-2 border-ink/30 px-4 py-2.5 text-sm font-medium outline-none focus:border-ink bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}
