// Zestaw testowy asystenta formalnego (Z25): poprawność pliku pytań, logika oceny i próg jakości wyszukiwania.
// Pełny pomiar z modelem: `npm run eval`.
import { describe, expect, it } from "vitest";
import pytania from "../../eval/pytania.json";
import knowledgeBase from "../../data/wiedza/fragmenty.json";
import { searchKnowledge } from "@/lib/ai/rag/search";
import {
  evalSetSchema,
  fold,
  markdownReport,
  matchesSource,
  missingKeywords,
  scoreAnswerInScope,
  scoreAnswerOutOfScope,
  scoreRetrievalInScope,
  scoreRetrievalOutOfScope,
  summarizeAnswers,
  summarizeRetrieval,
  type AnswerInput,
} from "@/lib/ai/eval/ocena";

const set = evalSetSchema.parse(pytania);
const fragments = (knowledgeBase as { fragments: { id: string; text: string }[] }).fragments;

describe("plik eval/pytania.json", () => {
  it("ma około 25 pytań w zakresie i 5 spoza zakresu, z unikalnymi identyfikatorami", () => {
    expect(set.pytania.length).toBeGreaterThanOrEqual(25);
    expect(set.pozaZakresem.length).toBeGreaterThanOrEqual(5);
    const ids = [...set.pytania, ...set.pozaZakresem].map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("każde oczekiwane źródło istnieje w bazie wiedzy", () => {
    for (const q of set.pytania) {
      for (const z of q.zrodla) {
        expect(fragments.some((f) => matchesSource(f.id, [z])), `${q.id}: ${z}`).toBe(true);
      }
    }
  });

  it("słowa kluczowe odpowiedzi wzorcowej występują w oczekiwanych źródłach (wzorzec jest ugruntowany)", () => {
    for (const q of set.pytania) {
      const text = fragments.filter((f) => matchesSource(f.id, q.zrodla)).map((f) => f.text).join("\n");
      expect(missingKeywords(text, q.kluczowe), q.id).toEqual([]);
    }
  });
});

describe("logika oceny", () => {
  const q = set.pytania.find((p) => p.id === "Q03")!; // sprzeciw – 7 dni
  const out = set.pozaZakresem[0]!;
  const ans = (over: Partial<AnswerInput>): AnswerInput => ({
    answer: "Sprzeciw składa się w ciągu 7 dni od zapoznania się z oceną.",
    refused: false,
    mode: "AI",
    sourceIds: ["FAQ:sprzeciw"],
    durationMs: 1200,
    ...over,
  });

  it("dopasowanie źródła: dokładne i po prefiksie, bez fałszywych trafień", () => {
    expect(matchesSource("PORADNIK_OKRESOWE:s32:69", ["PORADNIK_OKRESOWE:s32"])).toBe(true);
    expect(matchesSource("PORADNIK_OKRESOWE:s320:1", ["PORADNIK_OKRESOWE:s32"])).toBe(false);
    expect(matchesSource("MODEL_KOMPETENCJI:WSPOLPRACA.3", ["MODEL_KOMPETENCJI:WSPOLPRACA"])).toBe(true);
    expect(matchesSource("ROZP_OKRESOWE:§11:ust.3", ["ROZP_OKRESOWE:§11"])).toBe(true);
    expect(matchesSource("ROZP_OKRESOWE:§1", ["ROZP_OKRESOWE:§11"])).toBe(false);
  });

  it("słowa kluczowe bez względu na wielkość liter i polskie znaki", () => {
    expect(fold("Siedmiu  DNI")).toBe("siedmiu dni");
    expect(missingKeywords("w ciągu SIEDMIU dni", [["7 dni", "siedmiu dni"]])).toEqual([]);
    expect(missingKeywords("w ciagu 14 dni", [["7 dni"]])).toEqual([["7 dni"]]);
  });

  it("odpowiedź poprawna: tryb AI, właściwe źródło, wymagana treść", () => {
    expect(scoreAnswerInScope(q, ans({})).ok).toBe(true);
  });

  it.each([
    ["zła treść", { answer: "Sprzeciw składa się w ciągu 14 dni." }, "brak w odpowiedzi"],
    ["obce źródło", { sourceIds: ["ROZP_PIERWSZA:§3"] }, "źródło spoza oczekiwanych"],
    ["bez źródła", { sourceIds: [] }, "bez źródła"],
    ["odmowa", { refused: true, sourceIds: [], answer: "Nie znalazłem…" }, "niepotrzebna odmowa"],
    ["tryb bez AI", { mode: "BEZ_AI" as const }, "bez AI"],
  ])("odpowiedź niepoprawna – %s", (_n, over, powod) => {
    const r = scoreAnswerInScope(q, ans(over));
    expect(r.ok).toBe(false);
    expect(r.powod).toContain(powod);
  });

  it("pytanie spoza zakresu: dobrze tylko przy odmowie", () => {
    expect(scoreAnswerOutOfScope(out, ans({ refused: true, sourceIds: [] })).ok).toBe(true);
    expect(scoreAnswerOutOfScope(out, ans({})).ok).toBe(false);
  });

  it("wyszukiwanie: pozycja właściwego fragmentu i odmowa", () => {
    const r = scoreRetrievalInScope(q, { sufficient: true, hitIds: ["X:1", "PORADNIK_OKRESOWE:s32:69"] });
    expect(r).toMatchObject({ ok: true, rank: 2 });
    expect(scoreRetrievalInScope(q, { sufficient: false, hitIds: ["FAQ:sprzeciw"] }).ok).toBe(false);
    expect(scoreRetrievalOutOfScope(out, { sufficient: false, hitIds: [] }).ok).toBe(true);
  });

  it("podsumowanie liczy procenty i trafia do raportu", () => {
    const answers = [scoreAnswerInScope(q, ans({})), scoreAnswerInScope(q, ans({ sourceIds: [] })), scoreAnswerOutOfScope(out, ans({ refused: true, sourceIds: [] }))];
    const s = summarizeAnswers(answers);
    expect(s.trafnosc).toEqual({ ok: 1, all: 2, percent: 50 });
    expect(s.zeZrodlem).toEqual({ ok: 1, all: 2, percent: 50 });
    expect(s.odmowy).toEqual({ ok: 1, all: 1, percent: 100 });
    const retrieval = [scoreRetrievalInScope(q, { sufficient: true, hitIds: ["FAQ:sprzeciw"] })];
    const md = markdownReport({ date: "21.11.2026", fragments: 406, retrieval: summarizeRetrieval(retrieval), retrievalResults: retrieval, answers: { model: "test", summary: s, results: answers } });
    expect(md).toContain("Trafność odpowiedzi");
    expect(md).toContain("1/2 (50%)");
    expect(md).toContain("Błędy do poprawy");
  });
});

describe("jakość wyszukiwania na zestawie testowym (próg regresji)", () => {
  const retrieval = [
    ...set.pytania.map((p) => {
      const r = searchKnowledge(p.pytanie, { limit: 5 });
      return scoreRetrievalInScope(p, { sufficient: r.sufficient, hitIds: r.hits.map((h) => h.fragment.id) });
    }),
    ...set.pozaZakresem.map((p) => {
      const r = searchKnowledge(p.pytanie, { limit: 5 });
      return scoreRetrievalOutOfScope(p, { sufficient: r.sufficient, hitIds: r.hits.map((h) => h.fragment.id) });
    }),
  ];
  const s = summarizeRetrieval(retrieval);

  // ZAŁOŻENIE: progi ustawione na wyniku z 21.11 (25/25 i 3/5) z małym zapasem; spadek poniżej = regresja bazy wiedzy lub wyszukiwarki.
  it("właściwy fragment w top 5 dla co najmniej 90% pytań w zakresie", () => {
    const fails = retrieval.filter((r) => r.inScope && !r.ok).map((r) => `${r.id}: ${r.powod}`);
    expect(s.trafnoscZrodla.percent, fails.join("\n")).toBeGreaterThanOrEqual(90);
  });

  it("co najmniej 3 z 5 pytań spoza zakresu odrzucone już na wyszukiwaniu (reszta – przez model)", () => {
    expect(s.odmowy.ok).toBeGreaterThanOrEqual(3);
  });

  it("prompt injection nie przechodzi przez wyszukiwanie", () => {
    expect(retrieval.find((r) => r.id === "P05")?.ok).toBe(true);
  });
});
