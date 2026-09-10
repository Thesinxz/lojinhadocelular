import { env } from "../lib/env";
import { adaptErpCatalog } from "./adapter";
import type { ErpFetchResult, ShopProduct } from "./types";

const CACHE_TTL_MS = 45_000; // 45 segundos (intervalo exigido: 30–60s)

let cache: {
  data: ShopProduct[];
  cachedAt: number;
} | null = null;

export function clearErpCache() {
  cache = null;
}

export function setErpCacheForTesting(products: ShopProduct[], cachedAt = Date.now()) {
  cache = {
    data: products,
    cachedAt,
  };
}

export async function getErpCatalog(): Promise<ErpFetchResult> {
  // Se o ERP não estiver habilitado
  if (!env.erpCatalogEnabled) {
    return {
      status: "config_error",
      message: "Catálogo ERP desativado.",
      products: [],
    };
  }

  // Se o slug da loja não estiver configurado
  const storeSlug = (env.erpStoreSlug || "").trim();
  if (!storeSlug || storeSlug === "<slug-da-empresa>" || storeSlug === "slug-da-empresa") {
    return {
      status: "config_error",
      message: "ERP_STORE_SLUG não configurado no servidor (.env).",
      products: [],
    };
  }

  const now = Date.now();

  // Se houver cache válido dentro do TTL de 45s
  if (cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return {
      status: cache.data.length > 0 ? "ok" : "empty",
      products: cache.data,
      cachedAt: cache.cachedAt,
    };
  }

  // Faz a requisição ao ERP Gestão Celular
  const baseUrl = (env.erpApiUrl || "https://gestaocelular.com.br").replace(/\/+$/, "");
  const categorySlug = (env.erpCategorySlug || "aparelhos-celulares").trim();
  const url = `${baseUrl}/api/storefront/${encodeURIComponent(storeSlug)}/catalog?category_slug=${encodeURIComponent(categorySlug)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "LojinhaDoCelular-Storefront/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      // Requisito 3: "Nunca exibir produto antigo como disponível se a API estiver fora do ar."
      cache = null;
      return {
        status: "offline",
        message: `ERP Gestão Celular retornou HTTP ${res.status}`,
        products: [],
      };
    }

    const json = await res.json();
    const products = adaptErpCatalog(json);

    // Salva no cache em memória
    cache = {
      data: products,
      cachedAt: now,
    };

    return {
      status: products.length > 0 ? "ok" : "empty",
      products,
      cachedAt: now,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    // Requisito 3: Se cair ou falhar, limpa cache e não serve dados desatualizados
    cache = null;
    const msg = err instanceof Error ? err.message : "Falha na comunicação com o ERP";
    return {
      status: "offline",
      message: msg,
      products: [],
    };
  }
}
