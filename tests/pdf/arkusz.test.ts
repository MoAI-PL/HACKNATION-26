import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  buildSheetData,
  formatAverage,
  officeName,
  sheetDownloads,
  sheetFileName,
  sheetProblem,
  sheetScope,
  splitName,
  type SheetRow,
} from "@/lib/pdf/arkusz";
import { additionalCell, renderSheetPdf } from "@/lib/pdf/ArkuszOkresowyPdf";
import { przypisy } from "@/lib/pdf/teksty-arkusza";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Ocena sporządzona – jak po kreator oceny okresowej, ocena wskaźników i podsumowanie oceny (urzędnik z wnioskiem o stopień). */
function row(over: Partial<SheetRow> = {}): SheetRow {
  const base = {
    id: "ev1",
    employeeId: "e1",
    evaluatorId: "u1",
    type: "OKRESOWA",
    sheet: "C",
    sheetOverridden: false,
    status: "CZEKA_NA_ZAPOZNANIE",
    periodStart: d("2024-12-11"),
    periodEnd: d("2026-11-20"),
    dueDate: d("2026-11-30"),
    criteriaSetAt: d("2024-12-11"),
    startChecklist: null,
    expectations: null,
    goals: null,
    isReevaluation: false,
    evaluatedAt: d("2026-11-20"),
    acknowledgedAt: null,
    result: "POZYTYWNA",
    overallLevel: "POWYZEJ",
    average: 6.29,
    justification: "Samodzielne, rzetelne opinie; wzór odpowiedzi trafił do szablonów wydziału.",
    developmentPlan: "Szkolenie z prawa UE w obszarze sztucznej inteligencji (I kw. 2027).",
    previousResult: "POZYTYWNA",
    previousLevel: "NA_POZIOMIE",
    previousDate: d("2024-11-30"),
    promotionRequest: true,
    promotionJustification: "Wysoka jakość opinii i samodzielność.",
    requestedGrade: 3,
    examResult: null,
    examExemption: null,
    lastWizardStep: null,
    wizardState: null,
    createdAt: d("2024-12-11"),
    updatedAt: d("2026-11-20"),
    employee: {
      id: "e1",
      firstName: "Katarzyna",
      lastName: "Wójcik",
      isCivilServant: true,
      appointmentYear: 2021,
      serviceGrade: 2,
      serviceGradeDate: null,
      employmentStart: d("2019-03-01"),
      permanentFrom: d("2019-03-01"),
      contractEnd: null,
      orgUnitId: "o3",
      positionId: "p1",
      supervisorId: "u1",
      unitHeadId: null,
      createdAt: d("2024-01-01"),
      updatedAt: d("2024-01-01"),
      position: { title: "radca" },
      orgUnit: {
        name: "Wydział Wspierania Innowacyjności",
        parent: { name: "Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji", parent: { name: "Ministerstwo Cyfryzacji (dane demo)", parent: null } },
      },
    },
    evaluator: { name: "Ewa Kowalczyk", employee: null },
    criteria: [
      ["WIEDZA", "OBOWIAZKOWE", 7],
      ["RZETELNOSC", "OBOWIAZKOWE", 5],
      ["ORGANIZACJA", "OBOWIAZKOWE", 5],
      ["WSPOLPRACA", "OBOWIAZKOWE", 7],
      ["KOMUNIKACJA", "OBOWIAZKOWE", 7],
      ["ANALITYCZNE", "DODATKOWE", 7],
      ["KREATYWNOSC", "DODATKOWE", 7],
    ].map(([competency, kind, score], order) => ({
      id: `c${order}`,
      evaluationId: "ev1",
      competency,
      kind,
      selectionReason: null,
      score,
      suggestedScore: score,
      overrideReason: null,
      order,
    })),
    conversations: [
      { type: "ROZPOCZYNAJACA", date: d("2024-12-11") },
      { type: "OCENIAJACA", date: d("2026-11-18") },
    ],
  };
  return { ...base, ...over } as unknown as SheetRow;
}

async function pdfText(buf: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

describe("arkusz – dane i warunki wydania", () => {
  it("nazwa urzędu to najwyższa komórka, imię i nazwisko z nazwy konta", () => {
    expect(officeName({ name: "Wydział", parent: { name: "Departament", parent: { name: "Ministerstwo" } } })).toBe("Ministerstwo");
    expect(officeName(null)).toBeNull();
    expect(splitName("Ewa Kowalczyk")).toEqual({ firstName: "Ewa", lastName: "Kowalczyk" });
    expect(splitName("Anna Maria Nowak-Kowalska")).toEqual({ firstName: "Anna", lastName: "Maria Nowak-Kowalska" });
  });

  it("pełny arkusz: części I–III, rozmowa oceniająca, poprzednia ocena, X przy wyniku", () => {
    const s = buildSheetData(row(), "PELNY");
    expect(s.office).toBe("Ministerstwo Cyfryzacji (dane demo)");
    expect(s.evaluator).toEqual({ firstName: "Ewa", lastName: "Kowalczyk", orgUnit: null, position: null });
    expect(s.criteria.filter((c) => c.kind === "DODATKOWE").map((c) => c.name)).toEqual(["Myślenie analityczne", "Kreatywność"]);
    expect(s.partII).toMatchObject({ interviewDate: "2026-11-18", periodStart: "2024-12-11", periodEnd: "2026-11-20", promotion: "TAK" });
    expect(s.partIII).toMatchObject({ appointmentYear: 2021, serviceGrade: 2, requestedGrade: 3 });
  });

  it("część I: bez ocen cząstkowych i bez części II i III", () => {
    const s = buildSheetData(row(), "CZESC_I");
    expect(s.partII).toBeNull();
    expect(s.partIII).toBeNull();
    expect(s.criteria.every((c) => c.points === null)).toBe(true);
  });

  it("pracownik służby cywilnej: NIE DOTYCZY i bez części III (przypis 18)", () => {
    const r = row();
    const s = buildSheetData({ ...r, employee: { ...r.employee, isCivilServant: false } } as SheetRow, "PELNY");
    expect(s.partII?.promotion).toBe("NIE_DOTYCZY");
    expect(s.partIII).toBeNull();
  });

  it("urzędnik bez wniosku: NIE i bez części III", () => {
    const s = buildSheetData(row({ promotionRequest: false }), "PELNY");
    expect(s.partII?.promotion).toBe("NIE");
    expect(s.partIII).toBeNull();
  });

  it("poprzednia ocena sporządzona przed systemem – data kryteriów z początku okresu", () => {
    const s = buildSheetData(row({ criteriaSetAt: null, status: "ZAKONCZONA" }), "PELNY");
    expect(s.criteriaSetAt).toBe("2024-12-11");
  });

  it("warunki wydania: część I po ustaleniu kryteriów, pełny po sporządzeniu oceny", () => {
    const base = { type: "OKRESOWA", sheet: "C", criteriaSetAt: d("2024-12-11"), periodStart: d("2024-12-11") };
    expect(sheetProblem({ ...base, status: "W_OCENIE" }, "CZESC_I")).toBeNull();
    expect(sheetProblem({ ...base, status: "W_OCENIE" }, "PELNY")).toContain("po sporządzeniu oceny");
    expect(sheetProblem({ ...base, status: "CZEKA_NA_ZAPOZNANIE" }, "PELNY")).toBeNull();
    expect(sheetProblem({ ...base, status: "DO_ROZPOCZECIA", criteriaSetAt: null, periodStart: null }, "CZESC_I")).toContain("ustal kryteria");
    expect(sheetProblem({ ...base, type: "PIERWSZA", sheet: "PIERWSZA", status: "W_OCENIE" }, "CZESC_I")).toContain("arkuszu B albo C");
  });

  it("dostęp: oceniany – tylko własne (pełny po sporządzeniu), kierujący – brak", () => {
    expect(sheetScope({ id: "u9", role: "KIERUJACY_KOMORKA" }, "PELNY")).toBeNull();
    expect(sheetScope({ id: "u9", role: "HR" }, "PELNY")).toEqual({});
    const own = sheetScope({ id: "u9", role: "OCENIANY" }, "PELNY");
    expect(own).toMatchObject({ employee: { user: { id: "u9" } }, status: { in: ["CZEKA_NA_ZAPOZNANIE", "ZAKONCZONA"] } });
  });

  it("formatowanie: średnia z przecinkiem i nazwa pliku bez polskich znaków", () => {
    expect(formatAverage(6.285714)).toBe("6,29");
    expect(formatAverage(null)).toBeNull();
    expect(sheetFileName({ sheet: "C", variant: "CZESC_I", employee: { firstName: "Łucja", lastName: "Wójcik", orgUnit: null, position: null } })).toBe(
      "arkusz-C-Wojcik-Lucja-czesc-I.pdf",
    );
  });

  it("przyciski pobierania: część I po ustaleniu kryteriów, pełny po sporządzeniu, pierwsza ocena – jeden arkusz po rozmowie wstępnej", () => {
    const base = { evaluationId: "e 1", type: "OKRESOWA" };
    expect(sheetDownloads({ ...base, status: "DO_ROZPOCZECIA", hasCriteria: false })).toEqual([]);
    expect(sheetDownloads({ ...base, status: "W_OKRESIE_OCENY", hasCriteria: true }).map((l) => l.href)).toEqual([
      "/api/v1/oceny/e%201/pdf?wariant=czesc-i",
    ]);
    expect(sheetDownloads({ ...base, status: "ZAKONCZONA", hasCriteria: false }).map((l) => l.label)).toEqual([
      "Pobierz arkusz (PDF)",
      "Pobierz część I (PDF)",
    ]);
    expect(sheetDownloads({ ...base, type: "PIERWSZA", status: "W_OCENIE", hasCriteria: true })).toEqual([{ href: "/api/v1/oceny/e%201/pdf", label: "Pobierz arkusz pierwszej oceny (PDF)" }]);
    expect(sheetDownloads({ ...base, type: "PIERWSZA", status: "DO_ROZPOCZECIA", hasCriteria: false })).toEqual([]);
  });

  it("część I: nieużyte wiersze kryteriów dodatkowych są puste, „—” gdy nie wybrano żadnego", () => {
    const one = [{ name: "Wystąpienia publiczne", kind: "DODATKOWE" as const, points: null }];
    expect([0, 1, 2].map((i) => additionalCell(one, i))).toEqual(["Wystąpienia publiczne", "", ""]);
    expect([0, 1, 2].map((i) => additionalCell([], i))).toEqual(["—", "", ""]);
  });

  it("przypis 1 różni się dla arkuszy B i C", () => {
    expect(przypisy("B")[1]).toContain("na którym praca polega na bezpośrednim kierowaniu pracownikami.");
    expect(przypisy("C")[1]).toContain("które nie jest");
  });
});

describe("arkusz – plik PDF", () => {
  it(
    "pełny arkusz C: trzy strony, polskie znaki, X w odpowiednich polach, pouczenie i część III",
    async () => {
      const buf = await renderSheetPdf(buildSheetData(row(), "PELNY"));
      if (process.env.ZAPISZ_PDF) writeFileSync(`${process.env.ZAPISZ_PDF}/arkusz-C-pelny.pdf`, buf);
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      const text = await pdfText(buf);
      for (const fragment of [
        "ARKUSZ C",
        "CZĘŚĆ I",
        "CZĘŚĆ II",
        "CZĘŚĆ III",
        "Ministerstwo Cyfryzacji (dane demo)",
        "Katarzyna",
        "Wójcik",
        "Wykorzystywanie wiedzy i doskonalenie zawodowe",
        "Myślenie analityczne",
        "6,29",
        "18.11.2026",
        "Zgodnie z art. 83 ust. 1",
        "Szkolenie z prawa UE",
        "wnioskuję o przyznanie 3 stopnia służbowego",
      ]) {
        expect(text, fragment).toContain(fragment);
      }
    },
    30_000,
  );

  it(
    "część I arkusza B: jedna strona, bez części II",
    async () => {
      const r = row({ sheet: "B" });
      const buf = await renderSheetPdf(buildSheetData(r, "CZESC_I"));
      if (process.env.ZAPISZ_PDF) writeFileSync(`${process.env.ZAPISZ_PDF}/arkusz-B-czesc-I.pdf`, buf);
      const text = await pdfText(buf);
      expect(text).toContain("ARKUSZ B");
      expect(text).not.toContain("CZĘŚĆ II");
      expect(text).toContain("na którym praca polega na bezpośrednim kierowaniu pracownikami");
    },
    30_000,
  );
});
