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
      className="fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-[#25D366] text-ink shadow-[3px_3px_0_0_#141414] transition active:scale-95 hover:scale-110"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
