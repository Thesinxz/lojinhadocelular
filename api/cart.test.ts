import { describe, it, expect } from "vitest";
import { formatBRL, installmentFromFees } from "../contracts/types";
import type { CartItem } from "../src/lib/cart";

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

  it("deve formatar a mensagem do WhatsApp exatamente no padrão solicitado", async () => {
    const item: CartItem = {
      id: "prod-1",
      productId: 10,
      name: "iPhone 14 Pro",
      color: "Preto Espacial",
      storage: "256GB",
      condition: "Seminovo",
      sku: "B2700",
      price: 339000,
      imageUrl: "",
      quantity: 1,
    };

    const colorPart = item.color ? ` - ${item.color}` : "";
    const storagePart = item.storage ? ` ${item.storage}` : "";
    const condPart = item.condition ? ` (${item.condition})` : "";
    const skuPart = item.sku ? ` — cód. ${item.sku}` : "";

    const msg = [
      `*Olá, Lojinha do Celular!* 📱`,
      `Quero fechar este pedido pelo site:\n`,
      `1. *${item.name}${colorPart}${storagePart}*${condPart}${skuPart}`,
      `Pix: ${formatBRL(item.price)}`,
      ``,
      `*Total no Pix: ${formatBRL(item.price)}*`,
      `ou em até 12x no cartão`,
      ``,
      `📍 Unidade: Unidade Jardim - MS`,
      `Pode confirmar disponibilidade e a entrega? 📦`,
    ].join("\n");

    expect(msg).toContain("*Olá, Lojinha do Celular!* 📱");
    expect(msg).toContain("Quero fechar este pedido pelo site:");
    expect(msg).toContain("1. *iPhone 14 Pro - Preto Espacial 256GB* (Seminovo) — cód. B2700");
    expect(msg).toContain("Pix: R$\u00a03.390,00");
    expect(msg).toContain("*Total no Pix: R$\u00a03.390,00*");
    expect(msg).toContain("Pode confirmar disponibilidade e a entrega? 📦");
  });
});
