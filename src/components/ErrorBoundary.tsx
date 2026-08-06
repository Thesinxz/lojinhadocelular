import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error) {
    console.error("Erro capturado pelo ErrorBoundary:", error);
    // Se for erro de módulo dinâmico/chunk 404 por redeploy, força busca do novo HTML sem cache
    const msg = error.message || "";
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("dynamically imported module") ||
      msg.includes("Importing a module script failed")
    ) {
      const lastReload = sessionStorage.getItem("chunk_reload");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 3000) {
        sessionStorage.setItem("chunk_reload", String(now));
        const freshUrl = window.location.origin + window.location.pathname + "?v=" + now;
        window.location.replace(freshUrl);
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12 text-center">
          <div className="max-w-md rounded-2xl border-2 border-ink bg-white p-8 shadow-[4px_4px_0_0_#141414]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-brand text-2xl font-bold text-ink">
              ✨
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-ink">
              Atualizamos o site!
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Novas ofertas e novidades foram publicadas. Clique no botão abaixo para carregar a versão mais recente.
            </p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem("chunk_reload");
                const freshUrl = window.location.origin + window.location.pathname + "?v=" + Date.now();
                window.location.replace(freshUrl);
              }}
              className="mt-6 w-full rounded-xl border-2 border-ink bg-ink py-3.5 font-display text-base font-bold text-brand shadow-[3px_3px_0_0_rgba(20,20,20,0.3)] transition hover:-translate-y-0.5"
            >
              Recarregar página agora
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
