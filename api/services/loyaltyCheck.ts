/** Conferência do bônus de fidelidade de uma avaliação: consulta o ERP e grava só o resultado. */
import { LOYALTY_STATUS_LABELS } from "@contracts/loyalty";
import { lookupLoyaltyByCpf, type LoyaltyResult } from "../erp/loyalty";
import { logAction } from "./auditLog";
import { updateEvaluationLoyalty } from "./evaluationStore";

export async function runLoyaltyCheck(evaluationId: number, cpf: string): Promise<LoyaltyResult> {
  const result = await lookupLoyaltyByCpf(cpf);
  await updateEvaluationLoyalty(evaluationId, {
    loyaltyStatus: result.status,
    loyaltyNote: result.note,
    erpCustomerId: result.erpCustomerId,
  });
  return result;
}

/** Roda sem atrasar a resposta ao cliente. O CPF fica só em memória e nunca vai para log. */
export function runLoyaltyCheckInBackground(evaluationId: number, cpf: string): void {
  void runLoyaltyCheck(evaluationId, cpf)
    .then((result) =>
      logAction(null, {
        action: "evaluation.loyaltyCheck",
        entityType: "evaluation",
        entityId: evaluationId,
        summary: `Conferência automática de fidelidade da avaliação #${evaluationId}: ${LOYALTY_STATUS_LABELS[result.status]}`,
      }),
    )
    .catch((err) => {
      console.error("[Loyalty] Falha na conferência de fidelidade:", {
        evaluationId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
}
