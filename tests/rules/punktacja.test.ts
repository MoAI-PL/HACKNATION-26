import { describe, expect, it } from "vitest";
import {
  firstEvalPointsForLevel,
  levelForPeriodicPoints,
  overallLevelForAverage,
  periodicPointsForLevel,
  scoreFirstEval,
  scorePeriodic,
} from "@/lib/rules/punktacja";
import { RulesInputError } from "@/lib/rules/bledy";
import { rules } from "@/lib/domain/przepisy";
import type { CompetencyCode, FirstEvalInput, FirstEvalPoints, PartialScore, PeriodicPoints } from "@/lib/domain/types";

// Kryteria arkusza C + dodatkowe – do budowania przykładowych ocen.
const KRYTERIA: CompetencyCode[] = [
  "WIEDZA",
  "RZETELNOSC",
  "ORGANIZACJA",
  "WSPOLPRACA",
  "KOMUNIKACJA",
  "ANALITYCZNE",
  "KLIENT",
  "KREATYWNOSC",
];

function oceny(...punkty: PeriodicPoints[]): PartialScore[] {
  return punkty.map((points, i) => ({ competency: KRYTERIA[i], kind: i < 5 ? "OBOWIAZKOWE" : "DODATKOWE", points }));
}

function pierwsza(punkty: FirstEvalPoints[], zmiany: Partial<FirstEvalInput> = {}): FirstEvalInput {
  return {
    scores: rules.firstEval.elements.map((competency, i) => ({ competency, points: punkty[i] })),
    exam: "ZDANY",
    reportSubmittedOnTime: true,
    ...zmiany,
  };
}

const teksty = (e: { explanations: { text: string }[] }) => e.explanations.map((x) => x.text).join("\n");

describe("skale punktowe", () => {
  it("ocena okresowa: 1/3/5/7/9 (§ 11 ust. 1 pkt 1)", () => {
    expect(periodicPointsForLevel("ZNACZNIE_PONIZEJ")).toBe(1);
    expect(periodicPointsForLevel("NA_POZIOMIE")).toBe(5);
    expect(periodicPointsForLevel("ZNACZNIE_POWYZEJ")).toBe(9);
    expect(levelForPeriodicPoints(7)).toBe("POWYZEJ");
    expect(() => levelForPeriodicPoints(4)).toThrow(RulesInputError);
  });

  it("pierwsza ocena: 3/5/7 i brak skrajnych poziomów (§ 9 ust. 1)", () => {
    expect(firstEvalPointsForLevel("PONIZEJ")).toBe(3);
    expect(firstEvalPointsForLevel("POWYZEJ")).toBe(7);
    expect(() => firstEvalPointsForLevel("ZNACZNIE_PONIZEJ")).toThrow(RulesInputError);
  });
});

describe("poziom ogólny – granice przedziałów (§ 11 ust. 1 pkt 2)", () => {
  it.each([
    [1, "ZNACZNIE_PONIZEJ"],
    [2, "ZNACZNIE_PONIZEJ"],
    [2.01, "PONIZEJ"],
    [4, "PONIZEJ"],
    [4.01, "NA_POZIOMIE"],
    [6, "NA_POZIOMIE"],
    [6.01, "POWYZEJ"],
    [8, "POWYZEJ"],
    [8.01, "ZNACZNIE_POWYZEJ"],
    [9, "ZNACZNIE_POWYZEJ"],
  ] as const)("średnia %s → %s", (srednia, poziom) => {
    expect(overallLevelForAverage(srednia)).toBe(poziom);
  });

  it("poza skalą rzuca czytelny błąd", () => {
    expect(() => overallLevelForAverage(9.5)).toThrow(RulesInputError);
    expect(() => overallLevelForAverage(0.5)).toThrow(RulesInputError);
  });
});

describe("ocena okresowa (§ 11)", () => {
  it("5,5,5,3,3,3 → średnia 4,00, poziom „poniżej”, ocena negatywna z uzasadnieniem", () => {
    const w = scorePeriodic(oceny(5, 5, 5, 3, 3, 3));
    expect(w.average).toBe(4);
    expect(w.overallLevel).toBe("PONIZEJ");
    expect(w.result).toBe("NEGATYWNA");
    expect(w.justificationRequired).toBe(true);
    expect(teksty(w)).toContain("4,00");
    expect(w.explanations.some((e) => e.legalBasis === "§ 11 ust. 1 pkt 4")).toBe(true);
  });

  it("średnia 2,00 → „znacznie poniżej”", () => {
    const w = scorePeriodic(oceny(1, 3)); // suma 4 / 2
    expect(w.overallLevel).toBe("ZNACZNIE_PONIZEJ");
    expect(w.result).toBe("NEGATYWNA");
  });

  it("średnia 6,00 → „na poziomie”, ocena pozytywna, uzasadnienie nieobowiązkowe", () => {
    const w = scorePeriodic(oceny(5, 7, 5, 7, 5, 7));
    expect(w.average).toBe(6);
    expect(w.overallLevel).toBe("NA_POZIOMIE");
    expect(w.result).toBe("POZYTYWNA");
    expect(w.justificationRequired).toBe(false);
  });

  it("średnia 8,00 → „powyżej”", () => {
    const w = scorePeriodic(oceny(7, 9, 7, 9, 7, 9));
    expect(w.overallLevel).toBe("POWYZEJ");
    expect(w.result).toBe("POZYTYWNA");
  });

  it("średnia tuż nad 4 (np. 4,20) → „na poziomie”, pozytywna", () => {
    const w = scorePeriodic(oceny(5, 5, 5, 3, 3)); // 21 / 5
    expect(w.overallLevel).toBe("NA_POZIOMIE");
    expect(w.result).toBe("POZYTYWNA");
  });

  it("średnia 7,40 z jedną oceną za 1 pkt → negatywna, wyjaśnienie wskazuje kryterium", () => {
    const w = scorePeriodic(oceny(9, 9, 9, 9, 1)); // 37 / 5 = 7,4
    expect(w.average).toBeCloseTo(7.4);
    expect(w.overallLevel).toBe("POWYZEJ");
    expect(w.result).toBe("NEGATYWNA");
    expect(w.justificationRequired).toBe(true);
    expect(teksty(w)).toContain("jedna ocena cząstkowa wynosi 1 pkt (");
    expect(teksty(w)).toContain("„Komunikacja”");
  });

  it("dwie oceny za 1 pkt – odmiana w wyjaśnieniu", () => {
    const w = scorePeriodic(oceny(9, 9, 9, 1, 1, 9, 9));
    expect(teksty(w)).toContain("2 oceny cząstkowe wynoszą 1 pkt");
  });

  it("niski poziom i ocena 1 pkt – oba powody w wyjaśnieniu", () => {
    const w = scorePeriodic(oceny(1, 3, 3, 3, 3));
    const negatywne = w.explanations.filter((e) => e.text.startsWith("Ocena jest negatywna"));
    expect(negatywne).toHaveLength(2);
  });

  it("liczy średnią ze wszystkich kryteriów, także dodatkowych", () => {
    const w = scorePeriodic(oceny(5, 5, 5, 5, 5, 9, 9, 9)); // 52 / 8 = 6,5
    expect(w.average).toBe(6.5);
    expect(w.overallLevel).toBe("POWYZEJ");
  });

  it("odrzuca puste, zdublowane i spoza skali oceny cząstkowe", () => {
    expect(() => scorePeriodic([])).toThrow(RulesInputError);
    expect(() =>
      scorePeriodic([
        { competency: "WIEDZA", kind: "OBOWIAZKOWE", points: 5 },
        { competency: "WIEDZA", kind: "OBOWIAZKOWE", points: 7 },
      ]),
    ).toThrow(/więcej niż jedną/);
    expect(() => scorePeriodic([{ competency: "WIEDZA", kind: "OBOWIAZKOWE", points: 4 as PeriodicPoints }])).toThrow(
      RulesInputError,
    );
  });

  it("korzysta z parametrów przekazanych jawnie (edycja przepisów w panelu HR)", () => {
    const zmienione = { ...rules, periodic: { ...rules.periodic, positiveMinOverallLevel: "POWYZEJ" as const } };
    expect(scorePeriodic(oceny(5, 5, 5, 5, 5), zmienione).result).toBe("NEGATYWNA");
  });
});

describe("pierwsza ocena (§ 10)", () => {
  it("3,3,7,7,7 → negatywna (dwie oceny za 3 pkt)", () => {
    const w = scoreFirstEval(pierwsza([3, 3, 7, 7, 7]));
    expect(w.average).toBeCloseTo(5.4);
    expect(w.result).toBe("NEGATYWNA");
    expect(w.justificationRequired).toBe(true);
    expect(teksty(w)).toContain("2 oceny cząstkowe za 3 pkt");
    expect(w.explanations.some((e) => e.legalBasis === "§ 10 ust. 1 pkt 3")).toBe(true);
  });

  it("3,5,5,5,5 → negatywna (średnia 4,60 < 5)", () => {
    const w = scoreFirstEval(pierwsza([3, 5, 5, 5, 5]));
    expect(w.average).toBeCloseTo(4.6);
    expect(w.result).toBe("NEGATYWNA");
    expect(teksty(w)).toContain("4,60");
    expect(w.explanations.some((e) => e.legalBasis === "§ 10 ust. 1 pkt 4")).toBe(true);
  });

  it("3,5,5,7,7 → pozytywna (jedna ocena za 3 pkt, średnia 5,40)", () => {
    const w = scoreFirstEval(pierwsza([3, 5, 5, 7, 7]));
    expect(w.result).toBe("POZYTYWNA");
    expect(w.justificationRequired).toBe(false);
  });

  it("średnia równo 5,00 → pozytywna (granica „nie niższa niż 5”)", () => {
    expect(scoreFirstEval(pierwsza([5, 5, 5, 5, 5])).result).toBe("POZYTYWNA");
    expect(scoreFirstEval(pierwsza([3, 5, 5, 5, 7])).result).toBe("POZYTYWNA");
  });

  it("egzamin „nie dotyczy” z powodem → pozytywna przy spełnieniu pozostałych warunków", () => {
    const w = scoreFirstEval(pierwsza([5, 5, 5, 7, 7], { exam: "NIE_DOTYCZY", examExemption: "ABSOLWENT_KSAP" }));
    expect(w.result).toBe("POZYTYWNA");
    expect(w.explanations.some((e) => e.legalBasis === "§ 10 ust. 3")).toBe(true);
  });

  it("egzamin „nie dotyczy” bez powodu → błąd danych wejściowych", () => {
    expect(() => scoreFirstEval(pierwsza([5, 5, 5, 5, 5], { exam: "NIE_DOTYCZY" }))).toThrow(RulesInputError);
  });

  it("niezdany egzamin → negatywna", () => {
    const w = scoreFirstEval(pierwsza([7, 7, 7, 7, 7], { exam: "NIEZDANY" }));
    expect(w.result).toBe("NEGATYWNA");
    expect(w.explanations.some((e) => e.legalBasis === "§ 10 ust. 1 pkt 1")).toBe(true);
  });

  it("sprawozdanie po terminie → negatywna", () => {
    const w = scoreFirstEval(pierwsza([7, 7, 7, 7, 7], { reportSubmittedOnTime: false }));
    expect(w.result).toBe("NEGATYWNA");
    expect(teksty(w)).toContain("Sprawozdanie nie zostało złożone w wyznaczonym terminie.");
  });

  it("kilka niespełnionych warunków – wszystkie w wyjaśnieniu", () => {
    const w = scoreFirstEval(pierwsza([3, 3, 3, 5, 5], { exam: "NIEZDANY", reportSubmittedOnTime: false }));
    expect(teksty(w)).toContain("nie są spełnione 4 warunki");
  });

  it("wymaga ocen wszystkich 5 elementów i tylko ich", () => {
    const niepelna = pierwsza([5, 5, 5, 5, 5]);
    niepelna.scores = niepelna.scores.slice(0, 4);
    expect(() => scoreFirstEval(niepelna)).toThrow(/Brak ocen cząstkowych/);

    const nadmiarowa = pierwsza([5, 5, 5, 5, 5]);
    nadmiarowa.scores.push({ competency: "KREATYWNOSC", points: 5 });
    expect(() => scoreFirstEval(nadmiarowa)).toThrow(/nie obejmuje kryterium/);
  });

  it("odrzuca punkty spoza skali 3/5/7", () => {
    expect(() => scoreFirstEval(pierwsza([5, 5, 5, 5, 9 as FirstEvalPoints]))).toThrow(RulesInputError);
  });

  it("wyjaśnienie pozytywnej oceny podaje progi z parametrów", () => {
    expect(teksty(scoreFirstEval(pierwsza([3, 5, 5, 7, 7])))).toContain("najwyżej 1 ocena cząstkowa za 3 pkt i ocena łączna co najmniej 5,00 pkt");
    const zmienione = { ...rules, firstEval: { ...rules.firstEval, minAverage: 4, maxScoresAtMinimum: 2 } };
    const w = scoreFirstEval(pierwsza([3, 3, 5, 5, 5]), zmienione);
    expect(w.result).toBe("POZYTYWNA");
    expect(teksty(w)).toContain("najwyżej 2 oceny cząstkowe za 3 pkt i ocena łączna co najmniej 4,00 pkt");
  });
});
