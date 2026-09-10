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
      aria-label="Falar no WhatsApp"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25 transition duration-200 active:scale-95 hover:scale-110 hover:bg-[#20ba59] hover:shadow-xl hover:shadow-[#25D366]/35"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
