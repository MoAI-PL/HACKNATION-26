// Tryb „5 minut przed rozmową”: jedna strona z faktami, trzema pytaniami i trzema pułapkami.
import { describe, expect, it } from "vitest";
import type { ObservationView } from "@/lib/obserwacje/dziennik";
import { BRIEF_MAX_FACTS, BRIEF_MAX_PITFALLS, BRIEF_MAX_QUESTIONS, buildFiveMinuteBrief } from "@/lib/rozmowa/piec-minut";
import { buildConversationPrep, type PrepInput } from "@/lib/rozmowa/przygotowanie";

const TODAY = "2026-11-22";

function obs(id: string, indicatorId: string, level: 1 | 2 | 3 | 4 | 5 | null, date: string): ObservationView {
  return {
    id, employeeId: "kasia", employeeName: "Katarzyna Wójcik", date, competency: null, indicatorId, behaviorLevel: level,
    situation: `Sytuacja ${id}`, action: `Działanie ${id}`, outcome: `Rezultat ${id}`, originalText: null, source: "RECZNA",
  };
}

const base: PrepInput = {
  kind: "OCENIAJACA",
  employeeName: "Katarzyna Wójcik",
  positionTitle: "radca",
  dominantTasks: ["Analizuje i dokonuje oceny prawa krajowego.", "Prowadzi sprawy dotyczące opinii indywidualnych."],
  criteria: [
    { competency: "KOMUNIKACJA", kind: "OBOWIAZKOWE" },
    { competency: "WSPOLPRACA", kind: "OBOWIAZKOWE" },
    { competency: "ANALITYCZNE", kind: "DODATKOWE" },
  ],
  ratings: [],
  observations: [obs("a", "ANALITYCZNE.3", 5, "2026-06-10"), obs("b", "KOMUNIKACJA.4", 2, "2026-09-01"), obs("c", "WSPOLPRACA.2", 4, "2026-10-01")],
  deadline: { date: "2026-12-01", label: "ocena okresowa do wt. 01.12" },
  stage: { status: "W_OCENIE", suggested: "OCENIAJACA" },
};

const brief = (input: PrepInput) => buildFiveMinuteBrief(input, buildConversationPrep(input), TODAY);

describe("5 minut przed rozmową", () => {
  it("rozmowa oceniająca: zakres, termin, mocna strona, obszar do rozwoju i notatki w faktach", () => {
    const b = brief(base);
    expect(b.title).toBe("5 minut przed rozmową: Katarzyna Wójcik");
    expect(b.facts[0]).toContain("§ 10 rozporządzenia");
    expect(b.facts).toContain("Termin: ocena okresowa do wt. 01.12.");
    expect(b.facts.some((f) => f.startsWith("Mocna strona: Formułowanie wniosków"))).toBe(true);
    expect(b.facts.some((f) => f.startsWith("Do rozwoju:"))).toBe(true);
    expect(b.facts).toContain("Notatki w dzienniku: 3, ostatnia z 1 października 2026.");
    expect(b.facts.length).toBeLessThanOrEqual(BRIEF_MAX_FACTS);
  });

  it("najwyżej trzy pytania i trzy pułapki – ostatnia zawsze typowa dla rodzaju rozmowy", () => {
    for (const kind of ["WSTEPNA", "ROZPOCZYNAJACA", "OCENIAJACA"] as const) {
      const b = brief({ ...base, kind, stage: { status: "W_OCENIE", suggested: kind } });
      expect(b.questions.length).toBeGreaterThan(0);
      expect(b.questions.length).toBeLessThanOrEqual(BRIEF_MAX_QUESTIONS);
      expect(b.pitfalls).toHaveLength(BRIEF_MAX_PITFALLS);
      expect(new Set(b.pitfalls.map((p) => p.title)).size).toBe(BRIEF_MAX_PITFALLS);
      expect(b.opening.length).toBeGreaterThan(40);
    }
    expect(brief({ ...base, kind: "WSTEPNA" }).pitfalls.at(-1)!.title).toContain("terminu sprawozdania");
  });

  it("pułapki z danych: efekt świeżości z Lustra, gdy większość notatek jest z ostatniego miesiąca", () => {
    const recent = [obs("x", "KOMUNIKACJA.4", 3, "2026-11-10"), obs("y", "WSPOLPRACA.2", 3, "2026-11-15"), obs("z", "KOMUNIKACJA.4", 3, "2026-11-20")];
    const b = brief({ ...base, observations: recent });
    expect(b.pitfalls[0]!.title).toBe("Większość notatek pochodzi z ostatniego miesiąca");
  });

  it("efekt aureoli z ocen wskaźników i ostrzeżenie po ocenie negatywnej z podstawą prawną", () => {
    const ratings = ["KOMUNIKACJA.1", "KOMUNIKACJA.2", "KOMUNIKACJA.3", "WSPOLPRACA.1", "WSPOLPRACA.2"].map((indicatorId) => ({ indicatorId, value: 4 as const }));
    const b = brief({ ...base, ratings, isReevaluation: true });
    expect(b.facts).toContain("To ponowna ocena po ocenie negatywnej (art. 81 ust. 9 ustawy o służbie cywilnej).");
    const titles = b.pitfalls.map((p) => p.title);
    expect(titles).toContain("Wszystkie wskaźniki na jednym poziomie");
    expect(titles).toHaveLength(BRIEF_MAX_PITFALLS);
  });

  it("bez notatek – fakt mówi to wprost; rozmowa wstępna nie liczy notatek", () => {
    expect(brief({ ...base, observations: [] }).facts).toContain("Brak notatek w dzienniku obserwacji z tego okresu.");
    expect(brief({ ...base, kind: "WSTEPNA", stage: { status: "DO_ROZPOCZECIA", suggested: "WSTEPNA" } }).facts.some((f) => f.startsWith("Notatki"))).toBe(false);
  });
});

describe("5 minut przed rozmową – poprzednia ocena", () => {
  it("wynik poprzedniej oceny bez powtórzonego słowa „ocena”", () => {
    const b = buildFiveMinuteBrief({ ...base, previousResult: "POZYTYWNA" }, buildConversationPrep({ ...base, previousResult: "POZYTYWNA" }), TODAY);
    expect(b.facts).toContain("Poprzednia ocena: pozytywna.");
  });
});
