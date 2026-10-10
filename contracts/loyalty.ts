/** Bônus de fidelidade: estado da conferência do cadastro do cliente no ERP. */
export const LOYALTY_STATUSES = ["verified", "found", "not_found", "unavailable", "manual", "denied"] as const;
export type LoyaltyStatus = (typeof LOYALTY_STATUSES)[number];

export const LOYALTY_STATUS_LABELS: Record<LoyaltyStatus, string> = {
  verified: "Confirmado no ERP (tem compra anterior)",
  found: "Cadastro encontrado, sem compra confirmada",
  not_found: "Não encontrado no ERP",
  unavailable: "Não foi possível consultar o ERP",
  manual: "Confirmado pela equipe",
  denied: "Negado pela equipe",
};

/** O bônus só entra na estimativa quando foi confirmado (pelo ERP ou pela equipe). */
export function loyaltyApplies(status: string | null | undefined): boolean {
  return status === "verified" || status === "manual";
}

/** A pessoa disse que comprou na Lojinha? (mesma regra do motor de avaliação) */
export function declaredLojinhaPurchase(purchaseLocation: string | null | undefined): boolean {
  const origin = String(purchaseLocation ?? "").toLowerCase();
  return origin.includes("lojinha do celular") || origin.includes("comprado com a nossa equipe");
}
