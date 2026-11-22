"use server";

// Akcja ocenianego: potwierdzenie zapoznania się z oceną (§ 12 ust. 1).
// Rola OCENIANY sprawdzana na serwerze; tylko własna ocena czekająca na zapoznanie; data = dzisiaj.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { fromDbDate, todayIso } from "@/lib/domain/daty";
import { acknowledgmentIssue } from "@/lib/ocena/podsumowanie";
import { applyAcknowledgment } from "@/lib/ocena/zapoznanie";
import { ownScope } from "./dane";

export type OwnAckResult = { ok: true } | { ok: false; error: string };

export async function acknowledgeOwnEvaluation(evaluationId: string): Promise<OwnAckResult> {
  const user = await requireRole("OCENIANY");
  if (typeof evaluationId !== "string" || !evaluationId) return { ok: false, error: "Nie znaleziono oceny." };

  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, ...ownScope(user.id) },
    select: { id: true, employeeId: true, evaluatorId: true, sheet: true, result: true, status: true, evaluatedAt: true },
  });
  if (!ev) return { ok: false, error: "Nie znaleziono oceny." };
  if (ev.status !== "CZEKA_NA_ZAPOZNANIE" || !ev.evaluatedAt) return { ok: false, error: "Ta ocena nie czeka na zapoznanie." };

  const today = todayIso();
  const problem = acknowledgmentIssue(today, fromDbDate(ev.evaluatedAt), today);
  if (problem) return { ok: false, error: problem };

  const applied = await prisma.$transaction((tx) => applyAcknowledgment(tx, ev, today, user.id, "OCENIANY"));
  if (!applied) return { ok: false, error: "Zapoznanie się z tą oceną jest już potwierdzone. Odśwież stronę." };
  revalidatePath("/moje-oceny");
  revalidatePath(`/moje-oceny/${ev.id}`);
  revalidatePath("/ocena/okresowa");
  revalidatePath("/ocena/pierwsza");
  revalidatePath("/pulpit");
  return { ok: true };
}
