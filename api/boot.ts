import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import fs from "fs";
import fsPromises from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { warmUpErpCatalog } from "./erp/service";
import { ensureTables, getPool } from "./queries/connection";
import { isEvaluationNotificationConfigured } from "./services/evaluationNotification";
import { isEvaluationPhotoStorageConfigured } from "./services/evaluationPhotoStorage";

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

const MAX_STATIC_CACHE_ENTRIES = 200;
const MAX_CACHED_ASSET_BYTES = 512 * 1024;
const staticAssetCache = new Map<
  string,
  { filePath: string; mtimeMs: number; size: number; etag: string; buffer: Buffer }
>();

function getPublicAssetCandidateDirs(subDir = ""): string[] {
  const dirs = [
    path.resolve(process.cwd(), "public", subDir),
    path.resolve(process.cwd(), "dist/public", subDir),
    path.resolve(import.meta.dirname, "public", subDir),
    path.resolve(import.meta.dirname, "../public", subDir),
    path.resolve(import.meta.dirname, "../dist/public", subDir),
  ];
  return Array.from(new Set(dirs));
}

function buildWeakEtag(size: number, mtimeMs: number): string {
  return `W/"${size.toString(36)}-${Math.trunc(mtimeMs).toString(36)}"`;
}

function matchesIfNoneMatch(headerValue: string | undefined, etag: string): boolean {
  if (!headerValue) return false;
  const trimmed = headerValue.trim();
  if (trimmed === "*") return true;
  return trimmed
    .split(",")
    .map(part => part.trim().replace(/^W\//i, ""))
    .includes(etag.replace(/^W\//i, ""));
}

async function resolveStaticFileAsync(
  candidateFiles: string[],
): Promise<{ filePath: string; stat: fs.Stats } | null> {
  for (const filePath of candidateFiles) {
    try {
      const stat = await fsPromises.stat(filePath);
      if (stat.isFile()) return { filePath, stat };
    } catch {
      // Arquivo não existe neste diretório candidato
    }
  }
  return null;
}

async function serveStaticAssetWithEtag(
  c: Context,
  candidateFiles: string[],
  resolveContentType: (resolvedPath: string) => string,
  extraHeaders: Record<string, string>,
) {
  const resolved = await resolveStaticFileAsync(candidateFiles);
  if (!resolved) return null;

  const { filePath, stat } = resolved;
  const etag = buildWeakEtag(stat.size, stat.mtimeMs);
  const contentType = resolveContentType(filePath);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    ETag: etag,
    ...extraHeaders,
  };

  if (matchesIfNoneMatch(c.req.header("if-none-match"), etag)) {
    return c.body(null, 304, headers);
  }

  let cached = staticAssetCache.get(filePath);
  if (
    cached &&
    cached.mtimeMs === stat.mtimeMs &&
    cached.size === stat.size
  ) {
    // Atualiza ordem LRU simples no Map
    staticAssetCache.delete(filePath);
    staticAssetCache.set(filePath, cached);
    if (c.req.method === "HEAD") {
      return c.body(null, 200, {
        ...headers,
        "Content-Length": cached.buffer.byteLength.toString(),
      });
    }
    return c.body(new Uint8Array(cached.buffer), 200, headers);
  }

  const buffer = await fsPromises.readFile(filePath);
  if (buffer.byteLength <= MAX_CACHED_ASSET_BYTES) {
    if (staticAssetCache.size >= MAX_STATIC_CACHE_ENTRIES) {
      const oldestKey = staticAssetCache.keys().next().value;
      if (oldestKey) staticAssetCache.delete(oldestKey);
    }
    cached = {
      filePath,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      etag,
      buffer,
    };
    staticAssetCache.set(filePath, cached);
  }

  if (c.req.method === "HEAD") {
    return c.body(null, 200, {
      ...headers,
      "Content-Length": buffer.byteLength.toString(),
    });
  }
  return c.body(new Uint8Array(buffer), 200, headers);
}

function getContentTypeByExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".woff2":
      return "font/woff2";
    case ".woff":
      return "font/woff";
    case ".ttf":
      return "font/ttf";
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function streamVideoFile(c: Context, fileName: string) {
  const safeName = path.basename(fileName);
  const resolved = await resolveStaticFileAsync(
    getPublicAssetCandidateDirs().map(dir => path.join(dir, safeName)),
  );
  if (!resolved) {
    return c.text("Video not found", 404);
  }

  const { filePath, stat } = resolved;
  const fileSize = stat.size;
  const etag = buildWeakEtag(fileSize, stat.mtimeMs);
  const range = c.req.header("range");

  // Headers estritos essenciais para iOS Safari, Chrome no iOS e Cloudflare CDN
  // s-maxage=0 e Cloudflare-CDN-Cache-Control: no-store instruem a borda do Cloudflare a repassar requisições Range para a origem sem converter 206 em 200
  const baseHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": "video/mp4",
    ETag: etag,
    "Cache-Control": "public, max-age=31536000, no-transform, s-maxage=0",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "CDN-Cache-Control": "no-store",
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
app.on(["GET", "HEAD"], "/hero-poster.jpg", async c => {
  const res = await serveStaticAssetWithEtag(
    c,
    getPublicAssetCandidateDirs().map(dir => path.join(dir, "hero-poster.jpg")),
    () => "image/jpeg",
    {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
    },
  );
  return res ?? c.text("Poster not found", 404);
});
app.on(["GET", "HEAD"], "/hero-poster.webp", async c => {
  const res = await serveStaticAssetWithEtag(
    c,
    getPublicAssetCandidateDirs().map(dir => path.join(dir, "hero-poster.webp")),
    () => "image/webp",
    {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
    },
  );
  return res ?? c.text("Poster not found", 404);
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

// Cache agressivo para assets com hash (JS/CSS) e fontes — imutáveis
app.use("/assets/*", async (c, next) => {
  await next();
  if (c.res.status >= 200 && c.res.status < 300) {
    c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    // Missing assets can appear briefly during a rolling deploy; never cache a 404 as immutable.
    c.res.headers.set("Cache-Control", "no-store");
  }
});

app.on(["GET", "HEAD"], "/fonts/:file", async c => {
  const safeName = path.basename(c.req.param("file"));
  const res = await serveStaticAssetWithEtag(
    c,
    getPublicAssetCandidateDirs("fonts").map(dir => path.join(dir, safeName)),
    getContentTypeByExt,
    {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
    },
  );
  return res ?? c.text("Font not found", 404);
});

app.use("/fonts/*", async (c, next) => {
  await next();
  if (c.res.status >= 200 && c.res.status < 300 && !c.res.headers.has("Cache-Control")) {
    c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    c.res.headers.set("Access-Control-Allow-Origin", "*");
  }
});

// Entrega direta de imagens estáticas com ETag, leitor assíncrono e headers abertos para WhatsApp/crawlers
app.on(["GET", "HEAD"], "/images/:file", async c => {
  const safeName = path.basename(c.req.param("file"));
  const res = await serveStaticAssetWithEtag(
    c,
    getPublicAssetCandidateDirs("images").map(dir => path.join(dir, safeName)),
    getContentTypeByExt,
    {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
    },
  );
  return res ?? c.text("Not Found", 404);
});

// Entrega direta de imagens dos iPhones (WebP com fallback transparente e ETag/304)
app.on(["GET", "HEAD"], "/images/iphones/:file", async c => {
  const safeName = path.basename(c.req.param("file"));
  const baseName = safeName.replace(/\.(png|jpe?g|webp)$/i, "");
  const dirs = getPublicAssetCandidateDirs("images/iphones");
  const exactPaths = dirs.map(dir => path.join(dir, safeName));
  const webpFallbackPaths = dirs.map(dir => path.join(dir, `${baseName}.webp`));
  const ext = path.extname(safeName).toLowerCase();
  const requestedJpeg = ext === ".jpg" || ext === ".jpeg";
  const candidateFiles = requestedJpeg
    ? exactPaths
    : [...webpFallbackPaths, ...exactPaths];

  const res = await serveStaticAssetWithEtag(
    c,
    candidateFiles,
    getContentTypeByExt,
    {
      "Cache-Control": "public, max-age=604800, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Access-Control-Allow-Origin": "*",
    },
  );
  return res ?? c.text("Not Found", 404);
});

// Preserva Cache-Control mais específico (como immutable em /images/iphones/*) sem rebaixá-lo
app.use("/images/*", async (c, next) => {
  await next();
  if (c.res.status >= 200 && c.res.status < 300 && !c.res.headers.has("Cache-Control")) {
    c.res.headers.set("Cache-Control", "public, max-age=86400");
  }
  c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  c.res.headers.set("Access-Control-Allow-Origin", "*");
});

// Central NFC & QR Code da Loja (/nfc)
async function serveNfcFile(c: Context, rawFileName: string) {
  const safeName = path.basename(rawFileName || "index.html");
  const res = await serveStaticAssetWithEtag(
    c,
    getPublicAssetCandidateDirs("nfc").map(dir => path.join(dir, safeName)),
    getContentTypeByExt,
    { "Cache-Control": "public, max-age=300" },
  );
  return res ?? c.text("Not Found", 404);
}

app.get("/nfc", c => serveNfcFile(c, "index.html"));
app.get("/nfc/", c => serveNfcFile(c, "index.html"));
app.get("/nfc/:file", c => serveNfcFile(c, c.req.param("file")));

// Limite seguro de payload JSON para suportar fotos comprimidas de avaliação sem exaustão de memória
app.use(bodyLimit({ maxSize: 10 * 1024 * 1024 }));

// Rate Limiter em memória para proteção contra força bruta no login admin
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
// Limite por IP (inclui logins bem-sucedidos). A equipe inteira costuma usar o mesmo
// Wi-Fi da loja, então o teto é folgado; o limite fino por IP+usuário fica em admin.login.
const MAX_LOGIN_ATTEMPTS = 30;
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
  let databaseStatus: "connected" | "not_configured" | "error" = "not_configured";

  if (env.databaseUrl) {
    try {
      const pool = getPool();
      await ensureTables();
      await pool?.query("SELECT COUNT(*) AS total FROM evaluations");
      databaseStatus = "connected";
    } catch (err) {
      console.error("Health-check do banco de avaliações falhou:", err);
      databaseStatus = "error";
    }
  }

  const isHealthy =
    (catalog.status === "ok" || !env.erpCatalogEnabled) && databaseStatus === "connected";

  return c.json({
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      erp: env.erpCatalogEnabled ? catalog.status : "disabled",
      database: databaseStatus,
      evaluations: databaseStatus === "connected" ? "available" : "unavailable",
      notification: isEvaluationNotificationConfigured() ? "configured" : "not_configured",
      evaluationPhotos: isEvaluationPhotoStorageConfigured() ? "s3" : "database_inline",
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

// Redirecionamentos 301 permanentes para URLs canônicas limpas (evita erros de canônica e redirecionamento no GSC)
app.get("/catalogo", c => c.redirect("/#vitrine", 301));
app.get("/catalogo/*", c => c.redirect("/#vitrine", 301));
app.get("/troca", c => c.redirect("/avaliacao", 301));
app.get("/troca/*", c => c.redirect("/avaliacao", 301));
app.get("/termos", c => c.redirect("/privacidade", 301));
app.get("/termos-e-privacidade", c => c.redirect("/privacidade", 301));
app.get("/lgpd", c => c.redirect("/privacidade", 301));
app.get("/cookies", c => c.redirect("/privacidade", 301));

// SEO: sitemap.xml dinâmico com suporte a Google Images
app.get("/sitemap.xml", async c => {
  const origin = new URL(c.req.url).origin;
  try {
    const staticPaths = [
      { path: "/", priority: "1.0", freq: "daily" },
      { path: "/avaliacao", priority: "0.9", freq: "weekly" },
      { path: "/privacidade", priority: "0.5", freq: "monthly" },
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

  // Aquece o catálogo do ERP em segundo plano para acelerar a 1ª visita.
  void warmUpErpCatalog();

  // LGPD: apaga avaliações com prazo de guarda vencido (a cada 12 h).
  const { startRetentionJob } = await import("./services/retention");
  startRetentionJob();
}
