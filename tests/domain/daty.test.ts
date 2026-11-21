import { describe, expect, it } from "vitest";
import { fromDbDate, isIsoDate, toDbDate, todayIso } from "@/lib/domain/daty";

describe("daty kalendarzowe ↔ baza", () => {
  it("rozpoznaje poprawne i niepoprawne daty", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-1-5")).toBe(false);
  });

  it("zachowuje dzień w obie strony (także koniec miesiąca)", () => {
    for (const d of ["2024-08-31", "2026-01-01", "2026-12-31", "2028-02-29"]) {
      expect(fromDbDate(toDbDate(d))).toBe(d);
    }
  });

  it("odrzuca niepoprawną datę przy zapisie", () => {
    expect(() => toDbDate("31.08.2024")).toThrow(/RRRR-MM-DD/);
  });

  it("dzisiejsza data liczona w strefie Europe/Warsaw", () => {
    // 23:30 UTC 31.12 to już 1 stycznia w Polsce (UTC+1)
    expect(todayIso(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    // 21:30 UTC 30.06 to 23:30 w Polsce (UTC+2) – nadal 30 czerwca
    expect(todayIso(new Date("2026-06-30T21:30:00Z"))).toBe("2026-06-30");
  });
});
