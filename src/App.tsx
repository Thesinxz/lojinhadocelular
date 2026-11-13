import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router";
import Header from "./components/Header";
import Footer from "./components/Footer";
import CookieBanner from "./components/CookieBanner";
import { CartProvider, useCart } from "./lib/cart";
import { CompareProvider, useCompare } from "./lib/compare";
import Home from "./pages/Home";
import { getMainStoreUrl } from "./lib/shop";
import { usePageViewTracking } from "./lib/usePageViewTracking";
import { loadProdutoPage } from "./lib/routePrefetch";
import { useWhatsAppModalRequested } from "./lib/whatsappModal";

// Rotas e overlays carregados sob demanda para enxugar o primeiro bundle no mobile
const Produto = lazy(loadProdutoPage);
const TradeIn = lazy(() => import("./pages/TradeIn"));
const TvMode = lazy(() => import("./pages/TvMode"));
const AdminApp = lazy(() => import("./pages/admin/AdminApp"));
const Comparar = lazy(() => import("./pages/Comparar"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));
const WelcomePopup = lazy(() => import("./components/WelcomePopup"));
const CartDrawer = lazy(() => import("./components/CartDrawer"));
const CompareBar = lazy(() => import("./components/CompareBar"));

function StoreOverlays() {
  const { items, isOpen } = useCart();
  const { ids } = useCompare();
  const whatsAppRequested = useWhatsAppModalRequested();

  return (
    <>
      {whatsAppRequested && (
        <Suspense fallback={null}>
          <WelcomePopup />
        </Suspense>
      )}
      {(items.length > 0 || isOpen) && (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
      {ids.length > 0 && (
        <Suspense fallback={null}>
          <CompareBar />
        </Suspense>
      )}
    </>
  );
}

/** Rola até a âncora (#sobre, #unidades...) após a navegação */
function ScrollToHash() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      // espera a página renderizar antes de rolar
      const t = setTimeout(() => {
        const el = document.getElementById(location.hash.slice(1));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname, location.hash]);
  return null;
}

export default function App() {
  const location = useLocation();
  const isTv = location.pathname.startsWith("/tv");
  const isAdmin =
    location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const isPrivacyPath =
    location.pathname === "/privacidade" ||
    location.pathname === "/termos" ||
    location.pathname === "/termos-e-privacidade" ||
    location.pathname === "/lgpd" ||
    location.pathname === "/cookies";
  const isTrocaFacilDomain =
    typeof window !== "undefined" &&
    window.location.hostname.includes("trocafacil");

  usePageViewTracking(!isTv && !isAdmin);

  // Se estiver no subdomínio do Troca Fácil e tentar acessar vitrine, catálogo ou produto, redireciona para a loja principal
  useEffect(() => {
    if (!isTrocaFacilDomain) return;

    const isVitrineIntent =
      location.hash === "#vitrine" ||
      location.pathname === "/catalogo" ||
      location.pathname === "/vitrine" ||
      location.pathname === "/loja" ||
      location.pathname.startsWith("/produto/");

    if (isVitrineIntent) {
      const targetPath =
        location.pathname === "/catalogo" ||
        location.pathname === "/vitrine" ||
        location.pathname === "/loja"
          ? "/#vitrine"
          : `${location.pathname}${location.search}${location.hash}`;
      window.location.href = getMainStoreUrl(targetPath);
    }
  }, [isTrocaFacilDomain, location.pathname, location.hash, location.search]);

  const isTradeIn =
    !isAdmin &&
    !isTv &&
    !isPrivacyPath &&
    (isTrocaFacilDomain ||
      location.pathname === "/avaliacao" ||
      location.pathname === "/troca");

  if (isTv) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-950">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        }
      >
        <Routes>
          <Route path="/tv" element={<TvMode />} />
          <Route path="/tv/*" element={<TvMode />} />
        </Routes>
      </Suspense>
    );
  }

  // Painel administrativo: layout próprio, fora do cabeçalho/rodapé da loja.
  if (isAdmin) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-[100dvh] items-center justify-center bg-[#fbfbfd]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#e5e5e7] border-t-[#1d1d1f]" />
          </div>
        }
      >
        <Routes>
          <Route path="/admin/*" element={<AdminApp />} />
        </Routes>
      </Suspense>
    );
  }

  if (isTradeIn) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-[100dvh] items-center justify-center bg-[#fbfbfd]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#e5e5e7] border-t-[#1d1d1f]" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<TradeIn />} />
          <Route path="/avaliacao" element={<TradeIn />} />
          <Route path="/troca" element={<TradeIn />} />
          {isTrocaFacilDomain && <Route path="*" element={<TradeIn />} />}
        </Routes>
      </Suspense>
    );
  }

  return (
    <CartProvider>
      <CompareProvider>
        <div className="flex min-h-[100dvh] flex-col bg-[#fbfbfd] font-sans text-[#1d1d1f] antialiased">
          <ScrollToHash />
          <Header />
          <main className="flex-1">
            <Suspense
              fallback={
                <div className="mx-auto max-w-6xl px-4 py-16">
                  <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/catalogo"
                  element={<Navigate to="/#vitrine" replace />}
                />
                <Route path="/produto/:id" element={<Produto />} />
                <Route path="/comparar" element={<Comparar />} />
                <Route path="/privacidade" element={<Privacidade />} />
                <Route path="/termos" element={<Privacidade />} />
                <Route path="/termos-e-privacidade" element={<Privacidade />} />
                <Route path="/lgpd" element={<Privacidade />} />
                <Route path="/cookies" element={<Privacidade />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <CookieBanner />
          <StoreOverlays />
        </div>
      </CompareProvider>
    </CartProvider>
  );
}
