// Pseudonimizacja przed LLM (Z34): podwładni, osoby spoza zespołu, komórki, identyfikatory; brak fałszywych trafień
// w przepisach i OSP; zastosowanie w asystencie formalnym, analizie OSP i ostatniej linii obrony w warstwie LLM.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  describeHidden,
  pseudonymize,
  pseudonymizeMany,
  redactIdentifiers,
  restoreNames,
  type PseudoPerson,
} from "@/lib/ai/pseudonimizacja";
import { answerFormalQuestion } from "@/lib/ai/funkcje/asystent-formalny";
import { proposeAdditionalCriteria, pseudonymizePosition } from "@/lib/ai/funkcje/kryteria-z-osp";
import { OpenAICompatibleProvider } from "@/lib/ai/llm/openai-compatible";
import type { ChatMessage, LLMProvider } from "@/lib/ai/llm";
import { parseOsp } from "@/lib/import/osp";
import knowledge from "../../data/wiedza/fragmenty.json";

const zespol: PseudoPerson[] = [
  { id: "kw", firstName: "Katarzyna", lastName: "Wójcik" },
  { id: "jn", firstName: "Jan", lastName: "Nowak" },
];

function fakeLLM(reply: string): LLMProvider & { prompts: ChatMessage[][] } {
  return {
    name: "test",
    model: "model-testowy",
    prompts: [],
    async chat(messages) {
      this.prompts.push(messages);
      return { content: reply, model: "model-testowy", durationMs: 1 };
    },
  };
}

describe("identyfikatory", () => {
  it("e-mail, telefon, PESEL, numer konta i dowodu → znaczniki; oryginały tylko po stronie serwera", () => {
    const p = pseudonymize(
      "Pisała do k.wojcik@urzad.gov.pl, dzwoniła na +48 600 123 456 i 22 250 01 20, PESEL 90010112345, konto PL61 1090 1014 0000 0712 1981 2874, dowód ABC123456.",
    );
    expect(p.text).toBe(
      "Pisała do [EMAIL_1], dzwoniła na [TELEFON_1] i [TELEFON_2], PESEL [PESEL_1], konto [NR_KONTA_1], dowód [DOKUMENT_1].",
    );
    expect(p.hidden.EMAIL_1).toBe("k.wojcik@urzad.gov.pl");
    expect(p.counts).toEqual({ EMAIL: 1, TELEFON: 2, PESEL: 1, NR_KONTA: 1, DOKUMENT: 1 });
  });

  it("daty, przepisy, liczby i skróty zostają bez zmian", () => {
    const t = "Spotkanie z DSI 21.11.2026 (2026-11-21), art. 81 ust. 4, § 11, Dz.U. 2016 poz. 470, 24 miesiące, 7 dni, 1234 sprawy.";
    expect(pseudonymize(t).text).toBe(t);
    expect(redactIdentifiers(t)).toBe(t);
  });

  it("ta sama wartość = ten sam znacznik", () => {
    expect(pseudonymize("Napisz na a@b.pl, a kopię na a@b.pl.").text).toBe("Napisz na [EMAIL_1], a kopię na [EMAIL_1].");
  });
});

describe("osoby", () => {
  it("podwładni z odmianą + imię i nazwisko zwinięte do jednego znacznika", () => {
    const p = pseudonymize("Kasia Wójcik pomogła Janowi Nowakowi. Wójcik była świetna.", zespol);
    expect(p.text).toBe("[OSOBA_1] pomogła [OSOBA_2]. [OSOBA_1] była świetna.");
    expect(p.tags).toEqual({ OSOBA_1: "kw", OSOBA_2: "jn" });
    expect(p.mentioned).toEqual(["kw", "jn"]);
  });

  it("osoby spoza zespołu: po „pan / pani” (bez stanowiska), popularne imię, nazwisko o typowej końcówce", () => {
    const p = pseudonymize("Kasia rozmawiała z panią Dyrektor Zielińską, z Markiem Kowalskim i z Nowickim.", zespol);
    expect(p.text).toBe("[OSOBA_1] rozmawiała z panią Dyrektor [OSOBA_2], z [OSOBA_3] i z [OSOBA_4].");
    expect(p.tags).toEqual({ OSOBA_1: "kw" });
    expect(p.hidden).toEqual({ OSOBA_2: "Zielińską", OSOBA_3: "Markiem Kowalskim", OSOBA_4: "Nowickim" });
    expect(p.counts.OSOBA).toBe(4);
  });

  it("ta sama osoba spoza zespołu w innej formie – także na początku zdania – dostaje ten sam znacznik", () => {
    const p = pseudonymize("Kowalski spóźnił się na spotkanie, a potem Kowalskiego nie było wcale.");
    expect(p.text).toBe("[OSOBA_1] spóźnił się na spotkanie, a potem [OSOBA_1] nie było wcale.");
  });

  it("bez fałszywych trafień: przymiotniki, stanowiska, słowa jak „ani”, „jasne”, nazwy instytucji", () => {
    for (const t of [
      "Polski rząd i Unia Europejska. Niski poziom ryzyka. Bliski termin.",
      "Pan Minister pochwalił zespół. Jasne, że ani jeden termin nie przepadł.",
      "Wojewódzki Sąd Administracyjny i Sojusz Północnoatlantycki.",
      "Zespół pracował sprawnie, a marka urzędu zyskała.",
    ]) {
      expect(pseudonymize(t, zespol).text).toBe(t);
    }
  });

  it("przywracanie: podwładny → imię, osoba spoza zespołu i komórka → oryginał, nieznany znacznik osoby → „osoba”", () => {
    const p = pseudonymize("Kasia i pan Lipski z Wydziału Kadr", zespol);
    expect(p.text).toBe("[OSOBA_1] i pan [OSOBA_2] z [KOMORKA_1]");
    expect(restoreNames("[OSOBA_1] uzgodniła z OSOBA_2 i [OSOBA_9] sprawę w [KOMORKA_1].", p.tags, zespol, p.hidden)).toBe(
      "Katarzyna uzgodniła z Lipski i osoba sprawę w Wydziału Kadr.",
    );
  });
});

describe("komórki organizacyjne", () => {
  it("nazwa własna komórki → [KOMORKA_n]; zwykłe słowo „zespół” zostaje", () => {
    const p = pseudonymize("Spotkanie w Departamencie Analiz i Strategii, potem Biuro Dyrektora Generalnego. Zespół pracował sprawnie.");
    expect(p.text).toBe("Spotkanie w [KOMORKA_1], potem [KOMORKA_2]. Zespół pracował sprawnie.");
  });

  it("w analizie OSP komórek nie ukrywamy (opcja units: false)", () => {
    expect(pseudonymize("Współpracuje z Departamentem Budżetu.", [], { units: false }).text).toBe("Współpracuje z Departamentem Budżetu.");
  });
});

describe("podsumowanie dla użytkownika", () => {
  it("odmiana liczebników; nic nie ukryto → null", () => {
    expect(describeHidden({ OSOBA: 2, EMAIL: 1 })).toBe("Przed wysłaniem do modelu ukryto: 2 osoby, 1 adres e-mail.");
    expect(describeHidden({ OSOBA: 1, KOMORKA: 5, TELEFON: 2 })).toBe(
      "Przed wysłaniem do modelu ukryto: 1 osobę, 5 komórek organizacyjnych, 2 numery telefonów.",
    );
    expect(describeHidden({})).toBeNull();
  });
});

describe("brak fałszywych trafień w materiałach", () => {
  it("baza wiedzy (406 fragmentów przepisów i poradników): ostatnia linia obrony niczego nie zmienia", () => {
    const fragments = (knowledge as { fragments: { text: string }[] }).fragments;
    expect(fragments.length).toBeGreaterThan(100);
    for (const f of fragments) expect(redactIdentifiers(f.text)).toBe(f.text);
  });

  it("OSP z materiałów MC: w zadaniach nie ma czego ukrywać – treść dla modelu bez zmian", () => {
    for (const file of readdirSync("materialy/OSP").filter((f) => f.endsWith(".docx"))) {
      const position = parseOsp(readFileSync(`materialy/OSP/${file}`)).position!;
      expect(pseudonymizePosition(position).position, file).toEqual(position);
    }
  });

  it("pola łączone w pseudonymizeMany nie sklejają się (osoba na końcu jednego pola i na początku drugiego to dwie osoby)", () => {
    const p = pseudonymizeMany(["Uzgadnia z Janem", "Kowalski pisze", "Termin: 7 dni"], []);
    expect(p.texts).toEqual(["Uzgadnia z [OSOBA_1]", "[OSOBA_2] pisze", "Termin: 7 dni"]);
    expect(p.hidden).toEqual({ OSOBA_1: "Janem", OSOBA_2: "Kowalski" });
  });
});

describe("zastosowanie przed modelem", () => {
  it("asystent formalny: model, wyszukiwarka i dziennik dostają pytanie bez imion; w odpowiedzi imię wraca", async () => {
    const llm = fakeLLM('{"odpowiedz":"[OSOBA_1] może złożyć sprzeciw w terminie 7 dni.","zrodla":[1]}');
    const r = await answerFormalQuestion("W jakim terminie Kasia Wójcik może złożyć sprzeciw od oceny?", { llm, people: zespol });
    const sent = JSON.stringify(llm.prompts);
    expect(sent).not.toMatch(/Kasia|Wójcik/);
    expect(sent).toContain("[OSOBA_1] może złożyć sprzeciw");
    expect(r.question).toBe("W jakim terminie Kasia Wójcik może złożyć sprzeciw od oceny?");
    expect(r.sentQuestion).toBe("W jakim terminie [OSOBA_1] może złożyć sprzeciw od oceny?");
    expect(r.privacy).toBe("Przed wysłaniem do modelu ukryto: 1 osobę.");
    expect(r.answer).toBe("Katarzyna może złożyć sprzeciw w terminie 7 dni.");
  });

  it("asystent formalny: pytanie bez danych osobowych – bez dodatkowych pól", async () => {
    const r = await answerFormalQuestion("W jakim terminie można złożyć sprzeciw?", { llm: fakeLLM('{"odpowiedz":"7 dni.","zrodla":[1]}') });
    expect(r.sentQuestion).toBeUndefined();
    expect(r.privacy).toBeUndefined();
  });

  it("analiza OSP: nazwisko i telefon z zadania nie trafiają do modelu, a cytat w propozycji jest oryginalny", async () => {
    const position = parseOsp(readFileSync("materialy/OSP/OSP_radca_DSI_WWI.docx")).position!;
    const z = { ...position, dominantTasks: ["Analizuje projekty aktów prawnych i uzgadnia je z Janem Kowalskim (tel. 600 123 456)", ...position.dominantTasks.slice(1)] };
    const llm = fakeLLM(
      JSON.stringify({ propozycje: [{ kryterium: "ANALITYCZNE", uzasadnienie: "Analiza aktów prawnych.", zadanie: 1, cytat: "Analizuje projekty aktów prawnych i uzgadnia je z [OSOBA_1]" }] }),
    );
    const r = await proposeAdditionalCriteria(z, "C", { llm });
    const sent = JSON.stringify(llm.prompts);
    expect(sent).not.toMatch(/Kowalsk|600 123 456/);
    expect(r.mode).toBe("AI");
    expect(r.proposals[0]!.quote.text).toBe("Analizuje projekty aktów prawnych i uzgadnia je z Janem Kowalskim");
  });

  it("warstwa LLM: identyfikatory w każdym zapytaniu są ukrywane przed wysłaniem (ostatnia linia obrony)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }));
    const llm = new OpenAICompatibleProvider({ baseUrl: "http://llm.test/v1", model: "m", timeoutMs: 1000 }, fetchMock as unknown as typeof fetch);
    await llm.chat([{ role: "user", content: "PESEL 90010112345, mail jan@x.pl" }]);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages[0].content).toBe("PESEL [PESEL], mail [EMAIL]");
  });
});
