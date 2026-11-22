// Dziennik obserwacji: odczyt i zapis w bazie.
// Zasada dostępu: przełożony widzi i zmienia wyłącznie obserwacje swoich bezpośrednich podwładnych
// (Employee.supervisorId = przełożony). Cudza obserwacja wygląda jak nieistniejąca – bez ujawniania danych.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fromDbDate, toDbDate } from "@/lib/domain/daty";
import type { BehaviorLevel, CompetencyCode } from "@/lib/domain/types";
import type { JournalFilters, ObservationInput, ObservationView } from "./dziennik";

export interface Subordinate {
  id: string;
  name: string;
}

/** Podwładni przełożonego (lista wyboru w formularzu i filtrze), alfabetycznie po nazwisku. */
export async function listSubordinates(supervisorId: string): Promise<Subordinate[]> {
  const rows = await prisma.employee.findMany({
    where: { supervisorId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }));
}

const select = {
  id: true,
  employeeId: true,
  date: true,
  competency: true,
  indicatorId: true,
  behaviorLevel: true,
  situation: true,
  action: true,
  outcome: true,
  originalText: true,
  source: true,
  employee: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ObservationSelect;

type Row = Prisma.ObservationGetPayload<{ select: typeof select }>;

function toView(r: Row): ObservationView {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
    date: fromDbDate(r.date),
    competency: (r.competency as CompetencyCode | null) ?? null,
    indicatorId: r.indicatorId,
    behaviorLevel: (r.behaviorLevel as BehaviorLevel | null) ?? null,
    situation: r.situation,
    action: r.action,
    outcome: r.outcome,
    originalText: r.originalText,
    source: r.source,
  };
}

export async function listObservations(supervisorId: string, f: Omit<JournalFilters, "view">): Promise<ObservationView[]> {
  const rows = await prisma.observation.findMany({
    where: {
      employee: { supervisorId },
      ...(f.employeeId ? { employeeId: f.employeeId } : {}),
      ...(f.competency ? { competency: f.competency } : {}),
      ...(f.from || f.to ? { date: { ...(f.from ? { gte: toDbDate(f.from) } : {}), ...(f.to ? { lte: toDbDate(f.to) } : {}) } } : {}),
    },
    select,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toView);
}

export async function getObservation(supervisorId: string, id: string): Promise<ObservationView | null> {
  const row = await prisma.observation.findFirst({ where: { id, employee: { supervisorId } }, select });
  return row ? toView(row) : null;
}

/** Czy pracownik jest podwładnym przełożonego (warunek każdego zapisu). */
export async function isSubordinate(supervisorId: string, employeeId: string): Promise<boolean> {
  return (await prisma.employee.count({ where: { id: employeeId, supervisorId } })) > 0;
}

function toData(input: ObservationInput) {
  return {
    employeeId: input.employeeId,
    date: toDbDate(input.date),
    competency: input.competency,
    indicatorId: input.indicatorId,
    behaviorLevel: input.behaviorLevel,
    situation: input.situation,
    action: input.action,
    outcome: input.outcome,
  };
}

export async function createObservation(authorId: string, input: ObservationInput): Promise<string> {
  const row = await prisma.observation.create({ data: { ...toData(input), authorId, source: "RECZNA" }, select: { id: true } });
  return row.id;
}

/** Zmiana wpisu – tylko gdy obserwacja należy do podwładnego przełożonego. Zwraca false, gdy jej nie ma. */
export async function updateObservation(supervisorId: string, id: string, input: ObservationInput): Promise<boolean> {
  const r = await prisma.observation.updateMany({ where: { id, employee: { supervisorId } }, data: toData(input) });
  return r.count > 0;
}

export async function deleteObservation(supervisorId: string, id: string): Promise<boolean> {
  const r = await prisma.observation.deleteMany({ where: { id, employee: { supervisorId } } });
  return r.count > 0;
}
