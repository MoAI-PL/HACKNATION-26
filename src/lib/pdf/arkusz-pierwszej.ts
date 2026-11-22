// Dane do PDF arkusza pierwszej oceny w służbie cywilnej – wzór: załącznik nr 2 do rozporządzenia PRM
// z 23.07.2015 (Dz.U. poz. 1144), plik materialy/pierwsza-ocena/Arkusz_pierwszej_oceny.docx.
// Wydruk po rozmowie wstępnej (podpisy pod rozmową wstępną); wynik i część oceny – po sporządzeniu oceny.

import type { Prisma } from "@prisma/client";
import { fromDbDate } from "@/lib/domain/daty";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import type { CompetencyCode, EvaluationResult, EvaluationStatus, ExamResult, IsoDate } from "@/lib/domain/types";
import { FINALIZED_STATUSES } from "@/lib/oceniany/moje-oceny";
import { rules } from "@/lib/domain/przepisy";
import { firstEvalWindow } from "@/lib/rules/terminy";
import { reportOnTime } from "@/lib/pierwsza-ocena/przebieg";
import { officeName, splitName, type SheetPerson } from "./arkusz";

export interface FirstSheetData {
  office: string | null;
  employee: SheetPerson & { employmentStart: IsoDate };
  evaluator: SheetPerson;
  unitHead: SheetPerson;
  initialConversation: IsoDate | null;
  reportDue: { from: IsoDate; to: IsoDate } | null;
  window: { from: IsoDate; to: IsoDate } | null;
  interviewDate: IsoDate | null;
  /** Część oceny – tylko po sporządzeniu (inaczej pola zostają do wypełnienia). */
  evaluation: {
    elements: { name: string; points: number | null }[];
    average: number | null;
    exam: ExamResult | null;
    reportOnTime: boolean;
    result: EvaluationResult | null;
    justification: string | null;
    developmentPlan: string | null;
    evaluatedAt: IsoDate | null;
    acknowledgedAt: IsoDate | null;
  } | null;
}

const orgUnitWithParents = {
  select: { name: true, parent: { select: { name: true, parent: { select: { name: true, parent: { select: { name: true } } } } } } },
} as const;

const userWithRecord = {
  select: {
    name: true,
    employee: { select: { firstName: true, lastName: true, position: { select: { title: true } }, orgUnit: { select: { name: true } } } },
  },
} as const;

export const firstSheetInclude = {
  employee: {
    include: {
      position: { select: { title: true } },
      orgUnit: orgUnitWithParents,
      unitHead: userWithRecord,
      absences: { select: { kind: true, from: true, to: true } },
    },
  },
  evaluator: userWithRecord,
  criteria: { orderBy: { order: "asc" } },
  conversations: { orderBy: { date: "asc" }, select: { type: true, date: true } },
  report: true,
} satisfies Prisma.EvaluationInclude;

export type FirstSheetRow = Prisma.EvaluationGetPayload<{ include: typeof firstSheetInclude }>;

/** Dlaczego nie można jeszcze wydrukować arkusza – null, gdy można. */
export function firstSheetProblem(ev: { type: string; status: EvaluationStatus }): string | null {
  if (ev.type !== "PIERWSZA") return "Ten wydruk dotyczy pierwszej oceny w służbie cywilnej.";
  if (ev.status === "DO_ROZPOCZECIA") return "Arkusz można wydrukować po rozmowie wstępnej i wyznaczeniu terminu sprawozdania (§ 3–4).";
  return null;
}

const iso = (d: Date | null | undefined): IsoDate | null => (d ? fromDbDate(d) : null);

type UserRecord = FirstSheetRow["evaluator"] | null;
function person(u: UserRecord): SheetPerson {
  if (!u) return { firstName: "", lastName: "", orgUnit: null, position: null };
  const name = u.employee ?? splitName(u.name);
  return { firstName: name.firstName, lastName: name.lastName, orgUnit: u.employee?.orgUnit?.name ?? null, position: u.employee?.position?.title ?? null };
}

export function buildFirstSheetData(ev: FirstSheetRow): FirstSheetData {
  const e = ev.employee;
  const employmentStart = fromDbDate(e.employmentStart);
  const contractEnd = iso(e.contractEnd);
  const window = contractEnd ? firstEvalWindow({ employmentStart, contractEnd }) : null;
  const wstepna = ev.conversations.find((c) => c.type === "WSTEPNA");
  const interview = [...ev.conversations].reverse().find((c) => c.type === "OCENIAJACA");
  const finalized = FINALIZED_STATUSES.includes(ev.status);
  const report = ev.report;
  const absences = e.absences.map((a) => ({ kind: a.kind, from: fromDbDate(a.from), to: fromDbDate(a.to) }));
  const onTime = report
    ? reportOnTime(iso(report.submittedAt) ?? undefined, {
        employmentStart,
        contractEnd: contractEnd ?? undefined,
        absences,
        dueFrom: fromDbDate(report.dueFrom),
        dueTo: fromDbDate(report.dueTo),
      })
    : false;
  const byCode = new Map(ev.criteria.map((c) => [c.competency, c.score]));

  return {
    office: officeName(e.orgUnit),
    employee: { firstName: e.firstName, lastName: e.lastName, orgUnit: e.orgUnit?.name ?? null, position: e.position?.title ?? null, employmentStart },
    evaluator: person(ev.evaluator),
    unitHead: person(e.unitHead),
    initialConversation: iso(wstepna?.date ?? ev.criteriaSetAt),
    reportDue: report ? { from: fromDbDate(report.dueFrom), to: fromDbDate(report.dueTo) } : null,
    window: window ? { from: window[0].date, to: window[1].date } : null,
    interviewDate: iso(interview?.date),
    evaluation: finalized
      ? {
          elements: rules.firstEval.elements.map((c: CompetencyCode) => ({ name: COMPETENCY_NAMES[c], points: byCode.get(c) ?? null })),
          average: ev.average,
          exam: ev.examResult,
          reportOnTime: onTime,
          result: ev.result,
          justification: ev.justification,
          developmentPlan: ev.developmentPlan,
          evaluatedAt: iso(ev.evaluatedAt),
          acknowledgedAt: iso(ev.acknowledgedAt),
        }
      : null,
  };
}

export function firstSheetFileName(data: Pick<FirstSheetData, "employee">): string {
  const ascii = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/Ł/g, "L")
      .replace(/[^A-Za-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `arkusz-pierwszej-oceny-${ascii(data.employee.lastName)}-${ascii(data.employee.firstName)}.pdf`;
}

/** Przycisk pobrania na ekranach pierwszej oceny – ten sam endpoint co arkusze B/C. */
export function firstSheetHref(evaluationId: string): string {
  return `/api/v1/oceny/${encodeURIComponent(evaluationId)}/pdf`;
}
