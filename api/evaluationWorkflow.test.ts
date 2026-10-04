import { describe, it, expect } from "vitest";
import {
  applyClaim,
  applyStatus,
  applyUnit,
  applyValues,
  isLate,
  validateNoteBody,
  type WorkflowState,
} from "./evaluationWorkflow";
import type { SessionUser } from "@contracts/permissions";

const created = new Date("2026-10-04T10:00:00Z");
const now = new Date("2026-10-04T13:00:00Z");

function state(patch: Partial<WorkflowState> = {}): WorkflowState {
  return {
    status: "pendente",
    unit: "",
    assignedUserId: null,
    assignedUserName: "",
    assignedAt: null,
    firstResponseAt: null,
    statusChangedAt: null,
    offeredValue: null,
    closedValue: null,
    refusalReason: "",
    createdAt: created,
    ...patch,
  };
}

const ana: SessionUser = { id: 2, username: "ana", name: "Ana", role: "vendedor", unit: "jardim", canEditPrices: false };
const bruno: SessionUser = { id: 3, username: "bruno", name: "Bruno", role: "vendedor", unit: "gll", canEditPrices: false };

describe("applyClaim", () => {
  it("atribui ao usuário, passa pendente → atendimento e marca a primeira resposta", () => {
    const next = applyClaim(state(), ana, now);
    expect(next.assignedUserId).toBe(2);
    expect(next.assignedUserName).toBe("Ana");
    expect(next.assignedAt).toEqual(now);
    expect(next.status).toBe("atendimento");
    expect(next.statusChangedAt).toEqual(now);
    expect(next.firstResponseAt).toEqual(now);
  });

  it("não sobrescreve a primeira resposta nem muda status já avançado", () => {
    const first = new Date("2026-10-04T11:00:00Z");
    const next = applyClaim(state({ status: "concluido", firstResponseAt: first }), ana, now);
    expect(next.status).toBe("concluido");
    expect(next.firstResponseAt).toEqual(first);
    expect(next.statusChangedAt).toBeNull();
  });

  it("recusa quando já está com outra pessoa", () => {
    const s = state({ assignedUserId: 3, assignedUserName: "Bruno", status: "atendimento" });
    expect(() => applyClaim(s, ana, now)).toThrow("Já está com Bruno");
  });

  it("permite reatribuir com force (dono)", () => {
    const s = state({ assignedUserId: 3, assignedUserName: "Bruno", status: "atendimento" });
    const next = applyClaim(s, ana, now, { force: true });
    expect(next.assignedUserId).toBe(2);
    expect(next.assignedUserName).toBe("Ana");
  });

  it("pegar de novo a própria avaliação não muda nada", () => {
    const s = applyClaim(state(), ana, created);
    const again = applyClaim(s, ana, now);
    expect(again).toEqual(s);
  });

  it("vendedor diferente pode pegar avaliação sem responsável", () => {
    expect(applyClaim(state(), bruno, now).assignedUserName).toBe("Bruno");
  });
});

describe("applyStatus", () => {
  it("recusado exige motivo válido", () => {
    expect(() => applyStatus(state(), "recusado", now)).toThrow(/motivo/i);
    expect(() => applyStatus(state(), "recusado", now, { refusalReason: "xyz" })).toThrow(/motivo/i);
    const next = applyStatus(state(), "recusado", now, { refusalReason: "preco" });
    expect(next.status).toBe("recusado");
    expect(next.refusalReason).toBe("preco");
  });

  it("atualiza status_changed_at e first_response_at (se nulo)", () => {
    const next = applyStatus(state(), "atendimento", now);
    expect(next.statusChangedAt).toEqual(now);
    expect(next.firstResponseAt).toEqual(now);

    const first = new Date("2026-10-04T11:00:00Z");
    const later = applyStatus(state({ firstResponseAt: first, status: "atendimento" }), "concluido", now);
    expect(later.firstResponseAt).toEqual(first);
  });

  it("concluido aceita valor fechado opcional", () => {
    expect(applyStatus(state(), "concluido", now, { closedValue: 150000 }).closedValue).toBe(150000);
    expect(applyStatus(state({ closedValue: 900 }), "concluido", now).closedValue).toBe(900);
    expect(() => applyStatus(state(), "concluido", now, { closedValue: -1 })).toThrow();
    expect(() => applyStatus(state(), "concluido", now, { closedValue: 10.5 })).toThrow();
  });

  it("sair de recusado limpa o motivo", () => {
    const s = state({ status: "recusado", refusalReason: "preco" });
    expect(applyStatus(s, "atendimento", now).refusalReason).toBe("");
  });

  it("mesmo status não altera status_changed_at", () => {
    const changed = new Date("2026-10-04T11:00:00Z");
    const s = state({ status: "atendimento", statusChangedAt: changed, firstResponseAt: changed });
    expect(applyStatus(s, "atendimento", now).statusChangedAt).toEqual(changed);
  });

  it("rejeita status desconhecido", () => {
    expect(() => applyStatus(state(), "xpto" as never, now)).toThrow();
  });
});

describe("applyValues", () => {
  it("grava inteiros ≥ 0 em centavos e mantém o que não veio", () => {
    const next = applyValues(state({ closedValue: 500 }), { offeredValue: 120000 });
    expect(next.offeredValue).toBe(120000);
    expect(next.closedValue).toBe(500);
    expect(applyValues(next, { offeredValue: null }).offeredValue).toBeNull();
  });

  it("rejeita negativos e frações", () => {
    expect(() => applyValues(state(), { offeredValue: -5 })).toThrow();
    expect(() => applyValues(state(), { closedValue: 1.2 })).toThrow();
  });
});

describe("applyUnit / validateNoteBody", () => {
  it("define a unidade", () => {
    expect(applyUnit(state(), "gll").unit).toBe("gll");
    expect(applyUnit(state({ unit: "gll" }), "").unit).toBe("");
    expect(() => applyUnit(state(), "outra" as never)).toThrow();
  });

  it("anotação precisa de 1 a 2000 caracteres", () => {
    expect(validateNoteBody("  Cliente ligou  ")).toBe("Cliente ligou");
    expect(() => validateNoteBody("   ")).toThrow();
    expect(() => validateNoteBody("x".repeat(2001))).toThrow();
  });
});

describe("isLate", () => {
  it("pendente além do SLA está atrasada", () => {
    expect(isLate({ status: "pendente", createdAt: created }, now, 2)).toBe(true);
    expect(isLate({ status: "pendente", createdAt: created }, now, 3)).toBe(false);
    expect(isLate({ status: "pendente", createdAt: created }, now, 4)).toBe(false);
  });

  it("outros status nunca estão atrasados", () => {
    expect(isLate({ status: "atendimento", createdAt: created }, now, 1)).toBe(false);
    expect(isLate({ status: "concluido", createdAt: created }, now, 1)).toBe(false);
  });
});
