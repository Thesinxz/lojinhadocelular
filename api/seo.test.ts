import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { serveStaticFiles, replaceOrInjectMeta } from "./lib/vite";
import { setErpCacheForTesting, clearErpCache } from "./erp/service";
import type { ShopProduct } from "./erp/types";

describe("SEO & WhatsApp OpenGraph Dynamic Preview", () => {
  beforeEach(() => {
    clearErpCache();
  });

  afterEach(() => {
    clearErpCache();
  });

  it("deve injetar tags OpenGraph corretas e remover duplicatas em replaceOrInjectMeta", () => {
    const rawHtml = `<!doctype html>
<html>
  <head>
    <title>Título Antigo</title>
    <meta name="description" content="Desc antiga" />
    <meta property="og:title" content="OG Antigo" />
    <meta property="og:image" content="https://antigo.com/img.png" />
  </head>
  <body><div id="root"></div></body>
</html>`;

    const enriched = replaceOrInjectMeta(rawHtml, {
      title: "iPhone 17 Pro Max - Silver 256GB por R$ 7.219,00 no Pix — Lojinha do Celular",
      desc: "✨ Lacrado • 🛡️ 1 ano de garantia • Pronta entrega em Jardim-MS.",
      img: "https://lojinhadocelular.com/images/iphones/iphone-17-pro-max-silver.png",
      url: "https://lojinhadocelular.com/produto/50e70d25-bc76-4b76-a76b-6cc3918e830e",
      ogType: "product",
      origin: "https://lojinhadocelular.com",
    });

    expect(enriched).toContain("<title>iPhone 17 Pro Max - Silver 256GB por R$ 7.219,00 no Pix — Lojinha do Celular</title>");
    expect(enriched).toContain('<meta property="og:title" content="iPhone 17 Pro Max - Silver 256GB por R$ 7.219,00 no Pix — Lojinha do Celular" />');
    expect(enriched).toContain('<meta property="og:image" content="https://lojinhadocelular.com/images/iphones/iphone-17-pro-max-silver.png" />');
    expect(enriched).toContain('<meta property="og:type" content="product" />');
    expect(enriched).not.toContain("Título Antigo");
    expect(enriched).not.toContain("OG Antigo");
  });

  it("deve responder 200 com OpenGraph do produto do ERP quando WhatsApp crawler acessar link com UUID", async () => {
    const dummyProduct: ShopProduct = {
      id: "50e70d25-bc76-4b76-a76b-6cc3918e830e",
      source: "erp",
      externalId: "50e70d25-bc76-4b76-a76b-6cc3918e830e",
      name: "CEL IPHONE 17 PRO MAX SILVER 256GB",
      brand: "Apple",
      category: "iphone_lacrado",
      condition: "lacrado",
      description: null,
      featured: true,
      active: true,
      createdAt: new Date(),
      warranty: "1 ano de garantia",
      imageUrl: "https://gestaocelular.com.br/images/iphone17promax.png",
      variants: [
        {
          id: "var-1",
          productId: "50e70d25-bc76-4b76-a76b-6cc3918e830e",
          version: "Pro Max",
          sku: "ERP-50E70D25",
          color: "Silver",
          colorHex: "#e2e4e1",
          storage: "256GB",
          condition: "lacrado",
          batteryHealth: "100%",
          warranty: "1 ano de garantia",
          priceCash: 721900,
          imageUrl: null,
          videoUrl: null,
          notes: null,
          available: true,
          quantity: 2,
        },
      ],
    };

    setErpCacheForTesting([dummyProduct]);

    const app = new Hono();
    serveStaticFiles(app as unknown as Parameters<typeof serveStaticFiles>[0]);

    // Simula requisição feita pelo WhatsApp crawler
    const res = await app.request("/produto/50e70d25-bc76-4b76-a76b-6cc3918e830e", {
      headers: {
        "user-agent": "WhatsApp/2.23.23.77 i",
        accept: "*/*",
        host: "lojinhadocelular.com",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const html = await res.text();
    expect(html).toContain("iPhone 17 Pro Max - Silver 256GB");
    expect(html).toContain("7.219,00 no Pix");
    expect(html).toContain("og:image");
    expect(html).toContain("gestaocelular.com.br/images/iphone17promax.png");
    expect(html).toContain("Lacrado");
  });

  it("deve responder 200 com OpenGraph para rotas SPA como /catalogo para crawlers", async () => {
    const app = new Hono();
    serveStaticFiles(app as unknown as Parameters<typeof serveStaticFiles>[0]);

    const res = await app.request("/catalogo", {
      headers: {
        "user-agent": "facebookexternalhit/1.1",
        accept: "*/*",
        host: "lojinhadocelular.com",
      },
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Loja de iPhone &amp; Celulares em Jardim-MS — Catálogo Lojinha do Celular");
    expect(html).toContain("/images/og-preview.jpg?v=3");
  });

  it("deve responder 200 com OpenGraph dedicado para /privacidade e termos da LGPD", async () => {
    const app = new Hono();
    serveStaticFiles(app as unknown as Parameters<typeof serveStaticFiles>[0]);

    const res = await app.request("/privacidade", {
      headers: {
        "user-agent": "WhatsApp/2.23.23.77 i",
        accept: "*/*",
        host: "lojinhadocelular.com",
      },
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Termos de Privacidade, LGPD &amp; Cookies — Lojinha do Celular");
    expect(html).toContain("LGPD");
  });

  it("deve responder 200 com OpenGraph e imagem do banner 1200x630 para a raiz (/) acessada pelo WhatsApp", async () => {
    const app = new Hono();
    serveStaticFiles(app as unknown as Parameters<typeof serveStaticFiles>[0]);

    const res = await app.request("/", {
      headers: {
        "user-agent": "WhatsApp/2.23.23.77 i",
        accept: "*/*",
        host: "lojinhadocelular.com",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();

    expect(html).toContain("Lojinha do Celular — iPhones, Smartphones &amp; Assistência Técnica");
    expect(html).toContain("61.874.839/0001-43");
    expect(html).toContain("(67) 99208-6012");
    expect(html).toContain('<meta property="og:image" content="https://lojinhadocelular.com/images/og-preview.jpg?v=3" />');
    expect(html).toContain('<meta property="og:url" content="https://lojinhadocelular.com/" />');
    expect(html).toContain('<link rel="image_src" href="https://lojinhadocelular.com/images/og-preview.jpg?v=3" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<meta property="og:type" content="website" />');

    // Confirma que as meta tags estão no início do <head> antes de qualquer tag <body>
    const headIndex = html.indexOf("<head");
    const ogTitleIndex = html.indexOf("og:title");
    const bodyIndex = html.indexOf("<body");
    expect(ogTitleIndex).toBeGreaterThan(headIndex);
    expect(ogTitleIndex).toBeLessThan(bodyIndex);
  });

  it("deve responder 200 com OpenGraph na rota /index.html", async () => {
    const app = new Hono();
    serveStaticFiles(app as unknown as Parameters<typeof serveStaticFiles>[0]);

    const res = await app.request("/index.html", {
      headers: {
        "user-agent": "WhatsApp/2.23.23.77 i",
        accept: "*/*",
        host: "lojinhadocelular.com",
      },
    });

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<meta property="og:url" content="https://lojinhadocelular.com/" />');
    expect(html).toContain('<meta property="og:image" content="https://lojinhadocelular.com/images/og-preview.jpg?v=3" />');
  });

  it("deve retornar 404 JSON para arquivos estáticos ausentes (.js, .css)", async () => {
    const app = new Hono();
    serveStaticFiles(app as unknown as Parameters<typeof serveStaticFiles>[0]);

    const res = await app.request("/assets/arquivo-inexistente.js", {
      headers: {
        accept: "*/*",
      },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Not Found" });
  });

  it("deve retornar robots.txt com regras seguras e sitemap", async () => {
    const { default: app } = await import("./boot");
    const res = await app.request("https://lojinhadocelular.com/robots.txt");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("User-agent: Googlebot-Image");
    expect(text).toContain("Sitemap: https://lojinhadocelular.com/sitemap.xml");
  });

  it("deve retornar sitemap.xml com namespace de imagem e URLs válidas", async () => {
    const { default: app } = await import("./boot");
    const res = await app.request("https://lojinhadocelular.com/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const text = await res.text();
    expect(text).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(text).toContain("<loc>https://lojinhadocelular.com/catalogo</loc>");
    expect(text).toContain("<image:image>");
    expect(text).toContain("<image:loc>");
  });

  it("deve servir /images/og-preview.jpg com Cross-Origin-Resource-Policy aberto para WhatsApp e redes sociais", async () => {
    const { default: app } = await import("./boot");
    const res = await app.request("https://lojinhadocelular.com/images/og-preview.jpg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
