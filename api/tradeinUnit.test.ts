import { describe, it, expect } from "vitest";
import { submitEvaluationInput } from "./shop";

const base = {
  name: "Maria",
  whatsapp: "67999990000",
  model: "iPhone 13",
  condition: "Bom",
  battery: "90%",
};

describe("submitEvaluationInput — unidade escolhida pelo cliente", () => {
  it("aceita jardim e gll", () => {
    expect(submitEvaluationInput.parse({ ...base, unit: "jardim" }).unit).toBe("jardim");
    expect(submitEvaluationInput.parse({ ...base, unit: "gll" }).unit).toBe("gll");
  });

  it("é opcional (formulários antigos continuam funcionando)", () => {
    expect(submitEvaluationInput.parse(base).unit).toBeUndefined();
  });

  it("rejeita unidade desconhecida", () => {
    expect(submitEvaluationInput.safeParse({ ...base, unit: "centro" }).success).toBe(false);
    expect(submitEvaluationInput.safeParse({ ...base, unit: "" }).success).toBe(false);
  });
});
