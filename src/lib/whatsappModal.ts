import { useState, useEffect } from "react";

const EVENT_NAME = "open-lojinha-whatsapp-modal";

export function openWhatsAppModal(customMessage?: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { message: customMessage } })
    );
  }
}

export function useWhatsAppModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState<string | undefined>();

  useEffect(() => {
    function handleOpen(e: Event) {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setCustomMessage(detail?.message);
      setIsOpen(true);
    }
    window.addEventListener(EVENT_NAME, handleOpen);
    return () => window.removeEventListener(EVENT_NAME, handleOpen);
  }, []);

  return {
    isOpen,
    customMessage,
    open: openWhatsAppModal,
    close: () => setIsOpen(false),
  };
}
