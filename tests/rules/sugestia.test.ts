import { describe, expect, it } from "vitest";
import { MIN_JUSTIFICATION_LENGTH, suggestLevel, validateFinalDecision } from "@/lib/rules/sugestia";
import { RulesInputError } from "@/lib/rules/bledy";
import { scorePeriodic } from "@/lib/rules/punktacja";
import { rules, type Rules } from "@/lib/domain/przepisy";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import type { CompetencyCode, EvaluationType, IndicatorRatingInput, IndicatorRatingValue, LevelSuggestion } from "@/lib/domain/types";

/** Oceny kolejnych wskaźników kompetencji; null = nieoceniony; "N" = z notatką (np. [5, "N"]). */
type R = IndicatorRatingValue | null | [IndicatorRatingValue, "N"];

function oceny(competency: CompetencyCode, values: R[]): IndicatorRatingInput[] {
  const ids = competencyModel.getCompetency(competency).indicators.map((i) => i.id);
  return values.map((v, i) => ({
    indicatorId: ids[i],
    value: Array.isArray(v) ? v[0] : v,
    hasNote: Array.isArray(v),
  }));
}

function sugestia(competency: CompetencyCode, values: R[], evaluationType: EvaluationType = "OKRESOWA", r?: Rules): LevelSuggestion {
  return suggestLevel(competency, oceny(competency, values), { evaluationType, rules: r });
}

const kody = (s: LevelSuggestion) => s.warnings.map((w) => w.code);
const teksty = (s: LevelSuggestion) => s.explanations.map((e) => e.text).join("\n");

describe("sugestia – ocena okresowa (skala 1/3/5/7/9)", () => {
  it("średnia wskaźników zaobserwowanych zaokrąglona do najbliższej wartości skali", () => {
    // Komunikacja: 4 wskaźniki → powyżej (7), na poziomie (5), powyżej (7), brak okazji
    const s = sugestia("KOMUNIKACJA", [[4, "N"], 3, 4, "BRAK_OBSERWACJI"]);
    expect(s.average).toBeCloseTo(6.333, 3);
    expect(s.suggestedPoints).toBe(7);
    expect(s.suggestedLevel).toBe("POWYZEJ");
    expect(s.tieRoundedDown).toBe(false);
    expect(s.observedCount).toBe(3);
    expect(s.totalCount).toBe(4);
    expect(teksty(s)).toMatch(/\(7 \+ 5 \+ 7\) : 3 = 6,33 pkt/);
    expect(teksty(s)).toMatch(/1 wskaźnik z oznaczeniem „brak okazji do obserwacji” nie wchodzi do średniej/);
    expect(teksty(s)).toMatch(/Najbliższa wartość skali to 7 pkt – „powyżej oczekiwań”/);
    expect(kody(s)).toEqual([]);
  });

  it("średnia równa wartości skali – bez zaokrąglania", () => {
    const s = sugestia("KOMUNIKACJA", [3, 3, 3, 3]);
    expect(s.suggestedPoints).toBe(5);
    expect(s.average).toBe(5);
    expect(s.tieRoundedDown).toBe(false);
  });

  it("remis 6,00 między 5 a 7 zaokrąglamy w dół i oznaczamy flagą", () => {
    const s = sugestia("KOMUNIKACJA", [3, 4, 3, 4]);
    expect(s.average).toBe(6);
    expect(s.suggestedPoints).toBe(5);
    expect(s.tieRoundedDown).toBe(true);
    expect(kody(s)).toContain("REMIS_W_DOL");
    expect(teksty(s)).toMatch(/dokładnie pomiędzy 5 pkt a 7 pkt, więc zaokrąglamy w dół \(wariant ostrożny\)/);
  });

  it("remis przy sześciu wskaźnikach (Współpraca) liczony bez błędów zaokrągleń", () => {
    const s = sugestia("WSPOLPRACA", [3, 4, 3, 4, 3, 4]);
    expect(s.suggestedPoints).toBe(5);
    expect(s.tieRoundedDown).toBe(true);
  });

  it("parametr tieBreak = UP zaokrągla remis w górę bez flagi „w dół”", () => {
    const up: Rules = { ...rules, suggestion: { ...rules.suggestion, tieBreak: "UP" } };
    const s = sugestia("KOMUNIKACJA", [3, 4, 3, 4], "OKRESOWA", up);
    expect(s.suggestedPoints).toBe(7);
    expect(s.tieRoundedDown).toBe(false);
    expect(kody(s)).toContain("REMIS_W_GORE");
  });

  it("średnia 2,00 (1 i 3 pkt) – remis w dół do 1 pkt i ostrzeżenia o ocenie negatywnej", () => {
    const s = sugestia("RZETELNOSC", [1, 2]);
    expect(s.suggestedPoints).toBe(1);
    expect(s.suggestedLevel).toBe("ZNACZNIE_PONIZEJ");
    expect(kody(s)).toEqual(expect.arrayContaining(["OCENA_1_PKT", "BRAK_NOTATKI", "REMIS_W_DOL", "SUGESTIA_1_PKT"]));
    const w = s.warnings.find((x) => x.code === "OCENA_1_PKT")!;
    expect(w.indicatorId).toBe("RZETELNOSC.1");
    expect(w.message).toMatch(/Ocena cząstkowa 1 pkt oznacza ocenę negatywną/);
    expect(w.legalBasis).toBe(rules.periodic.legalBasis.negative);
  });

  it("wskaźnik na poziomie 1 daje ostrzeżenie, nawet gdy sugestia jest wyższa", () => {
    const s = sugestia("KOMUNIKACJA", [[1, "N"], 4, 4, 4]);
    expect(s.suggestedPoints).toBe(5); // (1+7+7+7)/4 = 5,5 → 5
    expect(kody(s)).toEqual(["OCENA_1_PKT"]);
  });

  it("brak notatki przy poziomie 1 lub 5: „uzasadnij przykładem” przy konkretnym wskaźniku", () => {
    const s = sugestia("KOMUNIKACJA", [5, [5, "N"], 3, 3]);
    const brak = s.warnings.filter((w) => w.code === "BRAK_NOTATKI");
    expect(brak).toHaveLength(1);
    expect(brak[0].indicatorId).toBe("KOMUNIKACJA.1");
    expect(brak[0].message).toMatch(/uzasadnij ocenę przykładem \(sytuacja – działanie – rezultat\)/);
  });

  it("poziomy 2–4 nie wymagają notatki", () => {
    expect(kody(sugestia("KOMUNIKACJA", [2, 3, 4, 3]))).not.toContain("BRAK_NOTATKI");
  });

  it("mniej niż połowa wskaźników zaobserwowana → niska wiarygodność", () => {
    const s = sugestia("KOMUNIKACJA", [3, "BRAK_OBSERWACJI", "BRAK_OBSERWACJI", "BRAK_OBSERWACJI"]);
    expect(s.suggestedPoints).toBe(5);
    expect(kody(s)).toContain("NISKA_WIARYGODNOSC");
    expect(s.warnings.find((w) => w.code === "NISKA_WIARYGODNOSC")!.message).toMatch(/Zaobserwowano 1 z 4 wskaźników/);
    expect(teksty(s)).toMatch(/3 wskaźniki z oznaczeniem „brak okazji do obserwacji” nie wchodzą do średniej/);
  });

  it("dokładnie połowa zaobserwowana – bez ostrzeżenia", () => {
    expect(kody(sugestia("KOMUNIKACJA", [3, 3, "BRAK_OBSERWACJI", "BRAK_OBSERWACJI"]))).not.toContain("NISKA_WIARYGODNOSC");
  });

  it("brak zaobserwowanych wskaźników → brak podstaw do sugestii", () => {
    const s = sugestia("RZETELNOSC", ["BRAK_OBSERWACJI", "BRAK_OBSERWACJI"]);
    expect(s.suggestedPoints).toBeNull();
    expect(s.suggestedLevel).toBeNull();
    expect(s.average).toBeNull();
    expect(kody(s)).toEqual(["BRAK_PODSTAW"]);
    expect(s.distribution.BRAK_OBSERWACJI).toBe(2);
  });

  it("wskaźniki nieocenione: informacja, nie liczą się do rozkładu ani średniej", () => {
    const s = suggestLevel("KOMUNIKACJA", oceny("KOMUNIKACJA", [4]), { evaluationType: "OKRESOWA" });
    expect(s.suggestedPoints).toBe(7);
    expect(s.observedCount).toBe(1);
    expect(s.totalCount).toBe(4);
    expect(kody(s)).toEqual(["NIEOCENIONE_WSKAZNIKI", "NISKA_WIARYGODNOSC"]);
    expect(s.warnings[0].message).toMatch(/Nie oceniono jeszcze 3 z 4 wskaźników/);
    expect(s.indicators.map((i) => i.value)).toEqual([4, null, null, null]);
  });

  it("bez żadnych ocen – brak podstaw i informacja o nieocenionych", () => {
    const s = suggestLevel("LUDZIE", [], { evaluationType: "OKRESOWA" });
    expect(s.suggestedPoints).toBeNull();
    expect(kody(s)).toEqual(["NIEOCENIONE_WSKAZNIKI", "BRAK_PODSTAW"]);
  });

  it("dane do panelu „Dlaczego ten poziom?”: rozkład i wskaźniki w kolejności modelu", () => {
    const s = sugestia("KOMUNIKACJA", [[4, "N"], 3, 4, "BRAK_OBSERWACJI"]);
    expect(s.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 2, 5: 0, BRAK_OBSERWACJI: 1 });
    expect(s.indicators.map((i) => i.indicatorId)).toEqual(["KOMUNIKACJA.1", "KOMUNIKACJA.2", "KOMUNIKACJA.3", "KOMUNIKACJA.4"]);
    expect(s.indicators[0]).toMatchObject({ points: 7, hasNote: true, name: competencyModel.getIndicator("KOMUNIKACJA.1")!.name });
    expect(s.indicators[3]).toMatchObject({ value: "BRAK_OBSERWACJI", points: null });
    expect(teksty(s)).toMatch(/To tylko propozycja/);
  });

  it("sugestia nadaje się wprost jako ocena cząstkowa silnika punktacji", () => {
    const s = sugestia("KOMUNIKACJA", [3, 3, 3, 3]);
    const wynik = scorePeriodic([{ competency: "KOMUNIKACJA", kind: "OBOWIAZKOWE", points: s.suggestedPoints as 5 }]);
    expect(wynik.overallLevel).toBe(s.suggestedLevel);
  });
});

describe("sugestia – pierwsza ocena (skala 3/5/7)", () => {
  it("poziomy 1–2 → 3 pkt, 3 → 5 pkt, 4–5 → 7 pkt", () => {
    expect(sugestia("RZETELNOSC", [1, 2], "PIERWSZA").suggestedPoints).toBe(3);
    expect(sugestia("RZETELNOSC", [3, 3], "PIERWSZA").suggestedPoints).toBe(5);
    expect(sugestia("RZETELNOSC", [[4, "N"], [5, "N"]], "PIERWSZA").suggestedPoints).toBe(7);
    expect(sugestia("RZETELNOSC", [2, 4], "PIERWSZA").suggestedPoints).toBe(5); // (3 + 7) : 2 = 5
  });

  it("wyjaśnienie zawiera przeliczenie na skalę trzystopniową", () => {
    const s = sugestia("KOMUNIKACJA", [3, 4, 5, 2], "PIERWSZA");
    expect(teksty(s)).toMatch(/1–2 → 3 pkt, 3 → 5 pkt, 4–5 → 7 pkt/);
    expect(s.suggestedLevel).toBe("NA_POZIOMIE"); // (5 + 7 + 7 + 3) : 4 = 5,5 → 5
  });

  it("remis 6,00 w dół do 5 pkt", () => {
    const s = sugestia("RZETELNOSC", [3, 4], "PIERWSZA");
    expect(s.suggestedPoints).toBe(5);
    expect(s.tieRoundedDown).toBe(true);
  });

  it("poziom 1 – ostrzeżenie o progu ocen za 3 pkt (§ 10 ust. 1 pkt 3)", () => {
    const s = sugestia("RZETELNOSC", [[1, "N"], 3], "PIERWSZA");
    const w = s.warnings.find((x) => x.code === "OCENA_1_PKT")!;
    expect(w.message).toMatch(/w pierwszej ocenie odpowiada 3 pkt/);
    expect(w.legalBasis).toMatch(/pkt 3$/);
    expect(kody(s)).not.toContain("SUGESTIA_1_PKT");
  });
});

describe("sugestia – błędne dane wejściowe", () => {
  it("wskaźnik z innej kompetencji", () => {
    expect(() => suggestLevel("RZETELNOSC", [{ indicatorId: "KOMUNIKACJA.1", value: 3, hasNote: false }], { evaluationType: "OKRESOWA" })).toThrow(
      /KOMUNIKACJA\.1 nie należy do kompetencji „Rzetelność”/,
    );
  });

  it("powtórzony wskaźnik", () => {
    const r = oceny("RZETELNOSC", [3]);
    expect(() => suggestLevel("RZETELNOSC", [...r, ...r], { evaluationType: "OKRESOWA" })).toThrow(RulesInputError);
  });

  it("poziom spoza 1–5", () => {
    const bad = [{ indicatorId: "RZETELNOSC.1", value: 6 as unknown as 5, hasNote: false }] satisfies IndicatorRatingInput[];
    expect(() => suggestLevel("RZETELNOSC", bad, { evaluationType: "OKRESOWA" })).toThrow(/od 1 do 5/);
  });
});

describe("decyzja przełożonego", () => {
  const s = sugestia("KOMUNIKACJA", [[4, "N"], 3, 4, "BRAK_OBSERWACJI"]); // sugestia 7

  it("zgodna z sugestią – bez uzasadnienia", () => {
    expect(validateFinalDecision({ suggestion: s, finalPoints: 7 })).toEqual({
      valid: true,
      justificationRequired: false,
      differsFromSuggestion: false,
      errors: [],
    });
  });

  it("inna niż sugestia – wymaga jednego zdania powodu", () => {
    const v = validateFinalDecision({ suggestion: s, finalPoints: 5 });
    expect(v.valid).toBe(false);
    expect(v.justificationRequired).toBe(true);
    expect(v.differsFromSuggestion).toBe(true);
    expect(v.errors[0].text).toMatch(/Wybrana ocena \(5 pkt\) różni się od sugestii \(7 pkt\)\. Napisz jednym zdaniem, dlaczego\./);
  });

  it(`zbyt krótki powód (< ${MIN_JUSTIFICATION_LENGTH} znaków) nie wystarcza, pełne zdanie tak`, () => {
    expect(validateFinalDecision({ suggestion: s, finalPoints: 5, justification: "  bo tak  " }).valid).toBe(false);
    const ok = validateFinalDecision({ suggestion: s, finalPoints: 5, justification: "Pisemne odpowiedzi wymagały dwóch poprawek w III kwartale." });
    expect(ok.valid).toBe(true);
    expect(ok.differsFromSuggestion).toBe(true);
  });

  it("ocena spoza skali jest odrzucana z podstawą prawną", () => {
    const v = validateFinalDecision({ suggestion: s, finalPoints: 4, justification: "Wystarczająco długi powód zmiany." });
    expect(v.valid).toBe(false);
    expect(v.errors[0].legalBasis).toBe("§ 11 ust. 1 pkt 1");
  });

  it("brak sugestii – dowolna ocena ze skali bez obowiązkowego powodu", () => {
    const none = sugestia("RZETELNOSC", ["BRAK_OBSERWACJI", "BRAK_OBSERWACJI"]);
    expect(validateFinalDecision({ suggestion: none, finalPoints: 5 })).toMatchObject({ valid: true, justificationRequired: false });
  });

  it("pierwsza ocena: 9 pkt spoza skali 3/5/7", () => {
    const p = sugestia("RZETELNOSC", [3, 3], "PIERWSZA");
    const v = validateFinalDecision({ suggestion: p, finalPoints: 9, justification: "Wystarczająco długi powód zmiany." });
    expect(v.valid).toBe(false);
    expect(v.errors[0].text).toMatch(/skali pierwszej oceny \(3, 5, 7\)/);
  });
});
