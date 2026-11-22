// Ekran ocenianego: co oceniany widzi na danym etapie oceny.
import { describe, expect, it } from "vitest";
import { ownEvaluationView, sortOwnEvaluations, type OwnEvaluationRow } from "@/lib/oceniany/moje-oceny";

function wiersz(zmiany: Partial<OwnEvaluationRow> = {}): OwnEvaluationRow {
  return {
    id: "e1",
    type: "OKRESOWA",
    sheet: "A",
    status: "W_OKRESIE_OCENY",
    isReevaluation: false,
    evaluatorName: "Ewa Kowalska",
    criteriaSetAt: "2026-01-10",
    dueDate: "2026-12-31",
    justification: "Notatka robocza",
    developmentPlan: "Szkolenie",
    promotionRequest: false,
    isCivilServant: true,
    criteria: [
      { competency: "RZETELNOSC", kind: "OBOWIAZKOWE", selectionReason: "Kluczowe dla stanowiska", score: 7 },
      { competency: "KOMUNIKACJA", kind: "OBOWIAZKOWE", score: 5 },
    ],
    conversations: [{ type: "ROZPOCZYNAJACA", date: "2026-01-10" }],
    ...zmiany,
  };
}

describe("widok oceny przed sporządzeniem (część I arkusza)", () => {
  it("pokazuje kryteria z uzasadnieniem wyboru i termin, ale ukrywa robocze oceny cząstkowe", () => {
    const v = ownEvaluationView(wiersz());
    expect(v.finalized).toBe(false);
    expect(v.dueDate).toBe("2026-12-31");
    expect(v.criteria[0]).toMatchObject({ competency: "RZETELNOSC", selectionReason: "Kluczowe dla stanowiska" });
    expect(v.criteria.every((c) => c.score === undefined)).toBe(true);
  });

  it("nie ujawnia wyniku, uzasadnienia ani IPRZ w trakcie oceniania", () => {
    const v = ownEvaluationView(wiersz({ status: "W_OCENIE", evaluatedAt: "2026-11-20" }));
    expect(v.result).toBeUndefined();
    expect(v.scoredCriteria).toBeUndefined();
    expect(v.justification).toBeUndefined();
    expect(v.developmentPlan).toBeUndefined();
    expect(v.evaluatedAt).toBeUndefined();
    expect(v.canAcknowledge).toBe(false);
  });
});

describe("widok oceny sporządzonej (§ 12)", () => {
  it("pokazuje oceny cząstkowe, wynik i pozwala potwierdzić zapoznanie się", () => {
    const v = ownEvaluationView(wiersz({ status: "CZEKA_NA_ZAPOZNANIE", evaluatedAt: "2026-11-20" }));
    expect(v.finalized).toBe(true);
    expect(v.criteria.map((c) => c.score)).toEqual([7, 5]);
    expect(v.result).toBeDefined();
    expect(v.justification).toBe("Notatka robocza");
    expect(v.canAcknowledge).toBe(true);
    expect(v.objection).toBeUndefined();
  });

  it("po zapoznaniu się: termin sprzeciwu 7 dni, bez przycisku potwierdzenia", () => {
    const v = ownEvaluationView(wiersz({ status: "ZAKONCZONA", evaluatedAt: "2026-11-02", acknowledgedAt: "2026-11-03" }));
    expect(v.canAcknowledge).toBe(false);
    expect(v.objection?.date).toBe("2026-11-10");
  });

  it("część III: nie dotyczy pracownika służby cywilnej / wniosek o stopień", () => {
    expect(ownEvaluationView(wiersz({ status: "ZAKONCZONA", evaluatedAt: "2026-11-02", isCivilServant: false })).partThree).toBe("NIE DOTYCZY");
    const z = ownEvaluationView(wiersz({ status: "ZAKONCZONA", evaluatedAt: "2026-11-02", promotionRequest: true, requestedGrade: 3 }));
    expect(z.partThree).toContain("stopień 3");
  });

  it("niekompletne oceny cząstkowe – brak wyniku zamiast błędnego wyliczenia", () => {
    const v = ownEvaluationView(
      wiersz({ status: "CZEKA_NA_ZAPOZNANIE", evaluatedAt: "2026-11-20", criteria: [{ competency: "RZETELNOSC", kind: "OBOWIAZKOWE", score: null }] }),
    );
    expect(v.result).toBeUndefined();
  });
});

describe("kolejność listy", () => {
  it("najpierw ocena do zapoznania, potem bieżąca, na końcu zakończone od najnowszej", () => {
    const lista = sortOwnEvaluations([
      ownEvaluationView(wiersz({ id: "stara", status: "ZAKONCZONA", evaluatedAt: "2024-11-02" })),
      ownEvaluationView(wiersz({ id: "biezaca" })),
      ownEvaluationView(wiersz({ id: "nowsza", status: "ZAKONCZONA", evaluatedAt: "2025-11-02" })),
      ownEvaluationView(wiersz({ id: "do-zapoznania", status: "CZEKA_NA_ZAPOZNANIE", evaluatedAt: "2026-11-20" })),
    ]);
    expect(lista.map((v) => v.id)).toEqual(["do-zapoznania", "biezaca", "nowsza", "stara"]);
  });
});
