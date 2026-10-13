import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "admin:browserNotifications";

type Permission = NotificationPermission | "unsupported";

function currentPermission(): Permission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Aviso nativo do navegador (Chrome, Edge, Firefox...) quando chega avaliação nova e o painel está
 * aberto em outra aba/janela. Pede permissão uma vez; o dono liga/desliga pelo sino do painel.
 * Não funciona com o painel fechado (isso exigiria notificação push com servidor).
 */
export function useBrowserNotifications(onOpen?: () => void) {
  const [permission, setPermission] = useState<Permission>(currentPermission);
  const [enabled, setEnabled] = useState(readEnabled);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  const show = useCallback((title: string, body: string, tag: string) => {
    try {
      const notification = new Notification(title, { body, icon: "/images/logo-icon.png", tag });
      notification.onclick = () => {
        window.focus();
        onOpenRef.current?.();
        notification.close();
      };
    } catch {
      // Alguns navegadores móveis só aceitam notificação via service worker: o aviso fica no título e no som.
    }
  }, []);

  /** Chamada quando chegam avaliações novas: só mostra se a aba não está em foco. */
  const notifyNewEvaluations = useCallback(
    (added: number) => {
      if (!enabled || currentPermission() !== "granted" || document.hasFocus()) return;
      show(
        added === 1 ? "Nova avaliação na Troca Fácil" : `${added} novas avaliações na Troca Fácil`,
        "Toque para abrir o painel e atender o cliente.",
        "new-evaluation",
      );
    },
    [enabled, show],
  );

  const persist = (value: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
    } catch {}
  };

  /** Liga/desliga; na primeira vez pede a permissão ao navegador. Devolve o estado final. */
  const toggle = useCallback(async (): Promise<Permission | "on" | "off"> => {
    const now = currentPermission();
    if (now === "unsupported" || now === "denied") {
      setPermission(now);
      return now;
    }
    if (now === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return result;
      setEnabled(true);
      persist(true);
      show("Avisos ativados", "Você será avisado quando chegar uma avaliação nova.", "notifications-enabled");
      return "on";
    }
    const next = !enabled;
    setEnabled(next);
    persist(next);
    return next ? "on" : "off";
  }, [enabled, show]);

  return {
    supported: permission !== "unsupported",
    permission,
    active: permission === "granted" && enabled,
    toggle,
    notifyNewEvaluations,
  };
}
