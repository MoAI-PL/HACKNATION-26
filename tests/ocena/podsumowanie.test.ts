import { describe, expect, it } from "vitest";
import {
  acknowledgmentIssue,
  missingText,
  partThreeAvailable,
  summarize,
  summaryFormSchema,
  summaryIssues,
  type ScoredCriterion,
  type SummaryForm,
} from "@/lib/ocena/podsumowanie";
import type { CompetencyCode } from "@/lib/domain/types";

const TODAY = "2026-11-21";
const KODY: CompetencyCode[] = ["WIEDZA", "RZETELNOSC", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA", "ANALITYCZNE"];
const kryteria = (...punkty: (number | null)[]): ScoredCriterion[] =>
  punkty.map((score, i) => ({ competency: KODY[i]!, kind: i < 5 ? "OBOWIAZKOWE" : "DODATKOWE", score }));

function wynik(...punkty: number[]) {
  const s = summarize(kryteria(...punkty));
  if (!s.complete) throw new Error("niekompletne");
  return s.result;
}

const form = (zmiany: Partial<SummaryForm> = {}): SummaryForm =>
  summaryFormSchema.parse({ developmentPlan: "Szkolenie z negocjacji, prowadzenie dwóch spotkań z partnerami.", evaluatedAt: "2026-11-20", ...zmiany });

const ctx = (result: ReturnType<typeof wynik>, isCivilServant = false) => ({ result, isCivilServant, today: TODAY, periodStart: "2024-12-14" });

describe("wynik z ocen cząstkowych (Z07)", () => {
  it("komplet ocen → średnia, poziom i wynik z wyjaśnieniem", () => {
    const r = wynik(5, 5, 5, 3, 3, 3);
    expect(r.average).toBe(4);
    expect(r.overallLevel).toBe("PONIZEJ");
    expect(r.result).toBe("NEGATYWNA");
    expect(r.explanations.length).toBeGreaterThan(1);
  });

  it("brakujące oceny → lista kryteriów bez oceny", () => {
    const s = summarize(kryteria(5, null, 5, null, 5));
    expect(s).toEqual({ complete: false, missing: ["RZETELNOSC", "WSPOLPRACA"] });
    expect(missingText(["RZETELNOSC"])).toBe("Brakuje ocen cząstkowych: Rzetelność.");
    expect(summarize([]).complete).toBe(false);
  });
});

describe("sporządzenie oceny – warunki", () => {
  it("nie da się zamknąć oceny negatywnej bez uzasadnienia (§ 11 ust. 3)", () => {
    const negatywna = wynik(9, 9, 9, 9, 1);
    const issues = summaryIssues(form(), ctx(negatywna));
    expect(issues).toEqual([expect.objectContaining({ field: "justification", legalBasis: "§ 11 ust. 3" })]);
    expect(summaryIssues(form({ justification: "Dwukrotnie przekazał opinię po terminie bez informacji." }), ctx(negatywna))).toEqual([]);
  });

  it("ocena pozytywna – uzasadnienie nieobowiązkowe", () => {
    expect(summaryIssues(form(), ctx(wynik(5, 7, 5, 7, 5)))).toEqual([]);
  });

  it("wnioski do IPRZ są zawsze wymagane (§ 11 ust. 1 pkt 5)", () => {
    expect(summaryIssues(form({ developmentPlan: " " }), ctx(wynik(5, 5, 5, 5, 5)))).toEqual([
      expect.objectContaining({ field: "developmentPlan", legalBasis: "§ 11 ust. 1 pkt 5" }),
    ]);
  });

  it("data sporządzenia: wymagana, nie z przyszłości, nie przed początkiem okresu", () => {
    const r = wynik(5, 5, 5, 5, 5);
    expect(summaryIssues(form({ evaluatedAt: undefined }), ctx(r))[0]!.field).toBe("evaluatedAt");
    expect(summaryIssues(form({ evaluatedAt: "2026-11-22" }), ctx(r))[0]!.text).toContain("z przyszłości");
    expect(summaryIssues(form({ evaluatedAt: "2024-12-01" }), ctx(r))[0]!.text).toContain("14.12.2024");
  });
});

describe("część III – wniosek o kolejny stopień (§ 11 ust. 5)", () => {
  it("tylko urzędnik i tylko przy ocenie pozytywnej", () => {
    expect(partThreeAvailable(true, wynik(7, 7, 7, 7, 7))).toBe(true);
    expect(partThreeAvailable(false, wynik(7, 7, 7, 7, 7))).toBe(false);
    expect(partThreeAvailable(true, wynik(3, 3, 3, 3, 3))).toBe(false);
  });

  it("wniosek wymaga stopnia i uzasadnienia", () => {
    const r = wynik(7, 7, 7, 7, 7);
    const bez = summaryIssues(form({ promotionRequest: true, requestedGrade: null }), ctx(r, true));
    expect(bez.map((i) => i.field)).toEqual(["promotion", "promotion"]);
    expect(summaryIssues(form({ promotionRequest: true, requestedGrade: 3, promotionJustification: "Prowadzi zespół projektowy." }), ctx(r, true))).toEqual([]);
  });

  it("wniosek przy ocenie negatywnej albo dla pracownika – błąd", () => {
    expect(summaryIssues(form({ promotionRequest: true, justification: "x" }), ctx(wynik(3, 3, 3, 3, 3), true))[0]!.text).toContain("tylko przy ocenie pozytywnej");
    expect(summaryIssues(form({ promotionRequest: true }), ctx(wynik(7, 7, 7, 7, 7), false))[0]!.text).toContain("tylko urzędnika");
  });
});

describe("zapoznanie się z oceną (§ 12)", () => {
  it("data zapoznania: wymagana, nie przed sporządzeniem, nie z przyszłości", () => {
    expect(acknowledgmentIssue(undefined, "2026-11-20", TODAY)).toContain("Podaj datę");
    expect(acknowledgmentIssue("2026-11-19", "2026-11-20", TODAY)).toContain("20.11.2026");
    expect(acknowledgmentIssue("2026-11-22", "2026-11-20", TODAY)).toContain("z przyszłości");
    expect(acknowledgmentIssue("2026-11-21", "2026-11-20", TODAY)).toBeNull();
  });
});
