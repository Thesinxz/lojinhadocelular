import { describe, it, expect } from "vitest";
import {
  computeEvaluationStats,
  computeCatalogIssues,
  localDateKey,
  type EvalStatRow,
} from "./dashboard";

const SLA = 2;
// 2026-10-15 15:00 em Campo Grande (UTC-4) = 19:00Z
const NOW = new Date("2026-10-15T19:00:00Z");

function row(patch: Partial<EvalStatRow>): EvalStatRow {
  return {
    status: "pendente",
    createdAt: new Date("2026-10-15T18:30:00Z"),
    firstResponseAt: null,
    statusChangedAt: null,
    assignedAt: null,
    closedValue: null,
    assignedUserId: null,
    assignedUserName: null,
    ...patch,
  };
}

describe("localDateKey", () => {
  it("usa o fuso de Campo Grande (UTC-4)", () => {
    // 01/11 02:00Z ainda é 31/10 22:00 em Campo Grande
    expect(localDateKey(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31");
  });
});

describe("computeEvaluationStats — agora", () => {
  it("conta pendentes, atrasadas e atendidas hoje", () => {
    const stats = computeEvaluationStats(
      [
        row({}), // pendente recente
        row({ createdAt: new Date("2026-10-15T10:00:00Z") }), // pendente atrasada
        row({
          status: "atendimento",
          firstResponseAt: new Date("2026-10-15T14:00:00Z"),
        }), // respondida hoje
        row({
          status: "atendimento",
          createdAt: new Date("2026-10-14T12:00:00Z"),
          firstResponseAt: new Date("2026-10-14T13:00:00Z"),
        }), // respondida ontem
      ],
      NOW,
      SLA,
    );
    expect(stats.now).toEqual({ pending: 2, late: 1, respondedToday: 1 });
  });
});

describe("computeEvaluationStats — mês", () => {
  const rows: EvalStatRow[] = [
    // recebidas em outubro
    row({
      status: "concluido",
      createdAt: new Date("2026-10-02T12:00:00Z"),
      firstResponseAt: new Date("2026-10-02T13:00:00Z"), // 60 min
      statusChangedAt: new Date("2026-10-03T12:00:00Z"),
      assignedAt: new Date("2026-10-02T13:00:00Z"),
      closedValue: 200000,
      assignedUserId: 2,
      assignedUserName: "Ana",
    }),
    row({
      status: "concluido",
      createdAt: new Date("2026-10-05T12:00:00Z"),
      firstResponseAt: new Date("2026-10-05T12:30:00Z"), // 30 min
      statusChangedAt: new Date("2026-10-06T12:00:00Z"),
      assignedAt: new Date("2026-10-05T12:30:00Z"),
      closedValue: 150000,
      assignedUserId: 3,
      assignedUserName: "Bruno",
    }),
    row({
      status: "concluido",
      createdAt: new Date("2026-10-07T12:00:00Z"),
      statusChangedAt: new Date("2026-10-08T12:00:00Z"),
      assignedAt: new Date("2026-10-07T12:00:00Z"),
      closedValue: 100000,
      assignedUserId: 2,
      assignedUserName: "Ana",
    }),
    row({
      status: "recusado",
      createdAt: new Date("2026-10-09T12:00:00Z"),
      firstResponseAt: new Date("2026-10-09T13:30:00Z"), // 90 min
      statusChangedAt: new Date("2026-10-09T14:00:00Z"),
      assignedAt: new Date("2026-10-09T13:30:00Z"),
      assignedUserId: 3,
      assignedUserName: "Bruno",
    }),
    // setembro — não entra no mês
    row({
      status: "concluido",
      createdAt: new Date("2026-09-20T12:00:00Z"),
      statusChangedAt: new Date("2026-09-21T12:00:00Z"),
      assignedAt: new Date("2026-09-20T12:00:00Z"),
      closedValue: 999999,
      assignedUserId: 2,
      assignedUserName: "Ana",
    }),
  ];

  it("calcula recebidas, concluídas, recusadas, taxa, total e tempo médio", () => {
    const { month } = computeEvaluationStats(rows, NOW, SLA);
    expect(month.received).toBe(4);
    expect(month.concluded).toBe(3);
    expect(month.refused).toBe(1);
    expect(month.closeRate).toBeCloseTo(0.75);
    expect(month.totalClosedCents).toBe(450000);
    expect(month.avgResponseMinutes).toBe(60);
  });

  it("retorna nulos quando não há base para taxa e tempo médio", () => {
    const { month } = computeEvaluationStats([row({})], NOW, SLA);
    expect(month.closeRate).toBeNull();
    expect(month.avgResponseMinutes).toBeNull();
  });

  it("monta ranking por vendedor ordenado por concluídas e valor", () => {
    const { ranking } = computeEvaluationStats(rows, NOW, SLA);
    expect(ranking).toEqual([
      { userId: 2, userName: "Ana", handled: 2, concluded: 2, totalClosedCents: 300000 },
      { userId: 3, userName: "Bruno", handled: 2, concluded: 1, totalClosedCents: 150000 },
    ]);
  });
});

describe("computeCatalogIssues", () => {
  it("encontra produtos sem foto, seminovos sem bateria e esgotados visíveis", () => {
    const issues = computeCatalogIssues([
      {
        id: 1,
        name: "iPhone 13 sem foto",
        category: "iphone_seminovo",
        condition: "seminovo",
        active: true,
        imageUrl: null,
        variants: [{ imageUrl: "", batteryHealth: "88%", available: true, quantity: 1 }],
      },
      {
        id: 2,
        name: "iPhone 12 sem bateria",
        category: "iphone_seminovo",
        condition: "seminovo",
        active: true,
        imageUrl: "https://x/foto.jpg",
        variants: [{ imageUrl: null, batteryHealth: "", available: true, quantity: 1 }],
      },
      {
        id: "erp-3",
        name: "Galaxy esgotado",
        category: "android",
        condition: "novo",
        active: true,
        imageUrl: "https://x/g.jpg",
        variants: [{ imageUrl: null, batteryHealth: null, available: false, quantity: 0 }],
      },
      {
        id: 4,
        name: "Oculto sem foto",
        category: "android",
        condition: "novo",
        active: false,
        imageUrl: null,
        variants: [{ imageUrl: null, available: false, quantity: 0 }],
      },
      {
        id: 5,
        name: "Lacrado ok",
        category: "iphone_lacrado",
        condition: "lacrado",
        active: true,
        imageUrl: null,
        variants: [{ imageUrl: "https://x/v.jpg", batteryHealth: "", available: true, quantity: 2 }],
      },
    ]);
    expect(issues.noPhoto).toEqual([{ id: "1", name: "iPhone 13 sem foto" }]);
    expect(issues.noBattery).toEqual([{ id: "2", name: "iPhone 12 sem bateria" }]);
    expect(issues.soldOutVisible).toEqual([{ id: "erp-3", name: "Galaxy esgotado" }]);
  });
});
