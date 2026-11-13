import { type RefObject, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { setProductStickyCtaVisible } from "@/lib/stickyCtaState";

export type MobileStickyCtaProps = {
  targetRef: RefObject<HTMLDivElement | null>;
  isAvailable: boolean;
  isCartOpen: boolean;
  cleanTitle: string;
  variantSummary: string;
  formattedPrice: string;
  installmentSummary?: string;
  whatsappHref: string;
  onAddToCart: () => void;
  onTrackInterest: () => void;
};

/** Barra inferior fixa para telas móveis após rolar além dos botões principais da página. */
export default function MobileStickyCta({
  targetRef,
  isAvailable,
  isCartOpen,
  cleanTitle,
  variantSummary,
  formattedPrice,
  installmentSummary,
  whatsappHref,
  onAddToCart,
  onTrackInterest,
}: MobileStickyCtaProps) {
  const [scrolledPastInlineCta, setScrolledPastInlineCta] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setScrolledPastInlineCta(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const pastTop = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setScrolledPastInlineCta(pastTop);
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [targetRef, isAvailable]);

  const isVisible = scrolledPastInlineCta && isAvailable && !isCartOpen;

  useEffect(() => {
    setProductStickyCtaVisible(isVisible);
    return () => {
      setProductStickyCtaVisible(false);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label={`Compra rápida para ${cleanTitle}`}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200/90 bg-white/95 px-3.5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.08)] md:hidden animate-in slide-in-from-bottom-2 duration-200"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-neutral-500">
            {variantSummary || cleanTitle}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-base font-black text-neutral-950 tracking-tight">
              {formattedPrice}
            </span>
            {installmentSummary && (
              <span className="truncate text-[10px] font-medium text-neutral-500">
                {installmentSummary}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onAddToCart}
            aria-label="Adicionar à sacola"
            className="inline-flex items-center gap-1 rounded-full bg-[#0071e3] px-3 py-2.5 text-xs font-semibold text-white shadow-xs transition active:scale-[0.97] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Sacola</span>
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            onClick={onTrackInterest}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-2.5 text-xs font-bold text-white shadow-xs transition active:scale-[0.97]"
          >
            <WhatsAppIcon className="h-3.5 w-3.5 fill-white" />
            <span>Pedir</span>
          </a>
        </div>
      </div>
    </div>
  );
}
