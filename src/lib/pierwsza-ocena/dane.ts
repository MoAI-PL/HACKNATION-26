// Odczyt danych ścieżki pierwszej oceny (Z17) – tylko po stronie serwera.

import { prisma } from "@/lib/db";
import { fromDbDate, todayIso } from "@/lib/domain/daty";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import type { CompetencyCode, Deadline, EvaluationStatus, ExamExemption, ExamResult, IsoDate } from "@/lib/domain/types";
import { evaluationAccess } from "@/lib/ocena/dane-kreatora";
import { firstEvalWindow, initialConversationDeadline, type AbsencePeriod } from "@/lib/rules/terminy";
import {
  STAGE_FOR_STATUS,
  effectiveReportDeadline,
  firstEvalSummary,
  proposedReportWindow,
  reportOnTime,
  windowLatest,
  type FirstEvalStage,
  type FirstEvalSummary,
} from "./przebieg";

const iso = (d: Date | null | undefined): IsoDate | undefined => (d ? fromDbDate(d) : undefined);

export interface FirstEvalListItem {
  evaluationId: string;
  employeeName: string;
  positionTitle?: string;
  status: EvaluationStatus;
  stage: FirstEvalStage;
  /** Najbliższy termin przełożonego na tym etapie (rozmowa, sprawozdanie, okno oceny). */
  next?: { label: string; deadline: Deadline };
}

const employeeInclude = {
  position: { select: { title: true } },
  orgUnit: { select: { name: true } },
  unitHead: { select: { name: true } },
  absences: { select: { kind: true, from: true, to: true } },
} as const;

function absencesOf(rows: { kind: AbsencePeriod["kind"]; from: Date; to: Date }[]): AbsencePeriod[] {
  return rows.map((a) => ({ kind: a.kind, from: fromDbDate(a.from), to: fromDbDate(a.to) }));
}

export async function listFirstEvaluations(userId: string): Promise<FirstEvalListItem[]> {
  const evs = await prisma.evaluation.findMany({
    where: { type: "PIERWSZA", status: { not: "ZAKONCZONA" }, ...evaluationAccess(userId) },
    include: { employee: { include: employeeInclude }, report: true },
  });
  const items = evs.map((ev): FirstEvalListItem => {
    const person = {
      employmentStart: fromDbDate(ev.employee.employmentStart),
      contractEnd: iso(ev.employee.contractEnd),
      absences: absencesOf(ev.employee.absences),
    };
    const stage = STAGE_FOR_STATUS[ev.status];
    let next: FirstEvalListItem["next"];
    if (stage === "ROZMOWA_WSTEPNA") next = { label: "rozmowa do", deadline: initialConversationDeadline(person.employmentStart) };
    else if (stage === "SPRAWOZDANIE" && ev.report) next = { label: "sprawozdanie do", deadline: effectiveReportDeadline(person, fromDbDate(ev.report.dueTo)) };
    else if (stage === "OCENA") {
      const latest = windowLatest(person);
      if (latest) next = { label: "ocena do", deadline: latest };
    }
    return {
      evaluationId: ev.id,
      employeeName: `${ev.employee.firstName} ${ev.employee.lastName}`,
      positionTitle: ev.employee.position?.title,
      status: ev.status,
      stage,
      next,
    };
  });
  const order: FirstEvalStage[] = ["ROZMOWA_WSTEPNA", "OCENA", "SPRAWOZDANIE", "ZAPOZNANIE", "ZAKONCZONA"];
  return items.sort(
    (a, b) => order.indexOf(a.stage) - order.indexOf(b.stage) || (a.next?.deadline.date ?? "9999").localeCompare(b.next?.deadline.date ?? "9999"),
  );
}

export interface FirstEvalData {
  evaluationId: string;
  status: EvaluationStatus;
  stage: FirstEvalStage;
  today: IsoDate;
  employee: {
    id: string;
    name: string;
    positionTitle?: string;
    orgUnit?: string;
    unitHeadName?: string;
    employmentStart: IsoDate;
    contractEnd?: IsoDate;
    absences: AbsencePeriod[];
  };
  deadlines: { initialConversation: Deadline; windowFrom?: Deadline; windowTo?: Deadline };
  conversation?: { date: IsoDate; notes?: string };
  /** Termin sprawozdania: zapisany po rozmowie wstępnej albo propozycja systemu. */
  report: {
    saved: boolean;
    dueFrom: IsoDate;
    dueTo: IsoDate;
    deadline: Deadline;
    submittedAt?: IsoDate;
    content?: string;
    fileName?: string;
    onTime: boolean;
  };
  exam?: ExamResult;
  examExemption?: ExamExemption;
  elements: { competency: CompetencyCode; name: string; score: number | null; suggestedScore: number | null; overrideReason?: string }[];
  summary: FirstEvalSummary;
  form: { evaluatedAt?: IsoDate; justification: string; developmentPlan: string };
  evaluatedAt?: IsoDate;
  acknowledgedAt?: IsoDate;
}

export async function loadFirstEval(evaluationId: string, userId: string): Promise<FirstEvalData | null> {
  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, type: "PIERWSZA", ...evaluationAccess(userId) },
    include: {
      employee: { include: employeeInclude },
      report: true,
      criteria: { orderBy: { order: "asc" } },
      conversations: { where: { type: "WSTEPNA" }, orderBy: { date: "desc" }, take: 1 },
    },
  });
  if (!ev) return null;
  const today = todayIso();
  const e = ev.employee;
  const person = { employmentStart: fromDbDate(e.employmentStart), contractEnd: iso(e.contractEnd), absences: absencesOf(e.absences) };
  const window = person.contractEnd ? firstEvalWindow({ employmentStart: person.employmentStart, contractEnd: person.contractEnd }) : undefined;

  const proposal = proposedReportWindow(person);
  const dueFrom = ev.report ? fromDbDate(ev.report.dueFrom) : proposal.dueFrom;
  const dueTo = ev.report ? fromDbDate(ev.report.dueTo) : proposal.dueTo;
  const ctx = { ...person, dueFrom, dueTo };
  const submittedAt = iso(ev.report?.submittedAt);
  const onTime = reportOnTime(submittedAt, ctx);

  const elements = ev.criteria.map((c) => ({
    competency: c.competency as CompetencyCode,
    name: COMPETENCY_NAMES[c.competency as CompetencyCode],
    score: c.score,
    suggestedScore: c.suggestedScore,
    overrideReason: c.overrideReason ?? undefined,
  }));
  const conv = ev.conversations[0];

  return {
    evaluationId: ev.id,
    status: ev.status,
    stage: STAGE_FOR_STATUS[ev.status],
    today,
    employee: {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      positionTitle: e.position?.title,
      orgUnit: e.orgUnit?.name,
      unitHeadName: e.unitHead?.name ?? undefined,
      ...person,
    },
    deadlines: { initialConversation: initialConversationDeadline(person.employmentStart), windowFrom: window?.[0], windowTo: window?.[1] },
    conversation: conv ? { date: fromDbDate(conv.date), notes: conv.notes ?? undefined } : undefined,
    report: {
      saved: !!ev.report,
      dueFrom,
      dueTo,
      deadline: effectiveReportDeadline(person, dueTo),
      submittedAt,
      content: ev.report?.content ?? undefined,
      fileName: ev.report?.fileName ?? undefined,
      onTime,
    },
    exam: ev.examResult ?? undefined,
    examExemption: ev.examExemption ?? undefined,
    elements,
    summary: firstEvalSummary({
      scores: elements,
      exam: ev.examResult ?? undefined,
      examExemption: ev.examExemption ?? undefined,
      reportSubmittedOnTime: onTime,
    }),
    form: { evaluatedAt: iso(ev.evaluatedAt), justification: ev.justification ?? "", developmentPlan: ev.developmentPlan ?? "" },
    evaluatedAt: iso(ev.evaluatedAt),
    acknowledgedAt: iso(ev.acknowledgedAt),
  };
}
