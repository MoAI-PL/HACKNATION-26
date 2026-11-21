import { describe, expect, it } from "vitest";
import {
  applyHrFilters,
  changeNoticeFor,
  currentDeadline,
  hrWarnings,
  needsReminder,
  parseHrFilters,
  reminderFor,
  sortHrRows,
  summarize,
  toHrRow,
  type HrEvaluationRecord,
} from "@/lib/hr/panel";

const TODAY = "2026-11-21";

function rec(over: Partial<HrEvaluationRecord> = {}, emp: Partial<HrEvaluationRecord["employee"]> = {}): HrEvaluationRecord {
  return {
    id: "ev1",
    type: "OKRESOWA",
    sheet: "C",
    status: "W_OKRESIE_OCENY",
    isReevaluation: false,
    criteriaSetAt: "2024-12-01",
    evaluatedAt: null,
    acknowledgedAt: null,
    result: null,
    previousDate: "2024-11-27",
    previousResult: "POZYTYWNA",
    previousAcknowledgedAt: "2024-11-29",
    evaluatorId: "ewa",
    evaluatorName: "Ewa Kowalczyk",
    ...over,
    employee: {
      id: "jan",
      name: "Jan Nowak",
      orgUnit: "Wydział A",
      employmentStart: "2020-01-02",
      permanentFrom: "2020-01-02",
      contractEnd: null,
      absences: [],
      pastResults: ["POZYTYWNA"],
      ...emp,
    },
  };
}

describe("bieżący termin oceny (silnik Z08)", () => {
  it("ocena okresowa: 24 miesiące od poprzedniej oceny", () => {
    const d = currentDeadline(rec())!;
    expect(d.kind).toBe("OCENA_OKRESOWA");
    expect(d.date).toBe("2026-11-27");
    expect(d.extensions).toEqual([]);
  });

  it("nieobecność ponad miesiąc wydłuża termin – z wyjaśnieniem dla HR", () => {
    const row = toHrRow(rec({}, { absences: [{ kind: "ZWOLNIENIE_LEKARSKIE", from: "2026-04-25", to: "2026-06-07" }] }), TODAY);
    expect(row.deadline!.date).toBe("2027-01-11"); // 27.11.2026 + 44 dni = 10.01.2027 (niedziela) → poniedziałek
    expect(row.extensionText).toBe("+44 dni: zwolnienie lekarskie 25.04–07.06.2026");
    expect(row.deadline!.explanation.legalBasis).toMatch(/art\. 81 ust\. 7/);
  });

  it("nieobecność krótsza niż miesiąc nie wydłuża terminu", () => {
    const row = toHrRow(rec({}, { absences: [{ kind: "URLOP_BEZPLATNY", from: "2026-08-03", to: "2026-08-22" }] }), TODAY);
    expect(row.extensionText).toBeNull();
    expect(row.deadline!.date).toBe("2026-11-27");
  });

  it("do rozpoczęcia: rozmowa rozpoczynająca w 30 dni od zatrudnienia na czas nieokreślony", () => {
    const d = currentDeadline(rec({ status: "DO_ROZPOCZECIA", previousDate: null }, { permanentFrom: "2026-11-09" }))!;
    expect(d.kind).toBe("ROZMOWA_ROZPOCZYNAJACA");
    expect(d.date).toBe("2026-12-09");
  });

  it("po ocenie negatywnej: ponowna ocena po 6 miesiącach od zapoznania się z oceną", () => {
    const d = currentDeadline(rec({ isReevaluation: true, previousDate: "2026-10-12", previousResult: "NEGATYWNA", previousAcknowledgedAt: "2026-10-14" }))!;
    expect(d.kind).toBe("PONOWNA_OCENA_PO_NEGATYWNEJ");
    expect(d.date).toBe("2027-04-15");
  });

  it("pierwsza ocena: rozmowa wstępna w 21 dni, potem okno oceny przed końcem umowy", () => {
    const base = { type: "PIERWSZA" as const, sheet: "PIERWSZA" as const, previousDate: null, previousResult: null };
    const emp = { employmentStart: "2026-11-06", permanentFrom: null, contractEnd: "2027-11-05" };
    expect(currentDeadline(rec({ ...base, status: "DO_ROZPOCZECIA" }, emp))!.kind).toBe("ROZMOWA_WSTEPNA");
    expect(currentDeadline(rec({ ...base, status: "W_OKRESIE_OCENY" }, emp))!.kind).toBe("PIERWSZA_OCENA_DO");
  });

  it("czeka na zapoznanie i zakończona – bez terminu", () => {
    expect(toHrRow(rec({ status: "CZEKA_NA_ZAPOZNANIE" }), TODAY).deadline).toBeNull();
    expect(toHrRow(rec({ status: "ZAKONCZONA" }), TODAY).urgency).toBeNull();
  });

  it("pilność i dni do terminu", () => {
    const row = toHrRow(rec(), TODAY);
    expect(row.daysLeft).toBe(6);
    expect(row.urgency).toBe("PILNE");
    expect(row.statusLabel).toBe("Kryteria ustalone");
  });
});

describe("ostrzeżenie z art. 71 (tylko informacja dla HR)", () => {
  it("dwie kolejne oceny negatywne", () => {
    expect(hrWarnings(rec({}, { pastResults: ["NEGATYWNA", "NEGATYWNA", "POZYTYWNA"] }))[0]).toMatch(/Dwie kolejne oceny negatywne.*art\. 71.*niczego nie robi automatycznie/);
  });
  it("negatywna po pozytywnej – bez ostrzeżenia", () => {
    expect(hrWarnings(rec({}, { pastResults: ["NEGATYWNA", "POZYTYWNA"] }))).toEqual([]);
  });
});

describe("filtry i kolejność tabeli", () => {
  const rows = [
    toHrRow(rec({ id: "a" }, { id: "a", name: "Anna B", orgUnit: "W1" }), TODAY), // 27.11
    toHrRow(rec({ id: "b", status: "ZAKONCZONA" }, { id: "b", name: "Bogdan C", orgUnit: "W2" }), TODAY),
    toHrRow(rec({ id: "c", previousDate: "2025-11-27" }, { id: "c", name: "Celina D", orgUnit: "W2" }), TODAY), // 27.11.2027
    toHrRow(rec({ id: "d", status: "CZEKA_NA_ZAPOZNANIE" }, { id: "d", name: "Damian E", orgUnit: "W1" }), TODAY),
  ];

  it("domyślnie oceny w toku; „WSZYSTKIE” – także zakończone", () => {
    expect(applyHrFilters(rows, {}).map((r) => r.evaluationId)).toEqual(["a", "c", "d"]);
    expect(applyHrFilters(rows, { status: "WSZYSTKIE" })).toHaveLength(4);
  });

  it("etap, termin i komórka", () => {
    expect(applyHrFilters(rows, { status: "CZEKA_NA_ZAPOZNANIE" }).map((r) => r.evaluationId)).toEqual(["d"]);
    expect(applyHrFilters(rows, { urgency: "PILNE" }).map((r) => r.evaluationId)).toEqual(["a"]);
    expect(applyHrFilters(rows, { urgency: "BEZ_TERMINU" }).map((r) => r.evaluationId)).toEqual(["d"]);
    expect(applyHrFilters(rows, { orgUnit: "W2" }).map((r) => r.evaluationId)).toEqual(["c"]);
  });

  it("parametry adresu – niepoprawne pomijane", () => {
    expect(parseHrFilters({ etap: "W_OCENIE", termin: "PILNE", komorka: "W1" })).toEqual({ status: "W_OCENIE", urgency: "PILNE", orgUnit: "W1" });
    expect(parseHrFilters({ etap: "COS", termin: "JUTRO" })).toEqual({ status: undefined, urgency: undefined, orgUnit: undefined });
    expect(parseHrFilters({ etap: "WSZYSTKIE" }).status).toBe("WSZYSTKIE");
  });

  it("najpierw najbliższy termin, oceny bez terminu na końcu", () => {
    expect(sortHrRows(rows).map((r) => r.evaluationId)).toEqual(["a", "c", "b", "d"]);
  });

  it("podsumowanie", () => {
    expect(summarize(rows)).toEqual({ open: 3, overdue: 0, urgent: 1, extended: 0 });
  });
});

describe("przypomnienia", () => {
  const row = toHrRow(rec(), TODAY);

  it("treść dla oceniającego z wyjaśnieniem terminu i podstawą prawną", () => {
    const r = reminderFor(row)!;
    expect(r).toMatchObject({ kind: "OCENA_OKRESOWA", dueDate: "2026-11-27", subject: "Ocena okresowa – Jan Nowak – termin: 27.11.2026" });
    expect(r.body).toContain(row.deadline!.explanation.text);
    expect(r.body).toMatch(/Podstawa: art\. 81 ust\. 4/);
    expect(r.body).not.toMatch(/\n\n\n/);
  });

  it("po terminie – temat mówi, że termin minął", () => {
    expect(reminderFor(toHrRow(rec(), "2026-12-01"))!.subject).toMatch(/termin minął 27\.11\.2026/);
  });

  it("raz o danym terminie; nowe przypomnienie, gdy termin się zmieni; nie dla terminów odległych", () => {
    expect(needsReminder(row, [])).toBe(true);
    expect(needsReminder(row, [{ employeeId: "jan", kind: "OCENA_OKRESOWA", dueDate: "2026-11-27" }])).toBe(false);
    expect(needsReminder(row, [{ employeeId: "jan", kind: "OCENA_OKRESOWA", dueDate: "2026-10-01" }])).toBe(true);
    expect(needsReminder(toHrRow(rec({ previousDate: "2025-11-27" }), TODAY), [])).toBe(false);
    expect(needsReminder(toHrRow(rec({ status: "ZAKONCZONA" }), TODAY), [])).toBe(false);
  });
});

describe("zawiadomienie o zmianie terminu (§ 8)", () => {
  it("stary i nowy termin, przyczyna i podstawa prawna", () => {
    const n = changeNoticeFor(rec({}, { absences: [{ kind: "ZWOLNIENIE_LEKARSKIE", from: "2026-04-25", to: "2026-06-07" }] }))!;
    expect(n).toMatchObject({ employeeName: "Jan Nowak", previousDate: "2026-11-27", newDate: "2027-01-11" });
    expect(n.paragraphs.join(" ")).toMatch(/Dotychczasowy termin: 27\.11\.2026\. Nowy termin: 11\.01\.2027\./);
    expect(n.paragraphs.join(" ")).toMatch(/łącznie 44 dni\): zwolnienie lekarskie 25\.04–07\.06\.2026/);
    expect(n.legalBasis).toBe("art. 81 ust. 7 ustawy o służbie cywilnej, § 8 rozporządzenia w sprawie ocen okresowych");
  });

  it("bez wydłużenia, pierwsza ocena i ponowna ocena – brak zawiadomienia", () => {
    expect(changeNoticeFor(rec())).toBeNull();
    expect(changeNoticeFor(rec({ type: "PIERWSZA" }))).toBeNull();
    expect(changeNoticeFor(rec({ isReevaluation: true }, { absences: [{ kind: "ZWOLNIENIE_LEKARSKIE", from: "2026-04-25", to: "2026-06-07" }] }))).toBeNull();
  });
});
