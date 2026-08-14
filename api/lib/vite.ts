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

    // Detecta o protocolo e domínio real da requisição (mesmo atrás de reverse proxy / Cloudflare)
    const proto = c.req.header("x-forwarded-proto") || "https";
    const host =
      c.req.header("x-forwarded-host") ||
      c.req.header("host") ||
      "lojinhadocelular.com";
    const origin = `${proto}://${host}`;

    const url = new URL(c.req.url);
    const pathname = url.pathname;

    let title = "Lojinha do Celular — iPhones Importados dos EUA & Assistência";
    let desc =
      "iPhones lacrados e seminovos com até 1 ano de garantia. As melhores ofertas em celulares e assistência técnica especializada em Jardim-MS e Guia Lopes da Laguna.";
    let img = `${origin}/images/og-banner.png`;
    let ogType = "website";
    const currentUrl = `${origin}${pathname}`;

    // ROTA DO CATÁLOGO (/catalogo)
    if (pathname.startsWith("/catalogo")) {
      title = "Catálogo de iPhones & Celulares — Lojinha do Celular";
      desc =
        "Confira iPhones lacrados e seminovos dos EUA com até 1 ano de garantia, bateria revisada e pronta entrega em Jardim e Guia Lopes da Laguna. Compre direto pelo WhatsApp!";
      img = `${origin}/images/og-banner.png`;
    }
    // ROTA DE PRODUTO ESPECÍFICO (/produto/:id)
    else if (pathname.match(/^\/produto\/(\d+)/)) {
      const match = pathname.match(/^\/produto\/(\d+)/);
      const productId = match ? Number(match[1]) : null;
      if (productId) {
        try {
          const { getDb } = await import("../queries/connection");
          const db = getDb();
          const product = await db.query.products.findFirst({
            where: (p, { eq }) => eq(p.id, productId),
            with: { variants: true },
          });

          if (product) {
            ogType = "product";
            const minCash = product.variants
              .filter((v) => v.available && v.priceCash > 0)
              .map((v) => v.priceCash);
            const lowestPrice = minCash.length > 0 ? Math.min(...minCash) : null;
            const priceText = lowestPrice
              ? ` por R$ ${(lowestPrice / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} à vista`
              : "";

            title = `${product.name}${priceText} — Lojinha do Celular`;
            desc = product.description
              ? product.description.replace(/[\r\n]+/g, " ").slice(0, 160)
              : `Compre ${product.name} na Lojinha do Celular com ${product.warranty || "1 ano de garantia"}. Pronta entrega em Jardim-MS e Guia Lopes da Laguna.`;

            if (product.imageUrl) {
              img = product.imageUrl.startsWith("/")
                ? `${origin}${product.imageUrl}`
                : product.imageUrl;
            }
          }
        } catch (err) {
          console.error("Erro ao buscar produto para meta tags:", err);
        }
      }
    }

    // Sanitização para prevenção de injeção HTML / XSS
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(desc);
    const safeImg = escapeHtml(img);
    const safeUrl = escapeHtml(currentUrl);

    // Substituição das tags principais
    content = content
      .replace(/<title>.*?<\/title>/gi, `<title>${safeTitle}</title>`)
      .replace(
        /<meta name="description" content=".*?" \/>/gi,
        `<meta name="description" content="${safeDesc}" />`,
      )
      .replace(
        /<meta property="og:title" content=".*?" \/>/gi,
        `<meta property="og:title" content="${safeTitle}" />`,
      )
      .replace(
        /<meta property="og:description" content=".*?" \/>/gi,
        `<meta property="og:description" content="${safeDesc}" />`,
      )
      .replace(
        /<meta property="og:image" content=".*?" \/>/gi,
        `<meta property="og:image" content="${safeImg}" />`,
      )
      .replace(
        /<meta property="og:image:secure_url" content=".*?" \/>/gi,
        `<meta property="og:image:secure_url" content="${safeImg}" />`,
      )
      .replace(
        /<meta property="og:url" content=".*?" \/>/gi,
        `<meta property="og:url" content="${safeUrl}" />`,
      )
      .replace(
        /<meta property="og:type" content=".*?" \/>/gi,
        `<meta property="og:type" content="${ogType}" />`,
      )
      .replace(
        /<meta name="twitter:title" content=".*?" \/>/gi,
        `<meta name="twitter:title" content="${safeTitle}" />`,
      )
      .replace(
        /<meta name="twitter:description" content=".*?" \/>/gi,
        `<meta name="twitter:description" content="${safeDesc}" />`,
      )
      .replace(
        /<meta name="twitter:image" content=".*?" \/>/gi,
        `<meta name="twitter:image" content="${safeImg}" />`,
      );

    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    c.header("Pragma", "no-cache");
    c.header("Expires", "0");
    return c.html(content);
  });
}
