import { useState } from "react";
import { CheckCircle2, Loader2, PackagePlus, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { formatBRL } from "@contracts/types";
import { isValidCep, isValidCpfOrCnpj, isValidImei, onlyDigits } from "@contracts/brDocs";
import { centsToField, parseMoneyToCents } from "@/lib/money";
import { formatDateTime, type EvaluationRow } from "./evaluationUi";

const GRADES = ["A+", "A", "B", "C"] as const;

const inputCls =
  "h-11 w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:bg-white focus:ring-4 focus:ring-[#0071e3]/15";

function guessBrand(model: string): string {
  return /iphone|ipad|apple/i.test(model) ? "Apple" : "";
}

function guessBattery(text: string): string {
  const match = String(text ?? "").match(/\d{2,3}/);
  return match ? match[0] : "";
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-[#6e6e73]">{label}</span>
      {children}
    </label>
  );
}

/**
 * Entrada do aparelho comprado no estoque do ERP (Gestão Celular).
 * Só para trocas concluídas; ação manual, uma vez por avaliação.
 */
export default function ErpEntryCard({ evaluation }: { evaluation: EvaluationRow }) {
  const utils = trpc.useUtils();
  const state = trpc.admin.erpEntryState.useQuery({ id: evaluation.id });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    brandName: guessBrand(evaluation.model),
    modelName: evaluation.model,
    imei1: "",
    imei2: "",
    cor: evaluation.color ?? "",
    capacidade: evaluation.storage ?? "",
    batteryHealth: guessBattery(evaluation.battery),
    grade: "A" as (typeof GRADES)[number],
    cost: centsToField(evaluation.closedValue),
    sale: "",
    observacoes: "",
    necessitaReparo: false,
    emitirNfe: false,
    anatelManual: "" as "" | "REGULAR" | "NAO_CONSTA" | "IMPEDIDO",
    nome: evaluation.name,
    cpfCnpj: "",
    telefone: evaluation.whatsapp,
    email: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    codigoMunicipio: "",
    nomeMunicipio: "",
    uf: "",
  }));
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const [cepLoading, setCepLoading] = useState(false);
  async function lookupCep() {
    if (!isValidCep(form.cep)) return;
    setCepLoading(true);
    try {
      const found = await utils.admin.lookupCep.fetch({ cep: form.cep });
      if (!found) {
        toast.error("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      setForm((f) => ({
        ...f,
        logradouro: found.logradouro || f.logradouro,
        bairro: found.bairro || f.bairro,
        nomeMunicipio: found.cidade,
        uf: found.uf,
        codigoMunicipio: found.ibge,
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao consultar o CEP");
    } finally {
      setCepLoading(false);
    }
  }

  const create = trpc.admin.erpEntryCreate.useMutation({
    onSuccess: () => {
      toast.success("Aparelho cadastrado no estoque do ERP.");
      setOpen(false);
      utils.admin.erpEntryState.invalidate({ id: evaluation.id });
      utils.admin.evaluationDetail.invalidate({ id: evaluation.id });
    },
    onError: (err) => toast.error(err.message, { duration: 10_000 }),
  });

  if (evaluation.status !== "concluido") return null;
  if (state.isLoading) return <div className="h-20 animate-pulse rounded-2xl bg-[#f5f5f7]" />;
  const data = state.data;
  if (!data) return null;

  const entry = data.entry;
  if (entry?.status === "sent") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-emerald-900">
          <CheckCircle2 className="h-4 w-4" /> Aparelho no estoque do ERP
        </h2>
        <p className="mt-1 text-xs text-emerald-800">
          Entrada feita por {entry.userName || "alguém"} em {formatDateTime(entry.createdAt)}
          {entry.imeiLast4 ? ` · IMEI final ${entry.imeiLast4}` : ""}
          {entry.erpProductId ? ` · código ${entry.erpProductId}` : ""}.
        </p>
      </section>
    );
  }

  if (!data.configured) {
    return (
      <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#1d1d1f]">
          <PackagePlus className="h-4 w-4 text-[#0071e3]" /> Entrada no estoque do ERP
        </h2>
        <p className="mt-1 text-xs text-[#86868b]">
          Indisponível: o usuário de serviço do ERP ainda não foi configurado no servidor (ERP_SERVICE_EMAIL e ERP_SERVICE_PASSWORD).
        </p>
      </section>
    );
  }

  const costCents = parseMoneyToCents(form.cost);
  const saleCents = parseMoneyToCents(form.sale);
  const problems: string[] = [];
  if (!form.brandName.trim() || !form.modelName.trim()) problems.push("marca e modelo");
  if (!isValidImei(form.imei1)) problems.push("IMEI 1 válido (15 dígitos)");
  if (form.imei2 && !isValidImei(form.imei2)) problems.push("IMEI 2 válido");
  if (!form.cor.trim() || !form.capacidade.trim()) problems.push("cor e capacidade");
  const battery = Number(form.batteryHealth);
  if (form.batteryHealth === "" || !Number.isFinite(battery) || battery < 0 || battery > 100) problems.push("bateria de 0 a 100");
  if (costCents === null) problems.push("valor pago");
  if (saleCents === null || saleCents <= 0) problems.push("preço de venda");
  if (form.nome.trim().length < 3) problems.push("nome do cliente");
  if (!isValidCpfOrCnpj(form.cpfCnpj)) problems.push("CPF/CNPJ válido");
  if (!isValidCep(form.cep) || !form.logradouro.trim() || !form.numero.trim() || !form.bairro.trim() || form.codigoMunicipio.length < 7 || !form.nomeMunicipio.trim() || form.uf.trim().length !== 2) {
    problems.push("endereço completo");
  }

  function submit() {
    if (problems.length) {
      toast.error(`Falta preencher: ${problems.join(", ")}.`);
      return;
    }
    const summary = `${form.brandName} ${form.modelName} · IMEI final ${onlyDigits(form.imei1).slice(-4)} · pago ${formatBRL(costCents!)} · venda ${formatBRL(saleCents!)}${form.emitirNfe ? " · COM NF-e" : ""}`;
    if (!window.confirm(`Dar entrada no estoque do ERP?\n\n${summary}\n\nIsso cria o aparelho e o cliente no ERP e não pode ser desfeito por aqui.`)) return;
    create.mutate({
      id: evaluation.id,
      data: {
        brandName: form.brandName.trim(),
        modelName: form.modelName.trim(),
        imei1: onlyDigits(form.imei1),
        imei2: onlyDigits(form.imei2),
        cor: form.cor.trim(),
        capacidade: form.capacidade.trim(),
        batteryHealth: battery,
        grade: form.grade,
        costCents: costCents!,
        saleCents: saleCents!,
        observacoes: form.observacoes.trim(),
        necessitaReparo: form.necessitaReparo,
        emitirNfe: form.emitirNfe,
        anatelManual: form.anatelManual || undefined,
        cliente: {
          nome: form.nome.trim(),
          cpfCnpj: form.cpfCnpj,
          telefone: form.telefone.trim(),
          email: form.email.trim(),
          endereco: {
            cep: form.cep,
            logradouro: form.logradouro.trim(),
            numero: form.numero.trim(),
            complemento: form.complemento.trim(),
            bairro: form.bairro.trim(),
            codigoMunicipio: form.codigoMunicipio.trim(),
            nomeMunicipio: form.nomeMunicipio.trim(),
            uf: form.uf.trim().toUpperCase(),
          },
        },
      },
    });
  }

  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white p-4 shadow-2xs sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#1d1d1f]">
          <PackagePlus className="h-4 w-4 text-[#0071e3]" /> Entrada no estoque do ERP
        </h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 rounded-xl bg-[#0071e3] px-4 text-sm font-semibold text-white hover:bg-[#0077ed]"
          >
            Dar entrada no ERP
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-[#86868b]">
        Cadastra o aparelho comprado do cliente no estoque do Gestão Celular. Os dados pessoais vão direto ao ERP e não ficam salvos aqui.
      </p>
      {entry?.status === "sending" && (
        <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
          Há uma tentativa recente sem resposta definitiva. Confira no ERP se o aparelho entrou antes de tentar de novo.
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-5">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-[#86868b]">Aparelho</legend>
            <Field label="Marca"><input className={inputCls} value={form.brandName} onChange={(e) => set("brandName", e.target.value)} /></Field>
            <Field label="Modelo"><input className={inputCls} value={form.modelName} onChange={(e) => set("modelName", e.target.value)} /></Field>
            <Field label="IMEI 1 (15 dígitos)"><input className={inputCls} inputMode="numeric" value={form.imei1} onChange={(e) => set("imei1", e.target.value)} placeholder="Disque *#06#" /></Field>
            <Field label="IMEI 2 (opcional)"><input className={inputCls} inputMode="numeric" value={form.imei2} onChange={(e) => set("imei2", e.target.value)} /></Field>
            <Field label="Cor"><input className={inputCls} value={form.cor} onChange={(e) => set("cor", e.target.value)} /></Field>
            <Field label="Capacidade"><input className={inputCls} value={form.capacidade} onChange={(e) => set("capacidade", e.target.value)} /></Field>
            <Field label="Saúde da bateria (%)"><input className={inputCls} inputMode="numeric" value={form.batteryHealth} onChange={(e) => set("batteryHealth", e.target.value.replace(/\D/g, "").slice(0, 3))} /></Field>
            <Field label="Grade">
              <select className={inputCls} value={form.grade} onChange={(e) => set("grade", e.target.value as (typeof GRADES)[number])}>
                {GRADES.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
            </Field>
            <Field label="Valor pago ao cliente (R$)"><input className={inputCls} inputMode="decimal" value={form.cost} onChange={(e) => set("cost", e.target.value)} /></Field>
            <Field label="Preço de venda (R$)"><input className={inputCls} inputMode="decimal" value={form.sale} onChange={(e) => set("sale", e.target.value)} /></Field>
            <Field label="Consulta do IMEI no portal da ANATEL" className="sm:col-span-2">
              <select className={inputCls} value={form.anatelManual} onChange={(e) => set("anatelManual", e.target.value as typeof form.anatelManual)}>
                <option value="">Ainda não consultei (o ERP tenta verificar sozinho)</option>
                <option value="REGULAR">Consultei: regular</option>
                <option value="NAO_CONSTA">Consultei: não consta bloqueio</option>
                <option value="IMPEDIDO">Consultei: IMPEDIDO / roubado</option>
              </select>
              <span className="mt-1 block text-[11px] text-[#86868b]">
                Aparelho impedido, roubado ou com IMEI inválido é recusado. Se o ERP não conseguir consultar a ANATEL, você precisa informar o resultado aqui.
              </span>
            </Field>
            <Field label="Observações" className="sm:col-span-2"><input className={inputCls} value={form.observacoes} maxLength={500} onChange={(e) => set("observacoes", e.target.value)} /></Field>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-[#86868b]">Cliente (vendedor do aparelho)</legend>
            <Field label="Nome completo"><input className={inputCls} value={form.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
            <Field label="CPF ou CNPJ"><input className={inputCls} inputMode="numeric" value={form.cpfCnpj} onChange={(e) => set("cpfCnpj", e.target.value)} /></Field>
            <Field label="Telefone"><input className={inputCls} value={form.telefone} onChange={(e) => set("telefone", e.target.value)} /></Field>
            <Field label="E-mail (opcional)"><input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="CEP">
              <div className="flex gap-2">
                <input className={inputCls} inputMode="numeric" value={form.cep} onChange={(e) => set("cep", e.target.value)} onBlur={lookupCep} placeholder="00000-000" />
                <button type="button" onClick={lookupCep} disabled={cepLoading || !isValidCep(form.cep)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e7] hover:bg-[#f5f5f7] disabled:opacity-40" aria-label="Buscar endereço pelo CEP">
                  {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Rua"><input className={inputCls} value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></Field>
            <Field label="Número"><input className={inputCls} value={form.numero} onChange={(e) => set("numero", e.target.value)} /></Field>
            <Field label="Complemento"><input className={inputCls} value={form.complemento} onChange={(e) => set("complemento", e.target.value)} /></Field>
            <Field label="Bairro"><input className={inputCls} value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></Field>
            <Field label="Cidade"><input className={inputCls} value={form.nomeMunicipio} onChange={(e) => set("nomeMunicipio", e.target.value)} /></Field>
            <Field label="UF"><input className={inputCls} maxLength={2} value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} /></Field>
            <Field label="Código IBGE do município"><input className={inputCls} inputMode="numeric" value={form.codigoMunicipio} onChange={(e) => set("codigoMunicipio", e.target.value.replace(/\D/g, "").slice(0, 7))} /></Field>
          </fieldset>

          <div className="space-y-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#e5e5e7] p-3 text-sm font-semibold text-[#1d1d1f]">
              <input type="checkbox" className="h-5 w-5" checked={form.necessitaReparo} onChange={(e) => set("necessitaReparo", e.target.checked)} />
              Precisa de reparo antes de vender
            </label>
            <label className={`flex min-h-11 items-start gap-3 rounded-xl border border-[#e5e5e7] p-3 text-sm font-semibold text-[#1d1d1f] ${data.canEmitNfe ? "cursor-pointer" : "opacity-60"}`}>
              <input type="checkbox" className="mt-0.5 h-5 w-5" disabled={!data.canEmitNfe} checked={form.emitirNfe} onChange={(e) => set("emitirNfe", e.target.checked)} />
              <span>
                Emitir NF-e de entrada
                <span className="block text-xs font-normal text-[#86868b]">
                  {data.canEmitNfe ? "Gera nota fiscal no ERP. Deixe desmarcado se não tiver certeza." : "Somente o dono (ou quem tem permissão de gerenciar produtos)."}
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-[#e5e5e7] px-4 text-sm font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7]">
              Cancelar
            </button>
            <button type="button" onClick={submit} disabled={create.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1d1d1f] px-5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar entrada no ERP
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
