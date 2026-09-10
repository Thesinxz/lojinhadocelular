import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { getErpCatalog } from "../erp/service";
import { formatCommercialProductName } from "../../src/lib/commercialFormatting";
import { resolveProductImage } from "../../src/lib/iphoneCatalog";
import { DEMO_PRODUCTS } from "../../src/lib/catalogDemo";

type App = Hono<{ Bindings: HttpBindings }>;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function findIndexHtml(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "dist/public/index.html"),
    path.resolve(import.meta.dirname, "public/index.html"),
    path.resolve(import.meta.dirname, "../dist/public/index.html"),
    path.resolve(import.meta.dirname, "../../dist/public/index.html"),
    path.resolve(process.cwd(), "public/index.html"),
    path.resolve(process.cwd(), "index.html"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export function replaceOrInjectMeta(
  html: string,
  tags: {
    title: string;
    desc: string;
    img: string;
    url: string;
    ogType: string;
    origin: string;
  },
): string {
  // Remove título anterior
  let content = html.replace(/<title>[\s\S]*?<\/title>/gi, "");

  // Remove meta tags anteriores de og:, twitter: e description
  content = content.replace(
    /<meta\s+[^>]*(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+|description)["'][^>]*\/?>/gi,
    "",
  );

  const safeTitle = escapeHtml(tags.title);
  const safeDesc = escapeHtml(tags.desc);
  const safeImg = escapeHtml(tags.img);
  const safeUrl = escapeHtml(tags.url);
  const safeType = escapeHtml(tags.ogType);

  const metaBlock = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />

    <!-- OpenGraph / WhatsApp / Facebook / Instagram -->
    <meta property="og:site_name" content="Lojinha do Celular" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImg}" />
    <meta property="og:image:secure_url" content="${safeImg}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="600" />
    <meta property="og:image:height" content="600" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:type" content="${safeType}" />
    <meta property="og:locale" content="pt_BR" />

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImg}" />
  `;

  if (content.includes("</head>")) {
    return content.replace("</head>", `${metaBlock}\n  </head>`);
  }
  return `${metaBlock}\n${content}`;
}

export function serveStaticFiles(app: App) {
  const staticRoot = fs.existsSync("./dist/public")
    ? "./dist/public"
    : path.resolve(import.meta.dirname, "public");

  app.use("*", serveStatic({ root: staticRoot }));

  app.notFound(async (c) => {
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    const userAgent = c.req.header("user-agent") || "";

    // Detecta scrapers de redes sociais (WhatsApp, Facebook, Twitter, Telegram, Discord, etc.)
    const isSocialScraper =
      /whatsapp|facebookexternalhit|twitterbot|telegrambot|linkedinbot|embedly|slackbot|discordbot|googlebot|applebot/i.test(
        userAgent,
      );

    // Se for arquivo estático ausente com extensão (.js, .css, .png, etc.) e não for bot/HTML, retorna 404
    const hasStaticExtension =
      path.extname(pathname) !== "" && !pathname.endsWith(".html");
    if (hasStaticExtension && !isSocialScraper) {
      return c.json({ error: "Not Found" }, 404);
    }

    // Se for rota sob /api/ não encontrada, retorna 404 JSON
    if (pathname.startsWith("/api/")) {
      return c.json({ error: "Not Found" }, 404);
    }

    const indexPath = findIndexHtml();
    if (!indexPath) {
      return c.text("App build not found. Please run pnpm build first.", 500);
    }
    let content = fs.readFileSync(indexPath, "utf-8");

    // Detecta o protocolo e domínio real da requisição (mesmo atrás de reverse proxy / Cloudflare)
    const proto = c.req.header("x-forwarded-proto") || "https";
    const host =
      c.req.header("x-forwarded-host") ||
      c.req.header("host") ||
      "lojinhadocelular.com";
    const origin = `${proto}://${host}`;

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
    // ROTA DE AVALIAÇÃO / TROCA FÁCIL
    else if (
      pathname.startsWith("/avaliacao") ||
      pathname.startsWith("/troca") ||
      host.includes("trocafacil")
    ) {
      title = "Troca Fácil de iPhone — Lojinha do Celular";
      desc =
        "Venda ou troque seu iPhone com segurança. Receba uma pré-avaliação rápida da equipe Lojinha do Celular em Jardim-MS.";
      img = `${origin}/images/og-banner.png`;
    }
    // ROTA DE PRODUTO ESPECÍFICO (/produto/:id)
    else {
      const productMatch = pathname.match(/^\/produto\/([^/?#]+)/i);
      if (productMatch) {
        const rawId = productMatch[1];
        const productIdStr = decodeURIComponent(rawId).trim();
        let foundProduct: {
          name: string;
          description?: string | null;
          imageUrl?: string | null;
          condition?: string | null;
          category?: string | null;
          warranty?: string | null;
          batteryHealth?: string | null;
          variants?: {
            priceCash?: number | null;
            color?: string | null;
            storage?: string | null;
            available?: boolean | null;
            warranty?: string | null;
            batteryHealth?: string | null;
            imageUrl?: string | null;
          }[];
        } | null = null;

        // 1. Busca prioritária no catálogo do ERP Gestão Celular
        try {
          const erp = await getErpCatalog();
          if (erp.status === "ok" && erp.products.length > 0) {
            const match = erp.products.find((p) => {
              const idMatch =
                String(p.id).trim().toLowerCase() === productIdStr.toLowerCase();
              const extMatch =
                p.externalId &&
                p.externalId.trim().toLowerCase() === productIdStr.toLowerCase();
              const pWithSku = p as { sku?: unknown };
              const skuMatch =
                typeof pWithSku.sku === "string" &&
                pWithSku.sku.trim().toLowerCase() === productIdStr.toLowerCase();
              return idMatch || extMatch || skuMatch;
            });
            if (match) {
              foundProduct = match;
            }
          }
        } catch (err) {
          console.error("Erro ao buscar no ERP para OpenGraph:", err);
        }

        // 2. Fallback no banco local MySQL
        if (!foundProduct) {
          try {
            const { getDb } = await import("../queries/connection");
            const db = getDb();
            const numericId = Number(productIdStr);
            if (!Number.isNaN(numericId) && numericId > 0) {
              const p = await db.query.products.findFirst({
                where: (prod, { eq }) => eq(prod.id, numericId),
                with: { variants: true },
              });
              if (p) {
                foundProduct = p;
              }
            }
          } catch {
            // Ignora se o DB local não estiver disponível
          }
        }

        // 3. Fallback no catálogo de demonstração
        if (!foundProduct) {
          const demo = DEMO_PRODUCTS.find(
            (p) =>
              String(p.id) === productIdStr ||
              p.name.toLowerCase().includes(productIdStr.toLowerCase()),
          );
          if (demo) {
            foundProduct = demo as unknown as typeof foundProduct;
          }
        }

        if (foundProduct) {
          ogType = "product";
          const firstVariant = foundProduct.variants?.[0];
          const validCashPrices = (foundProduct.variants || [])
            .filter((v) => v.available !== false && (v.priceCash ?? 0) > 0)
            .map((v) => v.priceCash as number);

          const lowestCash =
            validCashPrices.length > 0
              ? Math.min(...validCashPrices)
              : (firstVariant?.priceCash ?? 0);

          const formattedCash =
            lowestCash > 0
              ? ` por R$ ${(lowestCash / 100).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} no Pix`
              : "";

          const cleanCommercialTitle = formatCommercialProductName(
            foundProduct.name,
            firstVariant?.color,
            firstVariant?.storage,
          );

          title = `${cleanCommercialTitle}${formattedCash} — Lojinha do Celular`;

          const isLacrado =
            foundProduct.condition === "lacrado" ||
            foundProduct.condition === "novo" ||
            foundProduct.category === "iphone_lacrado";
          const conditionBadge = isLacrado ? "✨ Lacrado" : "🔄 Seminovo";
          const warrantyBadge =
            foundProduct.warranty ||
            firstVariant?.warranty ||
            (isLacrado ? "1 ano de garantia" : "Garantia com procedência");
          const batteryBadge =
            foundProduct.batteryHealth || firstVariant?.batteryHealth
              ? ` • 🔋 Bateria ${foundProduct.batteryHealth || firstVariant?.batteryHealth}`
              : "";

          desc = foundProduct.description
            ? foundProduct.description.replace(/[\r\n]+/g, " ").slice(0, 160)
            : `${conditionBadge} • 🛡️ ${warrantyBadge}${batteryBadge} • Pronta entrega em Jardim-MS e Guia Lopes da Laguna. Compre no WhatsApp da Lojinha do Celular!`;

          let resolvedImage =
            foundProduct.imageUrl || firstVariant?.imageUrl || "";
          if (
            !resolvedImage ||
            resolvedImage.includes("placeholder") ||
            resolvedImage.includes("unsplash")
          ) {
            resolvedImage = resolveProductImage(
              foundProduct.name,
              resolvedImage,
              firstVariant?.color ?? undefined,
            );
          }

          if (resolvedImage && resolvedImage.startsWith("/")) {
            img = `${origin}${resolvedImage}`;
          } else if (resolvedImage && resolvedImage.startsWith("http")) {
            img = resolvedImage;
          }
        }
      }
    }

    content = replaceOrInjectMeta(content, {
      title,
      desc,
      img,
      url: currentUrl,
      ogType,
      origin,
    });

    if (isSocialScraper) {
      c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    } else {
      c.header("Cache-Control", "no-cache, no-store, must-revalidate");
      c.header("Pragma", "no-cache");
      c.header("Expires", "0");
    }

    return c.html(content);
  });
}
