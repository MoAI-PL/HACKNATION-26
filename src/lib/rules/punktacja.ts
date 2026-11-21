// Silnik punktacji (Z07).
// - ocena okresowa: § 11 ust. 1 i 3 rozporządzenia PRM z 4.04.2016 (Dz.U. poz. 470);
// - pierwsza ocena: § 9 i § 10 rozporządzenia PRM z 23.07.2015 (Dz.U. poz. 1144).
// Wszystkie progi i skale pochodzą z data/przepisy.json (parametr `r`, domyślnie `rules`),
// dzięki czemu zmiana w panelu HR (Z19) nie wymaga zmian w kodzie.
//
// Porównania średniej z progami robimy na sumach (suma ≤ próg × liczba ocen), a nie na ułamkach,
// żeby granice 2,00 / 4,00 / 6,00 / 8,00 nigdy nie zależały od zaokrągleń liczb zmiennoprzecinkowych.

import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { COMPETENCY_NAMES, EXAM_EXEMPTION_LABELS, LEVEL_LABELS } from "@/lib/domain/slownik";
import {
  LEVELS,
  type CompetencyCode,
  type Explanation,
  type FirstEvalInput,
  type FirstEvalPoints,
  type FirstEvalScoreResult,
  type Level,
  type PartialScore,
  type PeriodicPoints,
  type PeriodicScoreResult,
} from "@/lib/domain/types";
import { RulesInputError } from "./bledy";
import { formatPoints, partialScoresCount, plural, pts } from "./tekst";

// Podstawy prawne spoza data/przepisy.json (przepisy nie mają tu parametrów liczbowych).
const LB_PERIODIC_OPTIONAL_JUSTIFICATION = "§ 11 ust. 4";
const LB_FIRST_EVAL_TOTAL = "§ 7 pkt 3";
const LB_FIRST_EVAL_OPTIONAL_JUSTIFICATION = "§ 10 ust. 5";

// ---------------------------------------------------------------------------
// Skale punktowe
// ---------------------------------------------------------------------------

/** Punkty oceny cząstkowej oceny okresowej dla poziomu (§ 11 ust. 1 pkt 1). */
export function periodicPointsForLevel(level: Level, r: Rules = defaultRules): PeriodicPoints {
  const row = r.periodic.partialScores.find((s) => s.level === level);
  if (!row) throw new RulesInputError(`Nieznany poziom oceny cząstkowej: ${level}.`);
  return row.points;
}

/** Poziom odpowiadający punktom oceny cząstkowej oceny okresowej. */
export function levelForPeriodicPoints(points: number, r: Rules = defaultRules): Level {
  const row = r.periodic.partialScores.find((s) => s.points === points);
  if (!row) throw new RulesInputError(`Ocena cząstkowa ${pts(points)} nie występuje w skali oceny okresowej (1, 3, 5, 7, 9).`);
  return row.level;
}

/** Punkty oceny cząstkowej pierwszej oceny dla poziomu (§ 9 ust. 1). */
export function firstEvalPointsForLevel(level: Level, r: Rules = defaultRules): FirstEvalPoints {
  const row = r.firstEval.partialScores.find((s) => s.level === level);
  if (!row) {
    throw new RulesInputError(
      `W pierwszej ocenie nie ma poziomu „${LEVEL_LABELS[level]}”. Skala ma trzy stopnie: poniżej, na poziomie i powyżej oczekiwań.`,
    );
  }
  return row.points;
}

/** Poziom odpowiadający punktom oceny cząstkowej pierwszej oceny. */
export function levelForFirstEvalPoints(points: number, r: Rules = defaultRules): Level {
  const row = r.firstEval.partialScores.find((s) => s.points === points);
  if (!row) throw new RulesInputError(`Ocena cząstkowa ${pts(points)} nie występuje w skali pierwszej oceny (3, 5, 7).`);
  return row.level;
}

// ---------------------------------------------------------------------------
// Poziom ogólny oceny okresowej (§ 11 ust. 1 pkt 2)
// ---------------------------------------------------------------------------

/**
 * Poziom ogólny dla sumy punktów z `count` ocen cząstkowych.
 * Pierwszy przedział jest domknięty z obu stron („od 1 do 2”), kolejne lewostronnie otwarte („powyżej 2 do 4”).
 */
function overallLevelForSum(sum: number, count: number, r: Rules): Level {
  const scaleMin = Math.min(...r.periodic.partialScores.map((p) => p.points));
  if (sum < scaleMin * count) {
    throw new RulesInputError(`Średnia ${formatPoints(sum / count)} pkt wykracza poza skalę oceny okresowej.`);
  }
  for (const t of r.periodic.overallLevelThresholds) {
    const aboveLower = t.above === null || sum > t.above * count;
    if (aboveLower && sum <= t.upTo * count) return t.level;
  }
  throw new RulesInputError(`Średnia ${formatPoints(sum / count)} pkt wykracza poza skalę oceny okresowej.`);
}

/** Poziom ogólny dla średniej arytmetycznej ocen cząstkowych (np. do podglądu w interfejsie). */
export function overallLevelForAverage(average: number, r: Rules = defaultRules): Level {
  return overallLevelForSum(average, 1, r);
}

function levelRank(level: Level): number {
  return LEVELS.indexOf(level);
}

// ---------------------------------------------------------------------------
// Ocena okresowa (§ 11)
// ---------------------------------------------------------------------------

function assertNoDuplicates(competencies: CompetencyCode[]): void {
  const seen = new Set<CompetencyCode>();
  for (const c of competencies) {
    if (seen.has(c)) {
      throw new RulesInputError(`Kryterium „${COMPETENCY_NAMES[c]}” ma więcej niż jedną ocenę cząstkową. Każde kryterium oceniamy raz.`);
    }
    seen.add(c);
  }
}

/**
 * Wylicza średnią, poziom ogólny i wynik oceny okresowej z ocen cząstkowych
 * wszystkich kryteriów (obowiązkowych i dodatkowych).
 */
export function scorePeriodic(scores: PartialScore[], r: Rules = defaultRules): PeriodicScoreResult {
  if (scores.length === 0) {
    throw new RulesInputError("Brak ocen cząstkowych. Oceń każde kryterium, zanim system wyliczy wynik.");
  }
  assertNoDuplicates(scores.map((s) => s.competency));
  for (const s of scores) levelForPeriodicPoints(s.points, r); // walidacja skali

  const lb = r.periodic.legalBasis;
  const count = scores.length;
  const sum = scores.reduce((acc, s) => acc + s.points, 0);
  const average = sum / count;
  const overallLevel = overallLevelForSum(sum, count, r);

  const explanations: Explanation[] = [
    {
      text: `Średnia z ${count} ${count === 1 ? "oceny cząstkowej" : "ocen cząstkowych"} wynosi ${formatPoints(average)} pkt, co oznacza ogólny poziom „${LEVEL_LABELS[overallLevel]}”.`,
      legalBasis: lb.overallLevel,
    },
  ];

  const levelTooLow = levelRank(overallLevel) < levelRank(r.periodic.positiveMinOverallLevel);
  const failing = scores.filter((s) => s.points === r.periodic.negativeIfAnyPartialScore);
  const result = levelTooLow || failing.length > 0 ? "NEGATYWNA" : "POZYTYWNA";

  if (result === "POZYTYWNA") {
    explanations.push({
      text: `Ocena jest pozytywna, bo ogólny poziom to co najmniej „${LEVEL_LABELS[r.periodic.positiveMinOverallLevel]}” i żadna ocena cząstkowa nie wynosi ${pts(r.periodic.negativeIfAnyPartialScore)}.`,
      legalBasis: lb.positive,
    });
  } else {
    if (levelTooLow) {
      explanations.push({
        text: `Ocena jest negatywna, bo ogólny poziom „${LEVEL_LABELS[overallLevel]}” jest niższy niż „${LEVEL_LABELS[r.periodic.positiveMinOverallLevel]}”.`,
        legalBasis: lb.negative,
      });
    }
    if (failing.length > 0) {
      const names = failing.map((s) => `„${COMPETENCY_NAMES[s.competency]}”`).join(", ");
      const subject =
        failing.length === 1
          ? "jedna ocena cząstkowa wynosi"
          : `${partialScoresCount(failing.length)} ${plural(failing.length, ["wynosi", "wynoszą", "wynosi"])}`;
      explanations.push({
        text: `Ocena jest negatywna, bo ${subject} ${pts(r.periodic.negativeIfAnyPartialScore)} (${names}).`,
        legalBasis: lb.negative,
      });
    }
  }

  const justificationRequired = result === "NEGATYWNA";
  explanations.push(
    justificationRequired
      ? { text: "Przy ocenie negatywnej uzasadnienie jest obowiązkowe.", legalBasis: lb.justificationRequired }
      : { text: "Uzasadnienie oceny pozytywnej jest nieobowiązkowe.", legalBasis: LB_PERIODIC_OPTIONAL_JUSTIFICATION },
  );

  return { average, overallLevel, result, justificationRequired, explanations };
}

// ---------------------------------------------------------------------------
// Pierwsza ocena (§ 10 rozporządzenia o pierwszej ocenie)
// ---------------------------------------------------------------------------

/** Wylicza ocenę łączną i wynik pierwszej oceny. Wymaga ocen wszystkich elementów z § 2 pkt 1. */
export function scoreFirstEval(input: FirstEvalInput, r: Rules = defaultRules): FirstEvalScoreResult {
  const fe = r.firstEval;
  const lb = fe.legalBasis;
  const { scores } = input;

  assertNoDuplicates(scores.map((s) => s.competency));
  const missing = fe.elements.filter((e) => !scores.some((s) => s.competency === e));
  if (missing.length > 0) {
    throw new RulesInputError(
      `Brak ocen cząstkowych: ${missing.map((m) => `„${COMPETENCY_NAMES[m]}”`).join(", ")}. Pierwsza ocena obejmuje wszystkie ${fe.elements.length} elementów (${lb.elements}).`,
    );
  }
  const extra = scores.filter((s) => !fe.elements.includes(s.competency));
  if (extra.length > 0) {
    throw new RulesInputError(
      `Pierwsza ocena nie obejmuje kryterium ${extra.map((s) => `„${COMPETENCY_NAMES[s.competency]}”`).join(", ")} (${lb.elements}).`,
    );
  }
  for (const s of scores) levelForFirstEvalPoints(s.points, r); // walidacja skali
  if (input.exam === "NIE_DOTYCZY" && !input.examExemption) {
    throw new RulesInputError(`Wskaż, dlaczego egzamin ze służby przygotowawczej nie dotyczy ocenianego (${lb.examExemption}).`);
  }

  const count = scores.length;
  const sum = scores.reduce((acc, s) => acc + s.points, 0);
  const average = sum / count;
  const minPoints = Math.min(...fe.partialScores.map((p) => p.points));
  const atMinimum = scores.filter((s) => s.points === minPoints).length;

  const explanations: Explanation[] = [
    { text: `Ocena łączna (średnia z ${count} ocen cząstkowych) wynosi ${formatPoints(average)} pkt.`, legalBasis: LB_FIRST_EVAL_TOTAL },
  ];
  const failures: Explanation[] = [];

  // Warunek 1: egzamin ze służby przygotowawczej (§ 10 ust. 1 pkt 1, wyjątki w ust. 3).
  if (input.exam === "NIEZDANY") {
    failures.push({ text: "Oceniany nie zaliczył egzaminu ze służby przygotowawczej.", legalBasis: `${lb.positive} pkt 1` });
  } else if (input.exam === "NIE_DOTYCZY") {
    explanations.push({
      text: `Warunek zaliczenia egzaminu nie dotyczy ocenianego: ${EXAM_EXEMPTION_LABELS[input.examExemption!]}.`,
      legalBasis: lb.examExemption,
    });
  }

  // Warunek 2: sprawozdanie w wyznaczonym terminie (§ 10 ust. 1 pkt 2).
  if (!input.reportSubmittedOnTime) {
    failures.push({ text: "Sprawozdanie nie zostało złożone w wyznaczonym terminie.", legalBasis: `${lb.positive} pkt 2` });
  }

  // Warunek 3: nie więcej niż jedna ocena cząstkowa za 3 pkt (§ 10 ust. 1 pkt 3).
  if (atMinimum > fe.maxScoresAtMinimum) {
    failures.push({
      text: `Oceniany ma ${partialScoresCount(atMinimum)} za ${pts(minPoints)}, a dopuszczalna jest najwyżej ${fe.maxScoresAtMinimum}.`,
      legalBasis: `${lb.positive} pkt 3`,
    });
  }

  // Warunek 4: ocena łączna nie niższa niż 5 pkt (§ 10 ust. 1 pkt 4).
  if (sum < fe.minAverage * count) {
    failures.push({
      text: `Ocena łączna ${formatPoints(average)} pkt jest niższa niż wymagane ${formatPoints(fe.minAverage)} pkt.`,
      legalBasis: `${lb.positive} pkt 4`,
    });
  }

  const result = failures.length === 0 ? "POZYTYWNA" : "NEGATYWNA";
  if (result === "POZYTYWNA") {
    explanations.push({
      text: "Ocena jest pozytywna, bo spełnione są łącznie wszystkie warunki: egzamin, sprawozdanie w terminie, najwyżej jedna ocena za 3 pkt i ocena łączna co najmniej 5 pkt.",
      legalBasis: lb.positive,
    });
    explanations.push({ text: "Uzasadnienie oceny pozytywnej jest nieobowiązkowe.", legalBasis: LB_FIRST_EVAL_OPTIONAL_JUSTIFICATION });
  } else {
    explanations.push({
      text:
        failures.length === 1
          ? "Ocena jest negatywna, bo nie jest spełniony warunek oceny pozytywnej:"
          : `Ocena jest negatywna, bo nie są spełnione ${failures.length} ${plural(failures.length, ["warunek", "warunki", "warunków"])} oceny pozytywnej:`,
      legalBasis: lb.negative,
    });
    explanations.push(...failures);
    explanations.push({ text: "Przy ocenie negatywnej uzasadnienie jest obowiązkowe.", legalBasis: lb.justificationRequired });
  }

  return { average, result, justificationRequired: result === "NEGATYWNA", explanations };
}
