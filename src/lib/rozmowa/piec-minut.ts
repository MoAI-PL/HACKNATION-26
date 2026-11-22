// Tryb „5 minut przed rozmową” (Z39): jedna strona do przeczytania tuż przed rozmową –
// najważniejsze fakty, trzy pytania i trzy pułapki. Czysta logika bez bazy i bez AI.
//
// Wszystko pochodzi ze ściągi asystenta rozmowy (Z24, buildConversationPrep) i z danych w systemie:
//  - fakty: rodzaj i zakres rozmowy, termin, stanowisko, poprzednia ocena, notatki z dziennika (Z13);
//  - pytania: pierwsze trzy ze ściągi (już dopasowane do notatek i ocen wskaźników);
//  - pułapki: sygnały Lustra oceniającego (Z36) z bieżących danych, trudne sytuacje właściwe dla tej osoby
//    (np. poprzednia ocena negatywna), a na końcu pułapka typowa dla rodzaju rozmowy.

import { RESULT_LABELS } from "@/lib/domain/slownik";
import type { BehaviorLevel, IsoDate } from "@/lib/domain/types";
import { formatDatePl } from "@/lib/obserwacje/dziennik";
import { haloSignal, recencySignal } from "@/lib/rules/lustro";
import { CONVERSATION_LABELS, type ConversationKind, type ConversationPrep, type PrepInput, type Question } from "./przygotowanie";

export const BRIEF_MAX_FACTS = 6;
export const BRIEF_MAX_QUESTIONS = 3;
export const BRIEF_MAX_PITFALLS = 3;

export interface BriefPitfall {
  title: string;
  tip: string;
  legalBasis?: string;
}

export interface FiveMinuteBrief {
  kind: ConversationKind;
  title: string;
  /** Jedno zdanie na otwarcie rozmowy. */
  opening: string;
  goal: string;
  facts: string[];
  questions: Question[];
  pitfalls: BriefPitfall[];
}

const OPENING: Record<ConversationKind, string> = {
  WSTEPNA:
    "Chcę omówić z Panią/Panem, jak wygląda pierwsza ocena, jakie są główne obowiązki na stanowisku i czego od nich oczekuję – a na koniec ustalimy termin sprawozdania.",
  ROZPOCZYNAJACA:
    "Chcę, żebyśmy razem ustalili obowiązki, kryteria oceny i oczekiwania na ten okres – tak, żeby od początku było jasne, co będzie brane pod uwagę.",
  OCENIAJACA:
    "Chcę porozmawiać o tym, jak minął okres oceny – opieram się na konkretnych sytuacjach z moich notatek, a na koniec ustalimy kierunki rozwoju.",
};

/** Pułapka typowa dla rodzaju rozmowy – zawsze na końcu listy, gdy jest miejsce. */
const KIND_PITFALL: Record<ConversationKind, BriefPitfall> = {
  WSTEPNA: {
    title: "Rozmowa kończy się bez terminu sprawozdania",
    tip: "Podaj konkretną datę złożenia sprawozdania i zapisz ją w przebiegu pierwszej oceny – od niej zależy, czy sprawozdanie będzie w terminie.",
    legalBasis: "§ 3 i § 4 rozporządzenia w sprawie pierwszej oceny",
  },
  ROZPOCZYNAJACA: {
    title: "Oczekiwania opisane cechami, a nie zachowaniami",
    tip: "Zamiast „ma być komunikatywna” podaj przykład zachowania na poziomie oczekiwań z opisu wskaźnika – wtedy na koniec okresu łatwo to ocenić.",
    legalBasis: "§ 5 ust. 1 rozporządzenia w sprawie ocen okresowych",
  },
  OCENIAJACA: {
    title: "Ocena osoby zamiast ocena zachowań",
    tip: "Mów o konkretnej sytuacji, zachowaniu i jego skutku („w sprawie z 14.10 odpowiedź wyszła po terminie”), nie o cechach („jest niesłowna”).",
  },
};

/** Fakty, które warto mieć w głowie, zanim zacznie się rozmowa. */
function facts(input: PrepInput, prep: ConversationPrep): string[] {
  const out: string[] = [`${CONVERSATION_LABELS[input.kind]} – zakres: ${prep.legalBasis}.`];
  const deadline = prep.checklist.find((c) => c.startsWith("Termin:"));
  if (deadline) out.push(deadline);
  if (input.positionTitle) out.push(`Stanowisko: ${input.positionTitle}.`);
  if (input.isReevaluation) out.push("To ponowna ocena po ocenie negatywnej (art. 81 ust. 9 ustawy o służbie cywilnej).");
  else if (input.previousResult) out.push(`Poprzednia ocena: ${RESULT_LABELS[input.previousResult].replace(/^ocena\s+/i, "").toLowerCase()}.`);

  if (input.kind === "OCENIAJACA") {
    if (prep.strengths[0]) out.push(`Mocna strona: ${prep.strengths[0].name} (${prep.strengths[0].levelLabel}).`);
    if (prep.growth[0]) out.push(`Do rozwoju: ${prep.growth[0].name} (${prep.growth[0].levelLabel}).`);
  } else if (input.kind === "ROZPOCZYNAJACA" && input.criteria.length > 0) {
    const extra = input.criteria.filter((c) => c.kind === "DODATKOWE").length;
    out.push(`Kryteria: ${input.criteria.length}${extra ? `, w tym dodatkowe: ${extra}` : ""} – omów każde na przykładzie zachowania.`);
  }

  if (input.kind !== "WSTEPNA") {
    const notes = input.observations;
    if (notes.length === 0) out.push("Brak notatek w dzienniku obserwacji z tego okresu.");
    else {
      const last = notes.reduce((a, o) => (o.date > a ? o.date : a), notes[0]!.date);
      out.push(`Notatki w dzienniku: ${notes.length}, ostatnia z ${formatDatePl(last)}.`);
    }
  }
  return out.slice(0, BRIEF_MAX_FACTS);
}

/** Pułapki: najpierw sygnały z danych tej osoby, potem trudne sytuacje właściwe dla niej, na końcu typowa dla rozmowy. */
function pitfalls(input: PrepInput, prep: ConversationPrep, today: IsoDate): BriefPitfall[] {
  const out: BriefPitfall[] = [];
  if (input.kind === "OCENIAJACA") {
    const recency = recencySignal(
      input.observations.map((o) => o.date),
      today,
    );
    if (recency) out.push({ title: recency.title, tip: recency.text });
    const observed = input.ratings.map((r) => r.value).filter((v): v is BehaviorLevel => v !== "BRAK_OBSERWACJI");
    const halo = haloSignal(observed);
    if (halo) out.push({ title: halo.title, tip: halo.text });
  }
  // Trudne sytuacje właściwe dla tej osoby lub rozmowy (te z podstawą prawną) – ogólne są w pełnej ściądze.
  for (const d of prep.difficult) if (d.legalBasis) out.push({ title: d.situation, tip: d.tip, legalBasis: d.legalBasis });
  const generic = prep.difficult.filter((d) => !d.legalBasis).map((d) => ({ title: d.situation, tip: d.tip }));
  // Miejsce na pułapkę typową dla rozmowy zostaje zawsze; brakujące miejsca dopełniają ogólne trudne sytuacje.
  const specific = out.slice(0, BRIEF_MAX_PITFALLS - 1);
  const filler = generic.slice(0, BRIEF_MAX_PITFALLS - 1 - specific.length);
  return [...specific, ...filler, KIND_PITFALL[input.kind]];
}

/** Jedna strona „5 minut przed rozmową” z tej samej ściągi, którą pokazuje asystent rozmowy. */
export function buildFiveMinuteBrief(input: PrepInput, prep: ConversationPrep, today: IsoDate): FiveMinuteBrief {
  return {
    kind: input.kind,
    title: `5 minut przed rozmową: ${input.employeeName}`,
    opening: OPENING[input.kind],
    goal: prep.goal,
    facts: facts(input, prep),
    questions: prep.questions.slice(0, BRIEF_MAX_QUESTIONS),
    pitfalls: pitfalls(input, prep, today),
  };
}
