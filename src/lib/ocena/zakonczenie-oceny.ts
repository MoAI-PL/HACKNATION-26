// Zakończenie oceny okresowej (Z14): ocena wskaźników kartami zachowań, sugestia i decyzja przełożonego.
// Czysta logika (bez bazy i Reacta) – używana w kreatorze i ponownie na serwerze przed zapisem decyzji.
// Sugestię liczy Z09 (src/lib/rules/sugestia.ts), skalę punktów § 11 ust. 1 pkt 1 – data/przepisy.json.

import { z } from "zod";
import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { COMPETENCY_NAMES, LEVEL_LABELS } from "@/lib/domain/slownik";
import type {
  CompetencyCode,
  IndicatorId,
  IndicatorRatingInput,
  IndicatorRatingValue,
  Level,
  LevelSuggestion,
  PeriodicPoints,
} from "@/lib/domain/types";
import { suggestLevel, validateFinalDecision } from "@/lib/rules/sugestia";

/** Oceny wskaźników kryterium: brak klucza = jeszcze nieoceniony. */
export type RatingsMap = Partial<Record<string, IndicatorRatingValue>>;

export interface CriterionForAssessment {
  competency: CompetencyCode;
  kind: "OBOWIAZKOWE" | "DODATKOWE";
  indicatorIds: string[];
  ratings: RatingsMap;
  /** Ostateczna ocena cząstkowa przełożonego (null = jeszcze bez decyzji). */
  score: number | null;
}

/** Wejście sugestii Z09 dla kryterium. `noteCounts` = liczba notatek z dziennika przy wskaźniku. */
export function ratingInputs(c: Pick<CriterionForAssessment, "indicatorIds" | "ratings">, noteCounts: Map<string, number>): IndicatorRatingInput[] {
  return c.indicatorIds.map((id) => ({
    indicatorId: id as IndicatorId,
    value: c.ratings[id] ?? null,
    hasNote: (noteCounts.get(id) ?? 0) > 0,
  }));
}

/** Sugestia dla kryterium oceny okresowej. */
export function suggestionFor(
  c: Pick<CriterionForAssessment, "competency" | "indicatorIds" | "ratings">,
  noteCounts: Map<string, number>,
  r: Rules = defaultRules,
): LevelSuggestion {
  return suggestLevel(c.competency, ratingInputs(c, noteCounts), { evaluationType: "OKRESOWA", rules: r });
}

/** Opcje decyzji: 5 poziomów z punktami (§ 11 ust. 1 pkt 1). */
export function decisionOptions(r: Rules = defaultRules): { level: Level; points: PeriodicPoints; label: string }[] {
  return r.periodic.partialScores.map((s) => ({ level: s.level, points: s.points, label: `${LEVEL_LABELS[s.level]} – ${s.points} pkt` }));
}

export interface CriterionProgress {
  rated: number;
  total: number;
  decided: boolean;
}

export function criterionProgress(c: CriterionForAssessment): CriterionProgress {
  return {
    rated: c.indicatorIds.filter((id) => c.ratings[id] !== undefined).length,
    total: c.indicatorIds.length,
    decided: c.score !== null,
  };
}

/** Pierwszy nieoceniony wskaźnik (do wznowienia pracy) albo 0. */
export function firstUnratedIndex(c: Pick<CriterionForAssessment, "indicatorIds" | "ratings">): number {
  const i = c.indicatorIds.findIndex((id) => c.ratings[id] === undefined);
  return i === -1 ? 0 : i;
}

/** Braki przed przejściem do podsumowania (Z15): każde kryterium musi mieć ocenę cząstkową. */
export function assessmentIssues(criteria: CriterionForAssessment[]): { competency: CompetencyCode; text: string }[] {
  return criteria
    .filter((c) => c.score === null)
    .map((c) => {
      const p = criterionProgress(c);
      return {
        competency: c.competency,
        text:
          p.rated < p.total
            ? `${COMPETENCY_NAMES[c.competency]}: oceniono ${p.rated} z ${p.total} wskaźników i nie wybrano oceny cząstkowej.`
            : `${COMPETENCY_NAMES[c.competency]}: wybierz ocenę cząstkową.`,
      };
    });
}

// ---------------------------------------------------------------------------
// Wejście akcji serwerowych
// ---------------------------------------------------------------------------

const ratingValue = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("BRAK_OBSERWACJI")]);

export const ratingInputSchema = z.object({
  competency: z.string(),
  indicatorId: z.string().regex(/^[A-Z]+\.[1-9]\d*$/),
  /** null = cofnięcie wyboru (wskaźnik znowu nieoceniony). */
  value: ratingValue.nullable(),
});

export const decisionInputSchema = z.object({
  competency: z.string(),
  points: z.number().int(),
  justification: z.string().max(2000).default(""),
});

/** Poziom w bazie (IndicatorRating.level): 1–5 albo null = brak okazji do obserwacji. */
export function toDbLevel(v: IndicatorRatingValue): number | null {
  return v === "BRAK_OBSERWACJI" ? null : v;
}

export function fromDbLevel(level: number | null): IndicatorRatingValue {
  return level === null ? "BRAK_OBSERWACJI" : (level as 1 | 2 | 3 | 4 | 5);
}

/** Walidacja decyzji z sugestią policzoną od nowa (na serwerze – z ocen zapisanych w bazie). */
export function checkDecision(suggestion: LevelSuggestion, points: number, justification: string, r: Rules = defaultRules) {
  return validateFinalDecision({ suggestion, finalPoints: points, justification }, r);
}
