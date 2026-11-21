import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CompetencyModelImportError, normalizeText, parseCompetencyModel } from "@/lib/import/model-kompetencji";
import { competencyModelSchema, createCompetencyModelIndex } from "@/lib/domain/model-kompetencji";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import { COMPETENCY_NAMES, COMPETENCY_XLSX_SHEETS } from "@/lib/domain/slownik";
import { COMPETENCY_CODES, type CompetencyModel } from "@/lib/domain/types";
import committed from "../../data/model-kompetencji.json";
import { ZALACZNIK_1 } from "./zalacznik-1";
import { HEADERS, buildXlsx, minimalModelSheets } from "./xlsx-fabryka";

const SOURCE = "materialy/Model_kompetencji.xlsx";
const fresh = parseCompetencyModel(readFileSync(SOURCE), { source: SOURCE, importedAt: "2026-11-21" });
const model = fresh.model;

/** Oczekiwana liczba wskaźników (sekcja 8.4 master promptu, zgodna z załącznikiem nr 1). */
const EXPECTED_COUNTS: Record<string, number> = {
  RZETELNOSC: 2, KOMUNIKACJA: 4, WIEDZA: 3, ORGANIZACJA: 5, KREATYWNOSC: 2, WSPOLPRACA: 6, ANALITYCZNE: 3,
  NEGOCJOWANIE: 3, WYSTAPIENIA: 4, KLIENT: 2, KRYZYS: 3, STRATEGICZNE: 3, LUDZIE: 6, DECYZJE: 3,
};

function expectImportError(sheets: ReturnType<typeof minimalModelSheets>, fragment: RegExp) {
  try {
    parseCompetencyModel(buildXlsx(sheets), { source: "test.xlsx" });
  } catch (e) {
    expect(e).toBeInstanceOf(CompetencyModelImportError);
    expect((e as CompetencyModelImportError).problems.join("\n")).toMatch(fragment);
    return e as CompetencyModelImportError;
  }
  throw new Error("Oczekiwano błędu importu, a import się powiódł.");
}

describe("import modelu kompetencji z pliku MC", () => {
  it("14 kompetencji, 49 wskaźników, 5 poziomów", () => {
    expect(model.competencies).toHaveLength(14);
    expect(model.competencies.flatMap((c) => c.indicators)).toHaveLength(49);
    for (const ind of model.competencies.flatMap((c) => c.indicators)) {
      expect(Object.keys(ind.levels)).toEqual(["1", "2", "3", "4", "5"]);
    }
    expect(fresh.warnings).toEqual([]);
  });

  it("liczba wskaźników w każdej kompetencji zgodna z modelem", () => {
    expect(Object.fromEntries(model.competencies.map((c) => [c.code, c.indicators.length]))).toEqual(EXPECTED_COUNTS);
  });

  it("kompetencje w kolejności spisu, z nazwami z załącznika nr 1", () => {
    expect(model.competencies.map((c) => c.code)).toEqual([...COMPETENCY_CODES]);
    for (const c of model.competencies) expect(c.name).toBe(COMPETENCY_NAMES[c.code]);
  });

  it.each(COMPETENCY_CODES)("nazwy wskaźników %s identyczne z załącznikiem nr 1 do rozporządzenia", (code) => {
    const c = model.competencies.find((x) => x.code === code)!;
    expect(c.indicators.map((i) => i.name)).toEqual(ZALACZNIK_1[code]);
  });

  it("identyfikatory KOD.numer w kolejności z arkusza", () => {
    for (const c of model.competencies) {
      expect(c.indicators.map((i) => i.id)).toEqual(c.indicators.map((_, n) => `${c.code}.${n + 1}`));
      expect(c.indicators.every((i) => i.competency === c.code)).toBe(true);
    }
  });

  it("teksty bez łamań linii, podwójnych spacji i spacji na końcach, opisy poziomów różne", () => {
    for (const ind of model.competencies.flatMap((c) => c.indicators)) {
      for (const t of [ind.name, ...Object.values(ind.levels)]) {
        expect(t).toBe(normalizeText(t));
        expect(t.length).toBeGreaterThan(10);
      }
      expect(new Set(Object.values(ind.levels)).size).toBe(5);
    }
  });

  it("wskazówki do oceny z arkusza „Model kompetencji” (sekcja 8.4)", () => {
    expect(model.guidance).toHaveLength(3);
    expect(model.guidance[0]).toMatch(/^Dobierz wskaźniki do zadań/);
    expect(model.guidance[1]).toMatch(/Zapisz sytuację, działanie i jego rezultat/);
    expect(model.guidance[2]).toMatch(/odnotuj brak podstaw do oceny/);
  });

  it("data/model-kompetencji.json jest aktualny względem xlsx (inaczej: npm run model)", () => {
    expect({ ...(committed as CompetencyModel), importedAt: model.importedAt }).toEqual(model);
  });
});

describe("dostęp do modelu w aplikacji", () => {
  it("wskaźnik i opis zachowania po identyfikatorze", () => {
    const ind = competencyModel.getIndicator("KOMUNIKACJA.2");
    expect(ind?.name).toMatch(/^Wypowiadanie się w sposób jasny i precyzyjny/);
    expect(competencyModel.behaviorDescription("KOMUNIKACJA.2", 3)).toBe(ind?.levels[3]);
    expect(competencyModel.getIndicator("KOMUNIKACJA.9")).toBeUndefined();
  });

  it("kompetencja po kodzie i płaska lista wskaźników", () => {
    expect(competencyModel.getCompetency("LUDZIE").indicators).toHaveLength(6);
    expect(competencyModel.indicators).toHaveLength(49);
  });

  it("schemat odrzuca model z pomieszaną kolejnością identyfikatorów i błędną nazwą", () => {
    const broken = structuredClone(committed) as CompetencyModel;
    broken.competencies[1].indicators[0].id = "KOMUNIKACJA.2";
    broken.competencies[2].name = "Wiedza";
    const r = competencyModelSchema.safeParse(broken);
    expect(r.success).toBe(false);
    const msg = r.error!.issues.map((i) => i.message).join("\n");
    expect(msg).toMatch(/KOMUNIKACJA\.1/);
    expect(msg).toMatch(/Wykorzystywanie wiedzy i doskonalenie zawodowe/);
  });

  it("schemat odrzuca model bez którejś kompetencji i z pustym opisem zachowania", () => {
    const broken = structuredClone(committed) as CompetencyModel;
    broken.competencies.pop();
    broken.competencies[0].indicators[0].levels[4] = "  ";
    expect(() => createCompetencyModelIndex(broken)).toThrow(/DECYZJE|pusty/);
  });
});

describe("import: poprawny plik w innym układzie zapisu", () => {
  it("minimalny model przechodzi, łamania linii są ujednolicone", () => {
    const { model: m, warnings } = parseCompetencyModel(buildXlsx(minimalModelSheets()), { source: "test.xlsx", importedAt: "2026-01-02" });
    expect(m.competencies).toHaveLength(14);
    expect(m.competencies[0].indicators[0].name).toBe("Wskaźnik RZETELNOSC w dwóch liniach.");
    expect(m.guidance).toEqual(["Wskazówka pierwsza."]);
    expect(m.importedAt).toBe("2026-01-02");
    expect(warnings).toEqual([]);
  });

  it("dodatkowy arkusz to tylko uwaga, nie błąd", () => {
    const sheets = { ...minimalModelSheets(), Notatki: [["coś"]] };
    const { warnings } = parseCompetencyModel(buildXlsx(sheets), { source: "test.xlsx" });
    expect(warnings).toEqual(["Pominięto nieznany arkusz „Notatki”."]);
  });
});

describe("import: czytelne błędy dla uszkodzonego pliku", () => {
  it("plik, który nie jest xlsx", () => {
    expect(() => parseCompetencyModel(new TextEncoder().encode("to nie jest Excel"), { source: "x" })).toThrow(/nie jest skoroszytem \.xlsx/);
  });

  it("brak arkusza kompetencji", () => {
    const sheets = minimalModelSheets();
    delete sheets[COMPETENCY_XLSX_SHEETS.KRYZYS];
    expectImportError(sheets, /Brak arkusza „RADZENIE SOBIE W SYTUACJIACH KR”/);
  });

  it("brak arkusza ze spisem", () => {
    const sheets = minimalModelSheets();
    delete sheets["Model kompetencji"];
    expectImportError(sheets, /Brak arkusza „Model kompetencji”/);
  });

  it("zmieniony nagłówek poziomu – z adresem komórki", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA[2] = [...HEADERS.slice(0, 3), "Średnio", ...HEADERS.slice(4)];
    expectImportError(sheets, /„KOMUNIKACJA”!D3: oczekiwano nagłówka „na poziomie oczekiwań”, jest „Średnio”/);
  });

  it("dodatkowa, szósta kolumna poziomu", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA[2] = [...HEADERS, "Wybitnie"];
    expectImportError(sheets, /„KOMUNIKACJA”!G3: nieoczekiwana kolumna/);
  });

  it("brak opisu zachowania dla poziomu", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA[3] = ["Wskaźnik", "a", "b", "", "d", "e"];
    expectImportError(sheets, /„KOMUNIKACJA”!A4: wskaźnik „Wskaźnik” nie ma opisu zachowania dla poziomu: na poziomie oczekiwań/);
  });

  it("opisy bez nazwy wskaźnika", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA.push([null, "a", "b", "c", "d", "e"]);
    expectImportError(sheets, /„KOMUNIKACJA”!A5: brak nazwy wskaźnika/);
  });

  it("powtórzony wskaźnik", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA.push([...sheets.KOMUNIKACJA[3]]);
    expectImportError(sheets, /występuje w arkuszu dwa razy/);
  });

  it("wskaźnik oddzielony pustym wierszem nie ginie po cichu", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA.push([], ["Zgubiony wskaźnik", "a", "b", "c", "d", "e"]);
    expectImportError(sheets, /„KOMUNIKACJA”!A6: treść poniżej pustego wiersza 5/);
  });

  it("liczba wskaźników niezgodna ze spisem", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA.push(["Drugi wskaźnik", "a", "b", "c", "d", "e"]);
    expectImportError(sheets, /„Komunikacja”: w spisie podano 1 wskaźników, a arkusz „KOMUNIKACJA” zawiera 2/);
  });

  it("deklaracja w nagłówku spisu niezgodna z treścią", () => {
    const sheets = minimalModelSheets();
    sheets["Model kompetencji"][2] = ["14 kompetencji • 49 wskaźników behawioralnych • 5 poziomów oceny"];
    expectImportError(sheets, /deklaruje 14 kompetencji, 49 wskaźników i 5 poziomów, a plik zawiera 14 kompetencji, 14 wskaźników/);
  });

  it("kompetencja spoza załącznika nr 1 w spisie", () => {
    const sheets = minimalModelSheets();
    sheets["Model kompetencji"][6] = ["1", "EMPATIA", "1"];
    const e = expectImportError(sheets, /„Model kompetencji”!B7: nieznana kompetencja „EMPATIA”/);
    expect(e.problems.join("\n")).toMatch(/w spisie brakuje kompetencji: Rzetelność/);
  });

  it("tytuł arkusza nie pasuje do kompetencji", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA[0] = ["WSPÓŁPRACA"];
    expectImportError(sheets, /„KOMUNIKACJA”!A1: tytuł „WSPÓŁPRACA” nie odpowiada kompetencji „Komunikacja”/);
  });

  it("zbiera wszystkie problemy naraz, a nie tylko pierwszy", () => {
    const sheets = minimalModelSheets();
    sheets.KOMUNIKACJA[3] = ["Wskaźnik", "", "", "", "", "e"];
    delete sheets[COMPETENCY_XLSX_SHEETS.LUDZIE];
    const e = expectImportError(sheets, /KOMUNIKACJA/);
    expect(e.problems.length).toBeGreaterThanOrEqual(2);
    expect(e.message).toMatch(/Problemy \(\d+\)/);
  });
});
