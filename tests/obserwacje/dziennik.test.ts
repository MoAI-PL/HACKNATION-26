import { describe, expect, it } from "vitest";
import {
  applyFilters,
  filtersToQuery,
  formatDatePl,
  groupByIndicator,
  groupByMonth,
  noteCountsByIndicator,
  observationsForIndicator,
  parseFilters,
  validateObservation,
  type ObservationView,
} from "@/lib/obserwacje/dziennik";

const TODAY = "2026-11-21";

function obs(id: string, date: string, indicatorId: string | null, employeeId = "kasia", extra: Partial<ObservationView> = {}): ObservationView {
  return {
    id,
    employeeId,
    employeeName: employeeId === "kasia" ? "Katarzyna Wójcik" : "Jan Nowak",
    date,
    competency: indicatorId ? (indicatorId.split(".")[0] as ObservationView["competency"]) : null,
    indicatorId,
    behaviorLevel: null,
    situation: "Sytuacja",
    action: "Działanie",
    outcome: "Rezultat",
    originalText: null,
    source: "RECZNA",
    ...extra,
  };
}

const valid = {
  employeeId: "kasia",
  date: "2026-11-20",
  indicatorId: "KOMUNIKACJA.2",
  behaviorLevel: "4",
  situation: "Spotkanie z izbami gospodarczymi.",
  action: "Wyjaśniła przepisy na przykładach.",
  outcome: "Uczestnicy nie mieli dodatkowych pytań.",
};

describe("walidacja obserwacji", () => {
  it("poprawny wpis: kompetencja wynika ze wskaźnika, puste pola SDR → null", () => {
    const r = validateObservation({ ...valid, outcome: "   " }, TODAY);
    expect(r).toEqual({
      ok: true,
      data: {
        employeeId: "kasia",
        date: "2026-11-20",
        indicatorId: "KOMUNIKACJA.2",
        competency: "KOMUNIKACJA",
        behaviorLevel: 4,
        situation: "Spotkanie z izbami gospodarczymi.",
        action: "Wyjaśniła przepisy na przykładach.",
        outcome: null,
      },
    });
  });

  it("bez wskaźnika i poziomu – notatka do przypięcia później", () => {
    const r = validateObservation({ ...valid, indicatorId: "", behaviorLevel: "" }, TODAY);
    expect(r.ok && r.data).toMatchObject({ indicatorId: null, competency: null, behaviorLevel: null });
  });

  it("wymaga co najmniej jednego z pól Sytuacja / Działanie / Rezultat", () => {
    const r = validateObservation({ ...valid, situation: "", action: " ", outcome: "" }, TODAY);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.sdr).toMatch(/co najmniej jedno: sytuację, działanie albo rezultat/);
  });

  it("brak pracownika", () => {
    const r = validateObservation({ ...valid, employeeId: "" }, TODAY);
    expect(!r.ok && r.errors.employeeId).toMatch(/Wybierz pracownika/);
  });

  it.each([
    ["2026-11-22", /z przyszłości/],
    ["2026-02-30", /RRRR-MM-DD/],
    ["21.11.2026", /RRRR-MM-DD/],
  ])("data %s jest odrzucana", (date, msg) => {
    const r = validateObservation({ ...valid, date }, TODAY);
    expect(!r.ok && r.errors.date).toMatch(msg);
  });

  it("dzisiejsza data jest dozwolona", () => {
    expect(validateObservation({ ...valid, date: TODAY }, TODAY).ok).toBe(true);
  });

  it("wskaźnik spoza modelu kompetencji", () => {
    const r = validateObservation({ ...valid, indicatorId: "KOMUNIKACJA.9" }, TODAY);
    expect(!r.ok && r.errors.indicatorId).toMatch(/Nie ma takiego wskaźnika/);
  });

  it("poziom zachowania tylko 1–5 i tylko przy wskaźniku", () => {
    const zly = validateObservation({ ...valid, behaviorLevel: "6" }, TODAY);
    expect(!zly.ok && zly.errors.behaviorLevel).toMatch(/jeden z pięciu opisów/);
    const bezWskaznika = validateObservation({ ...valid, indicatorId: "", behaviorLevel: "3" }, TODAY);
    expect(!bezWskaznika.ok && bezWskaznika.errors.behaviorLevel).toMatch(/po wybraniu wskaźnika/);
  });

  it("zbyt długi opis", () => {
    const r = validateObservation({ ...valid, action: "x".repeat(2001) }, TODAY);
    expect(!r.ok && r.errors.action).toMatch(/Najwyżej 2000 znaków/);
  });
});

describe("filtry dziennika", () => {
  it("parametry adresu → filtry, niepoprawne wartości pomijane", () => {
    expect(parseFilters({ osoba: "kasia", kompetencja: "KOMUNIKACJA", od: "2026-01-01", do: "2026-12-31", widok: "wskazniki" })).toEqual({
      employeeId: "kasia",
      competency: "KOMUNIKACJA",
      from: "2026-01-01",
      to: "2026-12-31",
      view: "wskazniki",
    });
    expect(parseFilters({ kompetencja: "EMPATIA", od: "wczoraj", widok: "inny" })).toEqual({
      employeeId: undefined,
      competency: undefined,
      from: undefined,
      to: undefined,
      view: "os",
    });
  });

  it("filtry → adres i z powrotem", () => {
    const f = { employeeId: "a b", competency: "RZETELNOSC" as const, from: "2026-01-01", view: "wskazniki" as const };
    const q = filtersToQuery(f);
    expect(q).toBe("?osoba=a+b&kompetencja=RZETELNOSC&od=2026-01-01&widok=wskazniki");
    expect(parseFilters(Object.fromEntries(new URLSearchParams(q)))).toMatchObject(f);
    expect(filtersToQuery({ view: "os" })).toBe("");
  });

  it("osoba, kompetencja i okres (granice włącznie)", () => {
    const items = [obs("1", "2026-01-01", "KOMUNIKACJA.1"), obs("2", "2026-06-30", "RZETELNOSC.1"), obs("3", "2026-06-30", "KOMUNIKACJA.2", "jan")];
    expect(applyFilters(items, { view: "os", employeeId: "kasia" }).map((o) => o.id)).toEqual(["1", "2"]);
    expect(applyFilters(items, { view: "os", competency: "KOMUNIKACJA" }).map((o) => o.id)).toEqual(["1", "3"]);
    expect(applyFilters(items, { view: "os", from: "2026-06-30", to: "2026-06-30" }).map((o) => o.id)).toEqual(["2", "3"]);
  });
});

describe("oś czasu i widok według wskaźników", () => {
  const items = [
    obs("a", "2026-10-05", "KOMUNIKACJA.2"),
    obs("b", "2026-11-20", "RZETELNOSC.1"),
    obs("c", "2026-11-02", "KOMUNIKACJA.2"),
    obs("d", "2025-12-31", null),
  ];

  it("miesiące od najnowszego, z polską nazwą", () => {
    const groups = groupByMonth(items);
    expect(groups.map((g) => [g.label, g.items.map((o) => o.id)])).toEqual([
      ["listopad 2026", ["b", "c"]],
      ["październik 2026", ["a"]],
      ["grudzień 2025", ["d"]],
    ]);
  });

  it("kompetencje i wskaźniki w kolejności modelu, nieprzypięte osobno", () => {
    const v = groupByIndicator(items);
    expect(v.competencies.map((c) => [c.competency, c.count])).toEqual([
      ["RZETELNOSC", 1],
      ["KOMUNIKACJA", 2],
    ]);
    expect(v.competencies[1].indicators[0]).toMatchObject({ indicatorId: "KOMUNIKACJA.2", name: expect.stringMatching(/^Wypowiadanie się/) });
    expect(v.competencies[1].indicators[0].items.map((o) => o.id)).toEqual(["c", "a"]);
    expect(v.unpinned.map((o) => o.id)).toEqual(["d"]);
  });

  it("w widoku według wskaźników notatki od najlepszego zachowania do najsłabszego, bez poziomu na końcu", () => {
    const lv = (id: string, date: string, behaviorLevel: 1 | 2 | 3 | 4 | 5 | null) => obs(id, date, "KOMUNIKACJA.2", "kasia", { behaviorLevel });
    const v = groupByIndicator([lv("n", "2026-11-21", null), lv("s", "2026-11-20", 2), lv("w", "2026-01-01", 5), lv("w2", "2026-06-01", 5), lv("o", "2026-03-01", 3)]);
    expect(v.competencies[0].indicators[0].items.map((o) => o.id)).toEqual(["w2", "w", "o", "s", "n"]);
  });

  it("notatki przy wskaźniku jednej osoby i liczniki dla sugestii", () => {
    const all = [...items, obs("e", "2026-11-21", "KOMUNIKACJA.2", "jan")];
    expect(observationsForIndicator(all, "kasia", "KOMUNIKACJA.2").map((o) => o.id)).toEqual(["c", "a"]);
    expect(Object.fromEntries(noteCountsByIndicator(all, "kasia"))).toEqual({ "KOMUNIKACJA.2": 2, "RZETELNOSC.1": 1 });
  });

  it("data po polsku", () => {
    expect(formatDatePl("2026-11-21")).toBe("21 listopada 2026");
    expect(formatDatePl("2026-03-01")).toBe("1 marca 2026");
  });
});
