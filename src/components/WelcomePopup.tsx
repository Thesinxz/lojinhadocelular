import { useEffect, useState } from "react";
import { X, MessageCircle, MapPin } from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";
import { safeSessionStorage } from "@/lib/storage";

const SESSION_KEY = "popup_seen";

export default function WelcomePopup() {
  const s = useShopSettings();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) return;
    if (!s.loading && s.popupEnabled && !safeSessionStorage.getItem(SESSION_KEY)) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [s.loading, s.popupEnabled]);

  function close() {
    safeSessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:pb-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-2xl transition-all animate-in fade-in-50 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-neutral-100 bg-gradient-to-b from-neutral-50 to-white px-6 pb-6 pt-8 text-center">
          <button
            onClick={close}
            className="absolute right-3.5 top-3.5 rounded-full bg-neutral-100 p-1.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-900"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <img src="/images/logo-icon.png" alt="Lojinha do Celular" className="mx-auto h-16 w-auto object-contain" />
          <h2 className="mt-3 font-display text-xl font-bold text-neutral-900">
            Bem-vindo à Lojinha do Celular!
          </h2>
          <p className="mt-1 text-sm font-medium text-neutral-500">
            Como podemos te ajudar hoje?
          </p>
        </div>

        <div className="space-y-3 p-5">
          <a
            href={waLink(s.whatsappJardim, "Olá! Vim pelo site da Lojinha do Celular.")}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-[#25D366] px-4 py-3.5 font-semibold text-white transition hover:bg-[#20ba59] active:scale-[0.99] shadow-sm"
          >
            <MessageCircle className="h-5 w-5 fill-white/20" />
            <div className="text-left">
              <span className="block text-sm font-bold">Chamar no WhatsApp</span>
              <span className="block text-xs text-white/90">Unidade Jardim-MS</span>
            </div>
          </a>
          <a
            href={waLink(s.whatsappGll, "Olá! Vim pelo site da Lojinha do Celular.")}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-[#25D366] px-4 py-3.5 font-semibold text-white transition hover:bg-[#20ba59] active:scale-[0.99] shadow-sm"
          >
            <MessageCircle className="h-5 w-5 fill-white/20" />
            <div className="text-left">
              <span className="block text-sm font-bold">Chamar no WhatsApp</span>
              <span className="block text-xs text-white/90">Unidade Guia Lopes da Laguna</span>
            </div>
          </a>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <a
              href={s.mapsJardim}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
            >
              <MapPin className="h-4 w-4 text-neutral-500" /> Jardim
            </a>
            <a
              href={s.mapsGll}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
            >
              <MapPin className="h-4 w-4 text-neutral-500" /> Guia Lopes
            </a>
          </div>

          <button
            onClick={close}
            className="w-full rounded-xl py-2.5 text-xs font-semibold text-neutral-400 transition hover:text-neutral-900 cursor-pointer"
          >
            Quero só olhar a vitrine →
          </button>
        </div>
      </div>
    </div>
  );
}
