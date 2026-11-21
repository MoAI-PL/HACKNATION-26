// Oś czasu procesu pracownika (Z37): kolejność, stany (zrobione / dziś / przed nami / po terminie), terminy z podstawą prawną.
import { describe, expect, it } from "vitest";
import { processTimeline } from "@/lib/dashboard/os-czasu";
import type { EmployeeInfo, EvaluationInfo } from "@/lib/dashboard/pulpit";

const TODAY = "2026-11-21";

function employee(over: Partial<EmployeeInfo> = {}): EmployeeInfo {
  return {
    id: "kw",
    firstName: "Katarzyna",
    lastName: "Wójcik",
    positionTitle: "radca",
    employmentStart: "2020-01-02",
    permanentFrom: "2020-07-01",
    evaluations: [],
    absences: [],
    positionChanges: [],
    observationsCount: 0,
    ...over,
  };
}

const ev = (over: Partial<EvaluationInfo>): EvaluationInfo => ({
  id: "e",
  type: "OKRESOWA",
  sheet: "C",
  status: "W_OKRESIE_OCENY",
  isReevaluation: false,
  ...over,
});

const titles = (xs: { title: string }[]) => xs.map((x) => x.title);

describe("oś czasu procesu", () => {
  it("historia i bieżący termin w kolejności dat, „dziś” między przeszłością a terminem", () => {
    const e = employee({
      evaluations: [
        ev({ id: "p", status: "ZAKONCZONA", criteriaSetAt: "2022-12-01", evaluatedAt: "2024-12-02", acknowledgedAt: "2024-12-04", result: "POZYTYWNA", level: "NA_POZIOMIE" }),
        ev({ id: "c", status: "W_OKRESIE_OCENY", criteriaSetAt: "2024-12-20" }),
      ],
    });
    const t = processTimeline(e, TODAY);
    expect(titles(t)).toEqual([
      "Nawiązanie stosunku pracy",
      "Zatrudnienie na czas nieokreślony",
      "Rozmowa rozpoczynająca – kryteria oceny okresowej",
      "Sporządzenie oceny okresowej",
      "Zapoznanie ocenianego z oceną",
      "Rozmowa rozpoczynająca – kryteria oceny okresowej",
      "Dziś",
      "Ocena okresowa",
    ]);
    expect(t[3]).toMatchObject({ detail: "Ocena pozytywna – na poziomie oczekiwań", state: "ZROBIONE" });
    const termin = t.at(-1)!;
    // 24 miesiące od poprzedniej oceny (art. 81 ust. 4) – 02.12.2026 to środa.
    expect(termin).toMatchObject({ kind: "TERMIN", date: "2026-12-02", state: "PRZED_NAMI", daysLeft: 11, urgency: "WKROTCE" });
    expect(termin.legalBasis).toMatch(/art\. 81/);
    expect(t.find((x) => x.kind === "DZIS")).toMatchObject({ date: TODAY, state: "DZIS" });
  });

  it("termin, który minął → PO_TERMINIE; nieobecność to okres z liczbą dni i przesuwa termin", () => {
    const e = employee({
      evaluations: [
        ev({ id: "p", status: "ZAKONCZONA", evaluatedAt: "2024-10-01", acknowledgedAt: "2024-10-03", result: "POZYTYWNA" }),
        ev({ id: "c", status: "W_OCENIE", criteriaSetAt: "2024-10-20" }),
      ],
      absences: [{ kind: "ZWOLNIENIE_LEKARSKIE", from: "2025-03-01", to: "2025-04-14" }],
    });
    const t = processTimeline(e, TODAY);
    const okres = t.find((x) => x.kind === "OKRES")!;
    expect(okres).toMatchObject({ title: "Nieobecność: zwolnienie lekarskie", date: "2025-03-01", until: "2025-04-14", detail: "45 dni", state: "ZROBIONE" });
    const termin = t.find((x) => x.kind === "TERMIN")!;
    // 01.10.2026 + 45 dni nieobecności (art. 81 ust. 7) = 15.11.2026 (niedziela) → 16.11.2026 – już minął.
    expect(termin).toMatchObject({ date: "2026-11-16", state: "PO_TERMINIE", urgency: "PO_TERMINIE", daysLeft: -5 });
    expect(t.indexOf(termin)).toBeLessThan(t.findIndex((x) => x.kind === "DZIS"));
  });

  it("termin na sprzeciw po zapoznaniu – widoczny do tygodnia po upływie, potem znika", () => {
    const zakonczona = (ack: string) =>
      employee({ evaluations: [ev({ id: "p", status: "ZAKONCZONA", evaluatedAt: "2026-11-10", acknowledgedAt: ack, result: "NEGATYWNA" })] });
    const swiezy = processTimeline(zakonczona("2026-11-18"), TODAY).find((x) => x.title === "Termin na sprzeciw ocenianego");
    expect(swiezy).toMatchObject({ date: "2026-11-25", state: "PRZED_NAMI", legalBasis: expect.stringMatching(/art\. 83/) });
    expect(processTimeline(zakonczona("2026-10-01"), TODAY).some((x) => x.title === "Termin na sprzeciw ocenianego")).toBe(false);
  });

  it("ponowna ocena po negatywnej: jeden dzień, bez przedziału „od X do X”; wyjaśnienie jest w karcie „Terminy”, nie na osi", () => {
    const e = employee({
      evaluations: [
        ev({ id: "p", status: "ZAKONCZONA", evaluatedAt: "2026-10-12", acknowledgedAt: "2026-10-14", result: "NEGATYWNA", level: "PONIZEJ" }),
        ev({ id: "c", status: "W_OKRESIE_OCENY", isReevaluation: true, criteriaSetAt: "2026-10-17" }),
      ],
    });
    const termin = processTimeline(e, TODAY).find((x) => x.title === "Ponowna ocena po ocenie negatywnej")!;
    expect(termin).toMatchObject({ date: "2027-04-15", until: undefined, detail: undefined, state: "PRZED_NAMI" });
    expect(termin.legalBasis).toMatch(/art\. 81/);
  });

  it("pierwsza ocena przed rozmową wstępną: termin 21 dni od nawiązania stosunku pracy", () => {
    const e = employee({ employmentStart: "2026-11-09", permanentFrom: undefined, evaluations: [ev({ type: "PIERWSZA", status: "DO_ROZPOCZECIA" })] });
    const t = processTimeline(e, TODAY);
    expect(titles(t)).toEqual(["Nawiązanie stosunku pracy", "Dziś", "Rozmowa wstępna"]);
    expect(t[2]).toMatchObject({ kind: "TERMIN", state: "PRZED_NAMI" });
  });

  it("w tym samym dniu: zdarzenie, potem „dziś”, potem termin; zdarzenie dziś ma stan DZIS", () => {
    const e = employee({
      employmentStart: TODAY,
      permanentFrom: undefined,
      evaluations: [ev({ type: "PIERWSZA", status: "DO_ROZPOCZECIA" })],
      positionChanges: [{ date: "2026-12-01", significantDutiesChange: true }],
    });
    const t = processTimeline(e, TODAY);
    expect(t.slice(0, 2).map((x) => [x.kind, x.state])).toEqual([
      ["ZDARZENIE", "DZIS"],
      ["DZIS", "DZIS"],
    ]);
    expect(t.find((x) => x.title === "Zmiana stanowiska")).toMatchObject({ state: "PRZED_NAMI", detail: "Istotna zmiana obowiązków" });
  });

  it("bez bieżącej oceny i bez historii: tylko zatrudnienie i „dziś”", () => {
    expect(titles(processTimeline(employee({ permanentFrom: undefined }), TODAY))).toEqual(["Nawiązanie stosunku pracy", "Dziś"]);
  });
});
