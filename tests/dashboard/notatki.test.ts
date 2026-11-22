// Przypomnienia o regularnych notatkach: osoby w okresie oceny bez notatki od co najmniej 90 dni.
import { describe, expect, it } from "vitest";
import { NOTE_REMINDER_DAYS, monthsAgoText, noteReminders } from "@/lib/dashboard/notatki";
import type { EmployeeInfo, EvaluationInfo } from "@/lib/dashboard/pulpit";

const TODAY = "2026-11-22";

function emp(id: string, ev: Partial<EvaluationInfo> | null, lastObservationDate?: string): EmployeeInfo {
  return {
    id, firstName: "Jan", lastName: id, employmentStart: "2020-01-01",
    evaluations: ev ? [{ id: `ev-${id}`, type: "OKRESOWA", sheet: "C", status: "W_OKRESIE_OCENY", isReevaluation: false, criteriaSetAt: "2025-01-15", ...ev }] : [],
    absences: [], positionChanges: [], observationsCount: lastObservationDate ? 3 : 0, lastObservationDate,
  };
}

describe("przypomnienia o regularnych notatkach", () => {
  it("próg 90 dni od ostatniej notatki – 89 dni bez przypomnienia, 90 z przypomnieniem", () => {
    expect(NOTE_REMINDER_DAYS).toBe(90);
    expect(noteReminders([emp("A", {}, "2026-08-25")], TODAY)).toEqual([]); // 89 dni
    const [r] = noteReminders([emp("B", {}, "2026-08-24")], TODAY); // 90 dni
    expect(r).toMatchObject({ employeeId: "B", days: 90, lastNote: "2026-08-24" });
  });

  it("bez notatki w okresie oceny – liczymy od początku okresu; notatka sprzed okresu się nie liczy", () => {
    const [r] = noteReminders([emp("C", { criteriaSetAt: "2026-07-01" }, "2026-05-10")], TODAY);
    expect(r).toMatchObject({ days: 144, lastNote: undefined, periodStart: "2026-07-01" });
  });

  it("tylko okres oceny: przed ustaleniem kryteriów, w trakcie sporządzania i po zakończeniu – bez przypomnień", () => {
    const old = "2025-02-01";
    expect(noteReminders([emp("D", { status: "DO_ROZPOCZECIA", criteriaSetAt: undefined }, old)], TODAY)).toEqual([]);
    expect(noteReminders([emp("E", { status: "W_OCENIE" }, old)], TODAY)).toEqual([]);
    expect(noteReminders([emp("F", { status: "ZAKONCZONA" }, old)], TODAY)).toEqual([]);
    expect(noteReminders([emp("G", null)], TODAY)).toEqual([]);
  });

  it("pierwsza ocena po rozmowie wstępnej – od daty rozmowy (albo zatrudnienia, gdy jej brak)", () => {
    const [r] = noteReminders([emp("H", { type: "PIERWSZA", sheet: "PIERWSZA", criteriaSetAt: undefined })], TODAY);
    expect(r!.periodStart).toBe("2020-01-01");
  });

  it("najdłużej bez notatki na górze", () => {
    const list = noteReminders([emp("X", {}, "2026-08-01"), emp("Y", {}, "2026-05-01"), emp("Z", {}, "2026-11-01")], TODAY);
    expect(list.map((r) => r.employeeId)).toEqual(["Y", "X"]);
  });

  it("czas po polsku: ponad 3 miesiące, ponad 5 miesięcy, ponad 1 miesiąc", () => {
    expect(monthsAgoText(100)).toBe("ponad 3 miesiące");
    expect(monthsAgoText(160)).toBe("ponad 5 miesięcy");
    expect(monthsAgoText(45)).toBe("ponad 1 miesiąc");
    expect(monthsAgoText(400)).toBe("ponad 13 miesięcy");
  });
});
