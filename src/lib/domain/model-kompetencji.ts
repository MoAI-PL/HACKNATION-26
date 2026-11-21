// Model kompetencji (Z05): schemat zod i indeks do szybkiego wyszukiwania.
// Bez odczytu plików – dane z data/model-kompetencji.json ładuje model-kompetencji-dane.ts.
// Tym samym schematem waliduje się wynik importu xlsx (src/lib/import/model-kompetencji.ts)
// i edycję opisów zachowań w panelu HR (Z19).

import { z } from "zod";
import { COMPETENCY_NAMES } from "./slownik";
import {
  COMPETENCY_CODES,
  type BehaviorLevel,
  type CompetencyCode,
  type CompetencyDefinition,
  type CompetencyModel,
  type IndicatorDefinition,
  type IndicatorId,
} from "./types";

const competency = z.enum(COMPETENCY_CODES);
const description = z.string().trim().min(1, "Opis zachowania nie może być pusty.");

const indicatorSchema = z.object({
  id: z.string().regex(/^[A-Z]+\.[1-9]\d*$/, "Identyfikator wskaźnika ma postać KOD.numer, np. KOMUNIKACJA.2."),
  competency,
  name: z.string().trim().min(1, "Nazwa wskaźnika nie może być pusta."),
  levels: z.object({ 1: description, 2: description, 3: description, 4: description, 5: description }),
});

const competencySchema = z
  .object({
    code: competency,
    name: z.string().min(1),
    indicators: z.array(indicatorSchema).min(1, "Kompetencja musi mieć co najmniej jeden wskaźnik."),
  })
  .superRefine((c, ctx) => {
    if (c.name !== COMPETENCY_NAMES[c.code]) {
      ctx.addIssue({ code: "custom", path: ["name"], message: `Nazwa musi brzmieć „${COMPETENCY_NAMES[c.code]}” (załącznik nr 1).` });
    }
    c.indicators.forEach((ind, i) => {
      if (ind.competency !== c.code) {
        ctx.addIssue({ code: "custom", path: ["indicators", i, "competency"], message: `Wskaźnik należy do kompetencji ${c.code}.` });
      }
      if (ind.id !== `${c.code}.${i + 1}`) {
        ctx.addIssue({ code: "custom", path: ["indicators", i, "id"], message: `Oczekiwano identyfikatora ${c.code}.${i + 1} (kolejność z arkusza).` });
      }
    });
  });

export const competencyModelSchema = z
  .object({
    source: z.string().min(1),
    importedAt: z.iso.date(),
    guidance: z.array(z.string().trim().min(1)),
    competencies: z.array(competencySchema),
  })
  .superRefine((m, ctx) => {
    const codes = m.competencies.map((c) => c.code);
    const missing = COMPETENCY_CODES.filter((c) => !codes.includes(c));
    const duplicated = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (missing.length > 0) ctx.addIssue({ code: "custom", path: ["competencies"], message: `Brak kompetencji: ${missing.join(", ")}.` });
    if (duplicated.length > 0) ctx.addIssue({ code: "custom", path: ["competencies"], message: `Powtórzone kompetencje: ${duplicated.join(", ")}.` });
  });

/** Szybki dostęp do modelu: kompetencja po kodzie, wskaźnik po identyfikatorze. */
export interface CompetencyModelIndex {
  model: CompetencyModel;
  competencies: CompetencyDefinition[];
  /** Wszystkie wskaźniki w kolejności kompetencji i arkusza. */
  indicators: IndicatorDefinition[];
  getCompetency(code: CompetencyCode): CompetencyDefinition;
  getIndicator(id: IndicatorId | string): IndicatorDefinition | undefined;
  /** Opis zachowania dla wskaźnika i poziomu 1–5 (karta zachowania w Z14). */
  behaviorDescription(id: IndicatorId | string, level: BehaviorLevel): string | undefined;
}

/** Waliduje model i buduje indeks. Rzuca ZodError z polskimi komunikatami, gdy dane są niepoprawne. */
export function createCompetencyModelIndex(raw: unknown): CompetencyModelIndex {
  const model = competencyModelSchema.parse(raw) as CompetencyModel;
  const byCode = new Map(model.competencies.map((c) => [c.code, c]));
  const indicators = model.competencies.flatMap((c) => c.indicators);
  const byId = new Map<string, IndicatorDefinition>(indicators.map((i) => [i.id, i]));
  return {
    model,
    competencies: model.competencies,
    indicators,
    getCompetency(code) {
      const c = byCode.get(code);
      if (!c) throw new Error(`Model kompetencji nie zawiera kompetencji ${code}.`);
      return c;
    },
    getIndicator: (id) => byId.get(id),
    behaviorDescription: (id, level) => byId.get(id)?.levels[level],
  };
}
