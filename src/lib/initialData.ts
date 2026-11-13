import superjson from "superjson";
import { getQueryKey, type CreateTRPCReact } from "@trpc/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";

type ShopOutputs = inferRouterOutputs<AppRouter>["shop"];

export interface InitialDataPayload {
  settings?: ShopOutputs["settings"];
  catalogStatus?: ShopOutputs["catalogStatus"];
  products?: ShopOutputs["products"];
  product?: {
    id: string | number;
    data: ShopOutputs["product"];
  };
}

/**
 * Converte a string serializada pelo servidor (`#__INITIAL_DATA__`) usando `superjson`,
 * restaurando tipos como `Date` e ignorando payloads ausentes ou inválidos.
 */
export function parseInitialDataPayload(
  raw: string | null | undefined,
): InitialDataPayload | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = superjson.parse<unknown>(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as InitialDataPayload;
  } catch {
    return null;
  }
}

/** Lê a carga de hidratação inicial inserida no HTML pelo servidor. */
export function readInitialDataFromDom(): InitialDataPayload | null {
  const doc = (
    globalThis as {
      document?: { getElementById?: (id: string) => { textContent: string | null } | null };
    }
  ).document;
  if (!doc?.getElementById) return null;
  const el = doc.getElementById("__INITIAL_DATA__");
  return parseInitialDataPayload(el?.textContent);
}

/**
 * Semeia o cache do TanStack Query antes do primeiro render para evitar uma viagem
 * extra até os EUA (~180 ms) ao abrir a vitrine ou um link direto de produto.
 */
export function hydrateQueryClientFromInitialData(
  queryClient: QueryClient,
  trpcReact: CreateTRPCReact<AppRouter, unknown>,
  payload: InitialDataPayload | null = readInitialDataFromDom(),
): boolean {
  if (!payload) return false;
  const updatedAt = Date.now();
  let seeded = false;

  if (payload.settings) {
    queryClient.setQueryData(
      getQueryKey(trpcReact.shop.settings, undefined, "query"),
      payload.settings,
      { updatedAt },
    );
    seeded = true;
  }

  if (payload.catalogStatus) {
    queryClient.setQueryData(
      getQueryKey(trpcReact.shop.catalogStatus, undefined, "query"),
      payload.catalogStatus,
      { updatedAt },
    );
    seeded = true;
  }

  if (Array.isArray(payload.products)) {
    queryClient.setQueryData(
      getQueryKey(trpcReact.shop.products, undefined, "query"),
      payload.products,
      { updatedAt },
    );
    seeded = true;
  }

  if (payload.product && payload.product.data) {
    queryClient.setQueryData(
      getQueryKey(trpcReact.shop.product, { id: payload.product.id }, "query"),
      payload.product.data,
      { updatedAt },
    );
    seeded = true;
  }

  return seeded;
}
