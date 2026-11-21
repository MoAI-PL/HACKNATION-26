// Odczyt danych pulpitu z bazy (Z11) – tylko po stronie serwera.
// Przełożony widzi wyłącznie swoich podwładnych (Employee.supervisorId).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromDbDate } from "@/lib/domain/daty";
import type { EmployeeInfo } from "./pulpit";

const employeeInclude = {
  position: { select: { title: true } },
  orgUnit: { select: { name: true } },
  evaluations: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      sheet: true,
      status: true,
      isReevaluation: true,
      criteriaSetAt: true,
      evaluatedAt: true,
      acknowledgedAt: true,
      result: true,
      overallLevel: true,
      dueDate: true,
      report: { select: { dueTo: true, submittedAt: true } },
    },
  },
  absences: { select: { kind: true, from: true, to: true } },
  positionChanges: { select: { date: true, significantDutiesChange: true } },
  observations: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
  _count: { select: { observations: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithData = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

const iso = (d: Date | null | undefined) => (d ? fromDbDate(d) : undefined);

export function toEmployeeInfo(e: EmployeeWithData): EmployeeInfo {
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    positionTitle: e.position?.title,
    orgUnit: e.orgUnit?.name,
    employmentStart: fromDbDate(e.employmentStart),
    permanentFrom: iso(e.permanentFrom),
    contractEnd: iso(e.contractEnd),
    evaluations: e.evaluations.map((ev) => ({
      id: ev.id,
      type: ev.type,
      sheet: ev.sheet,
      status: ev.status,
      isReevaluation: ev.isReevaluation,
      criteriaSetAt: iso(ev.criteriaSetAt),
      evaluatedAt: iso(ev.evaluatedAt),
      acknowledgedAt: iso(ev.acknowledgedAt),
      result: ev.result ?? undefined,
      level: ev.overallLevel ?? undefined,
      dueDate: iso(ev.dueDate),
      reportDue: iso(ev.report?.dueTo),
      reportSubmittedAt: iso(ev.report?.submittedAt),
    })),
    absences: e.absences.map((a) => ({ kind: a.kind, from: fromDbDate(a.from), to: fromDbDate(a.to) })),
    positionChanges: e.positionChanges.map((c) => ({ date: fromDbDate(c.date), significantDutiesChange: c.significantDutiesChange })),
    observationsCount: e._count.observations,
    lastObservationDate: iso(e.observations[0]?.date),
  };
}

/** Wszyscy podwładni przełożonego z danymi do terminów. */
export async function loadSubordinates(supervisorId: string): Promise<EmployeeInfo[]> {
  const rows = await prisma.employee.findMany({
    where: { supervisorId },
    include: employeeInclude,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map(toEmployeeInfo);
}

/** Jeden podwładny – null, gdy nie istnieje albo nie jest podwładnym tego przełożonego (bez ujawniania, który przypadek). */
export async function loadSubordinate(supervisorId: string, employeeId: string): Promise<EmployeeInfo | null> {
  const row = await prisma.employee.findFirst({ where: { id: employeeId, supervisorId }, include: employeeInclude });
  return row ? toEmployeeInfo(row) : null;
}
