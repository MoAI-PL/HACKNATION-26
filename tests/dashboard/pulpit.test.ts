import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "@/lib/rules/kalendarz";
import {
  buildDashboardTodo,
  currentEvaluation,
  employeeHref,
  employeeRow,
  evaluationLink,
  formatDay,
  journalLinks,
  pathEntries,
  periodicEvaluationHref,
  openDeadlines,
  sortRows,
  type EmployeeInfo,
  type EvaluationInfo,
} from "@/lib/dashboard/pulpit";
import { parseNewEmployeeForm, sheetExplanation, sheetForSubordinates } from "@/lib/dashboard/nowy-pracownik";

const TODAY = "2026-11-21";

function employee(over: Partial<EmployeeInfo> & { id: string }): EmployeeInfo {
  return {
    firstName: "Jan",
    lastName: over.id,
    employmentStart: "2020-01-02",
    evaluations: [],
    absences: [],
    positionChanges: [],
    observationsCount: 0,
    ...over,
  };
}

const done = (id: string, evaluatedAt: string, result: "POZYTYWNA" | "NEGATYWNA" = "POZYTYWNA"): EvaluationInfo => ({
  id,
  type: "OKRESOWA",
  sheet: "C",
  status: "ZAKONCZONA",
  isReevaluation: false,
  evaluatedAt,
  acknowledgedAt: addDays(evaluatedAt, 2),
  result,
});

const open = (id: string, over: Partial<EvaluationInfo> = {}): EvaluationInfo => ({
  id,
  type: "OKRESOWA",
  sheet: "C",
  status: "W_OKRESIE_OCENY",
  isReevaluation: false,
  ...over,
});

describe("otwarte terminy przełożonego", () => {
  it("ocena okresowa w toku: 24 miesiące od poprzedniej oceny", () => {
    const prev = addDays(addMonths(TODAY, -24), 9);
    const e = employee({ id: "katarzyna", evaluations: [done("p", prev), open("c", { status: "W_OCENIE" })] });
    const [d] = openDeadlines(e);
    expect(d?.kind).toBe("OCENA_OKRESOWA");
    expect(d!.date >= addMonths(prev, 24)).toBe(true);
  });

  it("nieobecność dłuższa niż miesiąc wydłuża termin (L4 44 dni)", () => {
    const prev = addDays(addMonths(TODAY, -24), 6);
    const base = employee({ id: "jan", evaluations: [done("p", prev), open("c")] });
    const withL4 = { ...base, absences: [{ kind: "ZWOLNIENIE_LEKARSKIE" as const, from: addDays(TODAY, -210), to: addDays(TODAY, -167) }] };
    const [a] = openDeadlines(base);
    const [b] = openDeadlines(withL4);
    expect(b!.extensions[0]?.days).toBe(44);
    expect(b!.date > a!.date).toBe(true);
  });

  it("przed rozmową rozpoczynającą: 30 dni od zatrudnienia na czas nieokreślony", () => {
    const e = employee({ id: "marta", permanentFrom: addDays(TODAY, -12), evaluations: [open("c", { status: "DO_ROZPOCZECIA" })] });
    expect(openDeadlines(e).map((d) => d.kind)).toEqual(["ROZMOWA_ROZPOCZYNAJACA"]);
  });

  it("po ocenie negatywnej: przed rozmową 7 dni, potem ponowna ocena po 6 miesiącach", () => {
    const neg = done("p", addDays(TODAY, -40), "NEGATYWNA");
    const przed = employee({ id: "m1", evaluations: [neg, open("c", { status: "DO_ROZPOCZECIA", isReevaluation: true })] });
    expect(openDeadlines(przed).map((d) => d.kind)).toEqual(["ROZMOWA_PO_NEGATYWNEJ"]);
    const po = employee({ id: "m2", evaluations: [neg, open("c", { isReevaluation: true })] });
    expect(openDeadlines(po).map((d) => d.kind)).toEqual(["PONOWNA_OCENA_PO_NEGATYWNEJ"]);
  });

  it("pierwsza ocena: rozmowa wstępna w 21 dni, potem sprawozdanie i okno oceny", () => {
    const start = addDays(TODAY, -15);
    const base = { id: "ola", employmentStart: start, contractEnd: addDays(addMonths(start, 12), -1) };
    const nowa = employee({ ...base, evaluations: [{ ...open("c", { type: "PIERWSZA", sheet: "PIERWSZA" }), status: "DO_ROZPOCZECIA" }] });
    expect(openDeadlines(nowa).map((d) => d.kind)).toEqual(["ROZMOWA_WSTEPNA"]);
    const wOkresie = employee({ ...base, evaluations: [open("c", { type: "PIERWSZA", sheet: "PIERWSZA" })] });
    expect(openDeadlines(wOkresie).map((d) => d.kind)).toEqual(["SPRAWOZDANIE", "PIERWSZA_OCENA_DO"]);
  });

  it("ocena czekająca na zapoznanie i brak otwartej oceny nie dają terminów", () => {
    expect(openDeadlines(employee({ id: "x", evaluations: [done("p", "2025-01-10"), open("c", { status: "CZEKA_NA_ZAPOZNANIE" })] }))).toEqual([]);
    expect(openDeadlines(employee({ id: "y", evaluations: [done("p", "2025-01-10")] }))).toEqual([]);
    expect(currentEvaluation(employee({ id: "z", evaluations: [done("p", "2025-01-10")] }))).toBeUndefined();
  });
});

describe("karta „Do zrobienia” i lista podwładnych", () => {
  const ludzie = [
    employee({ id: "pozniej", lastName: "Zieliński", permanentFrom: addDays(TODAY, -2), evaluations: [open("a", { status: "DO_ROZPOCZECIA" })] }),
    employee({ id: "pilne", lastName: "Adamska", permanentFrom: addDays(TODAY, -27), evaluations: [open("b", { status: "DO_ROZPOCZECIA" })] }),
    employee({ id: "bez", lastName: "Bąk", evaluations: [] }),
  ];

  it("sortuje od najpilniejszego; rozmowa rozpoczynająca prowadzi do kreatora Z12", () => {
    const todo = buildDashboardTodo(ludzie, TODAY, 5, () => true);
    expect(todo.map((t) => t.employeeId)).toEqual(["pilne", "pozniej"]);
    expect(todo[0]!.href).toBe(periodicEvaluationHref("b"));
    expect(todo[0]!.actionLabel).toBe("Ustal kryteria");
    expect(todo[0]!.title).toContain("J. Adamska");
    expect(todo[0]!.urgency).toBe("PILNE");
  });

  it("bez gotowego ekranu – karta pracownika i uczciwe „Zobacz szczegóły” (bez martwych linków)", () => {
    const todo = buildDashboardTodo(ludzie, TODAY, 5, () => false);
    expect(todo[0]!.href).toBe(employeeHref("pilne"));
    expect(todo[0]!.actionLabel).toBe("Zobacz szczegóły");
  });

  it("sporządzenie oceny i pierwsza ocena prowadzą na kartę pracownika, dopóki nie ma Z14 i Z17", () => {
    const prev = addDays(addMonths(TODAY, -24), 9);
    const wOcenie = employee({ id: "kasia", evaluations: [done("p", prev), open("c", { status: "W_OCENIE" })] });
    const start = addDays(TODAY, -15);
    const nowa = employee({ id: "ola", employmentStart: start, contractEnd: addDays(addMonths(start, 12), -1), evaluations: [{ ...open("f", { type: "PIERWSZA", sheet: "PIERWSZA" }), status: "DO_ROZPOCZECIA" }] });
    const todo = buildDashboardTodo([wOcenie, nowa], TODAY, 5, () => true);
    expect(todo.map((t) => [t.employeeId, t.actionLabel])).toEqual([["ola", "Zobacz szczegóły"], ["kasia", "Zobacz szczegóły"]]);
  });

  it("na aktualnym menu: kreator Z12 jest gotowy, ekran pierwszej oceny jeszcze nie", () => {
    const [item] = buildDashboardTodo([ludzie[1]!], TODAY);
    expect(item!.actionLabel).toBe("Ustal kryteria");
    expect(pathEntries(ludzie).map((p) => p.key)).not.toContain("PIERWSZA");
  });

  it("termin z innego roku ma rok w dacie (bez niejednoznaczności)", () => {
    const stara = employee({ id: "stara", lastName: "Stara", permanentFrom: "2025-11-20", evaluations: [open("s", { status: "DO_ROZPOCZECIA" })] });
    const [item] = buildDashboardTodo([stara], TODAY);
    expect(item!.title).toContain("termin minął 22.12.2025");
    expect(formatDay("2026-11-27", TODAY)).toBe("pt. 27.11");
    expect(formatDay("2027-01-11", TODAY)).toBe("11.01.2027");
  });

  it("pokazuje najwyżej 5 spraw", () => {
    const wielu = Array.from({ length: 8 }, (_, i) =>
      employee({ id: `p${i}`, permanentFrom: addDays(TODAY, -i), evaluations: [open(`e${i}`, { status: "DO_ROZPOCZECIA" })] }),
    );
    expect(buildDashboardTodo(wielu, TODAY)).toHaveLength(5);
  });

  it("lista: najpierw najbliższy termin, osoby bez terminu na końcu", () => {
    const rows = sortRows(ludzie.map((e) => employeeRow(e, TODAY)));
    expect(rows.map((r) => r.id)).toEqual(["pilne", "pozniej", "bez"]);
    expect(rows[0]!.next?.daysLeft).toBe(3);
    expect(rows[2]!.evaluation).toBeUndefined();
  });
});

describe("wejścia w ścieżki i karta pracownika", () => {
  const ludzie = [
    employee({ id: "a", permanentFrom: addDays(TODAY, -5), evaluations: [open("a1", { status: "DO_ROZPOCZECIA" })] }),
    employee({ id: "b", evaluations: [done("b0", "2025-01-10"), open("b1")] }),
    employee({ id: "c", employmentStart: addDays(TODAY, -3), evaluations: [{ ...open("c1", { type: "PIERWSZA", sheet: "PIERWSZA" }), status: "DO_ROZPOCZECIA" }] }),
  ];

  it("dwie ścieżki i dwóch asystentów z podsumowaniem, gdy wszystkie ekrany są gotowe", () => {
    const p = pathEntries(ludzie, () => true);
    expect(p.map((x) => x.key)).toEqual(["OKRESOWA", "PIERWSZA", "ASYSTENT_FORMALNY", "ASYSTENT_ROZMOWY"]);
    expect(p[0]!.summary).toBe("2 osoby, 1 do ustalenia kryteriów");
    expect(p[1]!.summary).toBe("1 osoba, 1 przed rozmową wstępną");
  });

  it("ścieżki bez gotowego ekranu są ukryte", () => {
    expect(pathEntries(ludzie, (h) => h === "/asystent").map((x) => x.key)).toEqual(["ASYSTENT_FORMALNY"]);
  });

  it("karta pracownika: główna akcja do oceny okresowej, brak akcji przy pierwszej ocenie", () => {
    expect(evaluationLink(ludzie[0]!, () => true)).toEqual({ href: periodicEvaluationHref("a1"), label: "Ustal kryteria" });
    expect(evaluationLink(ludzie[1]!, () => true)?.label).toBe("Otwórz ocenę okresową");
    expect(evaluationLink(ludzie[2]!, () => true)).toBeNull();
    expect(evaluationLink(ludzie[0]!, () => false)).toBeNull();
  });
});

describe("linki do dziennika obserwacji (Z13)", () => {
  it("lista notatek osoby i nowa notatka z wybraną osobą", () => {
    expect(journalLinks("abc 1", () => true)).toEqual({ list: "/obserwacje?osoba=abc%201", add: "/obserwacje/nowa?osoba=abc%201" });
  });

  it("bez gotowego dziennika – brak linków", () => {
    expect(journalLinks("abc", () => false)).toBeNull();
  });

  it("na aktualnym menu dziennik jest gotowy", () => {
    expect(journalLinks("abc")).not.toBeNull();
  });
});

describe("szybkie dodanie pracownika", () => {
  const form = (over: Record<string, string> = {}) => {
    const f = new FormData();
    const base: Record<string, string> = {
      firstName: "Anna",
      lastName: "Testowa",
      positionTitle: "specjalista",
      subordinates: "BRAK",
      evaluationType: "OKRESOWA",
      employmentStart: "2024-01-02",
      permanentFrom: "2024-01-02",
      ...over,
    };
    for (const [k, v] of Object.entries(base)) f.set(k, v);
    return f;
  };

  it("arkusz z pola OSP: brak podległych → C, kierowanie → B, z wyjaśnieniem", () => {
    expect(sheetForSubordinates("BRAK")).toBe("C");
    expect(sheetForSubordinates("OD_5_DO_9")).toBe("B");
    expect(sheetExplanation("BRAK")).toBe("Arkusz C, bo w OSP zaznaczono „brak podległych pracowników” (§ 3 ust. 4).");
  });

  it("poprawne dane przechodzą walidację", () => {
    const r = parseNewEmployeeForm(form({ orgUnit: "" }));
    expect(r.success).toBe(true);
    expect(r.data?.orgUnit).toBeUndefined();
    expect(r.data?.isCivilServant).toBe(false);
  });

  it("ocena okresowa wymaga daty, od której liczymy terminy", () => {
    const r = parseNewEmployeeForm(form({ permanentFrom: "" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["permanentFrom"]);
  });

  it("pierwsza ocena wymaga końca umowy późniejszego niż zatrudnienie", () => {
    expect(parseNewEmployeeForm(form({ evaluationType: "PIERWSZA", permanentFrom: "" })).success).toBe(false);
    expect(parseNewEmployeeForm(form({ evaluationType: "PIERWSZA", contractEnd: "2023-12-31" })).success).toBe(false);
    expect(parseNewEmployeeForm(form({ evaluationType: "PIERWSZA", contractEnd: "2025-01-01" })).success).toBe(true);
  });

  it("puste imię daje komunikat po polsku", () => {
    const r = parseNewEmployeeForm(form({ firstName: " " }));
    expect(r.error?.issues[0]?.message).toBe("Wpisz imię pracownika.");
  });
});
