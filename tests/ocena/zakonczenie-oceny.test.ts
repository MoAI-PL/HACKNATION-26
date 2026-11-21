import { describe, expect, it } from "vitest";
import {
  assessmentIssues,
  checkDecision,
  criterionProgress,
  decisionInputSchema,
  decisionOptions,
  firstUnratedIndex,
  fromDbLevel,
  ratingInputSchema,
  ratingInputs,
  suggestionFor,
  toDbLevel,
  type CriterionForAssessment,
} from "@/lib/ocena/zakonczenie-oceny";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";

const ids = (code: "KOMUNIKACJA" | "RZETELNOSC") => competencyModel.getCompetency(code).indicators.map((i) => i.id);

function kryterium(zmiany: Partial<CriterionForAssessment> = {}): CriterionForAssessment {
  return { competency: "KOMUNIKACJA", kind: "OBOWIAZKOWE", indicatorIds: ids("KOMUNIKACJA"), ratings: {}, score: null, ...zmiany };
}

describe("oceny wskaźników → sugestia (Z09)", () => {
  it("wejście sugestii: nieoceniony = null, notatka z dziennika = hasNote", () => {
    const [k1, k2] = ids("KOMUNIKACJA");
    const wej = ratingInputs(kryterium({ ratings: { [k1!]: 4 } }), new Map([[k2!, 2]]));
    expect(wej[0]).toEqual({ indicatorId: k1, value: 4, hasNote: false });
    expect(wej[1]).toEqual({ indicatorId: k2, value: null, hasNote: true });
  });

  it("sugestia ze wszystkich zaobserwowanych wskaźników; brak obserwacji nie wchodzi do średniej", () => {
    const [a, b, c, d] = ids("KOMUNIKACJA");
    const s = suggestionFor(kryterium({ ratings: { [a!]: 4, [b!]: 3, [c!]: 4, [d!]: "BRAK_OBSERWACJI" } }), new Map());
    expect(s.observedCount).toBe(3);
    expect(s.suggestedPoints).toBe(7); // (7 + 5 + 7) : 3 = 6,33 → 7
  });

  it("bez ocen – brak podstaw do sugestii", () => {
    expect(suggestionFor(kryterium(), new Map()).suggestedPoints).toBeNull();
  });
});

describe("decyzja przełożonego", () => {
  const [a, b] = ids("RZETELNOSC");
  const s = suggestionFor(kryterium({ competency: "RZETELNOSC", indicatorIds: ids("RZETELNOSC"), ratings: { [a!]: 3, [b!]: 3 } }), new Map());

  it("zgodna z sugestią – bez uzasadnienia", () => {
    expect(s.suggestedPoints).toBe(5);
    expect(checkDecision(s, 5, "").valid).toBe(true);
  });

  it("inna niż sugestia – wymaga powodu (co najmniej jedno zdanie)", () => {
    const bez = checkDecision(s, 7, "bo tak");
    expect(bez.valid).toBe(false);
    expect(bez.differsFromSuggestion).toBe(true);
    expect(checkDecision(s, 7, "Prowadził rozliczenia dotacji bez jednego błędu przez cały okres.").valid).toBe(true);
  });

  it("punkty spoza skali 1/3/5/7/9 są odrzucane", () => {
    expect(checkDecision(s, 4, "Wystarczająco długie uzasadnienie.").valid).toBe(false);
  });

  it("opcje decyzji: 5 poziomów z punktami", () => {
    expect(decisionOptions().map((o) => o.points)).toEqual([1, 3, 5, 7, 9]);
    expect(decisionOptions()[2]!.label).toBe("na poziomie oczekiwań – 5 pkt");
  });
});

describe("postęp i braki", () => {
  it("postęp kryterium i pierwszy nieoceniony wskaźnik", () => {
    const [a, b] = ids("KOMUNIKACJA");
    const c = kryterium({ ratings: { [a!]: 3, [b!]: "BRAK_OBSERWACJI" } });
    expect(criterionProgress(c)).toEqual({ rated: 2, total: 4, decided: false });
    expect(firstUnratedIndex(c)).toBe(2);
    expect(firstUnratedIndex(kryterium({ ratings: Object.fromEntries(ids("KOMUNIKACJA").map((i) => [i, 3])) }))).toBe(0);
  });

  it("braki przed podsumowaniem: kryteria bez decyzji", () => {
    const issues = assessmentIssues([kryterium({ score: 5 }), kryterium({ competency: "RZETELNOSC", indicatorIds: ids("RZETELNOSC") })]);
    expect(issues).toEqual([{ competency: "RZETELNOSC", text: "Rzetelność: oceniono 0 z 2 wskaźników i nie wybrano oceny cząstkowej." }]);
    expect(assessmentIssues([kryterium({ score: 5 })])).toEqual([]);
  });
});

describe("zapis w bazie i wejście akcji", () => {
  it("brak okazji do obserwacji = level null (założenie #10)", () => {
    expect(toDbLevel("BRAK_OBSERWACJI")).toBeNull();
    expect(toDbLevel(4)).toBe(4);
    expect(fromDbLevel(null)).toBe("BRAK_OBSERWACJI");
    expect(fromDbLevel(2)).toBe(2);
  });

  it("walidacja wejścia akcji", () => {
    expect(ratingInputSchema.safeParse({ competency: "KOMUNIKACJA", indicatorId: "KOMUNIKACJA.2", value: 3 }).success).toBe(true);
    expect(ratingInputSchema.safeParse({ competency: "KOMUNIKACJA", indicatorId: "KOMUNIKACJA.2", value: 6 }).success).toBe(false);
    expect(ratingInputSchema.safeParse({ competency: "KOMUNIKACJA", indicatorId: "x", value: 3 }).success).toBe(false);
    expect(decisionInputSchema.parse({ competency: "KOMUNIKACJA", points: 5 }).justification).toBe("");
  });
});
