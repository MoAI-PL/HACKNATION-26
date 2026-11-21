// Asystent rozmowy (Z24): dane z bazy – tylko podwładni przełożonego.

import { prisma } from "@/lib/db";
import { todayIso } from "@/lib/domain/daty";
import type { CompetencyCode, EvaluationResult } from "@/lib/domain/types";
import { currentDeadline } from "@/lib/hr/panel";
import { listHrRecords } from "@/lib/hr/repo";
import { fromDbLevel } from "@/lib/ocena/zakonczenie-oceny";
import { listObservations } from "@/lib/obserwacje/repo";
import { DEADLINE_KIND_LABELS, daysUntil } from "@/lib/rules/terminy";
import { formatDateShortPl } from "@/lib/rules/kalendarz";
import type { ConversationKind, PrepInput } from "./przygotowanie";

export interface ConversationTarget {
  employeeId: string;
  employeeName: string;
  positionTitle: string | null;
  suggested: ConversationKind;
  /** „Rozmowa rozpoczynająca do śr. 09.12” – gdy termin wynika z etapu oceny. */
  deadlineText: string | null;
  daysLeft: number | null;
}

/** Jaka rozmowa jest następna według etapu oceny. */
export function suggestedKind(type: "OKRESOWA" | "PIERWSZA", status: string): ConversationKind {
  if (status === "DO_ROZPOCZECIA") return type === "PIERWSZA" ? "WSTEPNA" : "ROZPOCZYNAJACA";
  return type === "PIERWSZA" ? "WSTEPNA" : "OCENIAJACA";
}

export async function listConversationTargets(supervisorId: string): Promise<ConversationTarget[]> {
  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { supervisorId },
      select: { id: true, firstName: true, lastName: true, position: { select: { title: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    listHrRecords(),
  ]);
  const today = todayIso();
  return employees.map((e) => {
    const open = records.filter((r) => r.employee.id === e.id && r.status !== "ZAKONCZONA" && r.status !== "CZEKA_NA_ZAPOZNANIE");
    const rec = open[0];
    const deadline = rec ? currentDeadline(rec) : null;
    return {
      employeeId: e.id,
      employeeName: `${e.firstName} ${e.lastName}`,
      positionTitle: e.position?.title ?? null,
      suggested: rec ? suggestedKind(rec.type, rec.status) : "OCENIAJACA",
      deadlineText: deadline ? `${DEADLINE_KIND_LABELS[deadline.kind]} do ${formatDateShortPl(deadline.date)}` : null,
      daysLeft: deadline ? daysUntil(deadline, today) : null,
    };
  });
}

export interface PrepData {
  input: Omit<PrepInput, "kind">;
  suggested: ConversationKind;
  evaluationId: string | null;
}

/** Dane do ściągi; null, gdy pracownik nie jest podwładnym przełożonego. */
export async function loadPrepData(supervisorId: string, employeeId: string): Promise<PrepData | null> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, supervisorId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: { select: { title: true, dominantTasks: true } },
      evaluations: {
        where: { status: { notIn: ["ZAKONCZONA"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          type: true,
          status: true,
          expectations: true,
          goals: true,
          isReevaluation: true,
          previousResult: true,
          criteria: { orderBy: { order: "asc" }, select: { competency: true, kind: true, ratings: { select: { indicatorId: true, level: true } } } },
        },
      },
    },
  });
  if (!employee) return null;
  const ev = employee.evaluations[0];
  const observations = await listObservations(supervisorId, { employeeId });
  const record = ev ? (await listHrRecords()).find((r) => r.id === ev.id) : undefined;
  const deadline = record ? currentDeadline(record) : null;
  const tasks = Array.isArray(employee.position?.dominantTasks) ? (employee.position!.dominantTasks as unknown[]).filter((t): t is string => typeof t === "string") : [];

  return {
    evaluationId: ev?.id ?? null,
    suggested: ev ? suggestedKind(ev.type, ev.status) : "OCENIAJACA",
    input: {
      employeeName: `${employee.firstName} ${employee.lastName}`,
      positionTitle: employee.position?.title ?? null,
      dominantTasks: tasks,
      criteria: (ev?.criteria ?? []).map((c) => ({ competency: c.competency as CompetencyCode, kind: c.kind })),
      ratings: (ev?.criteria ?? []).flatMap((c) => c.ratings.map((r) => ({ indicatorId: r.indicatorId, value: fromDbLevel(r.level) }))),
      observations,
      expectations: ev?.expectations ?? null,
      goals: ev?.goals ?? null,
      previousResult: (ev?.previousResult as EvaluationResult | null) ?? null,
      isReevaluation: ev?.isReevaluation ?? false,
      deadline: deadline ? { date: deadline.date, label: `${DEADLINE_KIND_LABELS[deadline.kind].toLocaleLowerCase("pl")} do ${formatDateShortPl(deadline.date)}` } : null,
    },
  };
}
