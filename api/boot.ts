import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

// Headers de segurança HTTP
app.use(
  secureHeaders({
    xFrameOptions: "SAMEORIGIN",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    crossOriginResourcePolicy: "cross-origin",
  })
);

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    // Domínios oficiais da loja
    if (
      hostname === "lojinhadocelular.com" ||
      hostname.endsWith(".lojinhadocelular.com")
    ) {
      return true;
    }

    // Ambiente de desenvolvimento / testes locais
    if (process.env.NODE_ENV !== "production") {
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".localhost")
      ) {
        return true;
      }
    }

    // Origens adicionais configuradas via variável de ambiente ALLOWED_ORIGINS
    const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map(o => o.trim().toLowerCase())
      .filter(Boolean);
    if (extraOrigins.includes(origin.toLowerCase())) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Habilitar CORS seguro restrito a origens autorizadas
app.use(
  "/api/*",
  cors({
    origin: origin => {
      if (!origin) return "";
      return isAllowedOrigin(origin) ? origin : "";
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Compressão gzip/deflate em todas as respostas (texto, JS, CSS, JSON)
app.use(compress());

// Cache agressivo para assets com hash (JS/CSS/fonts) — imutáveis
app.use("/assets/*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
});

// Cache de 1 dia para imagens locais (logo, favicon, og-banner) com acesso aberto para crawlers (WhatsApp, Facebook, Twitter)
app.use("/images/*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "public, max-age=86400");
  c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  c.res.headers.set("Access-Control-Allow-Origin", "*");
});

// Cache para mídia pesada do Hero (vídeo hero.mp4 e hero-poster.jpg)
app.use("/hero*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "public, max-age=604800");
  c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  c.res.headers.set("Access-Control-Allow-Origin", "*");
});

// Limite seguro de payload JSON para evitar DoS por exaustão de memória
app.use(bodyLimit({ maxSize: 2 * 1024 * 1024 }));

// Rate Limiter em memória para proteção contra força bruta no login admin
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

app.use("/api/trpc/admin.login*", async (c, next) => {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown-ip";
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record && record.resetTime > now) {
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      return c.json(
        {
          error: {
            message:
              "Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente.",
            code: -32000,
            data: { httpStatus: 429 },
          },
        },
        429
      );
    }
    record.count += 1;
  } else {
    loginAttempts.set(ip, { count: 1, resetTime: now + LOGIN_WINDOW_MS });
  }

  // Limpeza de IPs expirados periodicamente
  if (loginAttempts.size > 1000) {
    for (const [key, value] of loginAttempts.entries()) {
      if (value.resetTime < now) loginAttempts.delete(key);
    }
  }

  await next();
});

// Endpoint de Diagnóstico e Saúde do Sistema (ERP + Banco)
app.get("/api/health", async (c) => {
  const { getErpCatalog } = await import("./erp/service");
  const catalog = await getErpCatalog();
  const isHealthy = catalog.status === "ok" || (!env.erpCatalogEnabled && Boolean(env.databaseUrl));

  return c.json({
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      erp: env.erpCatalogEnabled ? catalog.status : "disabled",
      database: env.databaseUrl ? "connected" : "not_configured",
    },
  });
});

// SEO: robots.txt
app.get("/robots.txt", c => {
  const origin = new URL(c.req.url).origin;
  return c.text(`User-agent: *
Allow: /
Sitemap: ${origin}/sitemap.xml
`);
});

// SEO: sitemap.xml dinâmico
app.get("/sitemap.xml", async c => {
  const origin = new URL(c.req.url).origin;
  try {
    const { getDb } = await import("./queries/connection");
    const db = getDb();
    const allProducts = await db.query.products.findMany({
      where: (p, { eq }) => eq(p.active, true),
    });

    const staticPaths = [
      "",
      "/catalogo",
      "/avaliacao",
      "/lacrados",
      "/seminovos",
      "/reparos",
      "/lojas",
      "/privacidade",
      "/termos",
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPaths
  .map(
    p => `  <url>
    <loc>${origin}${p}</loc>
    <changefreq>daily</changefreq>
    <priority>${p === "" ? "1.0" : "0.8"}</priority>
  </url>`
  )
  .join("\n")}
${allProducts
  .map(
    p => `  <url>
    <loc>${origin}/produto/${p.id}</loc>
    <lastmod>${new Date(p.createdAt).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    return c.text(xml, 200, {
      "Content-Type": "application/xml; charset=utf-8",
    });
  } catch (err) {
    console.error("Erro ao gerar sitemap:", err);
    return c.text("Error generating sitemap", 500);
  }
});

app.use("/api/trpc/*", async c => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
