// REST API v1 (Z38): eksport oceny w JSON pod integrację z EZD i systemem kadrowym (specyfikacja: docs/openapi.yaml).
// Konwencja jak w kontrakcie domeny: klucze po angielsku, wartości domenowe po polsku (kody enumów), daty "RRRR-MM-DD".

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { fromDbDate } from "@/lib/domain/daty";
import { rules } from "@/lib/domain/przepisy";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import {
  EVALUATION_STATUSES,
  EVALUATION_TYPES,
  type CompetencyCode,
  type EvaluationResult,
  type EvaluationStatus,
  type EvaluationType,
  type IsoDate,
  type Level,
  type Role,
} from "@/lib/domain/types";
import { objectionDeadline } from "@/lib/rules/terminy";
import { FINALIZED_STATUSES } from "@/lib/oceniany/moje-oceny";

export const API_VERSION = "1";

/** Etapy, w których oceniany widzi swoją ocenę w API (po sporządzeniu – § 12) – te same co na ekranie „Moje oceny”. */
export const VISIBLE_TO_EMPLOYEE: EvaluationStatus[] = [...FINALIZED_STATUSES];

/**
 * Zakres ocen dostępnych dla użytkownika (Z04):
 * HR – wszystkie; przełożony – jako oceniający albo bezpośredni przełożony; oceniany – własne sporządzone oceny.
 * Kierujący komórką nie ma dostępu (null).
 */
export function evaluationScope(user: { id: string; role: Role }): Prisma.EvaluationWhereInput | null {
  switch (user.role) {
    case "HR":
      return {};
    case "PRZELOZONY":
      return { OR: [{ evaluatorId: user.id }, { employee: { supervisorId: user.id } }] };
    case "OCENIANY":
      return { employee: { user: { id: user.id } }, status: { in: VISIBLE_TO_EMPLOYEE } };
    default:
      return null;
  }
}

/** Filtry listy ocen: ?status=…&typ=…&pracownikId=… */
export const listQuerySchema = z.object({
  status: z.enum(EVALUATION_STATUSES).optional(),
  typ: z.enum(EVALUATION_TYPES).optional(),
  pracownikId: z.string().min(1).max(60).optional(),
});

const iso = (d: Date | null | undefined): IsoDate | null => (d ? fromDbDate(d) : null);

export const evaluationExportInclude = {
  employee: { include: { position: { select: { title: true } }, orgUnit: { select: { name: true } } } },
  evaluator: { select: { id: true, name: true } },
  criteria: { orderBy: { order: "asc" }, include: { ratings: true } },
  conversations: { orderBy: { date: "asc" }, select: { type: true, date: true } },
} satisfies Prisma.EvaluationInclude;

export type EvaluationRow = Prisma.EvaluationGetPayload<{ include: typeof evaluationExportInclude }>;

export interface EvaluationExport {
  apiVersion: string;
  exportedAt: string;
  legalBasis: string;
  evaluation: {
    id: string;
    type: EvaluationType;
    sheet: string;
    status: EvaluationStatus;
    isReevaluation: boolean;
    periodStart: IsoDate | null;
    periodEnd: IsoDate | null;
    criteriaSetAt: IsoDate | null;
    dueDate: IsoDate | null;
    evaluatedAt: IsoDate | null;
    acknowledgedAt: IsoDate | null;
    objectionDeadline: IsoDate | null;
    result: EvaluationResult | null;
    overallLevel: Level | null;
    average: number | null;
    justification: string | null;
    developmentPlan: string | null;
    previous: { result: EvaluationResult; level: Level | null; date: IsoDate } | null;
    promotion: { requestedGrade: number | null; justification: string | null } | null;
  };
  employee: { id: string; firstName: string; lastName: string; position: string | null; orgUnit: string | null; isCivilServant: boolean };
  evaluator: { id: string; name: string };
  criteria: {
    competency: CompetencyCode;
    name: string;
    kind: "OBOWIAZKOWE" | "DODATKOWE";
    selectionReason: string | null;
    score: number | null;
    suggestedScore: number | null;
    overrideReason: string | null;
    indicators: { id: string; name: string; behaviorLevel: number | null; observed: boolean }[];
  }[];
  conversations: { type: string; date: IsoDate }[];
}

/** Ocena z bazy → dokument eksportu (bez danych wewnętrznych: szkicu kreatora, dziennika decyzji). */
export function toEvaluationExport(ev: EvaluationRow, now: Date = new Date()): EvaluationExport {
  const acknowledgedAt = iso(ev.acknowledgedAt);
  return {
    apiVersion: API_VERSION,
    exportedAt: now.toISOString(),
    legalBasis: ev.type === "OKRESOWA" ? rules.sources.periodicRegulation : rules.sources.firstEvalRegulation,
    evaluation: {
      id: ev.id,
      type: ev.type,
      sheet: ev.sheet,
      status: ev.status,
      isReevaluation: ev.isReevaluation,
      periodStart: iso(ev.periodStart),
      periodEnd: iso(ev.periodEnd),
      criteriaSetAt: iso(ev.criteriaSetAt),
      dueDate: iso(ev.dueDate),
      evaluatedAt: iso(ev.evaluatedAt),
      acknowledgedAt,
      objectionDeadline: ev.type === "OKRESOWA" && acknowledgedAt ? objectionDeadline(acknowledgedAt).date : null,
      result: ev.result,
      overallLevel: ev.overallLevel,
      average: ev.average,
      justification: ev.justification,
      developmentPlan: ev.developmentPlan,
      previous: ev.previousResult && ev.previousDate ? { result: ev.previousResult, level: ev.previousLevel, date: fromDbDate(ev.previousDate) } : null,
      promotion: ev.promotionRequest ? { requestedGrade: ev.requestedGrade, justification: ev.promotionJustification } : null,
    },
    employee: {
      id: ev.employee.id,
      firstName: ev.employee.firstName,
      lastName: ev.employee.lastName,
      position: ev.employee.position?.title ?? null,
      orgUnit: ev.employee.orgUnit?.name ?? null,
      isCivilServant: ev.employee.isCivilServant,
    },
    evaluator: { id: ev.evaluator.id, name: ev.evaluator.name },
    criteria: ev.criteria.map((c) => {
      const ratings = new Map(c.ratings.map((r) => [r.indicatorId, r.level]));
      const def = competencyModel.getCompetency(c.competency);
      return {
        competency: c.competency,
        name: COMPETENCY_NAMES[c.competency],
        kind: c.kind,
        selectionReason: c.selectionReason,
        score: c.score,
        suggestedScore: c.suggestedScore,
        overrideReason: c.overrideReason,
        indicators: def.indicators
          .filter((i) => ratings.has(i.id))
          .map((i) => ({ id: i.id, name: i.name, behaviorLevel: ratings.get(i.id) ?? null, observed: ratings.get(i.id) !== null })),
      };
    }),
    conversations: ev.conversations.map((c) => ({ type: c.type, date: fromDbDate(c.date) })),
  };
}
