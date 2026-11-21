// Odczyt danych podsumowania oceny okresowej (Z15) – tylko po stronie serwera.

import { prisma } from "@/lib/db";
import { fromDbDate, todayIso } from "@/lib/domain/daty";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import type { Deadline, EvaluationResult, EvaluationStatus, IsoDate, Level } from "@/lib/domain/types";
import { objectionDeadline } from "@/lib/rules/terminy";
import { evaluationAccess } from "./dane-kreatora";
import { summarize, type ScoredCriterion, type SummaryForm, type SummaryResult } from "./podsumowanie";

const iso = (d: Date | null | undefined): IsoDate | undefined => (d ? fromDbDate(d) : undefined);

export interface PreviousSummary {
  date: IsoDate;
  result: EvaluationResult;
  level?: Level;
}

export interface SummaryData {
  evaluationId: string;
  status: EvaluationStatus;
  today: IsoDate;
  employee: { id: string; name: string; positionTitle?: string; isCivilServant: boolean; serviceGrade?: number };
  sheet: "A" | "B" | "C" | "PIERWSZA";
  periodStart?: IsoDate;
  dueDate?: IsoDate;
  criteria: (ScoredCriterion & { name: string; overrideReason?: string })[];
  summary: SummaryResult;
  form: SummaryForm;
  previous: PreviousSummary | null;
  acknowledgedAt?: IsoDate;
  /** Termin sprzeciwu – po zapoznaniu się z oceną (art. 83 ustawy). */
  objection: Deadline | null;
}

export async function loadSummary(evaluationId: string, userId: string): Promise<SummaryData | null> {
  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, type: "OKRESOWA", ...evaluationAccess(userId) },
    include: {
      employee: { include: { position: { select: { title: true } } } },
      criteria: { orderBy: { order: "asc" } },
    },
  });
  if (!ev) return null;

  let previous: PreviousSummary | null = null;
  if (ev.previousDate && ev.previousResult) {
    previous = { date: fromDbDate(ev.previousDate), result: ev.previousResult, level: ev.previousLevel ?? undefined };
  } else {
    const prev = await prisma.evaluation.findFirst({
      where: { employeeId: ev.employeeId, type: "OKRESOWA", id: { not: ev.id }, evaluatedAt: { not: null }, result: { not: null } },
      orderBy: { evaluatedAt: "desc" },
      select: { evaluatedAt: true, result: true, overallLevel: true },
    });
    if (prev?.evaluatedAt && prev.result) previous = { date: fromDbDate(prev.evaluatedAt), result: prev.result, level: prev.overallLevel ?? undefined };
  }

  const criteria = ev.criteria.map((c) => ({
    competency: c.competency,
    kind: c.kind,
    score: c.score,
    name: COMPETENCY_NAMES[c.competency],
    overrideReason: c.overrideReason ?? undefined,
  }));
  const acknowledgedAt = iso(ev.acknowledgedAt);

  return {
    evaluationId: ev.id,
    status: ev.status,
    today: todayIso(),
    employee: {
      id: ev.employeeId,
      name: `${ev.employee.firstName} ${ev.employee.lastName}`,
      positionTitle: ev.employee.position?.title,
      isCivilServant: ev.employee.isCivilServant,
      serviceGrade: ev.employee.serviceGrade ?? undefined,
    },
    sheet: ev.sheet,
    periodStart: iso(ev.periodStart),
    dueDate: iso(ev.dueDate),
    criteria,
    summary: summarize(criteria),
    form: {
      justification: ev.justification ?? "",
      developmentPlan: ev.developmentPlan ?? "",
      promotionRequest: ev.promotionRequest,
      promotionJustification: ev.promotionJustification ?? "",
      requestedGrade: ev.requestedGrade ?? (ev.employee.serviceGrade ? ev.employee.serviceGrade + 1 : null),
      evaluatedAt: iso(ev.evaluatedAt),
    },
    previous,
    acknowledgedAt,
    objection: acknowledgedAt ? objectionDeadline(acknowledgedAt) : null,
  };
}
