// Odczyt dziennika decyzji (Z35) – tylko po stronie serwera, tylko dla HR (sprawdza wywołujący).

import { prisma } from "@/lib/db";
import { auditWhere, type AuditFilters, type AuditRow } from "./dziennik";

type Person = { firstName: string; lastName: string } | null | undefined;
const fullName = (p: Person) => (p ? `${p.firstName} ${p.lastName}` : null);
const ids = (rows: { entity: string; entityId: string | null }[], entity: string) => [
  ...new Set(rows.filter((r) => r.entity === entity && r.entityId).map((r) => r.entityId!)),
];
const person = { select: { firstName: true, lastName: true } } as const;

/**
 * Kogo dotyczą wpisy: pracownik oceny, kryterium, notatki, przypomnienia albo sam pracownik.
 * Jedno zapytanie na rodzaj obiektu (najwyżej pięć, niezależnie od liczby wpisów).
 */
async function subjects(rows: { entity: string; entityId: string | null }[]): Promise<Map<string, string>> {
  const [evaluations, criteria, employees, observations, reminders] = await Promise.all([
    prisma.evaluation.findMany({ where: { id: { in: ids(rows, "Evaluation") } }, select: { id: true, employee: person } }),
    prisma.evaluationCriterion.findMany({ where: { id: { in: ids(rows, "EvaluationCriterion") } }, select: { id: true, evaluation: { select: { employee: person } } } }),
    prisma.employee.findMany({ where: { id: { in: ids(rows, "Employee") } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.observation.findMany({ where: { id: { in: ids(rows, "Observation") } }, select: { id: true, employee: person } }),
    prisma.reminder.findMany({ where: { id: { in: ids(rows, "Reminder") } }, select: { id: true, employee: person, evaluation: { select: { employee: person } } } }),
  ]);
  const out = new Map<string, string>();
  const put = (entity: string, id: string, name: string | null) => name && out.set(`${entity}:${id}`, name);
  for (const e of evaluations) put("Evaluation", e.id, fullName(e.employee));
  for (const c of criteria) put("EvaluationCriterion", c.id, fullName(c.evaluation.employee));
  for (const e of employees) put("Employee", e.id, fullName(e));
  for (const o of observations) put("Observation", o.id, fullName(o.employee));
  for (const r of reminders) put("Reminder", r.id, fullName(r.employee ?? r.evaluation?.employee));
  return out;
}

/** Najnowsze wpisy według filtrów; `limit` chroni ekran przed bardzo długą listą (eksport CSV ma wyższy limit). */
export async function listAudit(f: AuditFilters, limit: number, options: { withSubjects?: boolean } = {}): Promise<AuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: auditWhere(f),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, role: true } } },
  });
  const names = options.withSubjects ? await subjects(rows) : null;
  return rows.map((r) => ({
    createdAt: r.createdAt,
    userName: r.user?.name ?? null,
    userRole: r.user?.role ?? null,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    aiProposal: r.aiProposal,
    humanDecision: r.humanDecision,
    oldValue: r.oldValue,
    newValue: r.newValue,
    reason: r.reason,
    ...(names ? { subject: r.entityId ? (names.get(`${r.entity}:${r.entityId}`) ?? null) : null } : {}),
  }));
}
