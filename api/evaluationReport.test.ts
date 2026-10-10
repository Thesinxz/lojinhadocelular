import { describe, expect, it } from "vitest";
import { computeEvaluationReport, type ReportRow } from "./evaluationReport";

const base = new Date("2026-10-05T15:00:00Z");
const minutesAfter = (m: number) => new Date(base.getTime() + m * 60_000);

function row(patch: Partial<ReportRow> & { id: number }): ReportRow {
  return {
    name: "Cliente",
    whatsapp: "(67) 99999-0000",
    model: "iPhone 13",
    storage: "128GB",
    unit: "jardim",
    status: "pendente",
    refusalReason: "",
    offeredValue: null,
    closedValue: null,
    createdAt: base,
    firstResponseAt: null,
    statusChangedAt: null,
    assignedUserId: null,
    assignedUserName: "",
    ...patch,
  };
}

describe("computeEvaluationReport", () => {
  it("conta status, conversão e ticket médio", () => {
    const report = computeEvaluationReport([
      row({ id: 1, status: "concluido", closedValue: 200000, firstResponseAt: minutesAfter(10), statusChangedAt: minutesAfter(60), assignedUserId: 1, assignedUserName: "Ana" }),
      row({ id: 2, status: "concluido", closedValue: 100000, firstResponseAt: minutesAfter(30), statusChangedAt: minutesAfter(90), assignedUserId: 1, assignedUserName: "Ana", whatsapp: "67988887777" }),
      row({ id: 3, status: "recusado", refusalReason: "preco", whatsapp: "67977776666", unit: "gll" }),
      row({ id: 4, status: "atendimento", whatsapp: "67966665555" }),
      row({ id: 5, status: "pendente", whatsapp: "67955554444" }),
    ]);

    expect(report.totals).toMatchObject({
      received: 5,
      pending: 1,
      inProgress: 1,
      concluded: 2,
      refused: 1,
      totalClosedCents: 300000,
      avgTicketCents: 150000,
      avgResponseMinutes: 20,
      medianResponseMinutes: 20,
      unanswered: 1,
    });
    expect(report.totals.conversionRate).toBeCloseTo(2 / 3);
    expect(report.refusalReasons).toEqual([{ reason: "preco", count: 1 }]);
    expect(report.ranking[0]).toMatchObject({ userName: "Ana", handled: 2, concluded: 2, totalClosedCents: 300000 });
  });

  it("separa por loja, conta clientes recorrentes e modelos", () => {
    const report = computeEvaluationReport([
      row({ id: 1, whatsapp: "(67) 99999-0000", model: "iPhone 13" }),
      row({ id: 2, whatsapp: "67 99999 0000", model: "iPhone 13" }),
      row({ id: 3, whatsapp: "67911112222", model: "iPhone 12", unit: "" }),
    ]);
    expect(report.totals.repeatCustomers).toBe(1);
    expect(report.topModels[0]).toEqual({ model: "iPhone 13", count: 2 });
    expect(report.byUnit.find((u) => u.unit === "jardim")?.received).toBe(2);
    expect(report.byUnit.find((u) => u.unit === "")?.received).toBe(1);
  });

  it("agrupa por dia local e lida com lista vazia", () => {
    expect(computeEvaluationReport([]).totals).toMatchObject({ received: 0, conversionRate: null, avgTicketCents: null });
    const report = computeEvaluationReport([
      row({ id: 1, createdAt: new Date("2026-10-05T12:00:00Z") }),
      row({ id: 2, createdAt: new Date("2026-10-06T12:00:00Z"), status: "concluido", statusChangedAt: new Date("2026-10-07T12:00:00Z") }),
    ]);
    expect(report.byDay).toEqual([
      { date: "2026-10-05", received: 1, concluded: 0 },
      { date: "2026-10-06", received: 1, concluded: 0 },
      { date: "2026-10-07", received: 0, concluded: 1 },
    ]);
  });
});
