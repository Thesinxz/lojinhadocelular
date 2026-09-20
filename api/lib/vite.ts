import type { Context, Hono } from "hono";
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
    canonicalUrl?: string;
    noindex?: boolean;
  },
): string {
  // Remove título anterior
  let content = html.replace(/<title>[\s\S]*?<\/title>/gi, "");

  // Remove meta tags anteriores de og:, twitter:, description e robots
  content = content.replace(
    /<meta\s+[^>]*(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+|description|robots)["'][^>]*\/?>/gi,
    "",
  );

  // Remove link rel="image_src" e link rel="canonical" anteriores se houver
  content = content.replace(/<link\s+[^>]*rel=["'](?:image_src|canonical)["'][^>]*\/?>/gi, "");

  const safeTitle = escapeHtml(tags.title);
  const safeDesc = escapeHtml(tags.desc);
  const safeImg = escapeHtml(tags.img);
  const safeType = escapeHtml(tags.ogType);
  const safeCanonical = escapeHtml(tags.canonicalUrl || tags.url);

  // WhatsApp e redes sociais recomendam 1200x630 para banners e 600x600 para produtos individuais
  const isProduct = tags.ogType === "product";
  const imgWidth = isProduct ? "600" : "1200";
  const imgHeight = isProduct ? "600" : "630";
  const isJpg = tags.img.toLowerCase().includes(".jpg") || tags.img.toLowerCase().includes(".jpeg");
  const imgType = isJpg ? "image/jpeg" : "image/png";

  const robotsTag = tags.noindex
    ? '<meta name="robots" content="noindex, nofollow" />'
    : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />';

  const metaBlock = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    ${robotsTag}
    <link rel="canonical" href="${safeCanonical}" />

    <!-- OpenGraph / WhatsApp / Facebook / Instagram -->
    <meta property="og:site_name" content="Lojinha do Celular" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImg}" />
    <meta property="og:image:secure_url" content="${safeImg}" />
    <meta property="og:image:type" content="${imgType}" />
    <meta property="og:image:width" content="${imgWidth}" />
    <meta property="og:image:height" content="${imgHeight}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:url" content="${safeCanonical}" />
    <meta property="og:type" content="${safeType}" />
    <meta property="og:locale" content="pt_BR" />
    <link rel="image_src" href="${safeImg}" />

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImg}" />
  `;

  // Injeta logo no início do <head> para que crawlers (WhatsApp, Facebook)
  // leiam imediatamente os metadados nos primeiros KB do payload
  if (/<head[^>]*>/i.test(content)) {
    return content.replace(/(<head[^>]*>)/i, `$1\n${metaBlock}`);
  }
  if (content.includes("</head>")) {
    return content.replace("</head>", `${metaBlock}\n  </head>`);
  }
  return `${metaBlock}\n${content}`;
}

export async function renderEnrichedHtml(c: Context): Promise<Response> {
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

  // 1. Redirecionamentos 301 permanentes para URLs canônicas limpas (evita "Página com redirecionamento" ou duplicatas no GSC)
  if (pathname === "/index.html") {
    return c.redirect("/", 301);
  }
  if (pathname === "/catalogo" || pathname === "/catalogo/") {
    return c.redirect("/#vitrine", 301);
  }
  if (pathname === "/troca" || pathname === "/troca/") {
    return c.redirect("/avaliacao", 301);
  }
  if (
    pathname === "/termos" ||
    pathname === "/termos/" ||
    pathname === "/termos-e-privacidade" ||
    pathname === "/termos-e-privacidade/" ||
    pathname === "/lgpd" ||
    pathname === "/lgpd/" ||
    pathname === "/cookies" ||
    pathname === "/cookies/"
  ) {
    return c.redirect("/privacidade", 301);
  }

  // Detecta o protocolo e domínio real da requisição (mesmo atrás de reverse proxy / Cloudflare)
  const proto = c.req.header("x-forwarded-proto") || "https";
  const host =
    c.req.header("x-forwarded-host") ||
    c.req.header("host") ||
    "lojinhadocelular.com";
  const origin = `${proto}://${host}`;
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const canonicalDomain = isLocal ? origin : "https://lojinhadocelular.com";

  let title = "Lojinha do Celular — iPhones, Smartphones & Assistência Técnica";
  let desc =
    "Seu próximo smartphone com até 1 ano de garantia e procedência. Pronta entrega e assistência técnica em Jardim e Guia Lopes da Laguna - MS. CNPJ: 61.874.839/0001-43. WhatsApp: (67) 99208-6012.";
  let img = `${origin}/images/og-preview.jpg?v=3`;
  let ogType = "website";
  let canonicalUrl = `${canonicalDomain}/`;
  let noindex = false;
  let httpStatus: 200 | 404 = 200;
  const currentUrl =
    pathname === "/index.html" || pathname === "" ? `${origin}/` : `${origin}${pathname}`;

  // ROTA HOME (/)
  if (pathname === "/" || pathname === "") {
    canonicalUrl = `${canonicalDomain}/`;
  }
  // ROTA DE AVALIAÇÃO / TROCA FÁCIL (/avaliacao)
  else if (pathname === "/avaliacao" || pathname.startsWith("/avaliacao/")) {
    title = "Avaliação e Troca de Celular — Troca Fácil Lojinha do Celular";
    desc =
      "Venda ou troque seu celular e iPhone usado com segurança e melhor avaliação de mercado. Use como desconto na compra do seu novo aparelho na Lojinha do Celular em Jardim-MS. WhatsApp: (67) 99208-6012.";
    img = `${origin}/images/og-preview.jpg?v=3`;
    canonicalUrl = `${canonicalDomain}/avaliacao`;
  }
  // ROTA DE PRIVACIDADE (/privacidade)
  else if (pathname === "/privacidade" || pathname.startsWith("/privacidade/")) {
    title = "Termos de Privacidade, LGPD & Cookies — Lojinha do Celular";
    desc =
      "Transparência e segurança com seus dados. Conheça nossos termos de uso, política de privacidade e cookies em total conformidade com a LGPD (Lei nº 13.709/2018).";
    img = `${origin}/images/og-preview.jpg?v=3`;
    canonicalUrl = `${canonicalDomain}/privacidade`;
  }
  // ROTAS INTERNAS E PAINEL (ADMIN / TV)
  else if (pathname.startsWith("/admin") || pathname.startsWith("/tv")) {
    title = pathname.startsWith("/admin")
      ? "Painel Administrativo — Lojinha do Celular"
      : "TV Vitrine — Lojinha do Celular";
    noindex = true; // Nunca indexar painel administrativo ou modo TV no Google
    canonicalUrl = `${canonicalDomain}${pathname}`;
  }
  // ROTA DE PRODUTO ESPECÍFICO (/produto/:id)
  else {
    const productMatch = pathname.match(/^\/produto\/([^/?#]+)/i);
    if (productMatch) {
      const rawId = productMatch[1];
      const productIdStr = decodeURIComponent(rawId).trim();
      let foundProduct: {
        id: string | number;
        externalId?: string | null;
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
            const altMatch =
              Array.isArray(p.alternateIds) &&
              p.alternateIds.some(
                (alt) => alt.trim().toLowerCase() === productIdStr.toLowerCase(),
              );
            const pWithSku = p as { sku?: unknown };
            const skuMatch =
              typeof pWithSku.sku === "string" &&
              pWithSku.sku.trim().toLowerCase() === productIdStr.toLowerCase();
            return idMatch || extMatch || altMatch || skuMatch;
          });
          if (match && match.active !== false) {
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
            if (p && p.active !== false) {
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
        canonicalUrl = `${canonicalDomain}/produto/${encodeURIComponent(String(foundProduct.id || foundProduct.externalId || productIdStr))}`;
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
      } else {
        // PRODUTO NÃO ENCONTRADO NO ESTOQUE OU DELETADO => RETORNA HTTP 404 REAL (PREVINE ERRO SOFT 404 NO GSC)
        httpStatus = 404;
        noindex = true;
        title = "Produto não encontrado — Lojinha do Celular";
        desc = "O produto que você tentou acessar não está mais disponível ou foi removido do nosso catálogo.";
        canonicalUrl = `${canonicalDomain}${pathname}`;
      }
    } else {
      // ROTA DESCONHECIDA => RETORNA HTTP 404 REAL (PREVINE ERRO SOFT 404 NO GSC)
      httpStatus = 404;
      noindex = true;
      title = "Página não encontrada (404) — Lojinha do Celular";
      desc = "A página que você tentou acessar não existe ou foi movida. Visite nossa vitrine para conferir os aparelhos disponíveis.";
      canonicalUrl = `${canonicalDomain}${pathname}`;
    }
  }

  content = replaceOrInjectMeta(content, {
    title,
    desc,
    img,
    url: currentUrl,
    canonicalUrl,
    noindex,
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

  return c.html(content, httpStatus);
}

export function serveStaticFiles(app: App) {
  const staticRoot = fs.existsSync("./dist/public")
    ? "./dist/public"
    : path.resolve(import.meta.dirname, "public");

  // 1. Renderização dinâmica da Home (/) e /index.html com OpenGraph e SEO completos
  app.get("/", renderEnrichedHtml);
  app.get("/index.html", renderEnrichedHtml);

  // 2. Servir arquivos estáticos da pasta dist/public
  app.use("*", serveStatic({ root: staticRoot }));

  // 3. Fallback SPA para rotas dinâmicas (/produto/:id, /avaliacao, /privacidade, etc.)
  app.notFound(renderEnrichedHtml);
}
