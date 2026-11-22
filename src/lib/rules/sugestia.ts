// Sugerowany poziom kompetencji (Z09) i dane do panelu „Dlaczego ten poziom?”.
//
// ZAŁOŻENIE: reguła sugestii jest naszą propozycją, nie przepisem (docs/ZALOZENIA.md #2, #16):
//  - poziom zachowania 1–5 przeliczamy na punkty skali oceny (data/przepisy.json → behaviorToPoints):
//    okresowa 1/3/5/7/9, pierwsza 3/3/5/7/7;
//  - sugestia = średnia punktów wskaźników zaobserwowanych, zaokrąglona do najbliższej wartości skali,
//    remis zaokrąglamy w dół (suggestion.tieBreak) i oznaczamy flagą;
//  - „brak okazji do obserwacji” i wskaźniki jeszcze nieocenione nie wchodzą do średniej.
// Sugestia nigdy nie jest oceną: ostateczną wartość wybiera przełożony (validateFinalDecision).
//
// Zaokrąglenie liczymy na liczbach całkowitych (|suma − wartość × n|), żeby remis 6,00 między 5 a 7
// nie zależał od błędów zaokrągleń liczb zmiennoprzecinkowych.

import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { competencyModel as defaultModel } from "@/lib/domain/model-kompetencji-dane";
import type { CompetencyModelIndex } from "@/lib/domain/model-kompetencji";
import { COMPETENCY_NAMES, LEVEL_LABELS, BEHAVIOR_LEVEL_TO_LEVEL, NO_OBSERVATION_LABEL } from "@/lib/domain/slownik";
import type {
  BehaviorLevel,
  CompetencyCode,
  EvaluationType,
  Explanation,
  FinalDecisionInput,
  FinalDecisionValidation,
  FirstEvalPoints,
  IndicatorBreakdown,
  IndicatorRatingInput,
  IndicatorRatingValue,
  Level,
  LevelSuggestion,
  PeriodicPoints,
  Warning,
} from "@/lib/domain/types";
import { RulesInputError } from "./bledy";
import { formatPoints, plural, pts } from "./tekst";

/** ZAŁOŻENIE: „jedno zdanie powodu” przy zmianie sugestii – co najmniej tyle znaków (bez spacji na końcach). */
export const MIN_JUSTIFICATION_LENGTH = 10;

export interface SuggestionOptions {
  evaluationType: EvaluationType;
  rules?: Rules;
  model?: CompetencyModelIndex;
}

const BEHAVIOR_LEVELS: readonly BehaviorLevel[] = [1, 2, 3, 4, 5];

interface Scale {
  points: number[];
  levelOf(points: number): Level;
  behaviorPoints(level: BehaviorLevel): number;
}

function scaleFor(type: EvaluationType, r: Rules): Scale {
  const table = type === "OKRESOWA" ? r.periodic.partialScores : r.firstEval.partialScores;
  const mapping = type === "OKRESOWA" ? r.behaviorToPoints.periodic : r.behaviorToPoints.firstEval;
  const points = table.map((p) => p.points as number).sort((a, b) => a - b);
  return {
    points,
    levelOf: (p) => {
      const row = table.find((t) => t.points === p);
      if (!row) throw new RulesInputError(`Wartość ${pts(p)} nie występuje w skali oceny.`);
      return row.level;
    },
    behaviorPoints: (level) => {
      const p = mapping[String(level) as "1"];
      if (p === undefined || !points.includes(p)) {
        throw new RulesInputError(`Parametr behaviorToPoints dla poziomu ${level} nie wskazuje wartości ze skali (${points.join(", ")}).`);
      }
      return p;
    },
  };
}

/** Najbliższa wartość skali dla sumy `sum` z `n` wskaźników; przy remisie – według tieBreak. */
function roundToScale(sum: number, n: number, scale: number[], tieBreak: "DOWN" | "UP"): { value: number; tie: boolean } {
  let best = scale[0];
  let bestDist = Math.abs(sum - best * n);
  let tie = false;
  for (const v of scale.slice(1)) {
    const d = Math.abs(sum - v * n);
    if (d < bestDist) {
      best = v;
      bestDist = d;
      tie = false;
    } else if (d === bestDist) {
      tie = true;
      if (tieBreak === "UP") best = v;
    }
  }
  return { value: best, tie };
}

const indicatorsWord = (n: number) => plural(n, ["wskaźnik", "wskaźniki", "wskaźników"]);
/** Dopełniacz po „z”: „z 1 wskaźnika”, „z 4 wskaźników”. */
const ofIndicators = (n: number) => `${n} ${n === 1 ? "wskaźnika" : "wskaźników"}`;

/**
 * Sugerowany poziom kryterium na podstawie ocen jego wskaźników behawioralnych.
 * `ratings` może pomijać wskaźniki jeszcze nieocenione; wskaźnik spoza kompetencji albo powtórzony to błąd danych.
 */
export function suggestLevel(competency: CompetencyCode, ratings: IndicatorRatingInput[], options: SuggestionOptions): LevelSuggestion {
  const r = options.rules ?? defaultRules;
  const model = options.model ?? defaultModel;
  const type = options.evaluationType;
  const scale = scaleFor(type, r);
  const definition = model.getCompetency(competency);
  const name = COMPETENCY_NAMES[competency];

  const byId = new Map<string, IndicatorRatingInput>();
  for (const rating of ratings) {
    if (!definition.indicators.some((i) => i.id === rating.indicatorId)) {
      throw new RulesInputError(`Wskaźnik ${rating.indicatorId} nie należy do kompetencji „${name}”.`);
    }
    if (byId.has(rating.indicatorId)) throw new RulesInputError(`Wskaźnik ${rating.indicatorId} ma więcej niż jedną ocenę.`);
    const v = rating.value;
    if (v !== null && v !== "BRAK_OBSERWACJI" && !BEHAVIOR_LEVELS.includes(v)) {
      throw new RulesInputError(`Wskaźnik ${rating.indicatorId}: poziom zachowania musi być liczbą od 1 do 5 albo „${NO_OBSERVATION_LABEL}”.`);
    }
    byId.set(rating.indicatorId, rating);
  }

  const indicators: IndicatorBreakdown[] = definition.indicators.map((ind) => {
    const rating = byId.get(ind.id);
    const value = rating?.value ?? null;
    const points = value === null || value === "BRAK_OBSERWACJI" ? null : scale.behaviorPoints(value);
    return { indicatorId: ind.id, name: ind.name, value, points, hasNote: rating?.hasNote ?? false };
  });

  const distribution = Object.fromEntries([...BEHAVIOR_LEVELS, "BRAK_OBSERWACJI"].map((k) => [k, 0])) as Record<IndicatorRatingValue, number>;
  for (const i of indicators) if (i.value !== null) distribution[i.value]++;

  const observed = indicators.filter((i): i is IndicatorBreakdown & { points: number } => i.points !== null);
  const totalCount = indicators.length;
  const notObservable = distribution.BRAK_OBSERWACJI;
  const unrated = indicators.filter((i) => i.value === null).length;

  const warnings: Warning[] = [];
  const explanations: Explanation[] = [];
  const lbNegative = type === "OKRESOWA" ? r.periodic.legalBasis.negative : `${r.firstEval.legalBasis.positive} pkt 3`;

  // Ostrzeżenia przy wskaźnikach (do pokazania przy kartach w Z14).
  for (const i of indicators) {
    if (i.value === 1) {
      warnings.push({
        code: "OCENA_1_PKT",
        severity: "OSTRZEZENIE",
        indicatorId: i.indicatorId,
        message:
          type === "OKRESOWA"
            ? `„${i.name}”: zachowanie „${LEVEL_LABELS.ZNACZNIE_PONIZEJ}”. Ocena cząstkowa ${pts(1)} oznacza ocenę negatywną.`
            : `„${i.name}”: zachowanie „${LEVEL_LABELS.ZNACZNIE_PONIZEJ}” w pierwszej ocenie odpowiada ${pts(scale.behaviorPoints(1))}. Więcej niż ${r.firstEval.maxScoresAtMinimum} ocena cząstkowa za ${pts(scale.points[0])} oznacza ocenę negatywną.`,
        legalBasis: lbNegative,
      });
    }
    if (typeof i.value === "number" && r.suggestion.requireNoteAtLevels.includes(i.value) && !i.hasNote) {
      warnings.push({
        code: "BRAK_NOTATKI",
        severity: "OSTRZEZENIE",
        indicatorId: i.indicatorId,
        message: `„${i.name}”: przy zachowaniu „${LEVEL_LABELS[BEHAVIOR_LEVEL_TO_LEVEL[i.value]]}” uzasadnij ocenę przykładem (sytuacja – działanie – rezultat).`,
      });
    }
  }

  if (unrated > 0) {
    warnings.push({
      code: "NIEOCENIONE_WSKAZNIKI",
      severity: "INFO",
      message: `Nie oceniono jeszcze ${unrated} z ${ofIndicators(totalCount)}. Wybierz zachowanie albo „${NO_OBSERVATION_LABEL}”.`,
    });
  }

  if (observed.length === 0) {
    warnings.push({
      code: "BRAK_PODSTAW",
      severity: "INFO",
      message: `Brak podstaw do sugestii: żaden wskaźnik kryterium „${name}” nie został zaobserwowany. Wybierz ocenę samodzielnie i opisz jej podstawę.`,
    });
    explanations.push({ text: "System nie proponuje poziomu, bo nie ma zaobserwowanych wskaźników." });
    return {
      competency,
      evaluationType: type,
      suggestedPoints: null,
      suggestedLevel: null,
      average: null,
      tieRoundedDown: false,
      observedCount: 0,
      totalCount,
      distribution,
      indicators,
      explanations,
      warnings,
    };
  }

  const n = observed.length;
  const sum = observed.reduce((acc, i) => acc + i.points, 0);
  const average = sum / n;
  const { value, tie } = roundToScale(sum, n, scale.points, r.suggestion.tieBreak);
  const suggestedLevel = scale.levelOf(value);
  const tieRoundedDown = tie && r.suggestion.tieBreak === "DOWN";

  if (type === "PIERWSZA") {
    const groups = scale.points.map((p) => {
      const levels = BEHAVIOR_LEVELS.filter((l) => scale.behaviorPoints(l) === p);
      return `${levels.length > 1 ? `${levels[0]}–${levels[levels.length - 1]}` : levels[0]} → ${pts(p)}`;
    });
    explanations.push({ text: `W pierwszej ocenie poziomy zachowań przeliczamy na skalę trzystopniową: ${groups.join(", ")}.` });
  }
  explanations.push({
    text:
      n === 1
        ? `Zaobserwowano 1 wskaźnik: ${pts(sum)}.`
        : `Średnia z ${n} zaobserwowanych wskaźników: (${observed.map((i) => i.points).join(" + ")}) : ${n} = ${formatPoints(average)} pkt.`,
  });
  if (notObservable > 0) {
    explanations.push({
      text: `${notObservable} ${indicatorsWord(notObservable)} z oznaczeniem „${NO_OBSERVATION_LABEL}” nie ${plural(notObservable, ["wchodzi", "wchodzą", "wchodzi"])} do średniej.`,
    });
  }
  const lower = scale.points.filter((p) => p * n < sum).pop();
  const upper = scale.points.find((p) => p * n > sum);
  explanations.push({
    text: tie
      ? `Średnia wypada dokładnie pomiędzy ${pts(lower!)} a ${pts(upper!)}, więc zaokrąglamy ${r.suggestion.tieBreak === "DOWN" ? "w dół (wariant ostrożny)" : "w górę"}: sugestia ${pts(value)} – „${LEVEL_LABELS[suggestedLevel]}”.`
      : `Najbliższa wartość skali to ${pts(value)} – „${LEVEL_LABELS[suggestedLevel]}”.`,
  });
  explanations.push({ text: "To tylko propozycja. Ocenę cząstkową wybierasz Ty; zmiana sugestii wymaga jednego zdania powodu." });

  if (tie) {
    warnings.push({
      code: tieRoundedDown ? "REMIS_W_DOL" : "REMIS_W_GORE",
      severity: "INFO",
      message: `Średnia ${formatPoints(average)} pkt wypada dokładnie pomiędzy ${pts(lower!)} a ${pts(upper!)}. Sprawdź, która ocena lepiej opisuje zachowania z całego okresu.`,
    });
  }
  if (n < r.suggestion.minObservedShare * totalCount) {
    warnings.push({
      code: "NISKA_WIARYGODNOSC",
      severity: "OSTRZEZENIE",
      message: `Zaobserwowano ${n} z ${ofIndicators(totalCount)} – sugestia ma niską wiarygodność. Sprawdź, czy masz przykłady dla pozostałych.`,
    });
  }
  if (type === "OKRESOWA" && value === r.periodic.negativeIfAnyPartialScore) {
    warnings.push({
      code: "SUGESTIA_1_PKT",
      severity: "OSTRZEZENIE",
      message: `Sugerowana ocena cząstkowa ${pts(value)} oznacza ocenę negatywną całej oceny okresowej.`,
      legalBasis: r.periodic.legalBasis.negative,
    });
  }

  return {
    competency,
    evaluationType: type,
    suggestedPoints: value as PeriodicPoints | FirstEvalPoints,
    suggestedLevel,
    average,
    tieRoundedDown,
    observedCount: n,
    totalCount,
    distribution,
    indicators,
    explanations,
    warnings,
  };
}

/**
 * Walidacja decyzji przełożonego: ocena musi być z właściwej skali, a gdy różni się od sugestii –
 * wymaga jednego zdania powodu (oba wpisy, sugestia i decyzja, trafiają do dziennika decyzji).
 */
export function validateFinalDecision(input: FinalDecisionInput, r: Rules = defaultRules): FinalDecisionValidation {
  const { suggestion, finalPoints } = input;
  const scale = scaleFor(suggestion.evaluationType, r);
  const errors: Explanation[] = [];

  if (!scale.points.includes(finalPoints)) {
    errors.push({
      text: `Ocena ${pts(finalPoints)} nie występuje w skali ${suggestion.evaluationType === "OKRESOWA" ? "oceny okresowej" : "pierwszej oceny"} (${scale.points.join(", ")}).`,
      legalBasis: suggestion.evaluationType === "OKRESOWA" ? r.periodic.legalBasis.partialScores : r.firstEval.legalBasis.partialScores,
    });
  }

  const differsFromSuggestion = suggestion.suggestedPoints !== null && finalPoints !== suggestion.suggestedPoints;
  const justificationRequired = differsFromSuggestion;
  const justification = (input.justification ?? "").trim();
  if (justificationRequired && justification.length < MIN_JUSTIFICATION_LENGTH) {
    errors.push({
      text: `Wybrana ocena (${pts(finalPoints)}) różni się od sugestii (${pts(suggestion.suggestedPoints!)}). Napisz jednym zdaniem, dlaczego.`,
    });
  }

  return { valid: errors.length === 0, justificationRequired, differsFromSuggestion, errors };
}
