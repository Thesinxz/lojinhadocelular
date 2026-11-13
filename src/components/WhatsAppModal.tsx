import { useEffect } from "react";
import { X, MapPin, ExternalLink } from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";
import { useWhatsAppModal } from "@/lib/whatsappModal";
import { WhatsAppIcon } from "./WhatsAppIcon";

export { WhatsAppIcon };

export default function WhatsAppModal() {
  const s = useShopSettings();
  const { isOpen, customMessage, close } = useWhatsAppModal();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const defaultMsg = customMessage || "Olá! Vim pelo site da Lojinha do Celular e gostaria de tirar uma dúvida.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Falar no WhatsApp"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:pb-4 animate-in fade-in duration-200"
      onClick={close}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-2xl transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho com Ícone Oficial WhatsApp */}
        <div className="relative border-b border-neutral-100 bg-gradient-to-b from-neutral-50 to-white px-6 pb-6 pt-7 text-center">
          <button
            onClick={close}
            className="absolute right-3.5 top-3.5 rounded-full bg-neutral-100 p-1.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-900 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-md shadow-[#25D366]/25">
            <WhatsAppIcon className="h-8 w-8" />
          </div>

          <h2 className="mt-3 font-display text-xl font-bold text-neutral-950">
            Falar com a Lojinha do Celular
          </h2>
          <p className="mt-1 text-xs font-medium text-neutral-500">
            Escolha a loja mais próxima para iniciar o atendimento no WhatsApp:
          </p>
        </div>

        {/* Botões das Unidades */}
        <div className="space-y-3 p-5">
          <a
            href={waLink(s.whatsappJardim, defaultMsg)}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="group flex items-center justify-between gap-3 rounded-2xl bg-[#25D366] px-4 py-3.5 font-semibold text-white transition hover:bg-[#20ba59] active:scale-[0.99] shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white">
                <WhatsAppIcon className="h-5 w-5" />
              </div>
              <div className="text-left leading-tight">
                <span className="block text-sm font-bold">Unidade Jardim - MS</span>
                <span className="block text-xs text-white/90 font-normal">
                  {s.addressJardim || "Av. Duque de Caxias, 486"}
                </span>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/80 transition-transform group-hover:translate-x-0.5" />
          </a>

          <a
            href={waLink(s.whatsappGll, defaultMsg)}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="group flex items-center justify-between gap-3 rounded-2xl bg-[#25D366] px-4 py-3.5 font-semibold text-white transition hover:bg-[#20ba59] active:scale-[0.99] shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white">
                <WhatsAppIcon className="h-5 w-5" />
              </div>
              <div className="text-left leading-tight">
                <span className="block text-sm font-bold">Unidade Guia Lopes da Laguna</span>
                <span className="block text-xs text-white/90 font-normal">
                  {s.addressGll || "Rua Macias Barbosa, 2185"}
                </span>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/80 transition-transform group-hover:translate-x-0.5" />
          </a>

          {/* Links Rápidos de Localização */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={s.mapsJardim}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
            >
              <MapPin className="h-3.5 w-3.5 text-neutral-500" /> Mapa Jardim
            </a>
            <a
              href={s.mapsGll}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
            >
              <MapPin className="h-3.5 w-3.5 text-neutral-500" /> Mapa Guia Lopes
            </a>
          </div>

          <button
            type="button"
            onClick={close}
            className="w-full rounded-xl py-2 text-xs font-semibold text-neutral-400 transition hover:text-neutral-700 cursor-pointer text-center"
          >
            Continuar navegando no site →
          </button>
        </div>
      </div>
    </div>
  );
}
