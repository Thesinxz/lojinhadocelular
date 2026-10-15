import { beforeEach, describe, expect, it } from "vitest";
import {
  allowPageView,
  classifySource,
  computeTraffic,
  deviceFromUserAgent,
  getTrafficOverview,
  isBotUserAgent,
  normalizeViewPath,
  recordPageView,
  resetPageViewsForTesting,
  visitorHash,
  type PageViewRow,
} from "./services/pageViews";

const NOW = new Date("2026-10-14T15:00:00Z");
const row = (over: Partial<PageViewRow> = {}): PageViewRow => ({
  day: "2026-10-14",
  visitor: "a",
  path: "/",
  site: "loja",
  device: "mobile",
  source: "",
  ...over,
});

beforeEach(() => resetPageViewsForTesting());

describe("page views", () => {
  it("detecta robôs e aparelhos", () => {
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari")).toBe(false);
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone) Mobile Safari")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Macintosh) Chrome")).toBe("desktop");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPad)")).toBe("tablet");
  });

  it("normaliza o caminho sem consulta", () => {
    expect(normalizeViewPath("/Produto/12/?utm=x#a")).toBe("/produto/12");
    expect(normalizeViewPath("")).toBe("/");
  });

  it("classifica a origem", () => {
    expect(classifySource("https://l.instagram.com/", "", "lojinhadocelular.com")).toBe("instagram");
    expect(classifySource("", "ig", "lojinhadocelular.com")).toBe("instagram");
    expect(classifySource("https://www.google.com/", "", "lojinhadocelular.com")).toBe("google");
    expect(classifySource("https://trocafacil.lojinhadocelular.com/", "", "lojinhadocelular.com")).toBe("direto");
    expect(classifySource("https://blog.exemplo.com/", "", "lojinhadocelular.com")).toBe("outros");
    expect(classifySource("", "", "lojinhadocelular.com")).toBe("direto");
  });

  it("o hash do visitante muda por dia e não expõe o IP", () => {
    const a = visitorHash("1.2.3.4", "ua", "2026-10-14");
    expect(a).toBe(visitorHash("1.2.3.4", "ua", "2026-10-14"));
    expect(a).not.toBe(visitorHash("1.2.3.4", "ua", "2026-10-15"));
    expect(a).not.toContain("1.2.3.4");
  });

  it("limita visualizações por IP", () => {
    let ok = 0;
    for (let i = 0; i < 130; i++) if (allowPageView("ip", 1000)) ok++;
    expect(ok).toBe(120);
  });

  it("agrega visitantes únicos e páginas vistas por dia", () => {
    const rows = [
      row(),
      row({ path: "/produto/1" }),
      row({ visitor: "b", source: "instagram", device: "desktop", site: "trocafacil" }),
      row({ day: "2026-10-13", visitor: "a", source: "google" }),
    ];
    const t = computeTraffic(rows, 7, NOW);
    expect(t.totals).toEqual({ views: 4, visitors: 3, visitsToday: 3, visitorsToday: 2 });
    expect(t.daily).toHaveLength(7);
    expect(t.topPages[0]).toEqual({ path: "/", views: 3 });
    expect(t.sources.map((s) => s.source).sort()).toEqual(["google", "instagram"]);
    expect(t.sites.find((s) => s.site === "trocafacil")?.views).toBe(1);
  });

  it("grava e lê em memória, ignorando dias fora do período", async () => {
    await recordPageView(row());
    await recordPageView(row({ day: "2026-01-01" }));
    const t = await getTrafficOverview(7, NOW);
    expect(t.totals.views).toBe(1);
  });
});
