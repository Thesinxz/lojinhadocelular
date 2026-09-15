import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { inferRouterOutputs } from "@trpc/server";
import type { ReactNode } from "react";

import { safeStorage } from "@/lib/storage";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type ProductWithVariants = RouterOutputs["shop"]["products"][number];

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, error) {
        // Não tentar novamente se for erro de autorização
        const status = (error as { data?: { httpStatus?: number } })?.data?.httpStatus;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 30, // 30 segundos
      refetchOnWindowFocus: false,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const token = safeStorage.getItem("admin_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(input, init) {
        // O envio da avaliação pode carregar fotos e ser feito em rede móvel.
        // Um timeout de 15s abortava o request no Safari antes do banco responder.
        let signal = init?.signal;
        if (!signal && typeof AbortSignal !== "undefined") {
          const timeoutMs = 60_000;
          if (typeof AbortSignal.timeout === "function") {
            signal = AbortSignal.timeout(timeoutMs);
          } else {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), timeoutMs);
            signal = controller.signal;
          }
        }
        return globalThis.fetch(input, {
          ...(init ?? {}),
          signal: signal ?? init?.signal,
          credentials: "include",
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
