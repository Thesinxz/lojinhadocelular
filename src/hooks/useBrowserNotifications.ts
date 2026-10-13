import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";

const STORAGE_KEY = "admin:browserNotifications";

type Permission = NotificationPermission | "unsupported";

function currentPermission(): Permission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** A chave VAPID vem em base64 "url-safe"; o navegador quer bytes. */
function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Avisos de avaliação nova no navegador (Chrome, Edge, Firefox...):
 * - com o painel aberto em outra aba/janela: notificação nativa;
 * - com o painel fechado: notificação push (service worker + servidor), se o servidor tiver as chaves VAPID.
 * Pede permissão uma vez; o sino azul do painel liga/desliga.
 */
export function useBrowserNotifications(onOpen?: () => void) {
  const [permission, setPermission] = useState<Permission>(currentPermission);
  const [enabled, setEnabled] = useState(readEnabled);
  const [pushActive, setPushActive] = useState(false);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  const config = trpc.admin.pushConfig.useQuery(undefined, { staleTime: 1000 * 60 * 30, retry: 0 });
  const publicKey = config.data?.publicKey ?? null;
  const subscribeMutation = trpc.admin.pushSubscribe.useMutation();
  const unsubscribeMutation = trpc.admin.pushUnsubscribe.useMutation();

  /** Registra o service worker, inscreve este navegador no push e avisa o servidor. */
  const subscribePush = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !pushSupported() || currentPermission() !== "granted") return false;
    try {
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
      await subscribeMutation.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setPushActive(true);
      return true;
    } catch (err) {
      console.error("Não foi possível ativar a notificação push:", err);
      setPushActive(false);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  const unsubscribePush = useCallback(async () => {
    if (!pushSupported()) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unsubscribeMutation.mutateAsync({ endpoint }).catch(() => {});
      }
    } catch (err) {
      console.error("Não foi possível desligar a notificação push:", err);
    } finally {
      setPushActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Já com permissão e ligado: garante a inscrição (e liga-a ao usuário que está logado agora).
  useEffect(() => {
    if (enabled && permission === "granted" && publicKey) void subscribePush();
  }, [enabled, permission, publicKey, subscribePush]);

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

  /** Chamada quando chegam avaliações novas com o painel aberto: só mostra se a aba não está em foco. */
  const notifyNewEvaluations = useCallback(
    (added: number) => {
      // Com push ativo o service worker já mostra o aviso (evita notificação em dobro).
      if (!enabled || pushActive || currentPermission() !== "granted" || document.hasFocus()) return;
      show(
        added === 1 ? "Nova avaliação na Troca Fácil" : `${added} novas avaliações na Troca Fácil`,
        "Toque para abrir o painel e atender o cliente.",
        "new-evaluation",
      );
    },
    [enabled, pushActive, show],
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
      const pushed = await subscribePush();
      show(
        "Avisos ativados",
        pushed
          ? "Você será avisado de cada avaliação nova, mesmo com o painel fechado."
          : "Você será avisado quando chegar uma avaliação nova (com o painel aberto).",
        "notifications-enabled",
      );
      return "on";
    }
    const next = !enabled;
    setEnabled(next);
    persist(next);
    if (next) await subscribePush();
    else await unsubscribePush();
    return next ? "on" : "off";
  }, [enabled, show, subscribePush, unsubscribePush]);

  return {
    supported: permission !== "unsupported",
    permission,
    active: permission === "granted" && enabled,
    /** true quando o aviso chega mesmo com o painel fechado. */
    pushActive: pushActive && enabled,
    toggle,
    notifyNewEvaluations,
  };
}
