// Parametry przepisów (Z03): schemat zod i typowany dostęp do data/przepisy.json.
// KONTRAKT WSPÓLNY. Silniki (Z07, Z08, Z09, Z36) czytają parametry stąd, a nie z liczb na sztywno w kodzie.
// Panel HR (Z19) waliduje edycję tym samym schematem (rulesSchema).

import { z } from "zod";
import rawRules from "../../../data/przepisy.json";
import {
  COMPETENCY_CODES,
  LEVELS,
  SUBORDINATE_OPTIONS,
} from "./types";

const competency = z.enum(COMPETENCY_CODES);
const level = z.enum(LEVELS);
const legalBasis = z.record(z.string(), z.string());
const positiveInt = z.number().int().positive();
const behaviorKey = z.enum(["1", "2", "3", "4", "5"]);

export const rulesSchema = z.object({
  version: z.string(),
  sources: z.record(z.string(), z.string()),

  periodic: z.object({
    partialScores: z.array(z.object({ level, points: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7), z.literal(9)]) })).length(5),
    overallLevelThresholds: z
      .array(z.object({ level, above: z.number().nullable(), upTo: z.number() }))
      .length(5)
      .refine(
        (t) => t.every((row, i) => (i === 0 ? row.above === null : row.above === t[i - 1].upTo)),
        "Progi poziomu ogólnego muszą być ciągłe: „powyżej” = „do” poprzedniego progu.",
      ),
    mandatoryCriteria: z.object({ A: z.array(competency), B: z.array(competency), C: z.array(competency) }),
    maxAdditionalCriteria: positiveInt,
    positiveMinOverallLevel: level,
    negativeIfAnyPartialScore: z.number(),
    sheetBySubordinates: z.record(z.enum(SUBORDINATE_OPTIONS), z.enum(["B", "C"])),
    legalBasis,
  }),

  periodicDeadlines: z.object({
    periodMonths: positiveInt,
    criteriaConversationDays: positiveInt,
    afterNegativeConversationDays: positiveInt,
    reevaluationAfterNegativeMonths: positiveInt,
    absenceExtensionMinMonths: positiveInt,
    positionChange: z.object({
      thresholdMonths: positiveInt,
      newCriteriaDays: positiveInt,
      evaluationDaysBefore: positiveInt,
      evaluationDaysAfter: positiveInt,
    }),
    objectionDays: positiveInt,
    legalBasis,
  }),

  firstEval: z.object({
    elements: z.array(competency).length(5),
    partialScores: z.array(z.object({ level, points: z.union([z.literal(3), z.literal(5), z.literal(7)]) })).length(3),
    maxScoresAtMinimum: z.number().int().nonnegative(),
    minAverage: z.number(),
    initialConversationDays: positiveInt,
    evaluationEarliestMonths: positiveInt,
    evaluationLatestMonthsBeforeContractEnd: positiveInt,
    reportMinMonths: positiveInt,
    legalBasis,
  }),

  // ZAŁOŻENIE: mapowanie poziomów zachowania 1–5 na punkty (pierwsza ocena: 1–2 → 3, 3 → 5, 4–5 → 7) – docs/ZALOZENIA.md #1.
  behaviorToPoints: z.object({
    periodic: z.record(behaviorKey, z.number()),
    firstEval: z.record(behaviorKey, z.number()),
  }),

  // ZAŁOŻENIE: reguła sugerowanego poziomu (średnia, remis w dół) – docs/ZALOZENIA.md #2.
  suggestion: z.object({
    tieBreak: z.enum(["DOWN", "UP"]),
    minObservedShare: z.number().min(0).max(1),
    requireNoteAtLevels: z.array(z.number().int().min(1).max(5)),
  }),

  // ZAŁOŻENIE: progi Lustra oceniającego (Z36) – docs/ZALOZENIA.md #11.
  mirror: z.object({
    recencyWindowDays: positiveInt,
    recencyMinShare: z.number().min(0).max(1),
    haloMinIndicators: positiveInt,
    leniencyDiffPoints: z.number().positive(),
    leniencyMinEvaluationsInUnit: positiveInt,
  }),

  deadlineUrgency: z.object({ urgentDays: positiveInt, soonDays: positiveInt }),

  dateCounting: z.object({
    daysStartNextDay: z.boolean(),
    monthsEndOnLastDayIfMissing: z.boolean(),
    moveToNextWorkingDay: z.boolean(),
    saturdayIsDayOff: z.boolean(),
    legalBasis: z.string(),
  }),
});

export type Rules = z.infer<typeof rulesSchema>;

/** Parametry przepisów zwalidowane przy starcie – błąd w pliku zatrzymuje aplikację z czytelnym komunikatem. */
export const rules: Rules = rulesSchema.parse(rawRules);
