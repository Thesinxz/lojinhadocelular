import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
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

      const Icon = isChunkOrDeployError ? RefreshCw : AlertTriangle;
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#fbfbfd] px-4 py-12 text-center">
          <div role="alert" className="w-full max-w-md rounded-2xl border border-[#e5e5e7] bg-white p-8 shadow-sm">
            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
                isChunkOrDeployError ? "bg-[#0071e3]/10 text-[#0071e3]" : "bg-amber-100 text-amber-700"
              }`}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-[#1d1d1f]">
              {isChunkOrDeployError ? "Nova versão disponível" : "Algo não saiu como esperado"}
            </h2>
            <p className="mt-2 text-sm text-[#6e6e73]">
              {isChunkOrDeployError
                ? "Acabamos de publicar uma atualização. Recarregue a página para continuar com a versão mais recente."
                : "Tivemos um imprevisto ao carregar esta página. Você pode recarregar ou voltar para o início."}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-4 text-sm font-semibold text-white transition hover:bg-black active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Recarregar página
              </button>
              {!isChunkOrDeployError && (
                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="min-h-11 w-full rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
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
