import { useState, useEffect, useCallback } from "react";

export const WHATSAPP_MODAL_EVENT = "open-lojinha-whatsapp-modal";

// Guarda o primeiro clique antes do chunk do modal terminar de carregar via React.lazy.
let pendingOpenState: { isOpen: boolean; customMessage?: string } | null = null;

export function openWhatsAppModal(customMessage?: string) {
  pendingOpenState = { isOpen: true, customMessage };
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(WHATSAPP_MODAL_EVENT, { detail: { message: customMessage } })
    );
  }
}

export function useWhatsAppModalRequested() {
  const [requested, setRequested] = useState(() => Boolean(pendingOpenState?.isOpen));

  useEffect(() => {
    if (requested) return;
    function handleOpen() {
      setRequested(true);
    }
    window.addEventListener(WHATSAPP_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(WHATSAPP_MODAL_EVENT, handleOpen);
  }, [requested]);

  return requested;
}

export function useWhatsAppModal() {
  const [isOpen, setIsOpen] = useState(() => Boolean(pendingOpenState?.isOpen));
  const [customMessage, setCustomMessage] = useState<string | undefined>(
    () => pendingOpenState?.customMessage
  );

  useEffect(() => {
    function handleOpen(e: Event) {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setCustomMessage(detail?.message);
      setIsOpen(true);
    }
    window.addEventListener(WHATSAPP_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(WHATSAPP_MODAL_EVENT, handleOpen);
  }, []);

  const close = useCallback(() => {
    pendingOpenState = null;
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    customMessage,
    open: openWhatsAppModal,
    close,
  };
}
