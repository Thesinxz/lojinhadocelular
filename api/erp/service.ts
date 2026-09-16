import { env } from "../lib/env";
import { adaptErpCatalog } from "./adapter";
import { getErpOverrides, applyOverridesToProducts } from "./overrides";
import type { ErpFetchResult, ShopProduct } from "./types";

const CACHE_TTL_MS = 45_000; // 45 segundos (intervalo exigido: 30–60s)

let cache: {
  data: ShopProduct[];
  cachedAt: number;
} | null = null;
let inFlight: Promise<ErpFetchResult> | null = null;

export function clearErpCache() {
  cache = null;
}

export function setErpCacheForTesting(products: ShopProduct[], cachedAt = Date.now()) {
  cache = {
    data: products,
    cachedAt,
  };
}

async function loadErpCatalog(): Promise<ErpFetchResult> {
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

  // Lista de URLs candidatas em ordem de prioridade
  const baseUrl = (env.erpApiUrl || "https://api.gestaocelular.com.br").replace(/\/+$/, "");
  const categorySlug = (env.erpCategorySlug || "aparelhos-celulares").trim();

  const candidateUrls = [
    `${baseUrl}/api/storefront/${encodeURIComponent(storeSlug)}/catalog?category_slug=${encodeURIComponent(categorySlug)}`,
    `${baseUrl}/api/trade-in/public/${encodeURIComponent(storeSlug)}/config`,
  ];

  // Se a baseUrl configurada não for o endpoint oficial de API, adiciona o endpoint oficial como fallback garantido
  if (!baseUrl.includes("api.gestaocelular.com.br")) {
    candidateUrls.push(
      `https://api.gestaocelular.com.br/api/trade-in/public/${encodeURIComponent(storeSlug)}/config`
    );
  }

  let lastStatus = 0;
  let lastErrorMsg = "";
  let successJson: unknown = null;

  for (const url of candidateUrls) {
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
      lastStatus = res.status;

      if (res.ok) {
        successJson = await res.json();
        break;
      } else {
        lastErrorMsg = `HTTP ${res.status}`;
      }
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorMsg = msg;
    }
  }

  if (!successJson) {
    // Requisito 3: "Nunca exibir produto antigo como disponível se a API estiver fora do ar."
    cache = null;
    console.error(`[ERP] Falha na comunicação com o ERP Gestão Celular (${storeSlug}): ${lastErrorMsg || `HTTP ${lastStatus}`}`);
    return {
      status: "offline",
      message: `ERP Gestão Celular indisponível (${lastErrorMsg || `HTTP ${lastStatus}`}).`,
      products: [],
    };
  }

  try {
    let products = adaptErpCatalog(successJson);
    try {
      const overrides = await getErpOverrides();
      products = applyOverridesToProducts(products, overrides);
    } catch (err) {
      console.warn("[ERP] Aviso: Falha ao carregar overrides de produtos:", err);
    }

    console.log(`[ERP] Catálogo carregado com sucesso: ${products.length} aparelhos sincronizados.`);

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
    cache = null;
    const msg = err instanceof Error ? err.message : "Falha ao processar dados do ERP";
    console.error("[ERP] Erro ao adaptar catálogo:", msg);
    return {
      status: "offline",
      message: msg,
      products: [],
    };
  }
}

/**
 * Compartilha a mesma requisição quando catálogo/status/admin são carregados
 * simultaneamente. Sem isso, o primeiro acesso ao painel consultava o ERP
 * duas ou três vezes antes de o cache ser preenchido.
 */
export async function getErpCatalog(): Promise<ErpFetchResult> {
  if (inFlight) return inFlight;
  inFlight = loadErpCatalog();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
