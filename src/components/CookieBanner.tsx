import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { safeStorage } from "@/lib/storage";

const COOKIE_CONSENT_KEY = "cookie_consent";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verifica se o consentimento já foi registrado anteriormente
    const consent = safeStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Pequeno delay suave para não saltar na tela logo no primeiro frame
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    safeStorage.setItem(COOKIE_CONSENT_KEY, "all");
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    safeStorage.setItem(COOKIE_CONSENT_KEY, "essential");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Consentimento de Cookies e Privacidade"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-2xl border border-white/15 bg-[#141414]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl text-white animate-fadeIn"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Cookie className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-bold text-white">
            Privacidade & Cookies
          </span>
        </div>
        <button
          type="button"
          onClick={handleEssentialOnly}
          className="text-neutral-400 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
          aria-label="Fechar e manter apenas essenciais"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-300">
        Utilizamos cookies essenciais para manter sua sacola de compras ativa, lembrar sua loja
        preferida e proteger sua navegação, em estrita conformidade com a <b>LGPD (Lei 13.709/2018)</b>.
      </p>

      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <button
          type="button"
          onClick={handleAcceptAll}
          className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200 transition active:scale-95 shadow-sm text-center"
        >
          Aceitar todos
        </button>
        <button
          type="button"
          onClick={handleEssentialOnly}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition active:scale-95 text-center"
        >
          Apenas essenciais
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-white/10">
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" /> Seus dados estão protegidos
        </span>
        <Link
          to="/privacidade#cookies"
          className="hover:text-white underline transition"
        >
          Ver termos e política
        </Link>
      </div>
    </aside>
  );
}
