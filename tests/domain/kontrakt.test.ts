import { describe, expect, it } from "vitest";
import { $Enums } from "@prisma/client";
import * as T from "@/lib/domain/types";
import { COMPETENCY_NAMES, COMPETENCY_XLSX_SHEETS, SUBORDINATE_LABELS, indicatorId } from "@/lib/domain/slownik";
import { rules, rulesSchema } from "@/lib/domain/przepisy";
import rawRules from "../../data/przepisy.json";

describe("kontrakt domeny: typy ↔ Prisma", () => {
  const pary: [string, readonly string[], Record<string, string>][] = [
    ["Role", T.ROLES, $Enums.Role],
    ["EvaluationType", T.EVALUATION_TYPES, $Enums.EvaluationType],
    ["Sheet", T.SHEETS, $Enums.Sheet],
    ["EvaluationStatus", T.EVALUATION_STATUSES, $Enums.EvaluationStatus],
    ["CriterionKind", T.CRITERION_KINDS, $Enums.CriterionKind],
    ["EvaluationResult", T.RESULTS, $Enums.EvaluationResult],
    ["Level", T.LEVELS, $Enums.Level],
    ["ConversationType", T.CONVERSATION_TYPES, $Enums.ConversationType],
    ["ObservationSource", T.OBSERVATION_SOURCES, $Enums.ObservationSource],
    ["SubordinateOption", T.SUBORDINATE_OPTIONS, $Enums.SubordinateOption],
    ["AbsenceKind", T.ABSENCE_KINDS, $Enums.AbsenceKind],
    ["ExamResult", T.EXAM_RESULTS, $Enums.ExamResult],
    ["ExamExemption", T.EXAM_EXEMPTIONS, $Enums.ExamExemption],
    ["CompetencyCode", T.COMPETENCY_CODES, $Enums.CompetencyCode],
  ];

  it.each(pary)("enum %s ma te same wartości w types.ts i schema.prisma", (_nazwa, ts, prisma) => {
    expect([...ts].sort()).toEqual(Object.values(prisma).sort());
  });
});

describe("kontrakt domeny: słownik", () => {
  it("14 kompetencji z nazwami z załącznika nr 1 i arkuszami xlsx", () => {
    expect(T.COMPETENCY_CODES).toHaveLength(14);
    expect(Object.keys(COMPETENCY_NAMES).sort()).toEqual([...T.COMPETENCY_CODES].sort());
    expect(Object.keys(COMPETENCY_XLSX_SHEETS).sort()).toEqual([...T.COMPETENCY_CODES].sort());
    expect(COMPETENCY_NAMES.WIEDZA).toBe("Wykorzystywanie wiedzy i doskonalenie zawodowe");
    expect(COMPETENCY_NAMES.DECYZJE).toBe("Podejmowanie decyzji i odpowiedzialność");
  });

  it("nazwy arkuszy xlsx mieszczą się w limicie Excela (31 znaków)", () => {
    for (const nazwa of Object.values(COMPETENCY_XLSX_SHEETS)) expect(nazwa.length).toBeLessThanOrEqual(31);
  });

  it("identyfikator wskaźnika ma format KOD.nr", () => {
    expect(indicatorId("KOMUNIKACJA", 2)).toBe("KOMUNIKACJA.2");
  });

  it("każda opcja liczby podległych ma etykietę z OSP", () => {
    expect(Object.keys(SUBORDINATE_LABELS).sort()).toEqual([...T.SUBORDINATE_OPTIONS].sort());
  });
});

describe("kontrakt domeny: data/przepisy.json", () => {
  it("plik przechodzi walidację schematu", () => {
    expect(rulesSchema.safeParse(rawRules).success).toBe(true);
  });

  it("kryteria obowiązkowe zgodne z § 4 (A = B + zarządzanie strategiczne)", () => {
    const { A, B, C } = rules.periodic.mandatoryCriteria;
    expect(B).toEqual(["LUDZIE", "DECYZJE", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA"]);
    expect(C).toEqual(["WIEDZA", "RZETELNOSC", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA"]);
    expect(A).toEqual([...B, "STRATEGICZNE"]);
  });

  it("skala § 11: 1/3/5/7/9 i progi z granicami 2, 4, 6, 8", () => {
    expect(rules.periodic.partialScores.map((s) => s.points)).toEqual([1, 3, 5, 7, 9]);
    expect(rules.periodic.overallLevelThresholds.map((t) => t.upTo)).toEqual([2, 4, 6, 8, 9]);
    expect(rules.periodic.maxAdditionalCriteria).toBe(3);
  });

  it("wybór arkusza z OSP: brak podległych → C, każda forma kierowania → B", () => {
    const m = rules.periodic.sheetBySubordinates;
    expect(m.BRAK).toBe("C");
    for (const opcja of T.SUBORDINATE_OPTIONS.filter((o) => o !== "BRAK")) expect(m[opcja]).toBe("B");
  });

  it("pierwsza ocena: 5 elementów i skala 3/5/7", () => {
    expect(rules.firstEval.elements).toEqual(["RZETELNOSC", "WIEDZA", "ORGANIZACJA", "KOMUNIKACJA", "WSPOLPRACA"]);
    expect(rules.firstEval.partialScores.map((s) => s.points)).toEqual([3, 5, 7]);
  });

  it("schemat odrzuca nieciągłe progi poziomu ogólnego", () => {
    const zepsute = structuredClone(rawRules);
    zepsute.periodic.overallLevelThresholds[2].above = 4.5;
    expect(rulesSchema.safeParse(zepsute).success).toBe(false);
  });
});
