import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound(async (c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }

    const indexPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      return c.text("App build not found", 500);
    }
    let content = fs.readFileSync(indexPath, "utf-8");

    const url = new URL(c.req.url);
    const origin = url.origin;
    const pathname = url.pathname;

    // Se for rota de produto (/produto/:id), busca os metadados do produto no BD
    const match = pathname.match(/^\/produto\/(\d+)/);
    if (match) {
      const productId = Number(match[1]);
      try {
        const { getDb } = await import("../queries/connection");
        const db = getDb();
        const product = await db.query.products.findFirst({
          where: (p, { eq }) => eq(p.id, productId),
          with: { variants: true },
        });

        if (product) {
          const rawTitle = `${product.name} — Lojinha do Celular`;
          const rawDesc = product.description
            ? product.description.replace(/[\r\n]+/g, " ").slice(0, 160)
            : `Confira ${product.name} na Lojinha do Celular. Importados dos EUA com garantia e entrega rápida em Jardim-MS e Guia Lopes da Laguna.`;

          let rawImg = product.imageUrl || `${origin}/images/logo.png`;
          if (rawImg.startsWith("/")) rawImg = `${origin}${rawImg}`;

          const title = escapeHtml(rawTitle);
          const desc = escapeHtml(rawDesc);
          const img = escapeHtml(rawImg);
          const prodUrl = escapeHtml(`${origin}${pathname}`);

          content = content
            .replace(/<title>.*?<\/title>/gi, `<title>${title}</title>`)
            .replace(
              /<meta name="description" content=".*?" \/>/gi,
              `<meta name="description" content="${desc}" />`,
            )
            .replace(
              /<meta property="og:title" content=".*?" \/>/gi,
              `<meta property="og:title" content="${title}" />`,
            )
            .replace(
              /<meta property="og:description" content=".*?" \/>/gi,
              `<meta property="og:description" content="${desc}" />`,
            )
            .replace(
              /<meta property="og:image" content=".*?" \/>/gi,
              `<meta property="og:image" content="${img}" />`,
            )
            .replace(
              /<meta property="og:url" content=".*?" \/>/gi,
              `<meta property="og:url" content="${prodUrl}" />`,
            )
            .replace(
              /<meta name="twitter:title" content=".*?" \/>/gi,
              `<meta name="twitter:title" content="${title}" />`,
            )
            .replace(
              /<meta name="twitter:description" content=".*?" \/>/gi,
              `<meta name="twitter:description" content="${desc}" />`,
            )
            .replace(
              /<meta name="twitter:image" content=".*?" \/>/gi,
              `<meta name="twitter:image" content="${img}" />`,
            );
        }
      } catch (err) {
        console.error("Erro ao injetar meta tags do produto:", err);
      }
    }

    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    c.header("Pragma", "no-cache");
    c.header("Expires", "0");
    return c.html(content);
  });
}
