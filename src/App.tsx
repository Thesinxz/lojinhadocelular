import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router";
import Header from "./components/Header";
import Footer from "./components/Footer";
import WelcomePopup from "./components/WelcomePopup";
import CookieBanner from "./components/CookieBanner";
import CartDrawer from "./components/CartDrawer";
import { CartProvider } from "./lib/cart";
import Home from "./pages/Home";
import Produto from "./pages/Produto";
import TradeIn from "./pages/TradeIn";
import { getMainStoreUrl } from "./lib/shop";

import TvMode from "./pages/TvMode";

// Carregados sob demanda (não pesam no primeiro carregamento)
const Admin = lazy(() => import("./pages/Admin"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
  const isAdmin = location.pathname.startsWith("/admin");
  const isPrivacyPath =
    location.pathname === "/privacidade" ||
    location.pathname === "/termos" ||
    location.pathname === "/termos-e-privacidade" ||
    location.pathname === "/lgpd" ||
    location.pathname === "/cookies";
  const isTrocaFacilDomain =
    typeof window !== "undefined" && window.location.hostname.includes("trocafacil");

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
        location.pathname === "/catalogo" || location.pathname === "/vitrine" || location.pathname === "/loja"
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
      <Routes>
        <Route path="/tv" element={<TvMode />} />
        <Route path="/tv/*" element={<TvMode />} />
      </Routes>
    );
  }

  if (isTradeIn) {
    return (
      <Routes>
        <Route path="/" element={<TradeIn />} />
        <Route path="/avaliacao" element={<TradeIn />} />
        <Route path="/troca" element={<TradeIn />} />
        {isTrocaFacilDomain && <Route path="*" element={<TradeIn />} />}
      </Routes>
    );
  }

  return (
    <CartProvider>
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
              <Route path="/catalogo" element={<Navigate to="/#vitrine" replace />} />
              <Route path="/produto/:id" element={<Produto />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/termos" element={<Privacidade />} />
              <Route path="/termos-e-privacidade" element={<Privacidade />} />
              <Route path="/lgpd" element={<Privacidade />} />
              <Route path="/cookies" element={<Privacidade />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <WelcomePopup />
        <CookieBanner />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
