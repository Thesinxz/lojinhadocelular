import { describe, it, expect } from "vitest";
import { formatBRL, installmentFromFees } from "../contracts/types";
import {
  formatCommercialProductName,
  formatCommercialSku,
  formatUnitName,
  type CartItem,
} from "../src/lib/commercialFormatting";

describe("Sacola de Compras e Formatação de Mensagem de Checkout WhatsApp", () => {
  it("deve calcular corretamente o total no Pix e parcelamento em 12x", () => {
    const items: CartItem[] = [
      {
        id: "1",
        productId: 10,
        name: "iPhone 14 Pro",
        color: "Preto Espacial",
        storage: "256GB",
        condition: "Seminovo",
        sku: "B2700",
        price: 339000, // R$ 3.390,00
        imageUrl: "/images/iphones/14pro.png",
        quantity: 1,
      },
    ];

    const totalPix = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    expect(totalPix).toBe(339000);
    expect(formatBRL(totalPix)).toBe("R$\u00a03.390,00");

    const fee12 = 14.09;
    const installment12 = installmentFromFees(totalPix, 12, fee12);
    expect(installment12).toBeGreaterThan(0);
    expect(installment12 * 12).toBeGreaterThan(totalPix); // Com taxas da maquininha
  });

  it("deve limpar e formatar nomes comerciais do ERP sem duplicar cor e capacidade", () => {
    // Exemplo real fornecido pelo usuário:
    const rawName = "CEL IPHONE 17 PRO MAX SILVER 256GB";
    const formatted = formatCommercialProductName(rawName, "Silver", "256GB");
    expect(formatted).toBe("iPhone 17 Pro Max - Silver 256GB");
    expect(formatted).not.toContain("CEL");
    expect(formatted).not.toContain("SILVER 256GB - SILVER 256GB");

    // Outros casos comuns do ERP:
    const formatted2 = formatCommercialProductName(
      "Aparelho 14 PRO MAX 128 - ROXO (A) - Seminovo",
      "Roxo",
      "128GB",
    );
    expect(formatted2).toBe("iPhone 14 Pro Max - Roxo 128GB");

    const formatted3 = formatCommercialProductName("iPhone 13", "Estelar", "128GB");
    expect(formatted3).toBe("iPhone 13 - Estelar 128GB");
  });

  it("deve formatar códigos de SKU internos do ERP em códigos comerciais limpos", () => {
    // Código do ERP vindo de UUID ou prefixo ERP-
    expect(formatCommercialSku("ERP-50E70D25")).toBe("B50E7");
    expect(formatCommercialSku("50e70d25-9a4b-4c28-9842-1234567890ab")).toBe("B50E7");

    // Código comercial já formatado
    expect(formatCommercialSku("B2700")).toBe("B2700");
    expect(formatCommercialSku("2700")).toBe("B2700");
    expect(formatCommercialSku(null)).toBe("B1000");
  });

  it("deve normalizar o nome da unidade sem duplicar 'Unidade'", () => {
    expect(formatUnitName("Unidade Jardim - MS")).toBe("Jardim - MS");
    expect(formatUnitName("Unidade Guia Lopes da Laguna")).toBe("Guia Lopes da Laguna");
    expect(formatUnitName("Jardim - MS")).toBe("Jardim - MS");
  });

  it("deve formatar a mensagem do WhatsApp no padrão refinado para produtos do ERP", () => {
    const rawName = "CEL IPHONE 17 PRO MAX SILVER 256GB";
    const color = "Silver";
    const storage = "256GB";
    const condition = "Lacrado";
    const rawSku = "ERP-50E70D25";
    const priceCash = 721900;
    const unitRaw = "Unidade Jardim - MS";

    const cleanTitle = formatCommercialProductName(rawName, color, storage);
    const cleanSku = formatCommercialSku(rawSku);
    const cleanUnit = formatUnitName(unitRaw);

    const msg = [
      `*Olá, Lojinha do Celular!* 📱`,
      `Quero fechar este pedido pelo site:\n`,
      `1. *${cleanTitle}* (${condition}) — cód. ${cleanSku}`,
      `Pix: ${formatBRL(priceCash)}`,
      ``,
      `*Total no Pix: ${formatBRL(priceCash)}*`,
      `ou até 12x de R$ 700,25 no cartão`,
      ``,
      `📍 Unidade: ${cleanUnit}`,
      `Pode confirmar disponibilidade e a entrega? 📦`,
    ].join("\n");

    expect(msg).toContain("1. *iPhone 17 Pro Max - Silver 256GB* (Lacrado) — cód. B50E7");
    expect(msg).toContain("📍 Unidade: Jardim - MS");
    expect(msg).not.toContain("CEL IPHONE");
    expect(msg).not.toContain("SILVER 256GB - SILVER 256GB");
    expect(msg).not.toContain("ERP-50E70D25");
    expect(msg).not.toContain("Unidade: Unidade");
  });
});
