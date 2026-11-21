// Ekran kierującego komórką: pierwsze oceny nowych pracowników z kalendarzem terminów.
import { describe, expect, it } from "vitest";
import type { HrEvaluationRecord } from "@/lib/hr/panel";
import { firstEvaluationRows } from "@/lib/kierujacy/pierwsze-oceny";

const TODAY = "2026-11-21";

function rec(over: Partial<HrEvaluationRecord> = {}, emp: Partial<HrEvaluationRecord["employee"]> = {}): HrEvaluationRecord {
  return {
    id: "ev1",
    type: "PIERWSZA",
    sheet: "PIERWSZA",
    status: "DO_ROZPOCZECIA",
    isReevaluation: false,
    criteriaSetAt: null,
    evaluatedAt: null,
    acknowledgedAt: null,
    result: null,
    previousDate: null,
    previousResult: null,
    previousAcknowledgedAt: null,
    evaluatorId: "ewa",
    evaluatorName: "Ewa Kowalczyk",
    ...over,
    employee: {
      id: "ola",
      name: "Aleksandra Mazur",
      orgUnit: "Wydział Zarządzania Kryzysowego",
      employmentStart: "2026-11-06",
      permanentFrom: null,
      contractEnd: "2027-11-05",
      absences: [],
      pastResults: [],
      ...emp,
    },
  };
}

describe("pierwsze oceny w komórce kierującego", () => {
  it("nowa pracownica: najbliższy termin to rozmowa wstępna (21 dni), w kalendarzu też okno oceny", () => {
    const [row] = firstEvaluationRows([rec()], TODAY);
    expect(row!.deadline!.kind).toBe("ROZMOWA_WSTEPNA");
    expect(row!.deadline!.date).toBe("2026-11-27");
    expect(row!.calendar.map((c) => c.label)).toEqual(["Rozmowa wstępna", "Pierwsza ocena – najwcześniej", "Pierwsza ocena"]);
    expect(row!.calendar.every((c) => !c.past)).toBe(true);
    expect(row!.nextStep).toContain("rozmowę wstępną");
  });

  it("bez daty końca umowy – tylko rozmowa wstępna w kalendarzu", () => {
    const [row] = firstEvaluationRows([rec({}, { contractEnd: null })], TODAY);
    expect(row!.calendar).toHaveLength(1);
  });

  it("po ocenie pozytywnej – wskazówka o wniosku do dyrektora generalnego (art. 38 ust. 3)", () => {
    const [row] = firstEvaluationRows([rec({ status: "ZAKONCZONA", result: "POZYTYWNA", evaluatedAt: "2026-10-01" })], TODAY);
    expect(row!.deadline).toBeNull();
    expect(row!.nextStep).toContain("art. 38 ust. 3");
    expect(row!.nextStep).toContain("na czas nieokreślony");
  });

  it("pomija oceny okresowe; zakończone na końcu listy", () => {
    const rows = firstEvaluationRows(
      [
        rec({ id: "zakonczona", status: "ZAKONCZONA", result: "POZYTYWNA" }),
        rec({ id: "okresowa", type: "OKRESOWA", sheet: "C" }),
        rec({ id: "biezaca" }),
      ],
      TODAY,
    );
    expect(rows.map((r) => r.evaluationId)).toEqual(["biezaca", "zakonczona"]);
  });
});
