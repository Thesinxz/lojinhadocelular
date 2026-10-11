import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { safeStorage } from "@/lib/storage";

const COOKIE_CONSENT_KEY = "cookie_consent";
const COOKIE_CONSENT_AT_KEY = "cookie_consent_at";
/** Evento para reabrir o aviso (link "Preferências de cookies" do rodapé). */
export const OPEN_COOKIE_PREFERENCES_EVENT = "open-cookie-preferences";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verifica se o consentimento já foi registrado anteriormente
    const consent = safeStorage.getItem(COOKIE_CONSENT_KEY);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!consent) {
      // Aparece já no primeiro acesso, com um respiro curto para não saltar no primeiro frame.
      timer = setTimeout(() => setIsVisible(true), 500);
    }
    const reopen = () => setIsVisible(true);
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen);
    };
  }, []);

  const save = (choice: "all" | "essential") => {
    safeStorage.setItem(COOKIE_CONSENT_KEY, choice);
    safeStorage.setItem(COOKIE_CONSENT_AT_KEY, new Date().toISOString());
    setIsVisible(false);
  };
  const handleAcceptAll = () => save("all");
  const handleEssentialOnly = () => save("essential");

  if (!isVisible) return null;

  return (
    <aside
      role="dialog"
      aria-label="Consentimento de Cookies e Privacidade"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-2xl border border-neutral-200/90 bg-white/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl text-neutral-900 animate-fadeIn"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
            <Cookie className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-bold text-neutral-900">
            Privacidade & Cookies
          </span>
        </div>
        <button
          type="button"
          onClick={handleEssentialOnly}
          className="text-neutral-400 hover:text-neutral-700 transition p-1 rounded-lg hover:bg-neutral-100 cursor-pointer"
          aria-label="Fechar e manter apenas essenciais"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-neutral-600">
        Usamos apenas armazenamento essencial: manter sua sacola, lembrar sua loja preferida e proteger sua
        navegação. Não usamos rastreadores de publicidade nem vendemos seus dados, em conformidade com a{" "}
        <b className="text-neutral-900 font-semibold">LGPD (Lei 13.709/2018)</b>.
      </p>

      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <button
          type="button"
          onClick={handleAcceptAll}
          className="flex-1 rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 transition active:scale-95 shadow-xs text-center cursor-pointer"
        >
          Aceitar e continuar
        </button>
        <button
          type="button"
          onClick={handleEssentialOnly}
          className="rounded-full border border-neutral-200/80 bg-neutral-50 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition active:scale-95 text-center cursor-pointer"
        >
          Só essenciais
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500 pt-2.5 border-t border-neutral-100">
        <span className="flex items-center gap-1 text-emerald-700 font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Seus dados estão protegidos
        </span>
        <Link
          to="/privacidade#cookies"
          className="text-neutral-600 hover:text-neutral-900 underline transition"
        >
          Ver termos e política
        </Link>
      </div>
    </aside>
  );
}
