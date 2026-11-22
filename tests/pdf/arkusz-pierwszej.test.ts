import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildFirstSheetData, firstSheetFileName, firstSheetHref, firstSheetProblem, type FirstSheetRow } from "@/lib/pdf/arkusz-pierwszej";
import { renderFirstSheetPdf } from "@/lib/pdf/ArkuszPierwszejPdf";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Pierwsza ocena sporządzona – jak po ścieżce pierwsza ocena (rozmowa wstępna, sprawozdanie, 5 elementów, wynik). */
function row(over: Partial<Record<string, unknown>> = {}): FirstSheetRow {
  const base = {
    id: "ev1",
    employeeId: "e1",
    evaluatorId: "u1",
    type: "PIERWSZA",
    sheet: "PIERWSZA",
    status: "CZEKA_NA_ZAPOZNANIE",
    criteriaSetAt: d("2026-02-10"),
    evaluatedAt: d("2026-11-02"),
    acknowledgedAt: null,
    result: "POZYTYWNA",
    average: 5.4,
    justification: null,
    developmentPlan: "Szkolenie z postępowania administracyjnego.",
    examResult: "NIE_DOTYCZY",
    examExemption: "WYZSZE_STANOWISKO",
    employee: {
      id: "e1",
      firstName: "Aleksandra",
      lastName: "Mazur",
      employmentStart: d("2026-02-02"),
      contractEnd: d("2027-02-01"),
      position: { title: "starszy specjalista" },
      orgUnit: { name: "Wydział Analiz", parent: { name: "Ministerstwo Cyfryzacji (dane demo)", parent: null } },
      unitHead: { name: "Tomasz Wiśniewski", employee: null },
      absences: [],
    },
    evaluator: { name: "Ewa Kowalczyk", employee: null },
    criteria: [
      ["RZETELNOSC", 5],
      ["WIEDZA", 7],
      ["ORGANIZACJA", 5],
      ["KOMUNIKACJA", 3],
      ["WSPOLPRACA", 7],
    ].map(([competency, score], order) => ({ id: `c${order}`, competency, kind: "OBOWIAZKOWE", score, order })),
    conversations: [{ type: "WSTEPNA", date: d("2026-02-10") }],
    report: { dueFrom: d("2026-10-05"), dueTo: d("2026-10-19"), submittedAt: d("2026-10-12"), content: "…", fileName: null },
  };
  return { ...base, ...over } as unknown as FirstSheetRow;
}

async function pdfText(buf: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text.replace(/\s+/g, " ");
}

describe("arkusz pierwszej oceny – dane", () => {
  it("wydruk dopiero po rozmowie wstępnej i tylko dla pierwszej oceny", () => {
    expect(firstSheetProblem({ type: "PIERWSZA", status: "DO_ROZPOCZECIA" })).toContain("rozmowie wstępnej");
    expect(firstSheetProblem({ type: "PIERWSZA", status: "W_OKRESIE_OCENY" })).toBeNull();
    expect(firstSheetProblem({ type: "OKRESOWA", status: "ZAKONCZONA" })).toContain("pierwszej oceny");
  });

  it("dane z bazy: urząd, osoby, terminy, oceny elementów i sprawozdanie w terminie", () => {
    const data = buildFirstSheetData(row());
    expect(data.office).toBe("Ministerstwo Cyfryzacji (dane demo)");
    expect(data.unitHead).toMatchObject({ firstName: "Tomasz", lastName: "Wiśniewski" });
    expect(data.initialConversation).toBe("2026-02-10");
    expect(data.reportDue).toEqual({ from: "2026-10-05", to: "2026-10-19" });
    expect(data.window?.from).toBe("2026-10-03");
    expect(data.evaluation?.elements.map((e) => e.points)).toEqual([5, 7, 5, 3, 7]);
    expect(data.evaluation?.reportOnTime).toBe(true);
  });

  it("przed sporządzeniem oceny część z wynikiem zostaje pusta", () => {
    expect(buildFirstSheetData(row({ status: "W_OCENIE" })).evaluation).toBeNull();
  });

  it("nazwa pliku i adres jak przy arkuszach B/C", () => {
    expect(firstSheetFileName(buildFirstSheetData(row()))).toBe("arkusz-pierwszej-oceny-Mazur-Aleksandra.pdf");
    expect(firstSheetHref("ev 1")).toBe("/api/v1/oceny/ev%201/pdf");
  });
});

describe("arkusz pierwszej oceny – PDF", () => {
  it("zawiera stałe teksty wzoru, polskie znaki i dane oceny", async () => {
    const pdf = await renderFirstSheetPdf(buildFirstSheetData(row()));
    if (process.env.ZAPISZ_PDF) writeFileSync("arkusz-pierwszej-test.pdf", pdf);
    const text = await pdfText(pdf);
    expect(text).toContain("ARKUSZ PIERWSZEJ OCENY W SŁUŻBIE CYWILNEJ");
    expect(text).toContain("DANE KIERUJĄCEGO KOMÓRKĄ ORGANIZACYJNĄ");
    expect(text).toContain("Aleksandra");
    expect(text).toContain("Wiśniewski");
    expect(text).toContain("10.02.2026");
    expect(text).toContain("5,4 pkt");
    expect(text).toContain("Szkolenie z postępowania administracyjnego.");
    expect(text).toContain("Zapoznałam(-łem) się z pierwszą oceną w służbie cywilnej.");
  }, 30_000);

  it("po rozmowie wstępnej drukuje się arkusz bez wyniku (do podpisu)", async () => {
    const text = await pdfText(await renderFirstSheetPdf(buildFirstSheetData(row({ status: "W_OKRESIE_OCENY", report: { dueFrom: d("2026-10-05"), dueTo: d("2026-10-19"), submittedAt: null } }))));
    expect(text).toContain("ROZMOWA WSTĘPNA");
    expect(text).not.toContain("5,4 pkt");
  }, 30_000);
});
