import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router";
import Header from "./components/Header";
import Footer from "./components/Footer";
import WelcomePopup from "./components/WelcomePopup";
import WhatsAppFloat from "./components/WhatsAppFloat";
import Home from "./pages/Home";
import Catalogo from "./pages/Catalogo";
import Produto from "./pages/Produto";

// Carregados sob demanda (não pesam no primeiro carregamento)
const Admin = lazy(() => import("./pages/Admin"));
const TvMode = lazy(() => import("./pages/TvMode"));

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

  if (isTv) {
    return (
      <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-brand font-display text-2xl font-bold text-ink">Carregando...</div>}>
        <Routes>
          <Route path="/tv" element={<TvMode />} />
          <Route path="/tv/*" element={<TvMode />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white font-sans text-ink">
      <ScrollToHash />
      <Header />
      <main className="flex-1">
        <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16"><div className="h-64 animate-pulse rounded-2xl bg-neutral-200" /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/produto/:id" element={<Produto />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <WelcomePopup />
      <WhatsAppFloat />
    </div>
  );
}
