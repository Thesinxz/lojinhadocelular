import { describe, expect, it } from "vitest";
import { brazilPhoneInputDigits, normalizeBrazilPhone } from "@contracts/brDocs";

describe("brazilPhoneInputDigits (digitação do WhatsApp)", () => {
  it("mantém os 11 dígitos digitados, sem deslocar nenhum", () => {
    expect(brazilPhoneInputDigits("67993024221")).toBe("67993024221");
  });

  it("não insere o 9º dígito em um número de 10 dígitos durante a digitação/apagamento", () => {
    // 67 + 99302422 (8 dígitos): ao apagar o último dígito de 67993024221 o campo precisa ficar assim.
    expect(brazilPhoneInputDigits("(67) 9930-2422")).toBe("6799302422");
  });

  it("apagar dígito a dígito volta pelos mesmos números", () => {
    let digits = "67993024221";
    const seen: string[] = [];
    while (digits.length > 0) {
      digits = brazilPhoneInputDigits(digits.slice(0, -1));
      seen.push(digits);
    }
    expect(seen[0]).toBe("6799302422");
    expect(seen[1]).toBe("679930242");
    expect(seen.at(-1)).toBe("");
  });

  it("remove o +55 colado junto", () => {
    expect(brazilPhoneInputDigits("+55 (67) 99302-4221")).toBe("67993024221");
  });
});

describe("normalizeBrazilPhone (envio)", () => {
  it("completa o 9º dígito de celular no formato antigo", () => {
    expect(normalizeBrazilPhone("(67) 9930-2422")).toBe("5567999302422");
  });

  it("aceita o número completo", () => {
    expect(normalizeBrazilPhone("(67) 99302-4221")).toBe("5567993024221");
  });
});
