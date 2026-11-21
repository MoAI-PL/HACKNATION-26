// Odczyt danych kreatora oceny okresowej (Z12) z bazy – tylko po stronie serwera.
// Przełożony widzi wyłącznie oceny, w których jest oceniającym albo bezpośrednim przełożonym ocenianego.

import { prisma } from "@/lib/db";
import { fromDbDate, todayIso } from "@/lib/domain/daty";
import type { CompetencyCode, EvaluationStatus, IsoDate, PositionDescription, SheetSelection } from "@/lib/domain/types";
import { positionFromRecord } from "@/lib/ai/funkcje/kryteria-z-osp";
import { getLLM } from "@/lib/ai/llm";
import { selectSheet } from "@/lib/rules/arkusz";
import type { AbsencePeriod } from "@/lib/rules/terminy";
import { parseDraft, wizardDeadlines, type PreviousEvaluation, type WizardDeadlines, type WizardDraft } from "./kreator-okresowej";

const iso = (d: Date | null | undefined): IsoDate | undefined => (d ? fromDbDate(d) : undefined);

/** Warunek dostępu przełożonego do oceny. */
export function evaluationAccess(userId: string) {
  return { OR: [{ evaluatorId: userId }, { employee: { supervisorId: userId } }] };
}

export interface SavedCriterion {
  competency: CompetencyCode;
  kind: "OBOWIAZKOWE" | "DODATKOWE";
  reason?: string;
}

export interface WizardData {
  evaluationId: string;
  status: EvaluationStatus;
  today: IsoDate;
  employee: { id: string; name: string; positionTitle?: string; orgUnit?: string };
  position: PositionDescription | null;
  positionFileName?: string;
  sheetFromOsp: SheetSelection | null;
  deadlines: WizardDeadlines | null;
  previous?: PreviousEvaluation;
  draft: WizardDraft;
  aiAvailable: boolean;
  /** Zatwierdzona część I (status inny niż DO_ROZPOCZECIA). */
  saved?: {
    sheet: "A" | "B" | "C" | "PIERWSZA";
    sheetOverridden: boolean;
    criteria: SavedCriterion[];
    criteriaSetAt?: IsoDate;
    dueDate?: IsoDate;
    expectations?: string;
    goals?: string;
  };
}

/** Dane kreatora albo null, gdy ocena nie istnieje lub nie należy do przełożonego. */
export async function loadWizardData(evaluationId: string, userId: string): Promise<WizardData | null> {
  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, type: "OKRESOWA", ...evaluationAccess(userId) },
    include: {
      employee: { include: { position: true, orgUnit: true, absences: true } },
      criteria: { orderBy: { order: "asc" } },
    },
  });
  if (!ev) return null;

  const prev = await prisma.evaluation.findFirst({
    where: { employeeId: ev.employeeId, type: "OKRESOWA", id: { not: ev.id }, evaluatedAt: { not: null }, result: { not: null } },
    orderBy: { evaluatedAt: "desc" },
    select: { evaluatedAt: true, result: true, acknowledgedAt: true },
  });
  const previous: PreviousEvaluation | undefined =
    prev?.evaluatedAt && prev.result
      ? { evaluatedAt: fromDbDate(prev.evaluatedAt), result: prev.result, acknowledgedAt: iso(prev.acknowledgedAt) }
      : undefined;

  const emp = ev.employee;
  const position = emp.position ? positionFromRecord(emp.position) : null;
  const absences: AbsencePeriod[] = emp.absences.map((a) => ({ kind: a.kind, from: fromDbDate(a.from), to: fromDbDate(a.to) }));

  return {
    evaluationId: ev.id,
    status: ev.status,
    today: todayIso(),
    employee: {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      positionTitle: emp.position?.title,
      orgUnit: emp.orgUnit?.name,
    },
    position,
    positionFileName: emp.position?.sourceFileName ?? undefined,
    sheetFromOsp: position ? selectSheet(position.subordinates) : null,
    deadlines: wizardDeadlines({ previous, permanentFrom: iso(emp.permanentFrom), absences }),
    previous,
    draft: parseDraft(ev.wizardState),
    aiAvailable: !!getLLM(),
    saved:
      ev.status === "DO_ROZPOCZECIA"
        ? undefined
        : {
            sheet: ev.sheet,
            sheetOverridden: ev.sheetOverridden,
            criteria: ev.criteria.map((c) => ({ competency: c.competency, kind: c.kind, reason: c.selectionReason ?? undefined })),
            criteriaSetAt: iso(ev.criteriaSetAt),
            dueDate: iso(ev.dueDate),
            expectations: ev.expectations ?? undefined,
            goals: ev.goals ?? undefined,
          },
  };
}

export interface PeriodicListItem {
  evaluationId: string;
  employeeName: string;
  positionTitle?: string;
  status: EvaluationStatus;
  isReevaluation: boolean;
  dueDate?: IsoDate;
  /** Termin rozmowy rozpoczynającej – tylko dla ocen do rozpoczęcia. */
  conversationDue?: IsoDate;
}

/** Oceny okresowe przełożonego, które nie są zakończone – od najpilniejszych. */
export async function listPeriodicEvaluations(userId: string): Promise<PeriodicListItem[]> {
  const evs = await prisma.evaluation.findMany({
    where: { type: "OKRESOWA", status: { not: "ZAKONCZONA" }, ...evaluationAccess(userId) },
    include: { employee: { include: { position: { select: { title: true } }, absences: true } } },
  });
  const items: PeriodicListItem[] = [];
  for (const ev of evs) {
    let conversationDue: IsoDate | undefined;
    if (ev.status === "DO_ROZPOCZECIA") {
      const prev = await prisma.evaluation.findFirst({
        where: { employeeId: ev.employeeId, type: "OKRESOWA", id: { not: ev.id }, evaluatedAt: { not: null }, result: { not: null } },
        orderBy: { evaluatedAt: "desc" },
        select: { evaluatedAt: true, result: true, acknowledgedAt: true },
      });
      const d = wizardDeadlines({
        previous: prev?.evaluatedAt && prev.result ? { evaluatedAt: fromDbDate(prev.evaluatedAt), result: prev.result, acknowledgedAt: iso(prev.acknowledgedAt) } : undefined,
        permanentFrom: iso(ev.employee.permanentFrom),
      });
      conversationDue = d?.conversation.date;
    }
    items.push({
      evaluationId: ev.id,
      employeeName: `${ev.employee.firstName} ${ev.employee.lastName}`,
      positionTitle: ev.employee.position?.title,
      status: ev.status,
      isReevaluation: ev.isReevaluation,
      dueDate: iso(ev.dueDate),
      conversationDue,
    });
  }
  const key = (i: PeriodicListItem) => i.conversationDue ?? i.dueDate ?? "9999-12-31";
  return items.sort((a, b) => (a.status === "DO_ROZPOCZECIA" ? 0 : 1) - (b.status === "DO_ROZPOCZECIA" ? 0 : 1) || key(a).localeCompare(key(b)));
}
