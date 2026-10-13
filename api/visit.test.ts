import { describe, expect, it } from "vitest";
import {
  decodeVisit,
  encodeVisit,
  formatVisit,
  nextVisitDays,
  sanitizeVisit,
  visitPeriodsFor,
} from "@contracts/visit";

// 2026-10-12 é segunda-feira.
describe("preferência de visita", () => {
  it("segunda a sexta abre manhã e tarde; sábado só manhã; domingo fechado", () => {
    expect(visitPeriodsFor("2026-10-12")).toEqual(["manha", "tarde"]);
    expect(visitPeriodsFor("2026-10-16")).toEqual(["manha", "tarde"]);
    expect(visitPeriodsFor("2026-10-17")).toEqual(["manha"]);
    expect(visitPeriodsFor("2026-10-18")).toEqual([]);
    expect(visitPeriodsFor("lixo")).toEqual([]);
  });

  it("lista só dias em que a loja abre, a partir de hoje", () => {
    const days = nextVisitDays("2026-10-12", 7);
    expect(days[0]).toBe("2026-10-12");
    expect(days).not.toContain("2026-10-18");
    expect(days).toHaveLength(6);
  });

  it("codifica, decodifica e formata", () => {
    const value = encodeVisit("2026-10-14", "tarde");
    expect(decodeVisit(value)).toEqual({ date: "2026-10-14", period: "tarde" });
    expect(formatVisit(value)).toBe("quarta, 14/10 — Tarde");
    expect(formatVisit("")).toBe("");
    expect(decodeVisit("2026-02-31 manha")).toBeNull();
  });

  it("descarta preferências inválidas no servidor", () => {
    const today = "2026-10-12";
    expect(sanitizeVisit("2026-10-14 tarde", today)).toBe("2026-10-14 tarde");
    expect(sanitizeVisit("2026-10-18 manha", today)).toBe(""); // domingo
    expect(sanitizeVisit("2026-10-17 tarde", today)).toBe(""); // sábado à tarde
    expect(sanitizeVisit("2026-09-01 manha", today)).toBe(""); // passado
    expect(sanitizeVisit("2026-12-01 manha", today)).toBe(""); // longe demais
    expect(sanitizeVisit("qualquer coisa", today)).toBe("");
  });
});
