/** Endereço do painel do Gestão Celular ERP (onde a equipe edita estoque e preço). */
export const ERP_APP_URL = "https://gestaocelular.com.br";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Página do produto no ERP; sem um ID válido do ERP, abre o painel. */
export function erpProductUrl(externalId?: string | null): string {
  const id = String(externalId ?? "").trim();
  return UUID.test(id) ? `${ERP_APP_URL}/produtos/${id}` : ERP_APP_URL;
}
