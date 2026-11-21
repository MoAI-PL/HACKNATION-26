// Panel HR (Z18): odczyt i zapis w bazie. HR widzi wszystkie oceny i przypomnienia w urzędzie.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromDbDate, toDbDate } from "@/lib/domain/daty";
import type { EvaluationResult } from "@/lib/domain/types";
import type { HrEvaluationRecord, ReminderDraft } from "./panel";

const evaluationSelect = {
  id: true,
  employeeId: true,
  evaluatorId: true,
  type: true,
  sheet: true,
  status: true,
  isReevaluation: true,
  criteriaSetAt: true,
  evaluatedAt: true,
  acknowledgedAt: true,
  result: true,
  previousDate: true,
  previousResult: true,
  evaluator: { select: { name: true, email: true } },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employmentStart: true,
      permanentFrom: true,
      contractEnd: true,
      orgUnit: { select: { name: true } },
      absences: { select: { kind: true, from: true, to: true }, orderBy: { from: "asc" } },
    },
  },
} satisfies Prisma.EvaluationSelect;

type Row = Prisma.EvaluationGetPayload<{ select: typeof evaluationSelect }>;
const iso = (d: Date | null) => (d ? fromDbDate(d) : null);

/** Wszystkie oceny z danymi do terminów; historia wyników liczona w pamięci (dane jednego urzędu są małe). */
/** Oceny z danymi do liczenia terminów. Bez warunku – wszystkie (HR); z warunkiem – np. pierwsze oceny w komórce kierującego. */
export async function listHrRecords(where: Prisma.EvaluationWhereInput = {}): Promise<HrEvaluationRecord[]> {
  const rows: Row[] = await prisma.evaluation.findMany({ where, select: evaluationSelect });

  const completedByEmployee = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.status !== "ZAKONCZONA" || !r.evaluatedAt) continue;
    const list = completedByEmployee.get(r.employeeId) ?? [];
    list.push(r);
    completedByEmployee.set(r.employeeId, list);
  }
  for (const list of completedByEmployee.values()) list.sort((a, b) => b.evaluatedAt!.getTime() - a.evaluatedAt!.getTime());

  return rows.map((r) => {
    const history = completedByEmployee.get(r.employeeId) ?? [];
    const previous = r.previousDate ? history.find((h) => h.evaluatedAt!.getTime() === r.previousDate!.getTime()) : undefined;
    return {
      id: r.id,
      type: r.type,
      sheet: r.sheet,
      status: r.status,
      isReevaluation: r.isReevaluation,
      criteriaSetAt: iso(r.criteriaSetAt),
      evaluatedAt: iso(r.evaluatedAt),
      acknowledgedAt: iso(r.acknowledgedAt),
      result: r.result,
      previousDate: iso(r.previousDate),
      previousResult: r.previousResult,
      previousAcknowledgedAt: iso(previous?.acknowledgedAt ?? null),
      evaluatorId: r.evaluatorId,
      evaluatorName: r.evaluator.name ?? r.evaluator.email,
      employee: {
        id: r.employee.id,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        orgUnit: r.employee.orgUnit?.name ?? null,
        employmentStart: fromDbDate(r.employee.employmentStart),
        permanentFrom: iso(r.employee.permanentFrom),
        contractEnd: iso(r.employee.contractEnd),
        absences: r.employee.absences.map((a) => ({ kind: a.kind, from: fromDbDate(a.from), to: fromDbDate(a.to) })),
        pastResults: history.map((h) => h.result).filter((x): x is EvaluationResult => x !== null),
      },
    };
  });
}

export interface ReminderView {
  id: string;
  recipientName: string;
  recipientEmail: string;
  employeeId: string | null;
  employeeName: string | null;
  kind: string;
  dueDate: string;
  subject: string;
  body: string;
  sentAt: Date | null;
}

export async function listReminders(): Promise<ReminderView[]> {
  const rows = await prisma.reminder.findMany({
    select: {
      id: true,
      employeeId: true,
      kind: true,
      dueDate: true,
      subject: true,
      body: true,
      sentAt: true,
      recipient: { select: { name: true, email: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    recipientName: r.recipient.name ?? r.recipient.email,
    recipientEmail: r.recipient.email,
    employeeId: r.employeeId,
    employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : null,
    kind: r.kind,
    dueDate: fromDbDate(r.dueDate),
    subject: r.subject,
    body: r.body,
    sentAt: r.sentAt,
  }));
}

/** Symulacja wysyłki: znacznik „wysłano” i wpis w dzienniku zdarzeń. Zwraca false, gdy przypomnienia nie ma albo już wysłano. */
export async function markReminderSent(hrUserId: string, id: string, now: Date = new Date()): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.reminder.updateMany({ where: { id, sentAt: null }, data: { sentAt: now } });
    if (r.count === 0) return false;
    await tx.auditLog.create({ data: { userId: hrUserId, action: "PRZYPOMNIENIE_WYSLANE", entity: "Reminder", entityId: id, newValue: { sentAt: now.toISOString(), symulacja: true } } });
    return true;
  });
}

export async function createReminder(input: { recipientId: string; employeeId: string; evaluationId: string; draft: ReminderDraft }): Promise<string> {
  const row = await prisma.reminder.create({
    data: {
      recipientId: input.recipientId,
      employeeId: input.employeeId,
      evaluationId: input.evaluationId,
      kind: input.draft.kind,
      dueDate: toDbDate(input.draft.dueDate),
      subject: input.draft.subject,
      body: input.draft.body,
    },
    select: { id: true },
  });
  return row.id;
}
