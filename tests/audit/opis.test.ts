// Dziennik decyzji (Z35): wpisy zwykłym językiem zamiast surowego JSON.
import { describe, expect, it } from "vitest";
import { describeAudit, plainFields, plainReason, plainValue, shorten } from "@/lib/audit/opis";

const row = (action: string, v: { aiProposal?: unknown; humanDecision?: unknown; oldValue?: unknown; newValue?: unknown }) => ({
  action,
  aiProposal: v.aiProposal ?? null,
  humanDecision: v.humanDecision ?? null,
  oldValue: v.oldValue ?? null,
  newValue: v.newValue ?? null,
});

const noJson = (lines: string[]) => lines.forEach((l) => expect(l).not.toMatch(/[{}"]|[A-Z]{4,}_[A-Z]/));

describe("opis wpisów dziennika decyzji", () => {
  it("kryteria dodatkowe z OSP: nazwy kompetencji i skrócony cytat, decyzja z nazwami", () => {
    const d = describeAudit(
      row("AI_WSTAW", {
        aiProposal: {
          tryb: "AI",
          funkcja: "KRYTERIA_DODATKOWE_Z_OSP",
          propozycja: [
            { cytat: "OSP, zadanie dominujące 1: „Analizuje i dokonuje oceny prawa krajowego, prawa Unii Europejskiej, orzecznictwa krajowego i międzynarodowego, wytycznych organów unijnych”", kryterium: "ANALITYCZNE" },
            { cytat: "OSP, zadanie 4: „Analizuje bariery prawne”", kryterium: "KREATYWNOSC" },
          ],
        },
        humanDecision: { decyzja: "WSTAW", wstawiono: ["ANALITYCZNE", "KREATYWNOSC"] },
      }),
    );
    expect(d.ai[0]).toBe("Kryteria dodatkowe z opisu stanowiska");
    expect(d.ai[1]).toMatch(/^Myślenie analityczne – OSP, zadanie dominujące 1: .*…$/);
    expect(d.ai[1]!.length).toBeLessThan(140);
    expect(d.ai[2]).toBe("Kreatywność – OSP, zadanie 4: „Analizuje bariery prawne”");
    expect(d.decision).toEqual(["Wstawiono: Myślenie analityczne, Kreatywność"]);
  });

  it("ustalenie kryteriów: arkusz, nazwy kryteriów, daty po polsku – oba zapisywane formaty", () => {
    const demo = describeAudit(row("USTALENIE_KRYTERIOW", { newValue: { arkusz: "C", kryteria: ["WIEDZA", "RZETELNOSC"], dataRozmowy: "2024-12-15" } }));
    expect(demo.decision).toEqual(["Arkusz C", "Kryteria: Wykorzystywanie wiedzy i doskonalenie zawodowe, Rzetelność", "Rozmowa: 15.12.2024"]);
    const app = describeAudit(
      row("USTALENIE_KRYTERIOW", {
        newValue: { arkusz: "B", kryteria: [{ kryterium: "LUDZIE", rodzaj: "OBOWIAZKOWE" }, { kryterium: "KREATYWNOSC", rodzaj: "DODATKOWE" }], dataRozmowy: "2026-11-21", terminOceny: "2028-11-20" },
      }),
    );
    expect(app.decision).toEqual(["Arkusz B", "Kryteria: Zarządzanie ludźmi, Kreatywność (dodatkowe)", "Rozmowa: 21.11.2026", "Termin oceny: 20.11.2028"]);
    expect(app.ai).toEqual([]);
  });

  it("sporządzenie oceny: wynik, poziom, średnia i punkty przy nazwach", () => {
    const d = describeAudit(
      row("SPORZADZENIE_OCENY", {
        newValue: { oceny: [{ punkty: 7, kryterium: "WIEDZA" }, { punkty: 5, kryterium: "RZETELNOSC" }], wynik: "POZYTYWNA", poziom: "NA_POZIOMIE", srednia: 6 },
      }),
    );
    expect(d.decision).toEqual(["Wynik: ocena pozytywna (na poziomie oczekiwań), średnia 6", "Oceny: Wykorzystywanie wiedzy i doskonalenie zawodowe 7 pkt; Rzetelność 5 pkt"]);
    const first = describeAudit(row("SPORZADZENIE_OCENY", { newValue: { rodzaj: "PIERWSZA", wynik: "POZYTYWNA", ocenaLaczna: 5.4, oceny: [{ element: "WIEDZA", punkty: 5 }], egzamin: "ZDANY", sprawozdanieWTerminie: true } }));
    expect(first.decision).toEqual(["Pierwsza ocena", "Wynik: ocena pozytywna, średnia 5,4", "Oceny: Wykorzystywanie wiedzy i doskonalenie zawodowe 5 pkt", "Egzamin: tak", "Sprawozdanie w terminie: tak"]);
  });

  it("zapoznanie, zmiana sugestii, zmiana arkusza, przypomnienie", () => {
    expect(describeAudit(row("ZAPOZNANIE_Z_OCENA", { newValue: { data: "2024-12-03", potwierdzil: "PRZELOZONY" } })).decision).toEqual(["Data: 03.12.2024", "Potwierdził: przełożony"]);
    expect(describeAudit(row("ZMIANA_SUGESTII", { oldValue: { kryterium: "WIEDZA", sugestia: 5 }, newValue: { kryterium: "WIEDZA", ocena: 7 } })).decision).toEqual([
      "Wykorzystywanie wiedzy i doskonalenie zawodowe: sugestia 5 pkt → ocena 7 pkt",
    ]);
    expect(describeAudit(row("ZMIANA_ARKUSZA", { oldValue: { arkusz: "C" }, newValue: { arkusz: "B" } })).decision).toEqual(["Arkusz C → B"]);
    expect(describeAudit(row("PRZYPOMNIENIE_WYSLANE", { newValue: { sentAt: "2026-11-21T08:00:00.000Z", symulacja: true } })).decision).toEqual([
      "Wysłano 21.11.2026 09:00 (symulacja – bez prawdziwego e-maila)",
    ]);
  });

  it("asystent rozmowy i języka: rodzaj, skrócona treść, odrzucenie", () => {
    const d = describeAudit(row("AI_WSTAW", { aiProposal: { funkcja: "ASYSTENT_ROZMOWY", tryb: "AI", rozmowa: "OCENIAJACA", propozycja: "Otwarcie:\n" + "Dzień dobry. ".repeat(40) }, humanDecision: { decyzja: "WSTAW", wstawiono: "Tekst po edycji" } }));
    expect(d.ai.slice(0, 2)).toEqual(["Asystent rozmowy", "Rozmowa oceniająca"]);
    expect(d.ai[2]!.endsWith("…")).toBe(true);
    expect(d.decision).toEqual(["Wstawiono po edycji:", "Tekst po edycji"]);
    const j = describeAudit(row("AI_ODRZUC", { aiProposal: { funkcja: "ASYSTENT_JEZYKA", tryb: "BEZ_AI", propozycja: { pole: "uzasadnienie", oryginal: "Jest leniwy.", propozycja: "Dwa raporty po terminie." } }, humanDecision: { decyzja: "ODRZUC", wstawiono: null } }));
    expect(j).toEqual({ ai: ["Asystent języka (bez AI – z reguł)", "Pole: uzasadnienie", "Było: Jest leniwy.", "Propozycja: Dwa raporty po terminie."], decision: ["Odrzucono"] });
  });

  it("szybka notatka: wskaźnik po nazwie, bez identyfikatorów", () => {
    const d = describeAudit(
      row("AI_WSTAW", {
        aiProposal: { funkcja: "SZYBKA_NOTATKA", tryb: "AI", propozycja: { wskaznik: "KOMUNIKACJA.3", poziom: 4, model: "gemini" } },
        humanDecision: { pracownik: "cmwr123", wskaznik: "KOMUNIKACJA.3", poziom: 4, sytuacja: "Pismo", dzialanie: "Napisała prosto", rezultat: "Bez pytań" },
      }),
    );
    expect(d.ai).toEqual(["Szybka notatka", "Wskaźnik: Komunikacja, wskaźnik 3", "Poziom: 4"]);
    expect(d.decision).toEqual(["Wstawiono", "Wskaźnik: Komunikacja, wskaźnik 3", "Poziom: 4", "Sytuacja: Pismo", "Działanie: Napisała prosto", "Rezultat: Bez pytań"]);
    expect(d.decision.join(" ")).not.toContain("cmwr123");
  });

  it("nieznane i pozostałe wpisy: pola po polsku bez JSON i identyfikatorów", () => {
    const d = describeAudit(row("SPRAWOZDANIE_I_EGZAMIN", { newValue: { sprawozdanie: "2026-10-22", plik: "spr.pdf", egzamin: "NIE_DOTYCZY", zwolnienie: "ZASTEPSTWO" } }));
    expect(d.decision[0]).toBe("Sprawozdanie: 22.10.2026");
    expect(d.decision[2]).toBe("Egzamin: nie dotyczy");
    noJson(d.decision);
    const x = describeAudit(row("COS_NOWEGO", { oldValue: { a: 1 }, newValue: { a: 2, evaluationId: "e1" } }));
    expect(x.decision).toEqual(["Było: a: 1", "Jest: a: 2"]);
    expect(describeAudit(row("LOGOWANIE", {})).decision).toEqual([]);
    expect(describeAudit(row("RESET_DEMO", { newValue: { employees: 7, durationMs: 900 } })).decision).toEqual(["Dane demo przywrócone do stanu początkowego"]);
  });

  it("wartości pomocnicze", () => {
    expect(plainValue(null)).toBe("—");
    expect(plainValue(5.333333333333333)).toBe("5,33");
    expect(plainReason("Pominięto: KLIENT – zadanie poboczne.")).toBe("Pominięto: Orientacja na klienta/interesanta – zadanie poboczne.");
    expect(plainReason("Zgodnie z OSP i UE")).toBe("Zgodnie z OSP i UE");
    expect(plainReason(null)).toBe("—");
    expect(plainValue(["WIEDZA", "LUDZIE"])).toBe("Wykorzystywanie wiedzy i doskonalenie zawodowe, Zarządzanie ludźmi");
    expect(plainFields({ id: "x", positionId: "y", plik: "a.docx" })).toEqual(["Plik: a.docx"]);
    expect(shorten("a ".repeat(200), 20).length).toBeLessThanOrEqual(21);
  });
});
