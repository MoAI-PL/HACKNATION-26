import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { OspImportError, parseOsp } from "@/lib/import/osp";
import { readDocx } from "@/lib/import/docx";
import { selectSheet } from "@/lib/rules/arkusz";
import { rules } from "@/lib/domain/przepisy";
import { SUBORDINATE_OPTIONS } from "@/lib/domain/types";
import { buildDocx, ospDocx, p, placeholder, tbl, tc, tr, type Check } from "./docx-fabryka";
import seedOsp from "../../prisma/seed-dane/osp.json";

const osp = (name: string) => parseOsp(readFileSync(`materialy/OSP/${name}.docx`));
const radca = osp("OSP_radca_DSI_WWI");
const specjalista = osp("OSP_starszy_specjalista_DC_WZKSOiC");
const naczelnik = osp("OSP_naczelnik_DWM_WKAM");

function expectOspError(data: Uint8Array, fragment: RegExp) {
  try {
    parseOsp(data);
  } catch (e) {
    expect(e).toBeInstanceOf(OspImportError);
    expect((e as OspImportError).problems.join("\n")).toMatch(fragment);
    return;
  }
  throw new Error("Oczekiwano błędu importu OSP.");
}

describe("wybór arkusza z OSP od MC", () => {
  it("radca → arkusz C (brak podległych pracowników)", () => {
    expect(radca.position.subordinates).toBe("BRAK");
    expect(radca.sheet.sheet).toBe("C");
    expect(radca.sheet.explanation.text).toBe(
      "Wybrano arkusz C, bo w OSP zaznaczono „brak podległych pracowników”. Arkusz B dotyczy tylko stanowisk, na których praca polega na bezpośrednim kierowaniu pracownikami.",
    );
    expect(radca.sheet.explanation.legalBasis).toBe("§ 3");
  });

  it("starszy specjalista → arkusz C", () => {
    expect(specjalista.position.subordinates).toBe("BRAK");
    expect(specjalista.sheet.sheet).toBe("C");
  });

  it("naczelnik (5–9 podległych) → arkusz B z kryteriami obowiązkowymi B", () => {
    expect(naczelnik.position.subordinates).toBe("OD_5_DO_9");
    expect(naczelnik.sheet.sheet).toBe("B");
    expect(naczelnik.sheet.mandatoryCriteria).toEqual(rules.periodic.mandatoryCriteria.B);
    expect(naczelnik.sheet.explanation.text).toMatch(/od 5 do 9 pracowników” – praca na tym stanowisku polega na bezpośrednim kierowaniu/);
  });
});

describe("treść OSP od MC", () => {
  it("część I: stanowisko, urząd, komórka, symbol, przełożony", () => {
    expect(radca.position).toMatchObject({
      title: "radca",
      office: "Ministerstwo Cyfryzacji",
      orgUnit: "Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji, Wydział Wspierania Innowacyjności",
      symbol: "DSI WWI 5",
      supervisor: "naczelnik wydziału",
    });
    expect(naczelnik.position.title).toBe("naczelnik wydziału");
    expect(specjalista.position.orgUnit).toBe("Departament Cyberbezpieczeństwa, Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa");
  });

  it("cel istnienia stanowiska", () => {
    expect(radca.position.purpose).toMatch(/^Zapewnienie wsparcia merytorycznego w zakresie rozwoju innowacyjnych rozwiązań/);
    expect(specjalista.position.purpose).toBe(
      "Prowadzenie spraw dotyczących zarządzania kryzysowego w cyberprzestrzeni pozostających w zakresie ministra właściwego ds. informatyzacji.",
    );
    expect(naczelnik.position.purpose.length).toBeGreaterThan(200); // trzy akapity połączone
  });

  it("zadania dominujące i pozostałe, bez przedrostka „Zadanie N:”", () => {
    expect([radca, specjalista, naczelnik].map((o) => [o.position.dominantTasks.length, o.position.otherTasks.length])).toEqual([
      [3, 2],
      [3, 4],
      [3, 5],
    ]);
    expect(radca.position.dominantTasks[0]).toMatch(/^Analizuje i dokonuje oceny prawa krajowego/);
    expect(radca.position.otherTasks[0]).toMatch(/^Analizuje bariery prawne/); // „Zadanie 4.” z kropką
    for (const o of [radca, specjalista, naczelnik]) {
      for (const t of [...o.position.dominantTasks, ...o.position.otherTasks]) expect(t).not.toMatch(/^Zadanie/i);
    }
  });

  it("upoważnienia: zaznaczone pozycje i opis „inne”; brak upoważnień = pole puste", () => {
    expect(radca.position.authorizations).toBeUndefined();
    expect(naczelnik.position.authorizations).toBeUndefined();
    expect(specjalista.position.authorizations).toBe(
      "upoważnienie do przeprowadzania kontroli; upoważnienie do reprezentowania RP w pracach grup tematycznych UE, w zakresie wynikającym z powierzonych zadań.",
    );
  });

  it("kompetencje miękkie jako nazwy i kody z modelu kompetencji", () => {
    expect(radca.position.requiredCompetencyCodes).toEqual(["ORGANIZACJA", "WIEDZA", "WSPOLPRACA"]);
    expect(radca.position.requiredCompetencies).toEqual([
      "Organizacja pracy i orientacja na osiąganie celów",
      "Wykorzystywanie wiedzy i doskonalenie zawodowe",
      "Współpraca",
    ]);
    expect(naczelnik.position.requiredCompetencyCodes).toEqual(["LUDZIE", "DECYZJE", "WIEDZA", "ORGANIZACJA", "WSPOLPRACA"]);
    expect(specjalista.position.requiredCompetencyCodes).toEqual(["ORGANIZACJA", "WSPOLPRACA", "ANALITYCZNE", "WIEDZA"]);
  });

  it("kandydaci na kryteria dodatkowe: kompetencje z OSP spoza obowiązkowych arkusza", () => {
    expect(specjalista.additionalCriteriaFromOsp).toEqual(["ANALITYCZNE"]);
    expect(radca.additionalCriteriaFromOsp).toEqual([]);
    expect(naczelnik.additionalCriteriaFromOsp).toEqual(["WIEDZA"]);
  });

  it("wymagana wiedza jako lista, bez tekstów zastępczych Worda", () => {
    expect(naczelnik.position.knowledge).toEqual([
      "zasad funkcjonowania administracji publicznej, w tym służby cywilnej oraz działalności i organizacji MC",
      "współpracy międzynarodowej w wymiarze globalnym",
      "protokołu dyplomatycznego",
    ]);
    expect(specjalista.position.knowledge).toContain("Kodeksu postępowania administracyjnego");
    expect(radca.rawText).not.toMatch(/Wybierz element/);
  });

  it("opisy złożoności i samodzielności (kontekst dla AI)", () => {
    expect(radca.position.complexity).toMatch(/^Osoba zatrudniona na tym stanowisku jest odpowiedzialna za realizację zadań o wysokim stopniu złożoności/);
    expect(specjalista.position.independence).toMatch(/^Osoba na tym stanowisku otrzymuje od przełożonego polecenia/);
  });

  it("pełny tekst ze stanem pól wyboru i bez uwag dla plików MC", () => {
    expect(radca.rawText).toMatch(/\[x\] brak podległych pracowników/);
    expect(naczelnik.rawText).toMatch(/\[ \] brak podległych pracowników/);
    for (const o of [radca, specjalista, naczelnik]) expect(o.warnings).toEqual([]);
  });
});

describe("dane demo zgodne z plikami OSP", () => {
  it.each(Object.entries(seedOsp))("%s", (_klucz, wpis) => {
    const r = parseOsp(readFileSync(wpis.sourceFileName));
    expect({
      title: wpis.title,
      symbol: wpis.symbol,
      subordinates: wpis.subordinates,
      dominant: wpis.dominantTasks.length,
      other: wpis.otherTasks.length,
      competencies: wpis.requiredCompetencies.map((c) => c.toLocaleLowerCase("pl")),
    }).toEqual({
      title: r.position.title,
      symbol: r.position.symbol,
      subordinates: r.position.subordinates,
      dominant: r.position.dominantTasks.length,
      other: r.position.otherTasks.length,
      competencies: r.position.requiredCompetencies.map((c) => c.toLocaleLowerCase("pl")),
    });
  });
});

describe("reguła wyboru arkusza (§ 3)", () => {
  it.each(SUBORDINATE_OPTIONS)("%s", (option) => {
    const s = selectSheet(option);
    expect(s.sheet).toBe(option === "BRAK" ? "C" : "B");
    expect(s.mandatoryCriteria).toEqual(rules.periodic.mandatoryCriteria[s.sheet]);
  });
});

describe("pola wyboru zapisane na różne sposoby", () => {
  it.each<Check>(["w14", "legacy", "glyph", "sym"])("%s", (as) => {
    expect(parseOsp(ospDocx({ checked: [3], as })).sheet.sheet).toBe("B");
    expect(parseOsp(ospDocx({ checked: [0], as })).sheet.sheet).toBe("C");
  });

  it("czytnik docx: tekst zastępczy pomijany, znak pola usuwany z tekstu", () => {
    const doc = readDocx(buildDocx(p("opcja", { checked: true, as: "glyph" }) + placeholder() + tbl(tr("a", tc(placeholder())))));
    expect(doc.blocks[0]).toEqual({ kind: "paragraph", paragraph: { text: "opcja", checked: true } });
    expect(doc.text).toBe("[x] opcja\na | ");
  });
});

describe("OSP przygotowany przez jury lub inny urząd", () => {
  it("minimalny OSP: zadania z różnymi przedrostkami, wiedza i kompetencje", () => {
    const r = parseOsp(ospDocx());
    expect(r.position).toMatchObject({
      title: "specjalista",
      orgUnit: "Departament A, Wydział B",
      purpose: "Cel testowy stanowiska.",
      dominantTasks: ["Pierwsze zadanie.", "Drugie zadanie."],
      otherTasks: ["Trzecie zadanie."],
      knowledge: ["ustawy A", "ustawy B"],
      requiredCompetencyCodes: ["WSPOLPRACA", "KOMUNIKACJA"],
    });
    expect(r.warnings).toEqual([]);
  });

  it("upoważnienie „inne” z opisem i sprzeczne zaznaczenie „brak” – uwaga, nie błąd", () => {
    const r = parseOsp(ospDocx({ authorizations: { brak: true, kontrola: true, inne: "reprezentowanie urzędu w sądzie" } }));
    expect(r.position.authorizations).toBe("upoważnienie do przeprowadzania kontroli; reprezentowanie urzędu w sądzie");
    expect(r.warnings.join()).toMatch(/jednocześnie „brak upoważnień/);
  });

  it("brak kompetencji miękkich i celu – uwagi, import przechodzi", () => {
    const r = parseOsp(ospDocx({ soft: "cierpliwość", omit: ["purpose"] }));
    expect(r.position.requiredCompetencyCodes).toEqual([]);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings.join("\n")).toMatch(/celu istnienia stanowiska/);
    expect(r.warnings.join("\n")).toMatch(/Kompetencji miękkich/);
  });
});

describe("OSP: czytelne błędy", () => {
  it("nie zaznaczono liczby podległych", () => {
    expectOspError(ospDocx({ checked: [] }), /nie zaznaczono żadnej opcji w polu „LICZBA PODLEGŁYCH PRACOWNIKÓW”.*wybierz arkusz ręcznie/);
  });

  it("zaznaczono kilka opcji", () => {
    expectOspError(ospDocx({ checked: [0, 2] }), /zaznaczono kilka opcji \(„brak podległych pracowników”, „bezpośrednio kieruje lub koordynuje pracę od 5 do 9 pracowników”\)/);
  });

  it("brak sekcji liczby podległych", () => {
    expectOspError(ospDocx({ omit: ["subordinates"] }), /Brak sekcji „LICZBA PODLEGŁYCH PRACOWNIKÓW”/);
  });

  it("brak nazwy stanowiska", () => {
    expectOspError(ospDocx({ title: "" }), /Brak nazwy stanowiska/);
  });

  it("plik, który nie jest docx", () => {
    expectOspError(strToU8("zwykły tekst"), /nie jest dokumentem \.docx/);
  });

  it("archiwum bez word/document.xml (np. xlsx)", () => {
    expectOspError(zipSync({ "xl/workbook.xml": strToU8("<workbook/>") }), /brakuje części word\/document\.xml/);
  });

  it("XML z DOCTYPE odrzucony", () => {
    expectOspError(
      zipSync({ "word/document.xml": strToU8(`<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x "x">]><w:document/>`) }),
      /DOCTYPE/,
    );
  });
});
