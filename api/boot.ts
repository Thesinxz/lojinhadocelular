import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import fs from "fs";
import { Readable } from "stream";
import path from "path";
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

function resolveStaticFilePath(fileName: string): string | null {
  const safeName = path.basename(fileName);
  const possiblePaths = [
    path.resolve(process.cwd(), "public", safeName),
    path.resolve(process.cwd(), "dist/public", safeName),
    path.resolve(import.meta.dirname, "public", safeName),
    path.resolve(import.meta.dirname, "../public", safeName),
    path.resolve(import.meta.dirname, "../dist/public", safeName),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function streamVideoFile(c: Context, fileName: string) {
  const filePath = resolveStaticFilePath(fileName);
  if (!filePath) {
    return c.text("Video not found", 404);
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = c.req.header("range");

  // Headers estritos essenciais para iOS Safari, Chrome no iOS e Cloudflare CDN
  const baseHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": "video/mp4",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Access-Control-Allow-Origin": "*",
  };

  if (c.req.method === "HEAD") {
    return c.body(null, 200, {
      ...baseHeaders,
      "Content-Length": fileSize.toString(),
    });
  }

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10) || 0;
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const boundedEnd = Math.min(end, fileSize - 1);
    const chunkSize = boundedEnd - start + 1;

    const nodeStream = fs.createReadStream(filePath, { start, end: boundedEnd });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return c.body(webStream, 206, {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${boundedEnd}/${fileSize}`,
      "Content-Length": chunkSize.toString(),
    });
  }

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return c.body(webStream, 200, {
    ...baseHeaders,
    "Content-Length": fileSize.toString(),
  });
}

// Rotas de streaming de vídeo com suporte obrigatório a HTTP 206 Byte-Ranges para iOS Safari
app.on(["GET", "HEAD"], "/hero.mp4", c => streamVideoFile(c, "hero.mp4"));
app.on(["GET", "HEAD"], "/hero-mobile.mp4", c => streamVideoFile(c, "hero-mobile.mp4"));
app.on(["GET", "HEAD"], "/hero-poster.jpg", c => {
  const filePath = resolveStaticFilePath("hero-poster.jpg");
  if (!filePath) return c.text("Poster not found", 404);
  const buffer = fs.readFileSync(filePath);
  return c.body(buffer, 200, {
    "Content-Type": "image/jpeg",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Access-Control-Allow-Origin": "*",
  });
});

// Compressão gzip/deflate em respostas de texto, JS, CSS e JSON (exclui mídias binárias)
app.use(
  compress({
    contentTypeFilter: type =>
      !type.startsWith("video/") &&
      !type.startsWith("image/") &&
      !type.includes("octet-stream"),
  })
);

// Cache agressivo para assets com hash (JS/CSS/fonts) — imutáveis
app.use("/assets/*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
});

// Entrega direta de imagens estáticas com headers abertos para WhatsApp, Facebook e crawlers
app.get("/images/:file", async c => {
  const fileName = c.req.param("file");
  const safeName = path.basename(fileName);
  const possiblePaths = [
    path.resolve(process.cwd(), "public/images", safeName),
    path.resolve(process.cwd(), "dist/public/images", safeName),
    path.resolve(import.meta.dirname, "public/images", safeName),
    path.resolve(import.meta.dirname, "../public/images", safeName),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const ext = path.extname(safeName).toLowerCase();
      const contentType =
        ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".png"
            ? "image/png"
            : ext === ".svg"
              ? "image/svg+xml"
              : ext === ".webp"
                ? "image/webp"
                : "application/octet-stream";
      const buffer = fs.readFileSync(p);
      return c.body(buffer, 200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Origin": "*",
      });
    }
  }
  return c.text("Not Found", 404);
});

// Entrega direta de imagens dos iPhones (WebP com fallback transparente e headers abertos)
app.get("/images/iphones/:file", async c => {
  const fileName = c.req.param("file");
  const safeName = path.basename(fileName);
  const baseName = safeName.replace(/\.(png|webp)$/i, "");

  const possiblePaths = [
    path.resolve(process.cwd(), "public/images/iphones", `${baseName}.webp`),
    path.resolve(process.cwd(), "dist/public/images/iphones", `${baseName}.webp`),
    path.resolve(import.meta.dirname, "public/images/iphones", `${baseName}.webp`),
    path.resolve(import.meta.dirname, "../public/images/iphones", `${baseName}.webp`),
    path.resolve(process.cwd(), "public/images/iphones", safeName),
    path.resolve(process.cwd(), "dist/public/images/iphones", safeName),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const ext = path.extname(p).toLowerCase();
      const contentType = ext === ".webp" ? "image/webp" : "image/png";
      const buffer = fs.readFileSync(p);
      return c.body(buffer, 200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Origin": "*",
      });
    }
  }
  return c.text("Not Found", 404);
});

// Cache de 1 dia para imagens locais (logo, favicon, og-banner) com acesso aberto para crawlers (WhatsApp, Facebook, Twitter)
app.use("/images/*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "public, max-age=86400");
  c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  c.res.headers.set("Access-Control-Allow-Origin", "*");
});



// Limite seguro de payload JSON para suportar fotos comprimidas de avaliação sem exaustão de memória
app.use(bodyLimit({ maxSize: 10 * 1024 * 1024 }));

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
Disallow: /admin
Disallow: /admin/
Disallow: /api/trpc/admin.
Disallow: /tv
Disallow: /tv/

User-agent: Googlebot
Allow: /

User-agent: Googlebot-Image
Allow: /images/
Allow: /mockups/
Allow: /hero
Allow: /

Sitemap: ${origin}/sitemap.xml
`);
});

// SEO: sitemap.xml dinâmico com suporte a Google Images
app.get("/sitemap.xml", async c => {
  const origin = new URL(c.req.url).origin;
  try {
    const staticPaths = [
      { path: "", priority: "1.0", freq: "daily" },
      { path: "/catalogo", priority: "0.9", freq: "daily" },
      { path: "/avaliacao", priority: "0.9", freq: "weekly" },
      { path: "/privacidade", priority: "0.5", freq: "monthly" },
      { path: "/termos", priority: "0.5", freq: "monthly" },
    ];

    let productUrls: { loc: string; lastmod?: string; title?: string; image?: string }[] = [];

    if (env.erpCatalogEnabled) {
      const { getErpCatalog } = await import("./erp/service");
      const catalog = await getErpCatalog();
      if (catalog.status === "ok") {
        productUrls = catalog.products
          .filter(p => p.active !== false)
          .map(p => {
            const rawImg = p.imageUrl || (p.variants && p.variants[0]?.imageUrl);
            const absoluteImg = rawImg
              ? (rawImg.startsWith("http") ? rawImg : `${origin}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`)
              : undefined;
            return {
              loc: `${origin}/produto/${p.id || p.externalId}`,
              lastmod: new Date().toISOString().split("T")[0],
              title: p.name,
              image: absoluteImg,
            };
          });
      }
    }

    if (productUrls.length === 0) {
      const { getDb } = await import("./queries/connection");
      const db = getDb();
      const allProducts = await db.query.products.findMany({
        where: (p, { eq }) => eq(p.active, true),
      });
      productUrls = allProducts.map(p => {
        const rawImg = p.imageUrl;
        const absoluteImg = rawImg
          ? (rawImg.startsWith("http") ? rawImg : `${origin}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`)
          : undefined;
        return {
          loc: `${origin}/produto/${p.id}`,
          lastmod: new Date(p.createdAt).toISOString().split("T")[0],
          title: p.name,
          image: absoluteImg,
        };
      });
    }

    const escapeXml = (unsafe: string) =>
      unsafe.replace(/[<>&'"]/g, char => {
        switch (char) {
          case "<": return "&lt;";
          case ">": return "&gt;";
          case "&": return "&amp;";
          case "'": return "&apos;";
          case '"': return "&quot;";
          default: return char;
        }
      });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticPaths
  .map(
    p => `  <url>
    <loc>${origin}${p.path}</loc>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n")}
${productUrls
  .map(
    p => `  <url>
    <loc>${p.loc}</loc>
    ${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${
      p.image
        ? `\n    <image:image>\n      <image:loc>${escapeXml(p.image)}</image:loc>${
            p.title ? `\n      <image:title>${escapeXml(p.title)} - Lojinha do Celular Jardim MS</image:title>` : ""
          }\n    </image:image>`
        : ""
    }
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
