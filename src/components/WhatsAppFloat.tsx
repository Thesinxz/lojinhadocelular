import { MessageCircle } from "lucide-react";
import { useLocation } from "react-router";
import { useShopSettings, waLink } from "@/lib/shop";

export default function WhatsAppFloat() {
  const location = useLocation();
  const s = useShopSettings();

  // Não exibir sobre o painel admin ou no modo TV vitrine
  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/tv") ||
    !s.whatsappJardim
  ) {
    return null;
  }

  return (
    <a
      href={waLink(s.whatsappJardim, "Olá! Vim pelo site da Lojinha do Celular.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Pedir agora no WhatsApp"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      className="fixed right-4 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white px-5 py-3 font-bold text-sm shadow-[0_4px_20px_rgba(37,211,102,0.4)] transition-all duration-200 active:scale-95 hover:scale-105"
    >
      <MessageCircle className="h-5 w-5 fill-white/20" />
      <span className="font-semibold tracking-wide">Pedir agora</span>
    </a>
  );
}
