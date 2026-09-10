import { useLocation } from "react-router";
import { openWhatsAppModal } from "@/lib/whatsappModal";
import { WhatsAppIcon } from "./WhatsAppModal";

export default function WhatsAppFloat() {
  const location = useLocation();

  // Não exibir sobre o painel admin ou no modo TV vitrine
  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/tv")
  ) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => openWhatsAppModal("Olá! Vim pelo site da Lojinha do Celular.")}
      aria-label="Falar no WhatsApp"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      className="fixed right-4 sm:right-6 z-40 group flex items-center gap-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white p-3.5 sm:px-5 sm:py-3.5 font-bold text-sm shadow-[0_6px_24px_rgba(37,211,102,0.45)] transition-all duration-300 active:scale-95 hover:scale-105 cursor-pointer"
    >
      {/* Ping pulsante sutil */}
      <span className="absolute -inset-0.5 rounded-full bg-[#25D366] opacity-30 animate-ping -z-10" />

      <WhatsAppIcon className="h-6 w-6 fill-white" />
      <span className="hidden sm:inline font-bold tracking-tight text-white drop-shadow-xs">
        Falar no WhatsApp
      </span>
    </button>
  );
}
