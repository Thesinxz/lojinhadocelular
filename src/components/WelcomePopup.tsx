import { useEffect, useState } from "react";
import { X, MessageCircle, MapPin } from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";

const SESSION_KEY = "popup_seen";

export default function WelcomePopup() {
  const s = useShopSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    if (!s.loading && s.popupEnabled && !sessionStorage.getItem(SESSION_KEY)) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [s.loading, s.popupEnabled]);

  function close() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 backdrop-blur-sm sm:items-center" onClick={close}>
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border-4 border-ink bg-white shadow-[8px_8px_0_0_#141414]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-brand px-6 pb-6 pt-8 text-center">
          <button
            onClick={close}
            className="absolute right-3 top-3 rounded-full border-2 border-ink bg-white p-1.5 text-ink transition hover:bg-ink hover:text-brand"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <img src="/images/logo-icon.png" alt="Lojinha do Celular" className="mx-auto h-24 w-auto object-contain" />
          <h2 className="mt-2 font-display text-xl font-bold text-ink">
            Bem-vindo à Lojinha do Celular!
          </h2>
          <p className="mt-1 text-sm font-medium text-ink/70">
            Como podemos te ajudar hoje?
          </p>
        </div>

        <div className="space-y-3 p-5">
          <a
            href={waLink(s.whatsappJardim, "Olá! Vim pelo site da Lojinha do Celular.")}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border-2 border-ink bg-[#25D366] px-4 py-3 font-semibold text-ink transition hover:brightness-105"
          >
            <MessageCircle className="h-5 w-5" />
            <div className="text-left">
              <span className="block text-sm font-bold">Chamar no WhatsApp</span>
              <span className="block text-xs opacity-70">Unidade Jardim-MS</span>
            </div>
          </a>
          <a
            href={waLink(s.whatsappGll, "Olá! Vim pelo site da Lojinha do Celular.")}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border-2 border-ink bg-[#25D366] px-4 py-3 font-semibold text-ink transition hover:brightness-105"
          >
            <MessageCircle className="h-5 w-5" />
            <div className="text-left">
              <span className="block text-sm font-bold">Chamar no WhatsApp</span>
              <span className="block text-xs opacity-70">Unidade Guia Lopes da Laguna</span>
            </div>
          </a>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={s.mapsJardim}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand"
            >
              <MapPin className="h-4 w-4" /> Jardim
            </a>
            <a
              href={s.mapsGll}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-brand"
            >
              <MapPin className="h-4 w-4" /> Guia Lopes
            </a>
          </div>

          <button
            onClick={close}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-neutral-500 transition hover:text-ink"
          >
            Quero só olhar o site →
          </button>
        </div>
      </div>
    </div>
  );
}
