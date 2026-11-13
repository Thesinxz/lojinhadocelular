type NetworkInfo = {
  saveData?: boolean;
  effectiveType?: string;
};

let produtoRoutePromise: Promise<typeof import("@/pages/Produto")> | null = null;

/** Carrega o chunk da página de produto em cache único por sessão. */
export function loadProdutoPage() {
  if (!produtoRoutePromise) {
    produtoRoutePromise = import("@/pages/Produto");
  }
  return produtoRoutePromise;
}

/**
 * Pré-carrega o chunk da página de produto apenas quando a conexão não está
 * em modo economia de dados ou rede 2G.
 */
export function prefetchProductRoute(): void {
  if (typeof navigator !== "undefined") {
    const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    if (
      conn?.saveData ||
      conn?.effectiveType === "slow-2g" ||
      conn?.effectiveType === "2g"
    ) {
      return;
    }
  }
  void loadProdutoPage();
}
