// Zapoznanie ocenianego z oceną (§ 12 rozp. o ocenach okresowych) – wspólna logika dla przełożonego (Z15:
// odnotowuje datę zapoznania) i ocenianego (Z46: potwierdza zapoznanie się na swoim ekranie).
// Ocena przechodzi do „Zakończona”, a dla kolejnego okresu powstaje nowa ocena okresowa do ustalenia kryteriów
// (po ocenie negatywnej – ponowna, art. 81 ust. 9). Każde zapoznanie trafia do dziennika zdarzeń.
// Zwraca false, gdy ocena nie czekała już na zapoznanie (ktoś potwierdził je wcześniej).

import type { Prisma } from "@prisma/client";
import type { EvaluationResult, IsoDate } from "@/lib/domain/types";
import { toDbDate } from "@/lib/domain/daty";

export type AcknowledgedBy = "PRZELOZONY" | "OCENIANY";

export interface AcknowledgeInput {
  id: string;
  employeeId: string;
  evaluatorId: string;
  sheet: "A" | "B" | "C" | "PIERWSZA";
  result: EvaluationResult | null;
}

export async function applyAcknowledgment(
  tx: Prisma.TransactionClient,
  ev: AcknowledgeInput,
  ackDate: IsoDate,
  userId: string,
  by: AcknowledgedBy,
): Promise<boolean> {
  // Warunek na etap w samym zapisie: przy dwóch równoczesnych potwierdzeniach (przełożony i oceniany, podwójne kliknięcie)
  // tylko pierwsze zmieni ocenę – drugie nie utworzy kolejnej oceny ani drugiego wpisu w dzienniku.
  const updated = await tx.evaluation.updateMany({
    where: { id: ev.id, status: "CZEKA_NA_ZAPOZNANIE" },
    data: { status: "ZAKONCZONA", acknowledgedAt: toDbDate(ackDate) },
  });
  if (updated.count === 0) return false;
  const open = await tx.evaluation.count({
    where: { employeeId: ev.employeeId, type: "OKRESOWA", status: { not: "ZAKONCZONA" }, id: { not: ev.id } },
  });
  if (open === 0) {
    await tx.evaluation.create({
      data: {
        employeeId: ev.employeeId,
        evaluatorId: ev.evaluatorId,
        type: "OKRESOWA",
        sheet: ev.sheet,
        status: "DO_ROZPOCZECIA",
        isReevaluation: ev.result === "NEGATYWNA",
      },
    });
  }
  await tx.auditLog.create({
    data: { userId, action: "ZAPOZNANIE_Z_OCENA", entity: "Evaluation", entityId: ev.id, newValue: { data: ackDate, potwierdzil: by } },
  });
  return true;
}
