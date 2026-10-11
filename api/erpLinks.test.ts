import { describe, expect, it } from "vitest";
import { ERP_APP_URL, erpProductUrl } from "../src/lib/erpLinks";

describe("link do produto no ERP", () => {
  it("abre a página do produto quando o ID é um UUID do ERP", () => {
    expect(erpProductUrl("3f2b1c4e-9a7d-4e21-8b6a-1c2d3e4f5a6b")).toBe(`${ERP_APP_URL}/produtos/3f2b1c4e-9a7d-4e21-8b6a-1c2d3e4f5a6b`);
  });
  it("sem ID válido abre o painel, sem montar um endereço quebrado", () => {
    expect(erpProductUrl("")).toBe(ERP_APP_URL);
    expect(erpProductUrl(undefined)).toBe(ERP_APP_URL);
    expect(erpProductUrl("12")).toBe(ERP_APP_URL);
    expect(erpProductUrl("../../admin")).toBe(ERP_APP_URL);
  });
});
