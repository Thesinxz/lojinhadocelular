import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { isValidCpf } from "@contracts/brDocs";
import { LOYALTY_STATUS_LABELS, declaredLojinhaPurchase, loyaltyApplies, type LoyaltyStatus } from "@contracts/loyalty";
import { formatDateTime, type EvaluationRow } from "./evaluationUi";

function formatCpfInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const TONE: Record<string, string> = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-900",
  manual: "border-emerald-200 bg-emerald-50 text-emerald-900",
  found: "border-amber-200 bg-amber-50 text-amber-900",
  not_found: "border-red-200 bg-red-50 text-red-900",
  denied: "border-red-200 bg-red-50 text-red-900",
  unavailable: "border-neutral-200 bg-neutral-50 text-neutral-800",
};

/**
 * Bônus de fidelidade: a pessoa diz que comprou na Lojinha, mas o bônus só entra na estimativa
 * depois de confirmado (cadastro com compra no ERP, ou confirmação da equipe).
 */
export default function LoyaltyCard({ evaluation }: { evaluation: EvaluationRow }) {
  const utils = trpc.useUtils();
  const [cpf, setCpf] = useState("");
  const refresh = () => {
    utils.admin.evaluationDetail.invalidate({ id: evaluation.id });
    utils.admin.evaluationsPage.invalidate();
  };
  const verify = trpc.admin.evaluationLoyaltyVerify.useMutation({
    onSuccess: (res) => {
      setCpf("");
      refresh();
      toast.success(LOYALTY_STATUS_LABELS[res.status]);
    },
    onError: (err) => toast.error(err.message),
  });
  const confirm = trpc.admin.evaluationLoyaltyConfirm.useMutation({
    onSuccess: refresh,
    onError: (err) => toast.error(err.message),
  });

  if (!declaredLojinhaPurchase(evaluation.purchaseLocation)) return null;

  const status = (evaluation.loyaltyStatus || "") as LoyaltyStatus | "";
  const applied = loyaltyApplies(status);

  return (
    <section className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 shadow-2xs sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-purple-950">
        <Gift className="h-4 w-4" /> Bônus de fidelidade
      </h2>
      <p className="mt-1 text-xs text-purple-900/80">
        O cliente disse que comprou na Lojinha. O bônus só entra na estimativa depois de confirmado.
      </p>

      <div className={`mt-3 rounded-xl border p-3 text-sm ${status ? TONE[status] : "border-neutral-200 bg-white text-neutral-700"}`}>
        <p className="font-semibold">{status ? LOYALTY_STATUS_LABELS[status] : "Ainda não conferido"}</p>
        {evaluation.loyaltyNote && <p className="mt-0.5 text-xs">{evaluation.loyaltyNote}</p>}
        {evaluation.loyaltyCheckedAt && (
          <p className="mt-0.5 text-[11px] opacity-70">Conferido em {formatDateTime(evaluation.loyaltyCheckedAt)}</p>
        )}
        <p className="mt-1 text-xs font-semibold">{applied ? "✅ Bônus aplicado na estimativa" : "Bônus não aplicado na estimativa"}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[180px] flex-1">
          <span className="mb-1 block text-xs font-semibold text-[#6e6e73]">Conferir no ERP pelo CPF</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpfInput(e.target.value))}
            className="h-11 w-full rounded-xl border border-[#e5e5e7] bg-white px-3 text-sm font-medium outline-none focus:border-purple-400"
          />
        </label>
        <button
          type="button"
          disabled={!isValidCpf(cpf) || verify.isPending}
          onClick={() => verify.mutate({ id: evaluation.id, cpf })}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-900 px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {verify.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Conferir
        </button>
      </div>
      <p className="mt-1 text-[11px] text-[#86868b]">O CPF é usado só nesta consulta e não é salvo.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={confirm.isPending || status === "manual"}
          onClick={() => confirm.mutate({ id: evaluation.id, confirmed: true })}
          className="min-h-11 rounded-xl border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
        >
          Confirmar manualmente
        </button>
        <button
          type="button"
          disabled={confirm.isPending || status === "denied"}
          onClick={() => confirm.mutate({ id: evaluation.id, confirmed: false })}
          className="min-h-11 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
        >
          Negar bônus
        </button>
      </div>
    </section>
  );
}
