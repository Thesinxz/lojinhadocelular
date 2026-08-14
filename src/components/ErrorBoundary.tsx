import { Component, type ReactNode } from "react";
import { safeSessionStorage } from "@/lib/storage";

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
    const msg = error?.message || "";
    const isChunkOrDeployError =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("dynamically imported module") ||
      msg.includes("Importing a module script failed");

    if (isChunkOrDeployError && typeof window !== "undefined") {
      const lastReload = safeSessionStorage.getItem("chunk_reload");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 3000) {
        safeSessionStorage.setItem("chunk_reload", String(now));
        const freshUrl = window.location.origin + window.location.pathname + "?v=" + now;
        window.location.replace(freshUrl);
      }
    }
  }

  private handleReload = () => {
    safeSessionStorage.removeItem("chunk_reload");
    if (typeof window !== "undefined") {
      const freshUrl = window.location.origin + window.location.pathname + "?v=" + Date.now();
      window.location.replace(freshUrl);
    }
  };

  private handleGoHome = () => {
    safeSessionStorage.removeItem("chunk_reload");
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  public render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "";
      const isChunkOrDeployError =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Loading chunk") ||
        msg.includes("dynamically imported module") ||
        msg.includes("Importing a module script failed");

      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-50 px-4 py-12 text-center">
          <div className="w-full max-w-md rounded-3xl border-3 border-ink bg-white p-8 shadow-[6px_6px_0_0_#141414]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink bg-brand text-2xl font-bold text-ink">
              {isChunkOrDeployError ? "✨" : "📱"}
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold text-ink">
              {isChunkOrDeployError ? "Atualizamos o site!" : "Ops, algo deu errado"}
            </h2>
            <p className="mt-2 text-sm font-medium text-neutral-600">
              {isChunkOrDeployError
                ? "Novas ofertas e novidades foram publicadas. Clique no botão abaixo para carregar a versão mais recente."
                : "Tivemos um imprevisto temporário ao carregar esta página. Você pode recarregar ou voltar para o início."}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full rounded-2xl border-2 border-ink bg-ink py-3.5 font-display text-base font-bold text-brand shadow-[3px_3px_0_0_rgba(20,20,20,0.3)] transition active:translate-y-0.5 hover:-translate-y-0.5"
              >
                Recarregar página
              </button>
              {!isChunkOrDeployError && (
                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="w-full rounded-2xl border-2 border-ink bg-white py-3 font-display text-sm font-bold text-ink transition hover:bg-neutral-100"
                >
                  Voltar para a página inicial
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
