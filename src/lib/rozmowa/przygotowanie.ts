// Asystent rozmowy (Z24): przygotowanie rozmowy wstępnej, rozpoczynającej i oceniającej – czysta logika bez bazy i bez AI.
//
// Ściąga powstaje z danych, które już są w systemie:
//  - zakres rozmowy z przepisów (§ 3 rozp. o pierwszej ocenie, § 5 ust. 1 i § 10 rozp. o ocenach okresowych);
//  - zadania z OSP, kryteria, oczekiwania i cele z rozmowy rozpoczynającej (Z12);
//  - oceny wskaźników (Z14), a gdy ich jeszcze nie ma – opisy zachowań wskazane w notatkach z dziennika (Z13).
// AI (src/lib/rozmowa/ai.ts) tylko redaguje otwarcie i informację zwrotną – decyzja i treść należą do przełożonego.

import { competencyModel as defaultModel } from "@/lib/domain/model-kompetencji-dane";
import type { CompetencyModelIndex } from "@/lib/domain/model-kompetencji";
import { BEHAVIOR_LEVEL_TO_LEVEL, COMPETENCY_NAMES, CONVERSATION_TYPE_LABELS, LEVEL_LABELS } from "@/lib/domain/slownik";
import type { BehaviorLevel, CompetencyCode, EvaluationResult, IndicatorRatingValue, IsoDate } from "@/lib/domain/types";
import { formatDatePl, type ObservationView } from "@/lib/obserwacje/dziennik";
import { DEVELOPMENT_IDEAS } from "./rozwoj";

export type ConversationKind = "WSTEPNA" | "ROZPOCZYNAJACA" | "OCENIAJACA";
export const CONVERSATION_KINDS: ConversationKind[] = ["WSTEPNA", "ROZPOCZYNAJACA", "OCENIAJACA"];

export const CONVERSATION_LABELS: Record<ConversationKind, string> = {
  WSTEPNA: CONVERSATION_TYPE_LABELS.WSTEPNA,
  ROZPOCZYNAJACA: CONVERSATION_TYPE_LABELS.ROZPOCZYNAJACA,
  OCENIAJACA: CONVERSATION_TYPE_LABELS.OCENIAJACA,
};

export interface PrepInput {
  kind: ConversationKind;
  employeeName: string;
  positionTitle?: string | null;
  dominantTasks: string[];
  /** Kryteria oceny (okresowa); puste = wszystkie kompetencje z notatek. */
  criteria: { competency: CompetencyCode; kind: "OBOWIAZKOWE" | "DODATKOWE" }[];
  /** Oceny wskaźników z Z14 (jeśli przełożony już je wybrał). */
  ratings: { indicatorId: string; value: IndicatorRatingValue }[];
  observations: ObservationView[];
  expectations?: string | null;
  goals?: string | null;
  previousResult?: EvaluationResult | null;
  isReevaluation?: boolean;
  /** Termin rozmowy albo oceny, np. „do pt. 28.11” – do przypomnienia w ściądze. */
  deadline?: { date: IsoDate; label: string } | null;
  /** Etap bieżącej oceny i rozmowa, która według niego jest następna (gdy przełożony otworzy inną – informacja). */
  stage?: { status: "DO_ROZPOCZECIA" | "W_OKRESIE_OCENY" | "W_OCENIE"; suggested: ConversationKind; criteriaSetAt?: IsoDate | null } | null;
}

export interface IndicatorEvidence {
  indicatorId: string;
  name: string;
  competency: CompetencyCode;
  competencyName: string;
  /** Poziom zachowania 1–5 (z oceny wskaźnika albo średnia z notatek). */
  level: number;
  levelLabel: string;
  source: "OCENA" | "NOTATKI";
  observations: ObservationView[];
}

export interface AgendaItem {
  topic: string;
  details: string[];
}

export interface Question {
  text: string;
  /** Skąd się wzięło pytanie, np. „notatka z 19 lutego 2025”. */
  why: string;
}

export interface FeedbackDraft {
  indicatorName: string;
  date: IsoDate;
  behavior: string;
  effect: string;
  expectation: string;
}

export interface DifficultSituation {
  situation: string;
  tip: string;
  legalBasis?: string;
}

export interface ConversationPrep {
  kind: ConversationKind;
  title: string;
  goal: string;
  legalBasis: string;
  /** Fragment bazy wiedzy z treścią przepisu o zakresie rozmowy. */
  sourceFragmentId: string;
  agenda: AgendaItem[];
  strengths: IndicatorEvidence[];
  growth: IndicatorEvidence[];
  questions: Question[];
  feedback: FeedbackDraft[];
  development: { competency: CompetencyCode; name: string; ideas: string[] }[];
  difficult: DifficultSituation[];
  checklist: string[];
  /** Brak danych – wtedy ściąga mówi uczciwie, czego nie wiemy. */
  notes: string[];
}

/** Poziom do etykiety: najbliższy, a remis (np. 4,5) w dół – tak samo jak sugestia poziomu w Z09 (wariant ostrożny). */
export const roundLevel = (level: number) => Math.min(5, Math.max(1, Math.ceil(level - 0.5))) as BehaviorLevel;
const levelLabel = (level: number) => LEVEL_LABELS[BEHAVIOR_LEVEL_TO_LEVEL[roundLevel(level)]];
const shorten = (t: string, max = 140) => (t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t);

/** Poziom każdego wskaźnika: ocena z Z14 ma pierwszeństwo, w przeciwnym razie średnia z notatek z poziomem zachowania. */
export function indicatorEvidence(input: Pick<PrepInput, "ratings" | "observations" | "criteria">, model: CompetencyModelIndex = defaultModel): IndicatorEvidence[] {
  const allowed = new Set(input.criteria.map((c) => c.competency));
  const byIndicator = new Map<string, ObservationView[]>();
  for (const o of input.observations) {
    if (!o.indicatorId) continue;
    byIndicator.set(o.indicatorId, [...(byIndicator.get(o.indicatorId) ?? []), o]);
  }
  const ids = new Set<string>([...input.ratings.map((r) => r.indicatorId), ...byIndicator.keys()]);
  const result: IndicatorEvidence[] = [];
  for (const id of ids) {
    const ind = model.getIndicator(id);
    if (!ind || (allowed.size > 0 && !allowed.has(ind.competency))) continue;
    const obs = (byIndicator.get(id) ?? []).sort((a, b) => b.date.localeCompare(a.date));
    const rating = input.ratings.find((r) => r.indicatorId === id)?.value;
    let level: number | null = null;
    let source: IndicatorEvidence["source"] = "NOTATKI";
    if (typeof rating === "number") {
      level = rating;
      source = "OCENA";
    } else {
      const levels = obs.map((o) => o.behaviorLevel).filter((l): l is BehaviorLevel => l !== null);
      if (levels.length) level = levels.reduce((a, b) => a + b, 0) / levels.length;
    }
    if (level === null) continue;
    result.push({ indicatorId: id, name: ind.name.replace(/\.$/, ""), competency: ind.competency, competencyName: COMPETENCY_NAMES[ind.competency], level, levelLabel: levelLabel(level), source, observations: obs });
  }
  return result;
}

/**
 * Notatka, która najlepiej ilustruje ocenę: przy obszarze do rozwoju – z najniższym poziomem zachowania,
 * przy mocnej stronie – z najwyższym; przy remisie najnowsza. Notatki bez poziomu na końcu.
 */
export function illustrativeObservation(e: IndicatorEvidence, direction: "growth" | "strength", require?: (o: ObservationView) => boolean): ObservationView | undefined {
  const pool = e.observations.filter((o) => !require || require(o));
  const score = (o: ObservationView) => (o.behaviorLevel === null ? Infinity : direction === "growth" ? o.behaviorLevel : -o.behaviorLevel);
  return [...pool].sort((a, b) => score(a) - score(b) || b.date.localeCompare(a.date))[0];
}

function topStrengths(ev: IndicatorEvidence[]): IndicatorEvidence[] {
  return ev.filter((e) => e.level >= 4).sort((a, b) => b.level - a.level || b.observations.length - a.observations.length).slice(0, 3);
}

function topGrowth(ev: IndicatorEvidence[]): IndicatorEvidence[] {
  const low = ev.filter((e) => e.level < 3).sort((a, b) => a.level - b.level || b.observations.length - a.observations.length);
  return low.slice(0, 3);
}

/** Informacja zwrotna: zachowanie (działanie z notatki) – skutek (rezultat) – oczekiwanie (opis zachowania z modelu). */
function feedbackFrom(e: IndicatorEvidence, model: CompetencyModelIndex): FeedbackDraft | null {
  const growth = e.level < 3;
  const o = illustrativeObservation(e, growth ? "growth" : "strength", (x) => Boolean(x.action && x.outcome));
  if (!o) return null;
  const ind = model.getIndicator(e.indicatorId)!;
  const next = roundLevel(e.level) + 1;
  const expectation = growth
    ? `Oczekuję zachowania na poziomie oczekiwań: ${ind.levels[3]}`
    : next <= 5
      ? `Proszę utrzymać ten sposób działania. Kolejny krok: ${ind.levels[next as BehaviorLevel]}`
      : "Proszę utrzymać ten sposób działania i dzielić się nim z zespołem – to wzór dla innych.";
  return { indicatorName: e.name, date: o.date, behavior: o.action!, effect: o.outcome!, expectation };
}

const COMMON_DIFFICULT: DifficultSituation[] = [
  {
    situation: "Rozmowa robi się emocjonalna albo oceniany przyjmuje postawę obronną",
    tip: "Mów o konkretnych zachowaniach i ich skutkach, nie o cechach osoby. Daj czas na odpowiedź. Gdy emocje są silne – zaproponuj krótką przerwę albo dokończenie rozmowy w ustalonym terminie.",
  },
  {
    situation: "Oceniany mówi niewiele",
    tip: "Zadawaj pytania otwarte („Jak…?”, „Co pomogło…?”, „Czego potrzebujesz…?”) i podsumowuj własnymi słowami to, co usłyszysz.",
  },
  {
    situation: "Brakuje przykładów do któregoś wskaźnika",
    tip: "Powiedz to wprost. W ocenie wybierz „brak okazji do obserwacji” zamiast zgadywać – takie wskaźniki nie wchodzą do sugestii poziomu.",
  },
];

export function buildConversationPrep(input: PrepInput, model: CompetencyModelIndex = defaultModel): ConversationPrep {
  const ev = indicatorEvidence(input, model);
  const strengths = topStrengths(ev);
  const growth = topGrowth(ev);
  const tasks = input.dominantTasks.slice(0, 3);
  const notes: string[] = [];
  const questions: Question[] = [];
  const difficult = [...COMMON_DIFFICULT];
  let agenda: AgendaItem[];
  let goal: string;
  let legalBasis: string;
  let sourceFragmentId: string;

  if (input.kind === "WSTEPNA") {
    goal = "Wprowadzić nową osobę w zasady pierwszej oceny, omówić obowiązki i oczekiwania oraz wyznaczyć termin sprawozdania.";
    legalBasis = "§ 3 rozporządzenia w sprawie pierwszej oceny";
    sourceFragmentId = "ROZP_PIERWSZA:§3";
    agenda = [
      { topic: "Jak wygląda pierwsza ocena", details: ["5 elementów: rzetelność, wykorzystywanie wiedzy, organizacja pracy, komunikacja, współpraca", "skala 3 / 5 / 7 pkt, sprawozdanie, egzamin ze służby przygotowawczej"] },
      { topic: "Główne obowiązki z opisu stanowiska i oczekiwania co do ich wykonywania", details: tasks.map((t) => shorten(t)) },
      { topic: "Oczekiwania co do postawy, zaangażowania, postępów, relacji ze współpracownikami i terminowości", details: ["opieraj się na opisach elementów oceny z załącznika nr 1"] },
      { topic: "Termin złożenia sprawozdania", details: ["sprawozdanie obejmuje co najmniej 7 miesięcy pracy – podaj termin i zapisz go w notatkach z rozmowy"] },
    ];
    questions.push(
      { text: "Które zadania z opisu stanowiska wydają się Pani/Panu najtrudniejsze na start?", why: "§ 3 pkt 2 – obowiązki z OSP" },
      { text: "Jakiego wsparcia potrzebuje Pani/Pan w pierwszych tygodniach – od kogo i w jakiej formie?", why: "wdrożenie nowej osoby" },
      { text: "Jak chce Pani/Pan otrzymywać informację zwrotną w trakcie pierwszych miesięcy?", why: "uzgodnienie zasad współpracy" },
    );
  } else if (input.kind === "ROZPOCZYNAJACA") {
    goal = "Uzgodnić z osobą ocenianą obowiązki, kryteria oceny, oczekiwania i cele na okres oceny.";
    legalBasis = "§ 5 ust. 1 rozporządzenia w sprawie ocen okresowych";
    sourceFragmentId = "ROZP_OKRESOWE:§5:ust.1";
    agenda = [
      { topic: "Główne obowiązki z opisu stanowiska", details: tasks.map((t) => shorten(t)) },
      {
        topic: "Kryteria obowiązkowe i dodatkowe",
        details: input.criteria.length
          ? input.criteria.map((c) => `${COMPETENCY_NAMES[c.competency]}${c.kind === "DODATKOWE" ? " (dodatkowe)" : ""}`)
          : ["kryteria wybierzesz w kreatorze oceny okresowej (Ocena okresowa → Ustal kryteria)"],
      },
      { topic: "Oczekiwania co do sposobu spełniania kryteriów", details: [input.expectations || "opisz je przykładami zachowań na poziomie oczekiwań (opisy kart w modelu kompetencji)"] },
      { topic: "Cele na okres oceny (jeśli są uzasadnione)", details: [input.goals || "ustal 1–3 mierzalne cele powiązane z zadaniami z OSP"] },
    ];
    for (const t of tasks.slice(0, 2)) questions.push({ text: `Jak rozumie Pani/Pan zadanie „${shorten(t, 110)}”? Co jest potrzebne, żeby wykonywać je na poziomie oczekiwań?`, why: "§ 5 ust. 1 pkt 1 – obowiązki z OSP" });
    questions.push({ text: "Które z kryteriów są dla Pani/Pana najmniej jasne? Omówmy przykład zachowania „na poziomie oczekiwań”.", why: "§ 5 ust. 1 pkt 2–3 – kryteria i oczekiwania" });
    // Po ocenie negatywnej okres trwa do ponownej oceny po 6 miesiącach (art. 81 ust. 9), w pozostałych przypadkach – 24 miesiące.
    const horizon = input.isReevaluation ? "do ponownej oceny za 6 miesięcy" : "na najbliższe dwa lata";
    questions.push({ text: `Jaki cel ${horizon} byłby dla Pani/Pana ważny i realny?`, why: "§ 5 ust. 1 pkt 4 – cele" });
  } else {
    goal = "Omówić z osobą ocenianą wykonywanie obowiązków w świetle kryteriów, realizację celów i kierunki rozwoju – przed sporządzeniem oceny na piśmie.";
    legalBasis = "§ 10 rozporządzenia w sprawie ocen okresowych";
    sourceFragmentId = "ROZP_OKRESOWE:§10";
    agenda = [
      {
        topic: "Główne obowiązki w okresie oceny i sposób ich realizacji w świetle kryteriów",
        details: [
          ...tasks.map((t) => `obowiązek: ${shorten(t)}`),
          ...strengths.map((s) => `mocna strona: ${s.name} (${s.levelLabel})`),
          ...growth.map((g) => `do rozwoju: ${g.name} (${g.levelLabel})`),
        ],
      },
      { topic: "Realizacja celów", details: [input.goals ? `cel: ${input.goals}` : "cele nie zostały wyznaczone – pomiń ten punkt"] },
      { topic: "Kierunki rozwoju i potrzeby szkoleniowe", details: ["uzgodnij 1–3 działania rozwojowe – trafią do wniosków IPRZ w podsumowaniu oceny"] },
    ];
    for (const g of growth) {
      const o = illustrativeObservation(g, "growth", (x) => Boolean(x.situation));
      questions.push(
        o?.situation
          ? { text: `Wróćmy do sytuacji z ${formatDatePl(o.date)}: „${shorten(o.situation, 110)}”. Jak ją Pani/Pan dziś ocenia i co można było zrobić inaczej?`, why: `do rozwoju: ${g.name}` }
          : { text: `Jak ocenia Pani/Pan swoje działania w obszarze „${g.name}”? Co utrudniało pracę?`, why: `do rozwoju: ${g.name}` },
      );
    }
    for (const s of strengths.slice(0, 2)) {
      const o = illustrativeObservation(s, "strength", (x) => Boolean(x.situation));
      questions.push(
        o?.situation
          ? { text: `Co pomogło w sytuacji z ${formatDatePl(o.date)}: „${shorten(o.situation, 110)}”? Jak wykorzystać to w innych zadaniach?`, why: `mocna strona: ${s.name}` }
          : { text: `Co pozwala Pani/Panu dobrze radzić sobie w obszarze „${s.name}”?`, why: `mocna strona: ${s.name}` },
      );
    }
    if (input.goals) questions.push({ text: `Na ile udało się osiągnąć cel: „${shorten(input.goals, 120)}”? Co pomogło, a co przeszkadzało?`, why: "§ 10 pkt 2 – realizacja celów" });
    questions.push({ text: "Jakie wsparcie, szkolenie albo zadanie rozwojowe byłoby dla Pani/Pana najbardziej przydatne w kolejnym okresie?", why: "§ 10 pkt 3 – kierunki rozwoju" });
    difficult.unshift({
      situation: "Oceniany nie zgadza się z oceną",
      tip: "Wysłuchaj argumentów i odwołaj się do konkretnych notatek z dziennika. Poinformuj, że od oceny przysługuje sprzeciw do dyrektora generalnego urzędu w ciągu 7 dni od zapoznania się z nią.",
      legalBasis: "art. 83 ustawy o służbie cywilnej",
    });
    if (ev.length === 0) notes.push("Nie ma jeszcze ocen wskaźników ani notatek z poziomem zachowania – pytania są ogólne. Dodaj obserwacje w dzienniku albo oceń wskaźniki w kreatorze oceny.");
  }

  // Rozmowa otwarta nie na tym etapie oceny – mówimy to wprost, zamiast udawać, że to właściwy moment.
  if (input.stage && input.stage.suggested !== input.kind) {
    if (input.kind === "OCENIAJACA" && input.stage.status === "DO_ROZPOCZECIA") {
      // Ta informacja wyjaśnia też brak ocen i notatek – zastępuje ogólny komunikat o braku danych.
      notes.length = 0;
      notes.push("Kryteria tej oceny nie są jeszcze ustalone. Rozmowa oceniająca odbywa się pod koniec okresu oceny – teraz najpierw rozmowa rozpoczynająca.");
    } else if (input.kind === "ROZPOCZYNAJACA" && input.stage.status !== "DO_ROZPOCZECIA") {
      notes.push(
        input.stage.criteriaSetAt
          ? `Rozmowa rozpoczynająca odbyła się ${formatDatePl(input.stage.criteriaSetAt)} – ten widok przypomina jej ustalenia.`
          : "Rozmowa rozpoczynająca już się odbyła – ten widok przypomina jej ustalenia.",
      );
    }
  }

  // Pierwsza ocena ma tylko rozmowę wstępną – po jej zapisaniu (Z17: etap sprawozdania albo oceny) ściąga to mówi.
  const initialDone = input.kind === "WSTEPNA" && !!input.stage && input.stage.status !== "DO_ROZPOCZECIA";
  if (initialDone && input.stage) {
    notes.push(
      input.stage.criteriaSetAt
        ? `Rozmowa wstępna odbyła się ${formatDatePl(input.stage.criteriaSetAt)} – ten widok przypomina jej zakres. Dalsze kroki pierwszej oceny są w menu „Pierwsza ocena”.`
        : "Rozmowa wstępna już się odbyła – ten widok przypomina jej zakres. Dalsze kroki pierwszej oceny są w menu „Pierwsza ocena”.",
    );
  }

  if (input.isReevaluation || input.previousResult === "NEGATYWNA") {
    difficult.unshift({
      situation: "Poprzednia ocena była negatywna",
      tip: "Nazwij konkretne zachowania do poprawy i uzgodnij krótki plan z terminami (np. cotygodniowe 15-minutowe spotkania). Ponowna ocena następuje po 6 miesiącach od zapoznania się z oceną negatywną.",
      legalBasis: "art. 81 ust. 9 ustawy o służbie cywilnej",
    });
  }

  const feedback = [...growth, ...strengths].map((e) => feedbackFrom(e, model)).filter((f): f is FeedbackDraft => f !== null).slice(0, 4);
  // § 10 pkt 3: kierunki rozwoju omawia się zawsze – gdy nie ma obszarów poniżej oczekiwań, bierzemy najniżej ocenione
  // wskaźniki poniżej „powyżej oczekiwań”, a bez ocen i notatek – kryteria oceny.
  const nextLowest = [...ev].filter((e) => e.level < 4).sort((a, b) => a.level - b.level);
  const developmentCompetencies = [...new Set((growth.length ? growth : nextLowest).map((g) => g.competency))].slice(0, 2);
  // Działania rozwojowe to zakres rozmowy oceniającej (§ 10 pkt 3) – w rozmowie wstępnej i rozpoczynającej ich nie ma.
  const developmentSource = input.kind !== "OCENIAJACA" ? [] : developmentCompetencies.length ? developmentCompetencies : input.criteria.map((c) => c.competency).slice(0, 2);
  const development = developmentSource.map((c) => ({
    competency: c,
    name: COMPETENCY_NAMES[c],
    ideas: DEVELOPMENT_IDEAS[c],
  }));

  return {
    kind: input.kind,
    title: `${CONVERSATION_LABELS[input.kind]} – ${input.employeeName}`,
    goal,
    legalBasis,
    sourceFragmentId,
    agenda,
    strengths: input.kind === "OCENIAJACA" ? strengths : [],
    growth: input.kind === "OCENIAJACA" ? growth : [],
    questions,
    feedback: input.kind === "OCENIAJACA" ? feedback : [],
    development,
    difficult,
    checklist: [
      "Zarezerwuj 45–60 minut w spokojnym miejscu, bez telefonów i poczty.",
      input.kind === "OCENIAJACA" ? "Przejrzyj notatki z całego okresu oceny, nie tylko z ostatnich tygodni." : "Miej pod ręką opis stanowiska pracy (OSP).",
      // Termin dotyczy bieżącego etapu – pokazujemy go tylko przy rozmowie, która jest teraz następna.
      // Po rozmowie wstępnej termin z karty dotyczy już sprawozdania albo oceny, a nie tej rozmowy.
      ...(input.deadline && (!input.stage || input.stage.suggested === input.kind) && !initialDone ? [`Termin: ${input.deadline.label}.`] : []),
      input.kind === "OCENIAJACA" ? "Po rozmowie zapisz ustalenia – przydadzą się w ocenie i we wnioskach do IPRZ." : "Po rozmowie zapisz ustalenia – przydadzą się w ocenie.",
    ],
    notes,
  };
}
