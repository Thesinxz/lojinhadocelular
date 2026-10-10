/** "2.500,00" ou "2500" → centavos (null se vazio ou inválido). */
export function parseMoneyToCents(value: string): number | null {
  const clean = value.trim().replace(/[R$\s]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function centsToField(cents: number | null | undefined): string {
  return typeof cents === "number" ? (cents / 100).toFixed(2).replace(".", ",") : "";
}
