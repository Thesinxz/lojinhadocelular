import "dotenv/config";

function cleanValue(val: string | undefined): string {
  if (!val) return "";
  return val.replace(/^["']|["']$/g, "").trim();
}

function optional(name: string, fallback = ""): string {
  const val = process.env[name];
  if (!val) return fallback;
  const cleaned = cleanValue(val);
  return cleaned || fallback;
}

function parseBoolean(val: string | undefined, fallback = true): boolean {
  if (val === undefined || val === null || val === "") return fallback;
  const clean = cleanValue(val).toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes" || clean === "on";
}

function normalizeErpUrl(rawUrl: string): string {
  let url = cleanValue(rawUrl) || "https://api.gestaocelular.com.br";
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, "");
  // Se o usuário colocou o domínio sem api., corrige automaticamente para api.gestaocelular.com.br
  if (url.includes("gestaocelular.com.br") && !url.includes("api.gestaocelular.com.br")) {
    url = url.replace("gestaocelular.com.br", "api.gestaocelular.com.br");
  }
  return url;
}

function normalizeStoreSlug(rawSlug: string): string {
  let slug = cleanValue(rawSlug) || "lojinha-do-celular-mplnk5d6";
  // Se o usuário colou a URL completa em vez de apenas o slug
  if (slug.includes("/")) {
    const parts = slug.split("/").filter(Boolean);
    slug = parts[parts.length - 1] || slug;
  }
  return slug;
}

let _erpApiUrl: string | null = null;
let _erpStoreSlug: string | null = null;
let _erpCategorySlug: string | null = null;
let _erpCatalogEnabled: boolean | null = null;

export const env = {
  get appId(): string {
    return optional("APP_ID", "lojinha-app");
  },
  get appSecret(): string {
    return optional("APP_SECRET", "lojinha-secret-default-key-32-chars-min");
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get databaseUrl(): string {
    return optional("DATABASE_URL", "");
  },
  // ERP Gestão Celular — Storefront Catalog
  get erpApiUrl(): string {
    return _erpApiUrl !== null
      ? _erpApiUrl
      : normalizeErpUrl(optional("ERP_API_URL", "https://api.gestaocelular.com.br"));
  },
  set erpApiUrl(val: string) {
    _erpApiUrl = val;
  },
  get erpStoreSlug(): string {
    return _erpStoreSlug !== null
      ? _erpStoreSlug
      : normalizeStoreSlug(optional("ERP_STORE_SLUG", "lojinha-do-celular-mplnk5d6"));
  },
  set erpStoreSlug(val: string) {
    _erpStoreSlug = val;
  },
  get erpCategorySlug(): string {
    return _erpCategorySlug !== null
      ? _erpCategorySlug
      : optional("ERP_CATEGORY_SLUG", "aparelhos-celulares");
  },
  set erpCategorySlug(val: string) {
    _erpCategorySlug = val;
  },
  get erpCatalogEnabled(): boolean {
    return _erpCatalogEnabled !== null
      ? _erpCatalogEnabled
      : parseBoolean(process.env.ERP_CATALOG_ENABLED, true);
  },
  set erpCatalogEnabled(val: boolean) {
    _erpCatalogEnabled = val;
  },
};

