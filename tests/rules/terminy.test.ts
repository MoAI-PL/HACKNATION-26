import { describe, expect, it } from "vitest";
import {
  afterNegativeDeadlines,
  buildTodoItems,
  criteriaConversationDeadline,
  deadlineUrgency,
  firstEvalWindow,
  initialConversationDeadline,
  mergeAbsences,
  objectionDeadline,
  periodicEvaluationDeadline,
  positionChangeDeadline,
  reportDeadline,
  type AbsencePeriod,
} from "@/lib/rules/terminy";
import { RulesInputError } from "@/lib/rules/bledy";
import { rules } from "@/lib/domain/przepisy";
import type { Deadline } from "@/lib/domain/types";

const poprzednia = (date: string) => ({ anchor: { kind: "POPRZEDNIA_OCENA" as const, date } });
const L4 = (from: string, to: string): AbsencePeriod => ({ kind: "ZWOLNIENIE_LEKARSKIE", from, to });

describe("ocena okresowa – 24 miesiące (art. 81 ust. 4)", () => {
  it("24 miesiące od 31.08 przypadają na ostatni dzień miesiąca", () => {
    const d = periodicEvaluationDeadline(poprzednia("2026-08-31"));
    expect(d.kind).toBe("OCENA_OKRESOWA");
    expect(d.date).toBe("2028-08-31");
  });

  it("24 miesiące od 29.02 kończą się 28.02 (brak 29.02 w roku docelowym)", () => {
    // 28.02.2026 to sobota → poniedziałek 02.03.2026
    expect(periodicEvaluationDeadline(poprzednia("2024-02-29")).date).toBe("2026-03-02");
  });

  it("koniec terminu w sobotę przesuwa się na poniedziałek (art. 115 KC)", () => {
    const d = periodicEvaluationDeadline(poprzednia("2024-11-28"));
    expect(d.date).toBe("2026-11-30");
    expect(d.explanation.text).toContain("Termin wypadał w sobotę 28.11.2026");
    expect(d.explanation.legalBasis).toContain("art. 115 KC");
  });

  it("koniec terminu w święto przesuwa się na następny dzień roboczy", () => {
    expect(periodicEvaluationDeadline(poprzednia("2024-11-11")).date).toBe("2026-11-12");
    expect(periodicEvaluationDeadline(poprzednia("2024-12-24")).date).toBe("2026-12-28");
  });

  it("termin w dzień roboczy się nie przesuwa i nie wspomina o art. 115", () => {
    const d = periodicEvaluationDeadline(poprzednia("2024-11-27"));
    expect(d.date).toBe("2026-11-27");
    expect(d.explanation.legalBasis).not.toContain("115");
    expect(d.explanation.legalBasis).toContain("art. 81 ust. 4");
  });

  it("biegnie też od zatrudnienia na czas nieokreślony", () => {
    const d = periodicEvaluationDeadline({ anchor: { kind: "ZATRUDNIENIE_NA_CZAS_NIEOKRESLONY", date: "2025-01-15" } });
    expect(d.date).toBe("2027-01-15");
    expect(d.explanation.text).toContain("od zatrudnienia na czas nieokreślony");
  });
});

describe("nieobecności (art. 81 ust. 7)", () => {
  it("nieobecność 44 dni (ponad miesiąc) przesuwa termin o 44 dni", () => {
    const d = periodicEvaluationDeadline({ ...poprzednia("2024-06-10"), absences: [L4("2025-03-12", "2025-04-24")] });
    expect(d.date).toBe("2026-07-24");
    expect(d.extensions).toEqual([{ days: 44, reason: "zwolnienie lekarskie 12.03–24.04.2025" }]);
    expect(d.explanation.text).toContain("+44 dni");
    expect(d.explanation.legalBasis).toContain("art. 81 ust. 7");
  });

  it("nieobecność 20 dni (krócej niż miesiąc) nie przesuwa terminu", () => {
    const d = periodicEvaluationDeadline({ ...poprzednia("2024-06-10"), absences: [L4("2025-03-01", "2025-03-20")] });
    expect(d.date).toBe("2026-06-10");
    expect(d.extensions).toEqual([]);
    expect(d.explanation.text).toContain("Nie wydłużają terminu nieobecności trwające nie dłużej niż 1 miesiąc");
  });

  it("przykład z poradnika KPRM: 09.09–19.10.2014 wydłuża o 41 dni, a równo miesiąc nie wydłuża", () => {
    const urlop: AbsencePeriod = { kind: "INNA", from: "2014-09-09", to: "2014-10-13" };
    const l4 = L4("2014-10-14", "2014-10-19");
    const d = periodicEvaluationDeadline({ ...poprzednia("2013-05-08"), absences: [urlop, l4] });
    expect(d.extensions[0].days).toBe(41);
    expect(d.date).toBe("2015-06-18");

    const rownoMiesiac = periodicEvaluationDeadline({ ...poprzednia("2013-05-08"), absences: [L4("2014-09-09", "2014-10-09")] });
    expect(rownoMiesiac.extensions).toEqual([]);
  });

  it("dwie krótkie nieobecności rozdzielone tylko weekendem łączą się w jedną dłuższą niż miesiąc", () => {
    const absences: AbsencePeriod[] = [
      L4("2025-03-03", "2025-03-21"), // do piątku
      { kind: "URLOP_BEZPLATNY", from: "2025-03-24", to: "2025-04-10" }, // od poniedziałku
    ];
    expect(mergeAbsences(absences)).toHaveLength(1);
    const d = periodicEvaluationDeadline({ ...poprzednia("2024-06-10"), absences });
    expect(d.extensions).toEqual([{ days: 39, reason: "zwolnienie lekarskie + urlop bezpłatny 03.03–10.04.2025" }]);
  });

  it("przerwa w dzień roboczy rozdziela nieobecności", () => {
    expect(mergeAbsences([L4("2025-03-03", "2025-03-20"), L4("2025-03-24", "2025-04-10")])).toHaveLength(2);
  });

  it("pomija nieobecności sprzed początku okresu i po terminie", () => {
    const d = periodicEvaluationDeadline({
      ...poprzednia("2024-06-10"),
      absences: [L4("2024-01-01", "2024-03-31"), L4("2026-09-01", "2026-12-31")],
    });
    expect(d.extensions).toEqual([]);
    expect(d.date).toBe("2026-06-10");
  });

  it("nieobecność, która zaczyna się w wydłużonym okresie, też wydłuża termin", () => {
    // pierwsza: 10.04–31.05.2026 (52 dni) → termin 10.06 + 52 = 01.08.2026; druga zaczyna się 15.07, czyli przed nowym terminem
    const d = periodicEvaluationDeadline({
      ...poprzednia("2024-06-10"),
      absences: [L4("2026-04-10", "2026-05-31"), L4("2026-07-15", "2026-08-20")],
    });
    expect(d.extensions.map((e) => e.days)).toEqual([52, 37]);
  });

  it("odrzuca nieobecność z odwróconymi datami", () => {
    expect(() => mergeAbsences([L4("2025-03-10", "2025-03-01")])).toThrow(RulesInputError);
  });
});

describe("rozmowy i ocena po ocenie negatywnej", () => {
  it("rozmowa rozpoczynająca: 30 dni od poprzedniej oceny (§ 7 pkt 1)", () => {
    const d = criteriaConversationDeadline({ kind: "POPRZEDNIA_OCENA", date: "2026-11-02" });
    expect(d.date).toBe("2026-12-02");
    expect(d.explanation.legalBasis).toContain("§ 7 pkt 1");
  });

  it("po ocenie negatywnej: 7 dni na rozmowę i ponowna ocena po 6 miesiącach", () => {
    const [rozmowa, ponowna] = afterNegativeDeadlines({ evaluatedAt: "2026-03-02", acknowledgedAt: "2026-03-04" });
    expect(rozmowa.kind).toBe("ROZMOWA_PO_NEGATYWNEJ");
    expect(rozmowa.date).toBe("2026-03-09");
    expect(rozmowa.explanation.legalBasis).toContain("§ 7 pkt 2");
    expect(ponowna.kind).toBe("PONOWNA_OCENA_PO_NEGATYWNEJ");
    expect(ponowna.earliest).toBe("2026-09-05");
    expect(ponowna.date).toBe("2026-09-07"); // 05.09.2026 to sobota
    expect(ponowna.explanation.legalBasis).toBe("art. 81 ust. 9 ustawy");
  });

  it("przykład z poradnika: zapoznanie 15.02.2015 → ponowna ocena 16.08.2015 (niedziela → 17.08)", () => {
    const [, ponowna] = afterNegativeDeadlines({ evaluatedAt: "2015-02-10", acknowledgedAt: "2015-02-15" });
    expect(ponowna.earliest).toBe("2015-08-16");
    expect(ponowna.date).toBe("2015-08-17");
  });

  it("bez daty zapoznania jest tylko termin rozmowy", () => {
    expect(afterNegativeDeadlines({ evaluatedAt: "2026-03-02" })).toHaveLength(1);
  });

  it("sprzeciw: 7 dni od zapoznania się z oceną (art. 83)", () => {
    const d = objectionDeadline("2026-11-20");
    expect(d.date).toBe("2026-11-27");
    expect(d.explanation.legalBasis).toContain("art. 83");
  });
});

describe("zmiana stanowiska (§ 9, art. 81 ust. 6)", () => {
  const zmiana = (date: string, significantDutiesChange = true) => ({ date, significantDutiesChange });

  it("w ciągu 6 miesięcy: ponowne kryteria w 30 dni, termin oceny bez zmian", () => {
    const d = positionChangeDeadline({ change: zmiana("2026-05-10"), lastEvaluationAt: "2026-01-15" })!;
    expect(d.kind).toBe("PONOWNE_KRYTERIA_PO_ZMIANIE_STANOWISKA");
    expect(d.date).toBe("2026-06-09");
    expect(d.explanation.text).toContain("Termin oceny się nie zmienia");
  });

  it("równo 6 miesięcy to jeszcze „w okresie 6 miesięcy”", () => {
    expect(positionChangeDeadline({ change: zmiana("2026-07-15"), lastEvaluationAt: "2026-01-15" })!.kind).toBe(
      "PONOWNE_KRYTERIA_PO_ZMIANIE_STANOWISKA",
    );
  });

  it("po 6 miesiącach: ocena od 7 dni przed do 30 dni po zmianie", () => {
    const d = positionChangeDeadline({ change: zmiana("2026-09-01"), lastEvaluationAt: "2026-01-15" })!;
    expect(d.kind).toBe("OCENA_PRZY_ZMIANIE_STANOWISKA");
    expect(d.earliest).toBe("2026-08-25");
    expect(d.date).toBe("2026-10-01");
    expect(d.explanation.legalBasis).toContain("art. 81 ust. 6");
  });

  it("przy pierwszej ocenie okresowej liczy od ustalenia kryteriów", () => {
    const d = positionChangeDeadline({ change: zmiana("2026-05-10"), criteriaSetAt: "2026-01-15" })!;
    expect(d.explanation.text).toContain("od ustalenia kryteriów");
  });

  it("zmiana bez istotnej zmiany obowiązków nie zmienia terminów", () => {
    expect(positionChangeDeadline({ change: zmiana("2026-09-01", false), lastEvaluationAt: "2026-01-15" })).toBeNull();
  });

  it("bez punktu odniesienia zgłasza błąd", () => {
    expect(() => positionChangeDeadline({ change: zmiana("2026-09-01") })).toThrow(RulesInputError);
  });
});

describe("pierwsza ocena", () => {
  it("rozmowa wstępna: 21 dni od nawiązania stosunku pracy (§ 3)", () => {
    const d = initialConversationDeadline("2026-03-02");
    expect(d.date).toBe("2026-03-23");
    expect(d.explanation.legalBasis).toContain("§ 3");
  });

  it("okno oceny: po 8 miesiącach i najpóźniej miesiąc przed końcem umowy (art. 38)", () => {
    const [od, doo] = firstEvalWindow({ employmentStart: "2026-03-02", contractEnd: "2027-03-01" });
    expect(od.kind).toBe("PIERWSZA_OCENA_OD");
    expect(od.date).toBe("2026-11-03");
    expect(doo.kind).toBe("PIERWSZA_OCENA_DO");
    expect(doo.earliest).toBe("2026-11-03");
    expect(doo.date).toBe("2027-02-01");
  });

  it("ostatni dzień okna w dzień wolny cofa się na poprzedni dzień roboczy", () => {
    // umowa do 28.03.2027 → miesiąc wcześniej 28.02.2027 (niedziela) → piątek 26.02.2027
    const [, doo] = firstEvalWindow({ employmentStart: "2026-03-29", contractEnd: "2027-03-28" });
    expect(doo.date).toBe("2027-02-26");
    expect(doo.explanation.text).toContain("ostatnim dniem roboczym");
  });

  it("puste okno – ostrzeżenie w wyjaśnieniu", () => {
    const [, doo] = firstEvalWindow({ employmentStart: "2026-03-02", contractEnd: "2026-10-31" });
    expect(doo.explanation.text).toContain("okno jest puste");
  });

  it("sprawozdanie: termin z rozmowy wstępnej wydłużony o każdą nieobecność (§ 5 ust. 1)", () => {
    const d = reportDeadline({
      employmentStart: "2026-03-02",
      reportDue: "2026-11-16",
      absences: [L4("2026-05-04", "2026-05-08")],
    });
    expect(d.extensions).toEqual([{ days: 5, reason: "zwolnienie lekarskie 04.05–08.05.2026" }]);
    expect(d.date).toBe("2026-11-23"); // 21.11 to sobota
    expect(d.explanation.text).toContain("pisemnie zawiadomić");
  });

  it("sprawozdanie bez wyznaczonego terminu – propozycja: dzień po upływie 8 miesięcy", () => {
    const d = reportDeadline({ employmentStart: "2026-03-02" });
    expect(d.date).toBe("2026-11-03");
    expect(d.explanation.text).toContain("proponowany termin");
  });

  it("sprawozdanie przed upływem 8 miesięcy – ostrzeżenie", () => {
    const d = reportDeadline({ employmentStart: "2026-03-02", reportDue: "2026-10-01" });
    expect(d.explanation.text).toContain("Uwaga: termin musi przypadać po upływie 8 miesięcy");
  });
});

describe("pilność i karta „Do zrobienia”", () => {
  const termin = (kind: Deadline["kind"], date: string): Deadline => ({
    kind,
    date,
    extensions: [],
    explanation: { text: "", legalBasis: "§ 7 pkt 1, art. 111 § 2 KC" },
  });

  it.each([
    ["2026-11-20", "PO_TERMINIE"],
    ["2026-11-21", "PILNE"],
    ["2026-11-28", "PILNE"],
    ["2026-11-29", "WKROTCE"],
    ["2026-12-21", "WKROTCE"],
    ["2026-12-22", "W_TERMINIE"],
  ] as const)("termin %s przy dniu 21.11.2026 → %s", (date, urgency) => {
    expect(deadlineUrgency(termin("OCENA_OKRESOWA", date), "2026-11-21")).toBe(urgency);
  });

  it("sortuje od najpilniejszych, pomija terminy ocenianego i ogranicza liczbę kart", () => {
    const items = buildTodoItems(
      [
        {
          employeeId: "e1",
          employeeName: "Jan Nowak",
          deadlines: [termin("ROZMOWA_ROZPOCZYNAJACA", "2026-11-27"), termin("SPRZECIW", "2026-11-22")],
        },
        { employeeId: "e2", employeeName: "Anna Maria Wiśniewska", evaluationId: "ev2", deadlines: [termin("OCENA_OKRESOWA", "2026-11-18")] },
        { employeeId: "e3", employeeName: "Piotr Zieliński", deadlines: [termin("PIERWSZA_OCENA_OD", "2026-11-23"), termin("ROZMOWA_WSTEPNA", "2027-01-10")] },
      ],
      "2026-11-21",
      { limit: 2 },
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      employeeId: "e2",
      evaluationId: "ev2",
      urgency: "PO_TERMINIE",
      actionLabel: "Rozpocznij ocenę",
      title: "Ocena okresowa – A. Maria Wiśniewska – termin minął śr. 18.11 (§ 7 pkt 1)",
      href: "/pracownicy/e2",
    });
    expect(items[1].title).toBe("Rozmowa rozpoczynająca – J. Nowak – do pt. 27.11 (§ 7 pkt 1)");
    expect(items[1].urgency).toBe("PILNE");
  });

  it("pozwala podać własny adres przycisku", () => {
    const [item] = buildTodoItems(
      [{ employeeId: "e1", employeeName: "Jan Nowak", evaluationId: "ev1", deadlines: [termin("OCENA_OKRESOWA", "2026-12-01")] }],
      "2026-11-21",
      { hrefFor: (s) => `/przelozony/oceny/${s.evaluationId}` },
    );
    expect(item.href).toBe("/przelozony/oceny/ev1");
  });
});

describe("parametry z data/przepisy.json", () => {
  it("zmiana okresu oceny w przepisach zmienia termin", () => {
    const zmienione = { ...rules, periodicDeadlines: { ...rules.periodicDeadlines, periodMonths: 12 } };
    expect(periodicEvaluationDeadline(poprzednia("2025-11-27"), zmienione).date).toBe("2026-11-27");
  });
});
