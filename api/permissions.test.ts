import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { can, STORE_UNITS, type Capability, type SessionUser } from "@contracts/permissions";
import {
  assertCan,
  checkProductUpdate,
  checkErpOverrideUpdate,
  type ProductLike,
} from "./permissions";

const dono: SessionUser = {
  id: 1,
  username: "dono",
  name: "Dono",
  role: "dono",
  unit: null,
  canEditPrices: false,
};

const vendedor: SessionUser = {
  id: 2,
  username: "ana",
  name: "Ana",
  role: "vendedor",
  unit: "jardim",
  canEditPrices: false,
};

const vendedorComPreco: SessionUser = { ...vendedor, id: 3, canEditPrices: true };

const ALL_CAPS: Capability[] = [
  "evaluations.manage",
  "products.editMedia",
  "products.editPrice",
  "products.manage",
  "settings.manage",
  "users.manage",
  "reports.team",
];

function baseProduct(): ProductLike {
  return {
    name: "iPhone 15 Pro",
    brand: "Apple",
    category: "iphone_seminovo",
    condition: "seminovo",
    warranty: "3 meses",
    description: "Ótimo estado",
    featured: false,
    active: true,
    imageUrl: "",
    videoUrl: undefined,
    variants: [
      {
        id: 10,
        version: "15 Pro",
        storage: "128GB",
        color: "Preto",
        colorHex: "#111111",
        sku: "ABC",
        warranty: "",
        condition: "",
        priceCash: 320000,
        imageUrl: null as unknown as string,
        videoUrl: "",
        batteryHealth: "90%",
        notes: "",
        quantity: 1,
        available: true,
      },
    ],
  };
}

describe("can()", () => {
  it("dono pode tudo", () => {
    for (const cap of ALL_CAPS) expect(can(dono, cap)).toBe(true);
  });

  it("vendedor gerencia avaliações e mídia, mas não administra", () => {
    expect(can(vendedor, "evaluations.manage")).toBe(true);
    expect(can(vendedor, "products.editMedia")).toBe(true);
    expect(can(vendedor, "products.editPrice")).toBe(false);
    expect(can(vendedor, "products.manage")).toBe(false);
    expect(can(vendedor, "settings.manage")).toBe(false);
    expect(can(vendedor, "users.manage")).toBe(false);
    expect(can(vendedor, "reports.team")).toBe(false);
  });

  it("vendedor com canEditPrices pode editar preço", () => {
    expect(can(vendedorComPreco, "products.editPrice")).toBe(true);
    expect(can(vendedorComPreco, "products.manage")).toBe(false);
  });

  it("sem usuário não pode nada", () => {
    for (const cap of ALL_CAPS) {
      expect(can(null, cap)).toBe(false);
      expect(can(undefined, cap)).toBe(false);
    }
  });

  it("expõe as unidades da loja", () => {
    expect(STORE_UNITS).toEqual([
      { value: "jardim", label: "Jardim" },
      { value: "gll", label: "Guia Lopes da Laguna" },
    ]);
  });
});

describe("assertCan()", () => {
  it("lança FORBIDDEN quando não pode", () => {
    try {
      assertCan(vendedor, "users.manage");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
      expect((err as TRPCError).message).toBe("Sem permissão para esta ação");
    }
  });

  it("não lança quando pode", () => {
    expect(() => assertCan(dono, "users.manage")).not.toThrow();
  });
});

describe("checkProductUpdate()", () => {
  it("vendedor pode trocar a foto da variante", () => {
    const before = baseProduct();
    const after = baseProduct();
    after.variants[0].imageUrl = "https://cdn/foto.jpg";
    expect(checkProductUpdate(vendedor, before, after)).toBeNull();
  });

  it("vendedor pode alterar bateria, observações, quantidade, disponibilidade e visibilidade", () => {
    const before = baseProduct();
    const after = baseProduct();
    after.active = false;
    after.imageUrl = "https://cdn/capa.jpg";
    after.variants[0].batteryHealth = "88%";
    after.variants[0].notes = "Risco leve";
    after.variants[0].quantity = 0;
    after.variants[0].available = false;
    expect(checkProductUpdate(vendedor, before, after)).toBeNull();
  });

  it("trata undefined, null e string vazia como iguais", () => {
    const before = baseProduct();
    const after = baseProduct();
    after.videoUrl = "";
    after.variants[0].imageUrl = undefined;
    after.variants[0].videoUrl = null as unknown as string;
    after.description = "Ótimo estado";
    expect(checkProductUpdate(vendedor, before, after)).toBeNull();
  });

  it("vendedor sem permissão não pode mudar preço", () => {
    const before = baseProduct();
    const after = baseProduct();
    after.variants[0].priceCash = 300000;
    expect(checkProductUpdate(vendedor, before, after)).toMatch(/preço/i);
  });

  it("vendedor com canEditPrices pode mudar preço", () => {
    const before = baseProduct();
    const after = baseProduct();
    after.variants[0].priceCash = 300000;
    expect(checkProductUpdate(vendedorComPreco, before, after)).toBeNull();
  });

  it("vendedor não pode mudar o nome", () => {
    const before = baseProduct();
    const after = baseProduct();
    after.name = "iPhone 15 Pro Max";
    expect(checkProductUpdate(vendedor, before, after)).toMatch(/dono/i);
  });

  it("vendedor não pode destacar nem mudar campos de variante restritos", () => {
    const before = baseProduct();
    const featured = baseProduct();
    featured.featured = true;
    expect(checkProductUpdate(vendedor, before, featured)).not.toBeNull();

    const color = baseProduct();
    color.variants[0].color = "Azul";
    expect(checkProductUpdate(vendedor, before, color)).not.toBeNull();
  });

  it("vendedor não pode adicionar nem remover variante", () => {
    const before = baseProduct();
    const added = baseProduct();
    added.variants.push({ ...added.variants[0], id: undefined });
    expect(checkProductUpdate(vendedor, before, added)).toMatch(/variante/i);

    const swapped = baseProduct();
    swapped.variants[0].id = 99;
    expect(checkProductUpdate(vendedor, before, swapped)).toMatch(/variante/i);

    const removed = baseProduct();
    const twoVariants = baseProduct();
    twoVariants.variants.push({ ...twoVariants.variants[0], id: 11 });
    expect(checkProductUpdate(vendedor, twoVariants, removed)).toMatch(/variante/i);
  });

  it("vendedor não pode criar nem excluir produto", () => {
    expect(checkProductUpdate(vendedor, null, baseProduct())).toMatch(/dono/i);
    expect(checkProductUpdate(vendedor, baseProduct(), null)).toMatch(/dono/i);
    expect(checkProductUpdate(vendedorComPreco, null, baseProduct())).not.toBeNull();
  });

  it("dono pode tudo", () => {
    const before = baseProduct();
    const after = baseProduct();
    after.name = "Outro";
    after.featured = true;
    after.variants[0].priceCash = 1;
    after.variants.push({ ...after.variants[0], id: undefined });
    expect(checkProductUpdate(dono, before, after)).toBeNull();
    expect(checkProductUpdate(dono, null, after)).toBeNull();
    expect(checkProductUpdate(dono, before, null)).toBeNull();
  });
});

describe("checkErpOverrideUpdate()", () => {
  it("vendedor pode alterar mídia, bateria, descrição e visibilidade", () => {
    expect(checkErpOverrideUpdate(vendedor, ["imageUrl", "batteryHealth"])).toBeNull();
    expect(checkErpOverrideUpdate(vendedor, ["videoUrl", "description", "active"])).toBeNull();
  });

  it("vendedor não pode destacar, mudar categoria, nome ou garantia", () => {
    expect(checkErpOverrideUpdate(vendedor, ["featured"])).not.toBeNull();
    expect(checkErpOverrideUpdate(vendedor, ["imageUrl", "category"])).not.toBeNull();
    expect(checkErpOverrideUpdate(vendedor, ["customName"])).not.toBeNull();
    expect(checkErpOverrideUpdate(vendedor, ["warranty"])).not.toBeNull();
  });

  it("chaves desconhecidas exigem dono", () => {
    expect(checkErpOverrideUpdate(vendedor, ["algoNovo"])).not.toBeNull();
  });

  it("dono pode tudo", () => {
    expect(checkErpOverrideUpdate(dono, ["featured", "category", "customName", "warranty"])).toBeNull();
  });
});
