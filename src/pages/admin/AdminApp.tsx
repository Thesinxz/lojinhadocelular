import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { AdminSessionProvider, AdminUnitProvider } from "@/components/admin/AdminProviders";
import { useAdminSession } from "@/lib/adminSession";
import AdminLayout from "./AdminLayout";
import LoginPage from "./LoginPage";
import { RequireCap } from "./RequireCap";

const DashboardPage = lazy(() => import("./DashboardPage"));
const EvaluationsPage = lazy(() => import("./EvaluationsPage"));
const EvaluationDetailPage = lazy(() => import("./EvaluationDetailPage"));
const ProductsPage = lazy(() => import("./ProductsPage"));
const UsersPage = lazy(() => import("./UsersPage"));
const SettingsPage = lazy(() => import("./SettingsPage"));
const AccountPage = lazy(() => import("./AccountPage"));
const ActivityPage = lazy(() => import("./ActivityPage"));
const ErpPage = lazy(() => import("./ErpPage"));
const ReportsPage = lazy(() => import("./ReportsPage"));
const TrafficPage = lazy(() => import("./TrafficPage"));

function PageFallback() {
  return <div className="h-64 animate-pulse rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7]" />;
}

/** Garante noindex mesmo em navegação client-side (o servidor já envia para /admin/*). */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    meta.setAttribute("data-admin", "true");
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = "Painel da Loja | Lojinha do Celular";
    return () => {
      meta.remove();
      document.title = previousTitle;
    };
  }, []);
}

function AdminGate() {
  const { user, hasToken, isLoading, isError, retry, logout } = useAdminSession();

  if (hasToken && isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fbfbfd]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#e5e5e7] border-t-[#1d1d1f]" />
      </div>
    );
  }

  if (hasToken && isError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fbfbfd] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#e5e5e7] bg-white p-6 text-center shadow-2xs">
          <p className="font-display text-base font-bold text-[#1d1d1f]">Não foi possível abrir o painel</p>
          <p className="mt-1 text-sm text-[#86868b]">Verifique sua conexão com a internet e tente novamente.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={retry}
              className="min-h-11 rounded-xl bg-[#1d1d1f] px-5 text-sm font-semibold text-white hover:bg-black"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={logout}
              className="min-h-11 rounded-xl border border-[#e5e5e7] bg-white px-5 text-sm font-semibold text-[#6e6e73] hover:bg-[#f5f5f7]"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <AdminUnitProvider>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="avaliacoes"
            element={
              <Suspense fallback={<PageFallback />}>
                <EvaluationsPage />
              </Suspense>
            }
          />
          <Route
            path="avaliacoes/:id"
            element={
              <Suspense fallback={<PageFallback />}>
                <EvaluationDetailPage />
              </Suspense>
            }
          />
          <Route
            path="produtos"
            element={
              <Suspense fallback={<PageFallback />}>
                <ProductsPage />
              </Suspense>
            }
          />
          <Route
            path="atividade"
            element={
              <Suspense fallback={<PageFallback />}>
                <ActivityPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios"
            element={
              <Suspense fallback={<PageFallback />}>
                <ReportsPage />
              </Suspense>
            }
          />
          <Route
            path="acessos"
            element={
              <RequireCap cap="settings.manage">
                <Suspense fallback={<PageFallback />}>
                  <TrafficPage />
                </Suspense>
              </RequireCap>
            }
          />
          <Route
            path="erp"
            element={
              <RequireCap cap="products.editMedia">
                <Suspense fallback={<PageFallback />}>
                  <ErpPage />
                </Suspense>
              </RequireCap>
            }
          />
          <Route
            path="usuarios"
            element={
              <RequireCap cap="users.manage">
                <Suspense fallback={<PageFallback />}>
                  <UsersPage />
                </Suspense>
              </RequireCap>
            }
          />
          <Route
            path="configuracoes"
            element={
              <RequireCap cap="settings.manage">
                <Suspense fallback={<PageFallback />}>
                  <SettingsPage />
                </Suspense>
              </RequireCap>
            }
          />
          <Route
            path="conta"
            element={
              <Suspense fallback={<PageFallback />}>
                <AccountPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AdminUnitProvider>
  );
}

export default function AdminApp() {
  useNoIndex();
  return (
    <AdminSessionProvider>
      <AdminGate />
      <Toaster position="top-center" richColors closeButton />
    </AdminSessionProvider>
  );
}
