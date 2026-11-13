import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ShopProduct } from "./erp/types";
import {
  clearErpCache,
  setErpCacheForTesting,
  getCachedErpCatalogIfWarm,
} from "./erp/service";

const SAMPLE_ERP_PRODUCT: ShopProduct = {
  id: "prod-17-pm",
  source: "erp",
  externalId: "prod-17-pm",
  name: "IPHONE 17 PRO MAX 256GB SILVER",
  brand: "Apple",
  category: "iphone_lacrado",
  condition: "lacrado",
  description: "Original lacrado",
  featured: true,
  active: true,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  warranty: "1 ano Apple",
  imageUrl: "/images/iphones/iphone-17-pro-max-silver.webp",
  variants: [
    {
      id: "var-17-pm",
      productId: "prod-17-pm",
      version: "Pro Max",
      sku: "ERP-17PM",
      color: "Silver",
      colorHex: "#e2e4e1",
      storage: "256GB",
      condition: "lacrado",
      batteryHealth: "100%",
      warranty: "1 ano Apple",
      priceCash: 721900,
      imageUrl: null,
      videoUrl: null,
      notes: "NOTA INTERNA CONFIDENCIAL",
      available: true,
      quantity: 2,
    },
  ],
};

describe("Fase 1 — Performance, Cache de Borda & Hidratação", () => {
  beforeEach(() => {
    clearErpCache();
  });

  afterEach(() => {
    clearErpCache();
  });

  describe("Cache quente do catálogo ERP (0 ms para HTML hydration)", () => {
    it("retorna null quando cache está frio e os dados quando válido no TTL", () => {
      expect(getCachedErpCatalogIfWarm()).toBeNull();

      setErpCacheForTesting([SAMPLE_ERP_PRODUCT], Date.now());
      const warm = getCachedErpCatalogIfWarm();
      expect(warm).not.toBeNull();
      expect(warm?.status).toBe("ok");
      expect(warm?.products).toHaveLength(1);
    });

    it("retorna null se o cache expirou além do TTL (nunca serve estoque vencido)", () => {
      setErpCacheForTesting([SAMPLE_ERP_PRODUCT], Date.now() - 60_000);
      expect(getCachedErpCatalogIfWarm()).toBeNull();
    });
  });

  describe("Headers Edge-Ready nas queries públicas /api/trpc/shop.*", () => {
    it("envia Cache-Control com s-maxage e stale-while-revalidate para queries públicas GET", async () => {
      setErpCacheForTesting([SAMPLE_ERP_PRODUCT], Date.now());
      const { default: app } = await import("./boot");

      const expectedCaches: Record<string, string[]> = {
        "/api/trpc/shop.catalogStatus": ["public", "s-maxage=", "stale-while-revalidate="],
        "/api/trpc/shop.products": ["public", "s-maxage=", "stale-while-revalidate="],
        "/api/trpc/shop.featured": ["public", "s-maxage=", "stale-while-revalidate="],
        "/api/trpc/shop.settings": ["public", "s-maxage=", "stale-while-revalidate="],
        "/api/trpc/shop.socialProof": ["public", "s-maxage=", "stale-while-revalidate="],
        "/api/trpc/shop.tradeInOptions": ["public", "s-maxage=", "stale-while-revalidate="],
      };

      for (const [url, tokens] of Object.entries(expectedCaches)) {
        const res = await app.request(`https://lojinhadocelular.com${url}`);
        expect(res.status, `${url} status`).toBe(200);
        const cc = res.headers.get("cache-control") ?? "";
        for (const token of tokens) {
          expect(cc, `${url} Cache-Control (${cc})`).toContain(token);
        }
      }
    });

    it("mantém tradeInQuote e mutações fora de cache público (no-store)", async () => {
      const { default: app } = await import("./boot");

      const input = encodeURIComponent(JSON.stringify({ json: { model: "iPhone 15" } }));
      const quoteRes = await app.request(
        `https://lojinhadocelular.com/api/trpc/shop.tradeInQuote?input=${input}`,
      );
      expect(quoteRes.status).toBe(200);
      expect(quoteRes.headers.get("cache-control") ?? "").toContain("no-store");

      const viewRes = await app.request("https://lojinhadocelular.com/api/trpc/shop.trackView", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { path: "/", site: "loja" } }),
      });
      expect(viewRes.status).toBe(200);
      expect(viewRes.headers.get("cache-control") ?? "").toContain("no-store");
    });
  });

  describe("Servimento assíncrono de estáticos, ETag/304 e Cache-Control", () => {
    it("retorna ETag e 304 Not Modified para /images/iphones/*.webp sem rebaixar max-age=604800", async () => {
      const { default: app } = await import("./boot");

      const first = await app.request(
        "https://lojinhadocelular.com/images/iphones/iphone-17-pro-max-silver.webp",
      );
      expect(first.status).toBe(200);
      const etag = first.headers.get("etag");
      expect(etag).toBeTruthy();
      expect(first.headers.get("cache-control")).toContain("max-age=604800");
      expect(first.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
      expect(first.headers.get("access-control-allow-origin")).toBe("*");

      const cached = await app.request(
        "https://lojinhadocelular.com/images/iphones/iphone-17-pro-max-silver.webp",
        { headers: { "if-none-match": etag! } },
      );
      expect(cached.status).toBe(304);
    });

    it("retorna ETag e 304 Not Modified para /images/og-preview.jpg e /hero-poster.jpg", async () => {
      const { default: app } = await import("./boot");

      for (const route of ["/images/og-preview.jpg", "/hero-poster.jpg"]) {
        const res = await app.request(`https://lojinhadocelular.com${route}`);
        expect(res.status, route).toBe(200);
        const etag = res.headers.get("etag");
        expect(etag, `${route} ETag`).toBeTruthy();

        const revalidated = await app.request(`https://lojinhadocelular.com${route}`, {
          headers: { "if-none-match": etag! },
        });
        expect(revalidated.status, `${route} 304`).toBe(304);
      }
    });

    it("serve /fonts/inter-latin.woff2 com Cache-Control immutable e ETag/304", async () => {
      const { default: app } = await import("./boot");

      const res = await app.request("https://lojinhadocelular.com/fonts/inter-latin.woff2");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("font/woff2");
      expect(res.headers.get("cache-control")).toContain("max-age=31536000");
      expect(res.headers.get("cache-control")).toContain("immutable");
      const etag = res.headers.get("etag");
      expect(etag).toBeTruthy();

      const revalidated = await app.request(
        "https://lojinhadocelular.com/fonts/inter-latin.woff2",
        { headers: { "if-none-match": etag! } },
      );
      expect(revalidated.status).toBe(304);
    });
  });

  describe("HTML cache-control (bfcache) e hidratação XSS-safe (__INITIAL_DATA__)", () => {
    it("remove no-store do HTML público para liberar bfcache e mantém no-store em /admin", async () => {
      const { Hono } = await import("hono");
      const { serveStaticFiles } = await import("./lib/vite");
      const app = new Hono();
      serveStaticFiles(app as unknown as Parameters<typeof serveStaticFiles>[0]);

      const homeRes = await app.request("https://lojinhadocelular.com/", {
        headers: { accept: "text/html", host: "lojinhadocelular.com" },
      });
      expect(homeRes.status).toBe(200);
      const homeCc = homeRes.headers.get("cache-control") ?? "";
      expect(homeCc).toContain("must-revalidate");
      expect(homeCc).not.toContain("no-store");
      expect(homeRes.headers.get("pragma")).toBeNull();

      const adminRes = await app.request("https://lojinhadocelular.com/admin/produtos", {
        headers: { accept: "text/html", host: "lojinhadocelular.com" },
      });
      expect(adminRes.status).toBe(200);
      const adminCc = adminRes.headers.get("cache-control") ?? "";
      expect(adminCc).toContain("no-store");
      const adminHtml = await adminRes.text();
      expect(adminHtml).not.toContain("__INITIAL_DATA__");
    });

    it("injeta __INITIAL_DATA__ seguro contra XSS na Home e em /produto/:id sem vazar notes", async () => {
      const xssProduct: ShopProduct = {
        ...SAMPLE_ERP_PRODUCT,
        id: "50e70d25-bc76-4b76-a76b-6cc3918e830e",
        externalId: "50e70d25-bc76-4b76-a76b-6cc3918e830e",
        name: 'IPHONE 17 PRO </script><script>alert("xss")</script>',
      };
      setErpCacheForTesting([xssProduct], Date.now());

      const { Hono } = await import("hono");
      const { serveStaticFiles } = await import("./lib/vite");
      const app = new Hono();
      serveStaticFiles(app as unknown as Parameters<typeof serveStaticFiles>[0]);

      const homeRes = await app.request("https://lojinhadocelular.com/", {
        headers: { accept: "text/html", host: "lojinhadocelular.com" },
      });
      const homeHtml = await homeRes.text();
      expect(homeHtml).toContain('id="__INITIAL_DATA__"');
      expect(homeHtml).not.toContain('</script><script>alert("xss")</script>');
      expect(homeHtml).not.toContain("NOTA INTERNA CONFIDENCIAL");

      const prodRes = await app.request(
        "https://lojinhadocelular.com/produto/iphone-17-pro-50e70d25",
        { headers: { accept: "text/html", host: "lojinhadocelular.com" } },
      );
      expect(prodRes.status).toBe(200);
      const prodHtml = await prodRes.text();
      expect(prodHtml).toContain('id="__INITIAL_DATA__"');
      expect(prodHtml).toContain("50e70d25-bc76-4b76-a76b-6cc3918e830e");
      expect(prodHtml).not.toContain("NOTA INTERNA CONFIDENCIAL");

      const trocafacilRes = await app.request("https://trocafacil.lojinhadocelular.com/", {
        headers: { accept: "text/html", host: "trocafacil.lojinhadocelular.com" },
      });
      const trocafacilHtml = await trocafacilRes.text();
      expect(trocafacilHtml).toContain('id="__INITIAL_DATA__"');
      expect(trocafacilHtml).not.toContain("50e70d25-bc76-4b76-a76b-6cc3918e830e");
    });

    it("parseia __INITIAL_DATA__ com superjson preservando Date e ignorando payloads inválidos", async () => {
      const superjson = (await import("superjson")).default;
      const { parseInitialDataPayload } = await import("../src/lib/initialData");

      const encoded = superjson
        .stringify({
          settings: { whatsapp_jardim: "67999999999" },
          products: [SAMPLE_ERP_PRODUCT],
          product: { id: "iphone-17-pro-max-prod-17-pm", data: SAMPLE_ERP_PRODUCT },
        })
        .replace(/</g, "\\u003c");

      const parsed = parseInitialDataPayload(encoded);
      expect(parsed?.settings?.whatsapp_jardim).toBe("67999999999");
      expect(parsed?.products?.[0]?.createdAt).toBeInstanceOf(Date);
      expect(parsed?.product?.id).toBe("iphone-17-pro-max-prod-17-pm");

      expect(parseInitialDataPayload(null)).toBeNull();
      expect(parseInitialDataPayload("{not-valid-json")).toBeNull();
    });
  });

  describe("Otimização de imagens locais e srcSet responsivo (-360w.webp / R2)", () => {
    it("gera variante -360w.webp e srcSet real para imagens locais /images/iphones/*.webp", async () => {
      const { optimizeImageUrl, getImageSrcSet } = await import(
        "../src/lib/imageOptimization"
      );

      const url = "/images/iphones/iphone-17-pro-max-silver.webp";
      expect(optimizeImageUrl(url, 360)).toBe(
        "/images/iphones/iphone-17-pro-max-silver-360w.webp",
      );
      expect(optimizeImageUrl(url, 640)).toBe(url);
      expect(optimizeImageUrl("/images/iphones/iphone-17-pro-max-silver-360w.webp", 640)).toBe(url);
      expect(getImageSrcSet(url)).toBe(
        "/images/iphones/iphone-17-pro-max-silver-360w.webp 360w, /images/iphones/iphone-17-pro-max-silver.webp 612w",
      );
    });

    it("usa variantes -360w.webp direto no R2 sem passar pelo proxy wsrv.nl e preserva externos", async () => {
      const { optimizeImageUrl, getImageSrcSet } = await import(
        "../src/lib/imageOptimization"
      );

      const r2Url = "https://cdn.lojinhadocelular.com/images/iphones/iphone-16-black.webp";
      expect(optimizeImageUrl(r2Url, 360)).toBe(
        "https://cdn.lojinhadocelular.com/images/iphones/iphone-16-black-360w.webp",
      );
      expect(optimizeImageUrl(r2Url, 640)).toBe(r2Url);
      expect(getImageSrcSet(r2Url)).toBe(
        "https://cdn.lojinhadocelular.com/images/iphones/iphone-16-black-360w.webp 360w, https://cdn.lojinhadocelular.com/images/iphones/iphone-16-black.webp 612w",
      );

      expect(optimizeImageUrl("/images/logo.png", 360)).toBe("/images/logo.png");
      expect(getImageSrcSet("/images/logo.png")).toBeUndefined();
      expect(optimizeImageUrl("https://gestaocelular.com.br/media/a.jpg", 360)).toBe(
        "https://gestaocelular.com.br/media/a.jpg",
      );
      expect(optimizeImageUrl("https://images.unsplash.com/photo-123", 360)).toContain(
        "https://wsrv.nl/?url=",
      );
    });
  });
});
