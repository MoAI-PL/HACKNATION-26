import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "@/lib/rules/kalendarz";
import {
  STAGE_FOR_STATUS,
  completionIssues,
  defaultEvaluationDate,
  earliestReportDay,
  examMissing,
  firstEvalCriteria,
  firstEvalSummary,
  initialConversationIssues,
  lateConversationWarning,
  proposedReportWindow,
  reportFileProblem,
  reportIssues,
  reportOnTime,
  stepNumber,
  windowLatest,
  type ReportForm,
} from "@/lib/pierwsza-ocena/przebieg";
import { decisionOptions, suggestionFor } from "@/lib/ocena/zakonczenie-oceny";
import { assessableStatuses } from "@/lib/ocena/dane-oceny";

// Osoba zatrudniona 2 lutego 2026 na 12 miesięcy (jak w § 8.3: umowa na czas określony).
const START = "2026-02-02";
const END = addDays(addMonths(START, 12), -1); // 2027-02-01
const person = { employmentStart: START, contractEnd: END, absences: [] };

const ELEMENTS = ["RZETELNOSC", "WIEDZA", "ORGANIZACJA", "KOMUNIKACJA", "WSPOLPRACA"] as const;
const scores = (...points: (number | null)[]) => ELEMENTS.map((competency, i) => ({ competency, score: points[i] ?? null }));

describe("etapy i terminy pierwszej oceny", () => {
  it("etap wynika ze statusu oceny, a pasek ma 4 kroki", () => {
    expect(STAGE_FOR_STATUS.DO_ROZPOCZECIA).toBe("ROZMOWA_WSTEPNA");
    expect(STAGE_FOR_STATUS.W_OKRESIE_OCENY).toBe("SPRAWOZDANIE");
    expect(STAGE_FOR_STATUS.W_OCENIE).toBe("OCENA");
    expect(stepNumber("ZAKONCZONA")).toBe(4);
  });

  it("termin sprawozdania po upływie 8 miesięcy, okno oceny do miesiąca przed końcem umowy", () => {
    expect(earliestReportDay(START)).toBe("2026-10-03");
    const p = proposedReportWindow(person);
    expect(p.dueFrom >= "2026-10-03").toBe(true);
    expect(p.dueTo).toBe(addDays(p.dueFrom, 14));
    expect(windowLatest(person)!.date <= "2027-01-01").toBe(true);
  });

  it("propozycja nie wychodzi poza okno oceny przy krótkiej umowie", () => {
    const short = { employmentStart: START, contractEnd: "2026-11-20" };
    const p = proposedReportWindow(short);
    expect(p.dueTo <= p.dueFrom || p.dueTo <= windowLatest(short)!.date).toBe(true);
  });

  it("rozmowa wstępna: walidacja dat i ostrzeżenie po 21 dniach (§ 3)", () => {
    const ok = { date: "2026-02-10", dueFrom: "2026-10-05", dueTo: "2026-10-19", notes: "" };
    expect(initialConversationIssues(ok, person, "2026-02-20")).toEqual([]);
    expect(lateConversationWarning("2026-02-10", START)).toBeNull();
    expect(lateConversationWarning("2026-03-10", START)).toContain("po terminie");
    const fields = (f: typeof ok, today = "2026-02-20") => initialConversationIssues(f, person, today).map((i) => i.field);
    expect(fields({ ...ok, date: "2026-01-30" })).toContain("date");
    expect(fields({ ...ok, date: "2026-02-25" })).toContain("date"); // z przyszłości
    expect(fields({ ...ok, dueFrom: "2026-09-30" })).toContain("dueFrom"); // przed upływem 8 miesięcy
    expect(fields({ ...ok, dueTo: "2026-10-01" })).toContain("dueTo");
    expect(fields({ ...ok, dueTo: "2027-01-20" })).toContain("dueTo"); // po końcu okna oceny
  });
});

describe("sprawozdanie i egzamin", () => {
  const ctx = { ...person, dueFrom: "2026-10-05", dueTo: "2026-10-19" };
  const form: ReportForm = { mode: "ZLOZONE", submittedAt: "2026-10-12", content: "Zadania i wnioski.", fileName: "", exam: "ZDANY" };

  it("złożone w terminie – bez uwag i „w terminie”", () => {
    expect(reportIssues(form, ctx, "2026-10-20")).toEqual([]);
    expect(reportOnTime("2026-10-12", ctx)).toBe(true);
    expect(reportOnTime("2026-10-26", ctx)).toBe(false);
    expect(reportOnTime(undefined, ctx)).toBe(false);
  });

  it("wymaga daty i treści albo pliku; egzamin może poczekać, ale „nie dotyczy” wymaga powodu", () => {
    const fields = (f: Partial<ReportForm>) => reportIssues({ ...form, ...f }, ctx, "2026-10-20").map((i) => i.field);
    expect(fields({ submittedAt: "" })).toContain("submittedAt");
    expect(fields({ submittedAt: "2026-10-01" })).toContain("submittedAt"); // przed terminem – mniej niż 7 miesięcy
    expect(fields({ content: "", fileName: "" })).toContain("content");
    expect(fields({ content: "", fileName: "sprawozdanie.docx" })).not.toContain("content");
    expect(fields({ exam: undefined })).toEqual([]); // egzamin jeszcze się nie odbył – sprawozdanie i tak się zapisze
    expect(fields({ exam: "NIE_DOTYCZY" })).toContain("examExemption");
    expect(fields({ exam: "NIE_DOTYCZY", examExemption: "ZASTEPSTWO" })).toEqual([]);
  });

  it("brak sprawozdania można odnotować dopiero po terminie", () => {
    const missing: ReportForm = { ...form, mode: "NIE_ZLOZONE" };
    expect(reportIssues(missing, ctx, "2026-10-19").map((i) => i.field)).toContain("mode");
    expect(reportIssues(missing, ctx, "2026-10-21")).toEqual([]);
  });

  it("plik: tylko .docx albo .txt, niepusty, do 5 MB", () => {
    expect(reportFileProblem({ name: "s.docx", size: 1000 })).toBeNull();
    expect(reportFileProblem({ name: "s.txt", size: 10 })).toBeNull();
    expect(reportFileProblem({ name: "s.pdf", size: 10 })).toContain(".docx");
    expect(reportFileProblem({ name: "s.docx", size: 0 })).toContain("pusty");
    expect(reportFileProblem({ name: "s.docx", size: 6 * 1024 * 1024 })).toContain("za duży");
  });
});

describe("kryteria i egzamin", () => {
  it("pięć elementów pierwszej oceny jako kryteria obowiązkowe w kolejności z § 2 pkt 1", () => {
    expect(firstEvalCriteria()).toEqual(ELEMENTS.map((competency, order) => ({ competency, kind: "OBOWIAZKOWE", order })));
  });

  it("brak egzaminu blokuje wynik, a nie zapis sprawozdania", () => {
    expect(examMissing(undefined, undefined)).toBe(true);
    expect(examMissing("NIE_DOTYCZY", undefined)).toBe(true);
    expect(examMissing("NIE_DOTYCZY", "ZASTEPSTWO")).toBe(false);
    expect(examMissing("ZDANY", undefined)).toBe(false);
    const s = firstEvalSummary({ scores: scores(5, 5, 5, 7, 7), reportSubmittedOnTime: true });
    expect(s.complete).toBe(false);
    if (!s.complete) expect(s.missing).toEqual(["wynik egzaminu ze służby przygotowawczej"]);
  });
});

describe("wynik według § 10 i sporządzenie oceny", () => {
  it("braki zamiast wyjątku, gdy nie oceniono wszystkich elementów", () => {
    const s = firstEvalSummary({ scores: scores(5, 5, null, 7, 7), exam: "ZDANY", reportSubmittedOnTime: true });
    expect(s.complete).toBe(false);
    if (!s.complete) expect(s.missing.join()).toContain("Organizacja");
  });

  it("pozytywna: egzamin, sprawozdanie w terminie, najwyżej jedna „3”, średnia ≥ 5", () => {
    const s = firstEvalSummary({ scores: scores(3, 5, 5, 7, 5), exam: "ZDANY", reportSubmittedOnTime: true });
    expect(s.complete && s.result.result).toBe("POZYTYWNA");
    expect(s.complete && s.result.average).toBe(5);
  });

  it("negatywna przy sprawozdaniu po terminie, dwóch „3” albo niezdanym egzaminie", () => {
    const r = (over: Partial<Parameters<typeof firstEvalSummary>[0]>) => {
      const s = firstEvalSummary({ scores: scores(5, 5, 5, 7, 7), exam: "ZDANY", reportSubmittedOnTime: true, ...over });
      return s.complete ? s.result.result : null;
    };
    expect(r({ reportSubmittedOnTime: false })).toBe("NEGATYWNA");
    expect(r({ scores: scores(3, 3, 7, 7, 7) })).toBe("NEGATYWNA");
    expect(r({ exam: "NIEZDANY" })).toBe("NEGATYWNA");
    expect(r({ exam: "NIE_DOTYCZY", examExemption: "WYZSZE_STANOWISKO" })).toBe("POZYTYWNA");
  });

  it("sporządzenie: data w oknie oceny, uzasadnienie przy negatywnej, bez wniosków rozwojowych przy negatywnej", () => {
    const pos = firstEvalSummary({ scores: scores(5, 5, 5, 7, 7), exam: "ZDANY", reportSubmittedOnTime: true });
    const neg = firstEvalSummary({ scores: scores(5, 5, 5, 7, 7), exam: "NIEZDANY", reportSubmittedOnTime: true });
    if (!pos.complete || !neg.complete) throw new Error("oczekiwano pełnego wyniku");
    const ctx = { ...person, reportSubmittedAt: "2026-10-12", today: "2026-11-02" };
    const form = { evaluatedAt: "2026-11-02", justification: "", developmentPlan: "Szkolenie z KPA." };
    expect(completionIssues(form, { ...ctx, result: pos.result })).toEqual([]);
    const negFields = completionIssues(form, { ...ctx, result: neg.result }).map((i) => i.field);
    expect(negFields).toEqual(expect.arrayContaining(["justification", "developmentPlan"]));
    const early = completionIssues({ ...form, evaluatedAt: "2026-09-30" }, { ...ctx, today: "2026-09-30", result: pos.result }).map((i) => i.field);
    expect(early).toContain("evaluatedAt"); // przed upływem 8 miesięcy (art. 38)
    expect(completionIssues({ ...form, evaluatedAt: "2026-10-10" }, { ...ctx, result: pos.result }).map((i) => i.text).join()).toContain("po złożeniu sprawozdania");
    expect(defaultEvaluationDate(person, "2026-11-02")).toBe("2026-11-02");
    expect(defaultEvaluationDate(person, "2026-05-02")).toBeUndefined();
  });
});

describe("karty zachowań ocena wskaźników w skali pierwszej oceny", () => {
  it("decyzja w skali 3/5/7 i sugestia z mapowania behaviorToPoints.firstEval", () => {
    expect(decisionOptions(undefined, "PIERWSZA").map((o) => o.points)).toEqual([3, 5, 7]);
    expect(decisionOptions().map((o) => o.points)).toEqual([1, 3, 5, 7, 9]);
    const s = suggestionFor(
      { competency: "RZETELNOSC", indicatorIds: ["RZETELNOSC.1", "RZETELNOSC.2"], ratings: { "RZETELNOSC.1": 5, "RZETELNOSC.2": 4 } },
      new Map(),
      undefined,
      "PIERWSZA",
    );
    expect(s.suggestedPoints).toBe(7);
    expect(s.evaluationType).toBe("PIERWSZA");
  });

  it("elementy pierwszej oceny ocenia się dopiero po sprawozdaniu (etap „Do oceny”)", () => {
    expect(assessableStatuses("PIERWSZA")).toEqual(["W_OCENIE"]);
    expect(assessableStatuses("OKRESOWA")).toEqual(["W_OKRESIE_OCENY", "W_OCENIE"]);
  });
});
