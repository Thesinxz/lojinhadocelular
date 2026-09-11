import { describe, it, expect, beforeEach } from "vitest";
import { isSafeHttpUrl, getVideoEmbed } from "../src/lib/videoEmbed";
import app, { isAllowedOrigin } from "./boot";
import { isSafeOverrideKey, saveErpOverride } from "./erp/overrides";
import {
  sanitizePublicProduct,
  sanitizePublicProducts,
  checkEvaluationRateLimit,
  resetEvaluationRateLimitForTesting,
} from "./shop";

describe("Segurança de Embeds e Prevenção de XSS", () => {
  it("deve rejeitar URLs com protocolos executáveis perigosos (javascript:, data:, vbscript:)", () => {
    expect(isSafeHttpUrl("javascript:alert(document.cookie)")).toBe(false);
    expect(isSafeHttpUrl("javascript:window.location='https://attacker.com'")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("not-a-url")).toBe(false);
  });

  it("deve aceitar URLs com protocolo http ou https", () => {
    expect(isSafeHttpUrl("https://youtube.com/watch?v=12345678901")).toBe(true);
    expect(isSafeHttpUrl("http://example.com/video.mp4")).toBe(true);
  });

  it("getVideoEmbed deve retornar null para URLs maliciosas", () => {
    expect(getVideoEmbed("javascript:alert('xss')")).toBeNull();
    expect(getVideoEmbed("data:text/html;base64,...")).toBeNull();
    expect(getVideoEmbed("")).toBeNull();
  });

  it("getVideoEmbed deve processar links válidos do YouTube e arquivos de vídeo", () => {
    const yt = getVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(yt).not.toBeNull();
    expect(yt?.type).toBe("youtube");
    expect(yt?.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");

    const direct = getVideoEmbed("https://example.com/meuvideo.mp4");
    expect(direct).not.toBeNull();
    expect(direct?.type).toBe("video");
    expect(direct?.src).toBe("https://example.com/meuvideo.mp4");
  });
});

describe("Segurança de CORS e Origens Permitidas", () => {
  it("deve autorizar o domínio principal e subdomínios da loja", () => {
    expect(isAllowedOrigin("https://lojinhadocelular.com")).toBe(true);
    expect(isAllowedOrigin("https://trocafacil.lojinhadocelular.com")).toBe(true);
    expect(isAllowedOrigin("https://admin.lojinhadocelular.com")).toBe(true);
  });

  it("deve rejeitar origens não autorizadas ou ataques de typosquatting", () => {
    expect(isAllowedOrigin("https://attacker-lojinhadocelular.com")).toBe(false);
    expect(isAllowedOrigin("https://lojinhadocelular.com.evil.com")).toBe(false);
    expect(isAllowedOrigin("https://fake-bank.com")).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });

  it("deve permitir localhost em desenvolvimento", () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "development";
      expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
      expect(isAllowedOrigin("http://127.0.0.1:3000")).toBe(true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe("Proteção contra Prototype Pollution em Overrides do ERP", () => {
  it("deve identificar e rejeitar chaves de objeto perigosas", () => {
    expect(isSafeOverrideKey("__proto__")).toBe(false);
    expect(isSafeOverrideKey("constructor")).toBe(false);
    expect(isSafeOverrideKey("prototype")).toBe(false);
    expect(isSafeOverrideKey("")).toBe(false);
  });

  it("deve aceitar externalIds legítimos", () => {
    expect(isSafeOverrideKey("iphone-15-pro-max-256gb")).toBe(true);
    expect(isSafeOverrideKey("12345")).toBe(true);
  });

  it("saveErpOverride deve lançar exceção se chamado com chave perigosa", async () => {
    await expect(saveErpOverride("__proto__", { customName: "Hack" })).rejects.toThrow(
      /Chave de override inválida ou reservada/i,
    );
    await expect(saveErpOverride("constructor", { customName: "Hack" })).rejects.toThrow(
      /Chave de override inválida ou reservada/i,
    );
  });
});

describe("Isolamento de Dados: Ocultação de Notas Internas de Estoque", () => {
  it("sanitizePublicProduct deve remover o campo notes das variantes públicas", () => {
    const rawProduct = {
      id: 1,
      name: "iPhone 15 Pro",
      variants: [
        {
          id: 10,
          priceCash: 450000,
          color: "Titânio Natural",
          notes: "CUSTO: R$ 3.800, cliente trocou a tela com garantia de 30 dias",
          available: true,
        },
      ],
    };

    const sanitized = sanitizePublicProduct(rawProduct);
    expect(sanitized.variants[0].notes).toBeUndefined();
    expect(sanitized.variants[0].priceCash).toBe(450000);
    expect(sanitized.variants[0].color).toBe("Titânio Natural");
    expect("notes" in sanitized.variants[0]).toBe(false);
  });

  it("sanitizePublicProducts deve processar uma lista inteira de produtos", () => {
    const list = [
      {
        id: 1,
        name: "Aparelho 1",
        variants: [{ id: 11, notes: "Nota secreta 1", priceCash: 100 }],
      },
      {
        id: 2,
        name: "Aparelho 2",
        variants: [{ id: 12, notes: "Nota secreta 2", priceCash: 200 }],
      },
    ];

    const cleaned = sanitizePublicProducts(list);
    expect(cleaned[0].variants[0].notes).toBeUndefined();
    expect(cleaned[1].variants[0].notes).toBeUndefined();
  });
});

describe("Proteção contra Flood / Rate Limiting em Avaliações", () => {
  beforeEach(() => {
    resetEvaluationRateLimitForTesting();
  });

  it("deve permitir até 5 envios de proposta e bloquear a partir do 6º", () => {
    const fakeReq = new Request("https://lojinhadocelular.com/api/trpc/shop.submitEvaluation", {
      headers: { "x-forwarded-for": "203.0.113.195" },
    });

    // 5 envios devem ser aceitos
    for (let i = 0; i < 5; i++) {
      expect(checkEvaluationRateLimit(fakeReq)).toBe(true);
    }

    // 6º envio deve ser bloqueado
    expect(checkEvaluationRateLimit(fakeReq)).toBe(false);
  });

  it("IPs diferentes não devem bloquear um ao outro", () => {
    const ip1 = new Request("https://lojinhadocelular.com", {
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    const ip2 = new Request("https://lojinhadocelular.com", {
      headers: { "x-forwarded-for": "198.51.100.2" },
    });

    for (let i = 0; i < 5; i++) {
      expect(checkEvaluationRateLimit(ip1)).toBe(true);
    }
    expect(checkEvaluationRateLimit(ip1)).toBe(false);

    // ip2 ainda deve poder enviar
    expect(checkEvaluationRateLimit(ip2)).toBe(true);
  });
});

describe("Headers de Segurança e Compartilhamento de Mídia (WhatsApp / Redes Sociais)", () => {
  it("deve incluir Cross-Origin-Resource-Policy: cross-origin na resposta de imagens", async () => {
    const res = await app.request("/images/og-banner.png");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
