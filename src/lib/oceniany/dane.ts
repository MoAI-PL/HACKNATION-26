// Odczyt własnych ocen ocenianego (Z46) – tylko po stronie serwera.
// Każde zapytanie jest ograniczone do pracownika powiązanego z kontem (`Employee.user`), więc cudza ocena
// wygląda jak nieistniejąca (404).

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromDbDate } from "@/lib/domain/daty";
import { ownEvaluationView, sortOwnEvaluations, type OwnEvaluationRow, type OwnEvaluationView } from "./moje-oceny";

const iso = (d: Date | null | undefined) => (d ? fromDbDate(d) : undefined);

/** Warunek: oceny pracownika powiązanego z kontem użytkownika. */
export function ownScope(userId: string): Prisma.EvaluationWhereInput {
  return { employee: { user: { id: userId } } };
}

const include = {
  employee: { select: { isCivilServant: true } },
  evaluator: { select: { name: true } },
  criteria: { orderBy: { order: "asc" }, select: { competency: true, kind: true, selectionReason: true, score: true } },
  conversations: { orderBy: { date: "asc" }, select: { type: true, date: true } },
} satisfies Prisma.EvaluationInclude;

type Row = Prisma.EvaluationGetPayload<{ include: typeof include }>;

function toRow(ev: Row): OwnEvaluationRow {
  return {
    id: ev.id,
    type: ev.type,
    sheet: ev.sheet,
    status: ev.status,
    isReevaluation: ev.isReevaluation,
    evaluatorName: ev.evaluator.name,
    criteriaSetAt: iso(ev.criteriaSetAt),
    dueDate: iso(ev.dueDate),
    evaluatedAt: iso(ev.evaluatedAt),
    acknowledgedAt: iso(ev.acknowledgedAt),
    justification: ev.justification ?? undefined,
    developmentPlan: ev.developmentPlan ?? undefined,
    promotionRequest: ev.promotionRequest,
    requestedGrade: ev.requestedGrade ?? undefined,
    isCivilServant: ev.employee.isCivilServant,
    previous: ev.previousResult && ev.previousDate ? { date: fromDbDate(ev.previousDate), result: ev.previousResult, level: ev.previousLevel ?? undefined } : undefined,
    criteria: ev.criteria.map((c) => ({ competency: c.competency, kind: c.kind, selectionReason: c.selectionReason ?? undefined, score: c.score })),
    conversations: ev.conversations.map((c) => ({ type: c.type, date: fromDbDate(c.date) })),
  };
}

export async function loadOwnEvaluations(userId: string): Promise<OwnEvaluationView[]> {
  const rows = await prisma.evaluation.findMany({ where: ownScope(userId), include });
  return sortOwnEvaluations(rows.map((r) => ownEvaluationView(toRow(r))));
}

export async function loadOwnEvaluation(evaluationId: string, userId: string): Promise<OwnEvaluationView | null> {
  const row = await prisma.evaluation.findFirst({ where: { id: evaluationId, ...ownScope(userId) }, include });
  return row ? ownEvaluationView(toRow(row)) : null;
}

/** Czy konto ocenianego jest powiązane z kartoteką pracownika. */
export async function hasEmployeeRecord(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
  return !!u?.employeeId;
}
