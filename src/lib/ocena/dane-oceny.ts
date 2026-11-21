// Odczyt danych do zakończenia oceny okresowej (Z14) – tylko po stronie serwera.

import { prisma } from "@/lib/db";
import { fromDbDate, todayIso } from "@/lib/domain/daty";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import type { BehaviorLevel, CompetencyCode, EvaluationStatus, IsoDate } from "@/lib/domain/types";
import { listObservations } from "@/lib/obserwacje/repo";
import type { ObservationView } from "@/lib/obserwacje/dziennik";
import { evaluationAccess } from "./dane-kreatora";
import { fromDbLevel, type CriterionForAssessment, type RatingsMap } from "./zakonczenie-oceny";

export interface IndicatorForCards {
  id: string;
  name: string;
  levels: Record<BehaviorLevel, string>;
}

export interface CriterionData extends CriterionForAssessment {
  id: string;
  name: string;
  reason?: string;
  indicators: IndicatorForCards[];
  suggestedScore: number | null;
  overrideReason?: string;
}

export interface AssessmentData {
  evaluationId: string;
  status: EvaluationStatus;
  today: IsoDate;
  employee: { id: string; name: string; positionTitle?: string };
  sheet: "A" | "B" | "C" | "PIERWSZA";
  periodStart?: IsoDate;
  dueDate?: IsoDate;
  criteria: CriterionData[];
  /** Notatki z dziennika z okresu oceny (Z13). */
  observations: ObservationView[];
  /** Wskazówki z modelu kompetencji do pokazania przy ocenie (sekcja 8.4). */
  guidance: string[];
  /** Kryterium, do którego wracamy (indeks od 0). */
  resumeCriterion: number;
}

/** Statusy, w których można oceniać wskaźniki. */
export const ASSESSABLE: EvaluationStatus[] = ["W_OKRESIE_OCENY", "W_OCENIE"];

export async function loadAssessment(evaluationId: string, userId: string): Promise<AssessmentData | null> {
  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, type: "OKRESOWA", ...evaluationAccess(userId) },
    include: {
      employee: { include: { position: { select: { title: true } } } },
      criteria: { orderBy: { order: "asc" }, include: { ratings: true } },
    },
  });
  if (!ev) return null;

  const periodStart = ev.periodStart ? fromDbDate(ev.periodStart) : undefined;
  const observations = await listObservations(userId, { employeeId: ev.employeeId, from: periodStart });

  const criteria: CriterionData[] = ev.criteria.map((c) => {
    const def = competencyModel.getCompetency(c.competency as CompetencyCode);
    const ratings: RatingsMap = {};
    for (const r of c.ratings) ratings[r.indicatorId] = fromDbLevel(r.level);
    return {
      id: c.id,
      competency: c.competency,
      kind: c.kind,
      name: def.name,
      reason: c.selectionReason ?? undefined,
      indicatorIds: def.indicators.map((i) => i.id),
      indicators: def.indicators.map((i) => ({ id: i.id, name: i.name, levels: i.levels })),
      ratings,
      score: c.score,
      suggestedScore: c.suggestedScore,
      overrideReason: c.overrideReason ?? undefined,
    };
  });

  const step = /^ocena:(\d+)$/.exec(ev.lastWizardStep ?? "");
  const firstOpen = criteria.findIndex((c) => c.score === null);
  const resumeCriterion = step ? Math.min(Number(step[1]), criteria.length) : firstOpen === -1 ? criteria.length : firstOpen;

  return {
    evaluationId: ev.id,
    status: ev.status,
    today: todayIso(),
    employee: { id: ev.employeeId, name: `${ev.employee.firstName} ${ev.employee.lastName}`, positionTitle: ev.employee.position?.title },
    sheet: ev.sheet,
    periodStart,
    dueDate: ev.dueDate ? fromDbDate(ev.dueDate) : undefined,
    criteria,
    observations,
    guidance: competencyModel.model.guidance ?? [],
    resumeCriterion,
  };
}
