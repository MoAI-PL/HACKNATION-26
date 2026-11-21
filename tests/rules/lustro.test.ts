import { describe, expect, it } from "vitest";
import {
  evaluatorMirror,
  haloSignal,
  leniencySignal,
  missingEvidenceSignal,
  recencySignal,
  unitMirror,
  type CompletedEvaluation,
} from "@/lib/rules/lustro";

const DZIS = "2026-11-21";

describe("efekt świeżości (≥ 60% notatek z ostatnich 30 dni)", () => {
  it("pozytywny: 3 z 4 notatek z ostatniego miesiąca", () => {
    const s = recencySignal(["2026-03-01", "2026-11-01", "2026-11-10", "2026-11-20"], DZIS);
    expect(s?.code).toBe("SWIEZOSC");
    expect(s?.text).toContain("3 z 4 notatek (75%)");
  });

  it("negatywny: notatki rozłożone w czasie", () => {
    expect(recencySignal(["2025-06-01", "2025-12-01", "2026-05-01", "2026-11-20"], DZIS)).toBeNull();
  });

  it("za mało notatek albo notatki sprzed okresu oceny – bez sygnału", () => {
    expect(recencySignal(["2026-11-10", "2026-11-20"], DZIS)).toBeNull();
    expect(recencySignal(["2024-01-01", "2026-11-10", "2026-11-20"], DZIS, "2025-01-01")).toBeNull();
  });

  it("granica okna: dokładnie 30 dni wstecz nie liczy się do ostatniego miesiąca", () => {
    expect(recencySignal(["2026-10-22", "2026-10-22", "2026-11-20"], DZIS)).toBeNull(); // 1 z 3
  });
});

describe("efekt aureoli (wszystkie wskaźniki na jednym poziomie, ≥ 5)", () => {
  it("pozytywny: 6 wskaźników na poziomie 4", () => {
    expect(haloSignal([4, 4, 4, 4, 4, 4])?.text).toContain("„powyżej oczekiwań”");
  });

  it("negatywny: różne poziomy albo za mało wskaźników", () => {
    expect(haloSignal([4, 4, 4, 3, 4, 4])).toBeNull();
    expect(haloSignal([5, 5, 5, 5])).toBeNull();
  });
});

describe("łagodność / surowość (≥ 1,5 pkt od średniej komórki, ≥ 3 oceny w komórce)", () => {
  it("pozytywny: łagodność i surowość", () => {
    expect(leniencySignal([8.6, 9], [5, 5.4, 6, 8.8])?.code).toBe("LAGODNOSC");
    expect(leniencySignal([3], [6, 6.5, 7])?.code).toBe("SUROWOSC");
  });

  it("negatywny: różnica poniżej progu albo za mało ocen w komórce", () => {
    expect(leniencySignal([6.5], [5.5, 6, 6.2])).toBeNull();
    expect(leniencySignal([9], [5, 5])).toBeNull();
    expect(leniencySignal([], [5, 5, 5])).toBeNull();
  });
});

describe("brak dowodów (poziom skrajny bez notatki)", () => {
  it("pozytywny: wskazuje wskaźniki", () => {
    const s = missingEvidenceSignal([
      { name: "Komunikacja pisemna", level: 5, hasNote: false },
      { name: "Terminowość", level: 1, hasNote: true },
      { name: "Współpraca", level: 3, hasNote: false },
    ]);
    expect(s?.title).toBe("1 wskaźnik na poziomie skrajnym bez notatki");
    expect(s?.text).toContain("„Komunikacja pisemna”");
  });

  it("negatywny: skrajne poziomy mają notatki", () => {
    expect(missingEvidenceSignal([{ name: "x", level: 5, hasNote: true }])).toBeNull();
  });
});

describe("Lustro dla zamykanej oceny", () => {
  it("zbiera sygnały i nie blokuje (zwraca tylko informacje)", () => {
    const sygnaly = evaluatorMirror({
      noteDates: ["2026-11-01", "2026-11-10", "2026-11-20"],
      reference: DZIS,
      indicators: Array.from({ length: 5 }, (_, i) => ({ name: `w${i}`, level: 5 as const, hasNote: false })),
      supervisorAverages: [9],
      unitAverages: [5, 5, 5],
    });
    expect(sygnaly.map((s) => s.code)).toEqual(["BRAK_DOWODOW", "SWIEZOSC", "AUREOLA", "LAGODNOSC"]);
  });

  it("ocena bez typowych błędów – brak sygnałów", () => {
    expect(
      evaluatorMirror({
        noteDates: ["2025-02-01", "2025-08-01", "2026-03-01", "2026-11-01"],
        reference: DZIS,
        indicators: [3, 4, 3, 5, 4].map((level, i) => ({ name: `w${i}`, level: level as 3, hasNote: true })),
        supervisorAverages: [6],
        unitAverages: [5.5, 6, 6.5],
      }),
    ).toEqual([]);
  });
});

describe("panel HR – rozkład w komórkach", () => {
  const ocena = (unitId: string, evaluatorId: string, average: number): CompletedEvaluation => ({
    unitId,
    unitName: unitId === "u1" ? "Wydział A" : "Wydział B",
    evaluatorId,
    evaluatorName: evaluatorId.toUpperCase(),
    average,
    result: average > 4 ? "POZYTYWNA" : "NEGATYWNA",
    level: average > 8 ? "ZNACZNIE_POWYZEJ" : average > 6 ? "POWYZEJ" : average > 4 ? "NA_POZIOMIE" : "PONIZEJ",
  });

  it("rozkład i odstający przełożony („wszyscy na 9”)", () => {
    const [a] = unitMirror([
      ocena("u1", "p1", 6),
      ocena("u1", "p1", 5.4),
      ocena("u1", "p1", 3.8),
      ocena("u1", "p3", 6.6),
      ocena("u1", "p3", 6),
      ocena("u1", "p2", 9),
      ocena("u1", "p2", 9),
    ]);
    expect(a).toMatchObject({ unitName: "Wydział A", count: 7, results: { POZYTYWNA: 6, NEGATYWNA: 1 } });
    expect(a!.outliers.map((o) => [o.evaluatorId, o.signal.code])).toEqual([["p2", "LAGODNOSC"]]);
  });

  it("komórka z < 3 ocenami – bez rozkładu i bez wskazywania przełożonych (anonimowość)", () => {
    const b = unitMirror([ocena("u2", "p3", 9), ocena("u2", "p4", 3)])[0]!;
    expect(b).toMatchObject({ count: 2, average: null, results: null, levels: null, outliers: [] });
  });
});
