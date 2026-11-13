import { describe, expect, it } from "vitest";
import {
  ADMIN_PRODUCTS_BATCH_SIZE,
  applyOptimisticBulkProducts,
  applyOptimisticEvaluationClaim,
  applyOptimisticEvaluationDetailPatch,
  applyOptimisticProductToggle,
  filterAdminProducts,
  sliceAdminBatch,
} from "../src/lib/adminOptimistic";

const SAMPLE_ADMIN_PRODUCTS = [
  {
    id: 10,
    externalId: null,
    name: "iPhone 16 Pro Max",
    category: "iphone_lacrado",
    active: true,
    featured: true,
    variants: [{ sku: "B1610", storage: "256GB" }],
  },
  {
    id: "erp-1",
    externalId: "abc-99",
    name: "iPhone 13 Estelar",
    category: "iphone_seminovo",
    active: false,
    featured: false,
    variants: [{ sku: "ERP-ABC99", storage: "128GB" }],
  },
  {
    id: 12,
    externalId: null,
    name: "Redmi Note 14",
    category: "android",
    active: true,
    featured: false,
    variants: [{ sku: "XIA14", storage: "256GB" }],
  },
];

describe("adminOptimistic", () => {
  it("filtra catálogo admin sem acentos e calcula contadores corretos", () => {
    const res = filterAdminProducts(SAMPLE_ADMIN_PRODUCTS, {
      statusFilter: "todos",
      search: "256gb",
    });
    expect(res.counts).toEqual({
      all: 3,
      visible: 2,
      hidden: 1,
      featured: 1,
    });
    expect(res.filtered.map((p) => p.name)).toEqual([
      "iPhone 16 Pro Max",
      "Redmi Note 14",
    ]);

    const ocultos = filterAdminProducts(SAMPLE_ADMIN_PRODUCTS, {
      statusFilter: "ocultos",
      search: "estelar",
    });
    expect(ocultos.filtered.map((p) => p.id)).toEqual(["erp-1"]);
  });

  it("aplica update otimista em toggle unitário por id ou externalId sem mutar o original", () => {
    const next = applyOptimisticProductToggle(SAMPLE_ADMIN_PRODUCTS, "abc-99", {
      active: true,
      featured: true,
    });
    expect(next[1].active).toBe(true);
    expect(next[1].featured).toBe(true);
    expect(SAMPLE_ADMIN_PRODUCTS[1].active).toBe(false);

    const bulk = applyOptimisticBulkProducts(
      SAMPLE_ADMIN_PRODUCTS,
      ["10", "abc-99"],
      { featured: false },
    );
    expect(bulk[0].featured).toBe(false);
    expect(bulk[1].featured).toBe(false);
    expect(bulk[2].featured).toBe(false);
  });

  it("aplica claim otimista na lista de avaliações e patch no detalhe", () => {
    const pageData = {
      items: [
        { id: 5, assignedUserId: null as number | null, assignedUserName: null as string | null, status: "pendente" },
        { id: 6, assignedUserId: 2, assignedUserName: "Ana", status: "atendimento" },
      ],
      total: 2,
      hasMore: false,
    };
    const claimed = applyOptimisticEvaluationClaim(pageData, 5, {
      id: 9,
      name: "Marlon",
    });
    expect(claimed?.items[0].assignedUserId).toBe(9);
    expect(claimed?.items[0].assignedUserName).toBe("Marlon");
    expect(claimed?.items[0].status).toBe("atendimento");
    expect(pageData.items[0].assignedUserId).toBeNull();

    const detail = {
      evaluation: {
        id: 5,
        status: "pendente",
        unit: "jardim",
        assignedUserId: null as number | null,
        assignedUserName: null as string | null,
      },
      notes: [],
    };
    const patched = applyOptimisticEvaluationDetailPatch(detail, {
      status: "concluido",
      unit: "gll",
    });
    expect(patched?.evaluation.status).toBe("concluido");
    expect(patched?.evaluation.unit).toBe("gll");
    expect(detail.evaluation.status).toBe("pendente");
  });

  it("fatia lotes de produtos admin de 24 itens", () => {
    expect(ADMIN_PRODUCTS_BATCH_SIZE).toBe(24);
    const rows = Array.from({ length: 60 }, (_, idx) => idx);
    expect(sliceAdminBatch(rows, 24)).toHaveLength(24);
    expect(sliceAdminBatch(rows, 48)).toHaveLength(48);
  });
});
