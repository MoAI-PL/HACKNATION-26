import { describe, expect, it } from "vitest";
import {
  completionIssues,
  criteriaForSheet,
  draftSchema,
  effectiveSheet,
  firstIssueStep,
  lateConversationWarning,
  parseDraft,
  wizardDeadlines,
  type WizardDraft,
} from "@/lib/ocena/kreator-okresowej";

const TODAY = "2026-11-21";

/** Szkic, który spełnia wszystkie warunki (arkusz C z OSP, 2 kryteria dodatkowe). */
function pelny(zmiany: Partial<WizardDraft> = {}): WizardDraft {
  return draftSchema.parse({
    step: 5,
    additional: [
      { competency: "ANALITYCZNE", reason: "Zadanie dominujące 1: analizuje i dokonuje oceny prawa." },
      { competency: "KLIENT", reason: "Odpowiada na pisma podmiotów zewnętrznych." },
    ],
    checklist: { obowiazki: true, kryteria: true, oczekiwania: true, cele: false },
    expectations: "Opinie w terminie ustawowym, prostym językiem.",
    conversationDate: "2026-11-20",
    acknowledged: true,
    ...zmiany,
  });
}

const kroki = (draft: WizardDraft, sheetFromOsp: "B" | "C" | null = "C") =>
  completionIssues({ draft, sheetFromOsp, today: TODAY }).map((i) => i.step);

describe("szkic kreatora", () => {
  it("pusty albo uszkodzony szkic z bazy daje domyślny szkic od kroku 1", () => {
    expect(parseDraft(null).step).toBe(1);
    expect(parseDraft({ step: "zły" }).additional).toEqual([]);
    expect(parseDraft({ step: 3, sheet: "B" })).toMatchObject({ step: 3, sheet: "B" });
  });

  it("arkusz: wybór przełożonego ma pierwszeństwo przed OSP", () => {
    expect(effectiveSheet(pelny(), "C")).toBe("C");
    expect(effectiveSheet(pelny({ sheet: "B" }), "C")).toBe("B");
    expect(effectiveSheet(pelny(), null)).toBeNull();
  });

  it("część I: kryteria obowiązkowe arkusza, potem dodatkowe z uzasadnieniem", () => {
    const k = criteriaForSheet("C", pelny().additional);
    expect(k.map((c) => c.competency)).toEqual(["WIEDZA", "RZETELNOSC", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA", "ANALITYCZNE", "KLIENT"]);
    expect(k[5]).toMatchObject({ kind: "DODATKOWE", reason: expect.stringContaining("analizuje") });
  });
});

describe("walidacja przed zatwierdzeniem części I", () => {
  it("kompletny szkic nie ma braków", () => {
    expect(completionIssues({ draft: pelny(), sheetFromOsp: "C", today: TODAY })).toEqual([]);
  });

  it("bez OSP – brak w kroku 1 i 2", () => {
    expect(kroki(pelny(), null)).toEqual(expect.arrayContaining([1, 2]));
  });

  it("zmiana arkusza wymaga powodu", () => {
    const issues = completionIssues({ draft: pelny({ sheet: "B", additional: [] }), sheetFromOsp: "C", today: TODAY });
    expect(issues.map((i) => i.step)).toEqual([2]);
    expect(issues[0].text).toContain("Podaj powód zmiany arkusza C");
    expect(kroki(pelny({ sheet: "B", additional: [], sheetChangeReason: "Od 1.12 kieruje zespołem." }))).toEqual([]);
  });

  it("4. kryterium dodatkowe jest blokowane z podstawą prawną", () => {
    const draft = pelny({
      additional: ["ANALITYCZNE", "KLIENT", "KREATYWNOSC", "NEGOCJOWANIE"].map((c) => ({ competency: c as "KLIENT", reason: "powód" })),
    });
    const issues = completionIssues({ draft, sheetFromOsp: "C", today: TODAY });
    expect(issues).toEqual([expect.objectContaining({ step: 3, legalBasis: "§ 5 ust. 2" })]);
  });

  it("kryterium obowiązkowe nie może być dodatkowym – po zmianie arkusza też", () => {
    // LUDZIE jest dodatkowym w C, ale obowiązkowym w B
    const draft = pelny({ sheet: "B", sheetChangeReason: "kieruje zespołem", additional: [{ competency: "LUDZIE", reason: "x" }] });
    const issues = completionIssues({ draft, sheetFromOsp: "C", today: TODAY });
    expect(issues).toEqual([expect.objectContaining({ step: 3, legalBasis: "§ 4" })]);
  });

  it("kryterium dodatkowe bez uzasadnienia", () => {
    const issues = completionIssues({ draft: pelny({ additional: [{ competency: "KLIENT", reason: "  " }] }), sheetFromOsp: "C", today: TODAY });
    expect(issues[0].text).toContain("Orientacja na klienta/interesanta");
  });

  it("rozmowa: wymagane 3 tematy z § 5 ust. 1, cele są nieobowiązkowe", () => {
    const issues = completionIssues({
      draft: pelny({ checklist: { obowiazki: true, kryteria: false, oczekiwania: true } }),
      sheetFromOsp: "C",
      today: TODAY,
    });
    expect(issues).toEqual([expect.objectContaining({ step: 4, legalBasis: "§ 5 ust. 1 pkt 2" })]);
  });

  it("zaznaczone cele wymagają treści, oczekiwania też", () => {
    expect(kroki(pelny({ checklist: { obowiazki: true, kryteria: true, oczekiwania: true, cele: true } }))).toEqual([4]);
    expect(kroki(pelny({ expectations: "" }))).toEqual([4]);
  });

  it("data rozmowy: wymagana i nie z przyszłości", () => {
    expect(kroki(pelny({ conversationDate: undefined }))).toEqual([4]);
    expect(kroki(pelny({ conversationDate: "2026-11-22" }))).toEqual([4]);
  });

  it("bez potwierdzenia zapoznania się (§ 6 ust. 2)", () => {
    const issues = completionIssues({ draft: pelny({ acknowledged: false }), sheetFromOsp: "C", today: TODAY });
    expect(issues).toEqual([expect.objectContaining({ step: 5, legalBasis: "§ 6 ust. 2" })]);
  });

  it("przycisk „Popraw” prowadzi do pierwszego kroku z brakiem", () => {
    const issues = completionIssues({ draft: pelny({ acknowledged: false, conversationDate: undefined }), sheetFromOsp: "C", today: TODAY });
    expect(firstIssueStep(issues)).toBe(4);
    expect(firstIssueStep([])).toBeNull();
  });
});

describe("terminy kreatora", () => {
  it("pierwsza ocena okresowa: 30 dni na rozmowę i 24 miesiące od zatrudnienia na czas nieokreślony", () => {
    const d = wizardDeadlines({ permanentFrom: "2026-11-09" })!;
    expect(d.conversation.date).toBe("2026-12-09");
    expect(d.evaluation.date).toBe("2028-11-09");
    expect(d.reevaluation).toBe(false);
  });

  it("po ocenie pozytywnej liczy od jej sporządzenia i uwzględnia nieobecności", () => {
    const d = wizardDeadlines({
      previous: { evaluatedAt: "2026-11-02", result: "POZYTYWNA", acknowledgedAt: "2026-11-04" },
      absences: [{ kind: "ZWOLNIENIE_LEKARSKIE", from: "2027-03-01", to: "2027-04-13" }],
    })!;
    expect(d.conversation.date).toBe("2026-12-02");
    expect(d.evaluation.extensions[0].days).toBe(44);
  });

  it("po ocenie negatywnej: 7 dni na rozmowę i ponowna ocena po 6 miesiącach", () => {
    const d = wizardDeadlines({ previous: { evaluatedAt: "2026-11-02", result: "NEGATYWNA", acknowledgedAt: "2026-11-04" } })!;
    expect(d.reevaluation).toBe(true);
    expect(d.conversation.kind).toBe("ROZMOWA_PO_NEGATYWNEJ");
    expect(d.evaluation.kind).toBe("PONOWNA_OCENA_PO_NEGATYWNEJ");
  });

  it("brak danych w kartotece → null", () => {
    expect(wizardDeadlines({})).toBeNull();
    expect(wizardDeadlines({ previous: { evaluatedAt: "2026-11-02", result: "NEGATYWNA" } })).toBeNull();
  });

  it("rozmowa po terminie – ostrzeżenie, w terminie – brak", () => {
    const d = wizardDeadlines({ permanentFrom: "2026-10-01" })!;
    expect(lateConversationWarning("2026-10-20", d.conversation)).toBeNull();
    expect(lateConversationWarning("2026-11-21", d.conversation)?.text).toContain("po terminie");
  });
});
