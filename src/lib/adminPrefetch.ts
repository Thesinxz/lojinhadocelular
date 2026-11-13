const inFlightPrefetches = new Set<string>();

function runPrefetch(key: string, loader: () => Promise<unknown>): void {
  if (inFlightPrefetches.has(key)) return;
  inFlightPrefetches.add(key);
  loader().catch(() => {
    inFlightPrefetches.delete(key);
  });
}

export function prefetchEvaluationDetailRoute(): void {
  runPrefetch("evaluationDetail", () =>
    import("@/pages/admin/EvaluationDetailPage"),
  );
}

export function prefetchAdminProductEditor(): void {
  runPrefetch("productEditor", () =>
    import("@/components/admin/AdminProductEditor"),
  );
}

export function prefetchAdminErpProductEditor(): void {
  runPrefetch("erpProductEditor", () =>
    import("@/components/admin/AdminErpProductEditor"),
  );
}

const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  "/admin": () => import("@/pages/admin/DashboardPage"),
  "/admin/avaliacoes": () => import("@/pages/admin/EvaluationsPage"),
  "/admin/produtos": () => import("@/pages/admin/ProductsPage"),
  "/admin/relatorios": () => import("@/pages/admin/ReportsPage"),
  "/admin/acessos": () => import("@/pages/admin/TrafficPage"),
  "/admin/erp": () => import("@/pages/admin/ErpPage"),
  "/admin/atividade": () => import("@/pages/admin/ActivityPage"),
  "/admin/usuarios": () => import("@/pages/admin/UsersPage"),
  "/admin/configuracoes": () => import("@/pages/admin/SettingsPage"),
  "/admin/conta": () => import("@/pages/admin/AccountPage"),
};

export function prefetchAdminRoute(to: string): void {
  const cleanPath = to.split("?")[0];
  const loader = ROUTE_LOADERS[cleanPath];
  if (loader) {
    runPrefetch(`route:${cleanPath}`, loader);
  }
}
