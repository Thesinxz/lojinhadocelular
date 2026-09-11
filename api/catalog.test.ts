import { describe, it, expect } from "vitest";
import { DEMO_CLIENTS, DEMO_PRODUCTS } from "../src/lib/catalogDemo";

describe("Catalog Demo Data", () => {
  it("deve carregar a lista de clientes para a prova social", () => {
    expect(DEMO_CLIENTS.length).toBeGreaterThanOrEqual(3);
    DEMO_CLIENTS.forEach((c) => {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.bought).toBeTruthy();
      expect(c.avatarUrl).toBeTruthy();
    });
  });

  it("deve conter produtos de demonstracao validos com variantes de preco e estoque", () => {
    expect(DEMO_PRODUCTS.length).toBeGreaterThanOrEqual(3);
    DEMO_PRODUCTS.forEach((p) => {
      expect(p.id).toBeGreaterThan(0);
      expect(p.name).toBeTruthy();
      expect(p.brand).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.variants.length).toBeGreaterThan(0);
      p.variants.forEach((v) => {
        expect(v.priceCash).toBeGreaterThan(0);
        expect(v.storage).toBeTruthy();
        expect(v.color).toBeTruthy();
      });
    });
  });

  it("deve carregar a base completa de iPhones com especificações oficiais", async () => {
    const { IPHONE_CATALOG, detectIphoneModel, getIphoneModelColorImage } = await import(
      "../src/lib/iphoneCatalog"
    );
    expect(IPHONE_CATALOG.length).toBeGreaterThanOrEqual(45);

    // Teste de detecção de modelos recentes
    const m17 = detectIphoneModel("iPhone 17 Pro Max");
    expect(m17).toBeTruthy();
    expect(m17?.year).toBe(2025);
    expect(m17?.screen).toBe('6.9"');
    expect(m17?.capacities).toContain("256GB");

    // Teste de resolução de imagem por cor (WebP otimizado)
    const imgOrange = getIphoneModelColorImage(m17, "Cosmic Orange");
    expect(imgOrange).toContain("iphone-17-pro-max-cosmic-orange.webp");

    // Teste de detecção flexível (sem 'iPhone' ou case insensitive)
    const m16 = detectIphoneModel("16 pro");
    expect(m16?.name).toBe("iPhone 16 Pro");
    expect(m16?.year).toBe(2024);

    const mAir = detectIphoneModel("iPhone Air");
    expect(mAir?.name).toBe("iPhone Air");
    expect(mAir?.screen).toBe('6.5"');
  });

  it("deve processar links de vídeo para players responsivos (YouTube e MP4 direto)", async () => {
    const { getVideoEmbed } = await import("../src/lib/videoEmbed");
    
    // Link completo do YouTube
    const yt1 = getVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(yt1).toEqual({
      type: "youtube",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });

    // Link encurtado youtu.be
    const yt2 = getVideoEmbed("https://youtu.be/dQw4w9WgXcQ");
    expect(yt2).toEqual({
      type: "youtube",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });

    // Arquivo de vídeo direto MP4
    const mp4 = getVideoEmbed("https://meusite.com/videos/aparelho.mp4");
    expect(mp4).toEqual({
      type: "video",
      src: "https://meusite.com/videos/aparelho.mp4",
    });

    // Vazio retorna nulo
    expect(getVideoEmbed("")).toBeNull();
    expect(getVideoEmbed("   ")).toBeNull();
  });
});

