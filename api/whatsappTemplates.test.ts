import { describe, it, expect } from "vitest";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  buildTemplateVars,
  buildWhatsappLink,
  parseTemplates,
  renderTemplate,
} from "@/lib/whatsappTemplates";

describe("renderTemplate", () => {
  it("substitui placeholders conhecidos", () => {
    expect(
      renderTemplate("Olá {nome}! Seu {modelo} na {loja}: {valor_oferecido}", {
        nome: "Maria",
        modelo: "iPhone 13",
        loja: "Jardim",
        valor_oferecido: "R$ 1.500,00",
      }),
    ).toBe("Olá Maria! Seu iPhone 13 na Jardim: R$ 1.500,00");
  });

  it("placeholders sem valor viram string vazia; desconhecidos ficam como estão", () => {
    expect(renderTemplate("A {vendedor}B {endereco}C {outro}", {})).toBe("A B C {outro}");
  });

  it("repete o mesmo placeholder", () => {
    expect(renderTemplate("{nome} {nome}", { nome: "Zé" })).toBe("Zé Zé");
  });
});

describe("parseTemplates", () => {
  it("usa os padrões quando vazio ou inválido", () => {
    expect(parseTemplates(undefined)).toEqual(DEFAULT_WHATSAPP_TEMPLATES);
    expect(parseTemplates("")).toEqual(DEFAULT_WHATSAPP_TEMPLATES);
    expect(parseTemplates("{nao é json")).toEqual(DEFAULT_WHATSAPP_TEMPLATES);
    expect(parseTemplates("[]")).toEqual(DEFAULT_WHATSAPP_TEMPLATES);
    expect(parseTemplates('{"a":1}')).toEqual(DEFAULT_WHATSAPP_TEMPLATES);
  });

  it("aceita lista válida e descarta itens quebrados", () => {
    const raw = JSON.stringify([
      { id: "a", label: "Oi", body: "Olá {nome}" },
      { id: "b", label: "", body: "sem rótulo" },
      { label: "Sem id", body: "Texto" },
      "lixo",
    ]);
    const parsed = parseTemplates(raw);
    expect(parsed).toEqual([
      { id: "a", label: "Oi", body: "Olá {nome}" },
      { id: "tpl-3", label: "Sem id", body: "Texto" },
    ]);
  });

  it("os padrões têm os 4 modelos da especificação", () => {
    expect(DEFAULT_WHATSAPP_TEMPLATES.map((t) => t.label)).toEqual([
      "Recebemos sua avaliação",
      "Proposta",
      "Convite para a loja",
      "Pedir mais fotos",
    ]);
  });
});

describe("buildWhatsappLink", () => {
  it("normaliza para 55 + dígitos e codifica o texto", () => {
    expect(buildWhatsappLink("(67) 99208-6012", "Olá Maria & cia")).toBe(
      "https://wa.me/5567992086012?text=Ol%C3%A1%20Maria%20%26%20cia",
    );
    expect(buildWhatsappLink("5567992086012", "x")).toBe("https://wa.me/5567992086012?text=x");
    expect(buildWhatsappLink("+55 67 99208-6012", "")).toBe("https://wa.me/5567992086012");
  });
});

describe("buildTemplateVars", () => {
  it("monta loja, endereço e valor oferecido formatado", () => {
    const vars = buildTemplateVars({
      evaluation: { name: "Maria Souza", model: "iPhone 13", storage: "128GB", unit: "gll", offeredValue: 150000 },
      sellerName: "Ana",
      addresses: { jardim: "Rua A", gll: "Rua B" },
    });
    expect(vars).toEqual({
      nome: "Maria",
      modelo: "iPhone 13 128GB",
      loja: "Guia Lopes da Laguna",
      endereco: "Rua B",
      vendedor: "Ana",
      valor_oferecido: "R$ 1.500,00",
    });
  });

  it("sem unidade/valor → vazio", () => {
    const vars = buildTemplateVars({
      evaluation: { name: "João", model: "iPhone 11", storage: "", unit: "", offeredValue: null },
      sellerName: "",
      addresses: { jardim: "Rua A", gll: "Rua B" },
    });
    expect(vars.loja).toBe("");
    expect(vars.endereco).toBe("");
    expect(vars.valor_oferecido).toBe("");
  });
});
