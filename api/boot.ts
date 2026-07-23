import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

// Compressão gzip/deflate em todas as respostas (texto, JS, CSS, JSON)
app.use(compress());

// Cache agressivo para assets com hash (JS/CSS/fonts) — imutáveis
app.use("/assets/*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
});

// Cache de 1 dia para imagens locais (logo, favicon)
app.use("/images/*", async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "public, max-age=86400");
});

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// SEO: robots.txt
app.get("/robots.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.text(`User-agent: *
Allow: /
Sitemap: ${origin}/sitemap.xml
`);
});

// SEO: sitemap.xml dinâmico
app.get("/sitemap.xml", async (c) => {
  const origin = new URL(c.req.url).origin;
  try {
    const { getDb } = await import("./queries/connection");
    const db = getDb();
    const allProducts = await db.query.products.findMany({
      where: (p, { eq }) => eq(p.active, true),
    });

    const staticPaths = ["", "/catalogo", "/lacrados", "/seminovos", "/reparos", "/lojas"];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPaths
  .map(
    (p) => `  <url>
    <loc>${origin}${p}</loc>
    <changefreq>daily</changefreq>
    <priority>${p === "" ? "1.0" : "0.8"}</priority>
  </url>`,
  )
  .join("\n")}
${allProducts
  .map(
    (p) => `  <url>
    <loc>${origin}/produto/${p.id}</loc>
    <lastmod>${new Date(p.createdAt).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

    return c.text(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
  } catch (err) {
    console.error("Erro ao gerar sitemap:", err);
    return c.text("Error generating sitemap", 500);
  }
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

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
