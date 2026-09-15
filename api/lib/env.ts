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

export const ERP_KNOWN_UNITS = {
  MATRIZ: "dd89c64c-5188-4f14-a32b-a915e8e3b9b3", // Jardim - MS
  GUIA_LOPES: "71e3305a-b48b-4026-b953-7bdd3217648b", // Guia Lopes da Laguna - MS
} as const;

function resolveUnitId(raw: string | undefined): string {
  const val = cleanValue(raw).toLowerCase();
  if (val === "all" || val === "todas" || val === "*") {
    return "all";
  }
  if (val === "guia_lopes" || val === "guia-lopes" || val === "guialopes") {
    return ERP_KNOWN_UNITS.GUIA_LOPES;
  }
  // Padrão: Matriz (Jardim - MS) para evitar duplicações automáticas do ERP
  return ERP_KNOWN_UNITS.MATRIZ;
}

let _erpApiUrl: string | null = null;
let _erpStoreSlug: string | null = null;
let _erpCategorySlug: string | null = null;
let _erpCatalogEnabled: boolean | null = null;
let _erpUnitId: string | null = null;

export const env = {
  get appId(): string {
    return optional("APP_ID", "lojinha-app");
  },
  get appSecret(): string {
    const s = optional("APP_SECRET", "");
    if (!s && process.env.NODE_ENV === "production") {
      throw new Error(
        "[FATAL SECURITY] APP_SECRET obrigatório em ambiente de produção com no mínimo 32 caracteres.",
      );
    }
    return s || "lojinha-secret-default-key-32-chars-min-dev-only";
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get databaseUrl(): string {
    return optional("DATABASE_URL", "");
  },
  get evaluationNotificationWebhookUrl(): string {
    return optional("EVALUATION_NOTIFICATION_WEBHOOK_URL", "");
  },
  get whatsappCloudApiToken(): string {
    return optional("WHATSAPP_CLOUD_API_TOKEN", "");
  },
  get whatsappCloudPhoneNumberId(): string {
    return optional("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "");
  },
  get whatsappNotificationTo(): string {
    return optional("WHATSAPP_NOTIFICATION_TO", "");
  },
  get whatsappNotificationTemplate(): string {
    return optional("WHATSAPP_NOTIFICATION_TEMPLATE", "");
  },
  get whatsappNotificationLanguage(): string {
    return optional("WHATSAPP_NOTIFICATION_LANGUAGE", "pt_BR");
  },
  get whatsappCloudApiVersion(): string {
    return optional("WHATSAPP_CLOUD_API_VERSION", "v22.0");
  },
  get s3Endpoint(): string {
    return optional("S3_ENDPOINT", "");
  },
  get s3Region(): string {
    return optional("S3_REGION", "auto");
  },
  get s3BucketName(): string {
    return optional("S3_BUCKET_NAME", "");
  },
  get s3AccessKeyId(): string {
    return optional("S3_ACCESS_KEY_ID", "");
  },
  get s3SecretAccessKey(): string {
    return optional("S3_SECRET_ACCESS_KEY", "");
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
  get erpUnitId(): string {
    return _erpUnitId !== null
      ? _erpUnitId
      : resolveUnitId(optional("ERP_UNIT_ID", "matriz"));
  },
  set erpUnitId(val: string) {
    _erpUnitId = val;
  },
};
