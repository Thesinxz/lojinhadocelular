import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { trpc } from "@/providers/trpc";

const SESSION_KEY = "site:entryTracked";

/** Primeira página da visita? Então manda também a origem (de onde a pessoa veio). */
function takeEntry(): { referrer: string; utmSource: string } | undefined {
  try {
    if (window.sessionStorage.getItem(SESSION_KEY)) return undefined;
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  return { referrer: document.referrer.slice(0, 500), utmSource: (params.get("utm_source") ?? "").slice(0, 60) };
}

/** Conta a visualização da página atual (sem cookies). Não roda no painel nem no Modo TV. */
export function usePageViewTracking(enabled: boolean) {
  const { pathname } = useLocation();
  const track = trpc.shop.trackView.useMutation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || lastPath.current === pathname) return;
    lastPath.current = pathname;
    track.mutate({
      path: pathname,
      site: window.location.hostname.includes("trocafacil") ? "trocafacil" : "loja",
      entry: takeEntry(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pathname]);
}
