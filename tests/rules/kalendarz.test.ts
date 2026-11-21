import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  easterSunday,
  formatRangePl,
  holidayName,
  inclusiveDays,
  isDayOff,
  nextWorkingDay,
  previousWorkingDay,
} from "@/lib/rules/kalendarz";
import { RulesInputError } from "@/lib/rules/bledy";

describe("arytmetyka dat (art. 111–112 KC)", () => {
  it("dodaje dni, także przez koniec roku i wstecz", () => {
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("miesiące: ten sam dzień albo ostatni dzień miesiąca", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(addMonths("2024-02-29", 24)).toBe("2026-02-28");
    expect(addMonths("2026-08-31", 24)).toBe("2028-08-31");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
  });

  it("liczy dni okresu włącznie", () => {
    expect(inclusiveDays("2025-03-12", "2025-04-24")).toBe(44);
    expect(inclusiveDays("2026-05-04", "2026-05-04")).toBe(1);
  });

  it("odrzuca niepoprawne daty", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RulesInputError);
  });

  it("formatuje okresy po polsku", () => {
    expect(formatRangePl("2026-03-12", "2026-04-24")).toBe("12.03–24.04.2026");
    expect(formatRangePl("2026-12-20", "2027-01-15")).toBe("20.12.2026–15.01.2027");
  });
});

describe("święta ustawowe", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
  ])("Wielkanoc %i = %s", (rok, data) => {
    expect(easterSunday(rok)).toBe(data);
  });

  it("święta ruchome 2026: Poniedziałek Wielkanocny, Zielone Świątki, Boże Ciało", () => {
    expect(holidayName("2026-04-06")).toBe("Poniedziałek Wielkanocny");
    expect(holidayName("2026-05-24")).toBe("Zielone Świątki");
    expect(holidayName("2026-06-04")).toBe("Boże Ciało");
  });

  it("Wigilia jest dniem wolnym od 2025 r.", () => {
    expect(holidayName("2026-12-24")).not.toBeNull();
    expect(holidayName("2024-12-24")).toBeNull();
  });

  it("dni wolne: niedziela, święto i sobota (art. 115 KC)", () => {
    expect(isDayOff("2026-11-29")).toBe(true); // niedziela
    expect(isDayOff("2026-11-28")).toBe(true); // sobota
    expect(isDayOff("2026-11-28", false)).toBe(false);
    expect(isDayOff("2026-11-11")).toBe(true);
    expect(isDayOff("2026-11-27")).toBe(false);
  });

  it("przesuwa na najbliższy dzień roboczy w przód i wstecz", () => {
    expect(nextWorkingDay("2026-11-28")).toBe("2026-11-30");
    expect(nextWorkingDay("2026-12-24")).toBe("2026-12-28");
    expect(nextWorkingDay("2026-11-27")).toBe("2026-11-27");
    expect(previousWorkingDay("2026-11-29")).toBe("2026-11-27");
  });
});
