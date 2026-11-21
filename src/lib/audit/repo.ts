// Odczyt dziennika decyzji (Z35) – tylko po stronie serwera, tylko dla HR (sprawdza wywołujący).

import { prisma } from "@/lib/db";
import { auditWhere, type AuditFilters, type AuditRow } from "./dziennik";

/** Najnowsze wpisy według filtrów; `limit` chroni ekran przed bardzo długą listą (eksport CSV ma wyższy limit). */
export async function listAudit(f: AuditFilters, limit: number): Promise<AuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: auditWhere(f),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, role: true } } },
  });
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
  }));
}
