// Asystent rozmowy: dane z bazy – tylko podwładni przełożonego.
//
// Lista i ściąga wybierają tę samą ocenę jedną regułą (`currentEvaluation`): najnowsza ocena w toku
// (bez zakończonych i czekających na zapoznanie). Rodzaj rozmowy wynika z rodzaju i etapu tej oceny,
// a dostępne rodzaje – z rodzaju oceny (pierwsza ocena ma tylko rozmowę wstępną, § 3 rozp. o pierwszej ocenie).

import { prisma } from "@/lib/db";
import { fromDbDate, todayIso } from "@/lib/domain/daty";
import type { CompetencyCode, ConversationType, DeadlineUrgency, EvaluationResult, EvaluationStatus, EvaluationType } from "@/lib/domain/types";
import { currentDeadline, type HrEvaluationRecord } from "@/lib/hr/panel";
import { listHrRecords } from "@/lib/hr/repo";
import { fromDbLevel } from "@/lib/ocena/zakonczenie-oceny";
import { listObservations } from "@/lib/obserwacje/repo";
import { formatDateShortPl } from "@/lib/rules/kalendarz";
import { DEADLINE_KIND_LABELS, daysUntil, deadlineUrgency } from "@/lib/rules/terminy";
import type { ConversationKind, PrepInput } from "./przygotowanie";

/** Etapy, na których trwa proces oceny i jest z kim rozmawiać. */
const IN_PROGRESS: EvaluationStatus[] = ["DO_ROZPOCZECIA", "W_OKRESIE_OCENY", "W_OCENIE"];

/** Jaka rozmowa jest następna według rodzaju i etapu oceny; bez oceny w toku – rozpoczynająca nowy okres. */
export function suggestedKind(type: EvaluationType | null, status: EvaluationStatus | null): ConversationKind {
  if (type === "PIERWSZA") return "WSTEPNA";
  if (!type || !status || status === "DO_ROZPOCZECIA") return "ROZPOCZYNAJACA";
  return "OCENIAJACA";
}

/** Rozmowy właściwe dla rodzaju oceny: § 3 rozp. o pierwszej ocenie albo § 5 i § 10 rozp. o ocenach okresowych. */
export function allowedKinds(type: EvaluationType | null): ConversationKind[] {
  return type === "PIERWSZA" ? ["WSTEPNA"] : ["ROZPOCZYNAJACA", "OCENIAJACA"];
}

/** Najnowsza ocena w toku (rekordy z listHrRecords są posortowane od najnowszej). */
export function currentEvaluation(records: HrEvaluationRecord[], employeeId: string): HrEvaluationRecord | undefined {
  return records.find((r) => r.employee.id === employeeId && IN_PROGRESS.includes(r.status));
}

function deadlineInfo(record: HrEvaluationRecord | undefined) {
  const deadline = record ? currentDeadline(record) : null;
  if (!deadline) return null;
  const today = todayIso();
  return {
    deadline,
    text: `${DEADLINE_KIND_LABELS[deadline.kind]} do ${formatDateShortPl(deadline.date)}`,
    daysLeft: daysUntil(deadline, today),
    urgency: deadlineUrgency(deadline, today),
  };
}

export interface ConversationTarget {
  employeeId: string;
  employeeName: string;
  positionTitle: string | null;
  suggested: ConversationKind;
  deadlineText: string | null;
  daysLeft: number | null;
  urgency: DeadlineUrgency | null;
}

export async function listConversationTargets(supervisorId: string): Promise<ConversationTarget[]> {
  const employees = await prisma.employee.findMany({
    where: { supervisorId },
    select: { id: true, firstName: true, lastName: true, position: { select: { title: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const records = await listHrRecords({ employeeIds: employees.map((e) => e.id) });
  return employees.map((e) => {
    const rec = currentEvaluation(records, e.id);
    const info = deadlineInfo(rec);
    return {
      employeeId: e.id,
      employeeName: `${e.firstName} ${e.lastName}`,
      positionTitle: e.position?.title ?? null,
      suggested: suggestedKind(rec?.type ?? null, rec?.status ?? null),
      deadlineText: info?.text ?? null,
      daysLeft: info?.daysLeft ?? null,
      urgency: info?.urgency ?? null,
    };
  });
}

export interface PastConversation {
  id: string;
  type: ConversationType;
  date: string;
  notes: string | null;
}

/** Zapisane rozmowy z pracownikiem (tryb rozmowy, kreator oceny okresowej, pierwsza ocena), od najnowszej. */
export async function listPastConversations(supervisorId: string, employeeId: string, limit = 10): Promise<PastConversation[]> {
  const rows = await prisma.conversation.findMany({
    where: { employeeId, employee: { supervisorId } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { id: true, type: true, date: true, notes: true },
  });
  return rows.map((r) => ({ id: r.id, type: r.type as ConversationType, date: fromDbDate(r.date), notes: r.notes }));
}

export interface PrepData {
  input: Omit<PrepInput, "kind">;
  suggested: ConversationKind;
  allowed: ConversationKind[];
  evaluationId: string | null;
}

/** Dane do ściągi; null, gdy pracownik nie jest podwładnym przełożonego. */
export async function loadPrepData(supervisorId: string, employeeId: string): Promise<PrepData | null> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, supervisorId },
    select: { id: true, firstName: true, lastName: true, position: { select: { title: true, dominantTasks: true } } },
  });
  if (!employee) return null;

  const record = currentEvaluation(await listHrRecords({ employeeIds: [employee.id] }), employee.id);
  const ev = record
    ? await prisma.evaluation.findUnique({
        where: { id: record.id },
        select: {
          expectations: true,
          goals: true,
          periodStart: true,
          criteria: { orderBy: { order: "asc" }, select: { competency: true, kind: true, ratings: { select: { indicatorId: true, level: true } } } },
        },
      })
    : null;
  // Rozmowa oceniająca dotyczy okresu oceny – notatki sprzed jego początku (poprzedni okres) pomijamy.
  const periodStart = ev?.periodStart ? fromDbDate(ev.periodStart) : undefined;
  const observations = await listObservations(supervisorId, { employeeId, from: periodStart });
  const info = deadlineInfo(record);
  const tasks = Array.isArray(employee.position?.dominantTasks) ? (employee.position!.dominantTasks as unknown[]).filter((t): t is string => typeof t === "string") : [];

  return {
    evaluationId: record?.id ?? null,
    suggested: suggestedKind(record?.type ?? null, record?.status ?? null),
    allowed: allowedKinds(record?.type ?? null),
    input: {
      employeeName: `${employee.firstName} ${employee.lastName}`,
      positionTitle: employee.position?.title ?? null,
      dominantTasks: tasks,
      criteria: (ev?.criteria ?? []).map((c) => ({ competency: c.competency as CompetencyCode, kind: c.kind })),
      ratings: (ev?.criteria ?? []).flatMap((c) => c.ratings.map((r) => ({ indicatorId: r.indicatorId, value: fromDbLevel(r.level) }))),
      observations,
      expectations: ev?.expectations ?? null,
      goals: ev?.goals ?? null,
      previousResult: (record?.previousResult as EvaluationResult | null) ?? null,
      isReevaluation: record?.isReevaluation ?? false,
      deadline: info ? { date: info.deadline.date, label: `${info.text.charAt(0).toLocaleLowerCase("pl")}${info.text.slice(1)}` } : null,
      stage: record
        ? {
            status: record.status as "DO_ROZPOCZECIA" | "W_OKRESIE_OCENY" | "W_OCENIE",
            suggested: suggestedKind(record.type, record.status),
            criteriaSetAt: record.criteriaSetAt,
          }
        : null,
    },
  };
}
