import { env } from "../lib/env";
import { getDb, ensureTables } from "../queries/connection";
import { getErpCatalog } from "../erp/service";

/**
 * Catálogo exibido no painel: ERP oficial quando ativado, senão o banco local.
 * Usado pela lista de produtos do painel e pelas pendências do dashboard.
 */
export async function loadAdminProducts() {
  if (env.erpCatalogEnabled) {
    const erp = await getErpCatalog();
    return erp.status === "ok" ? erp.products : [];
  }

  try {
    const db = getDb();
    await ensureTables();
    return await db.query.products.findMany({
      with: { variants: true },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
  } catch (err) {
    console.error("Erro ao consultar produtos admin:", err);
    return [];
  }
}

/** Status da integração com o ERP, com a hora da última sincronização. */
export async function getErpStatus() {
  if (!env.erpCatalogEnabled) {
    return { enabled: false, status: "disabled" as const, count: 0, message: undefined, lastSyncAt: null };
  }
  const erp = await getErpCatalog();
  return {
    enabled: true,
    status: erp.status,
    count: erp.products.length,
    message: erp.message,
    lastSyncAt: erp.cachedAt ? new Date(erp.cachedAt).toISOString() : null,
  };
}
