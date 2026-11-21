"use server";

// Akcje serwerowe podsumowania oceny okresowej (Z15). Każda sprawdza rolę i dostęp do oceny (Z04),
// a wynik liczy od nowa z ocen cząstkowych zapisanych w bazie (silnik Z07).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { fromDbDate, toDbDate, todayIso } from "@/lib/domain/daty";
import { evaluationAccess } from "@/lib/ocena/dane-kreatora";
import { loadSummary } from "@/lib/ocena/dane-podsumowania";
import {
  acknowledgmentIssue,
  partThreeAvailable,
  summaryFormSchema,
  summaryIssues,
  missingText,
  type SummaryIssue,
} from "@/lib/ocena/podsumowanie";
import { applyAcknowledgment } from "@/lib/ocena/zapoznanie";

const NOT_FOUND = "Nie znaleziono oceny. Odśwież stronę i spróbuj ponownie.";

async function own(evaluationId: string) {
  const user = await requireRole("PRZELOZONY");
  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, type: "OKRESOWA", ...evaluationAccess(user.id) },
    select: { id: true, status: true, employeeId: true, evaluatorId: true, sheet: true, evaluatedAt: true, result: true },
  });
  return { user, ev };
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Autozapis pól podsumowania (uzasadnienie, wnioski do IPRZ, część III, data) przed sporządzeniem oceny. */
export async function saveSummaryDraft(evaluationId: string, input: unknown): Promise<SaveResult> {
  const { ev } = await own(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "W_OCENIE") return { ok: false, error: "Ocena jest już sporządzona – pól nie można zmieniać." };
  const parsed = summaryFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane formularza." };
  const f = parsed.data;
  await prisma.evaluation.update({
    where: { id: ev.id },
    data: {
      justification: f.justification.trim() || null,
      developmentPlan: f.developmentPlan.trim() || null,
      promotionRequest: f.promotionRequest,
      promotionJustification: f.promotionJustification.trim() || null,
      requestedGrade: f.promotionRequest ? f.requestedGrade : null,
    },
  });
  return { ok: true, savedAt: new Date().toISOString() };
}

export type CompleteResult = { ok: true } | { ok: false; error: string; issues?: SummaryIssue[] };

/** Sporządzenie oceny na piśmie: wynik z silnika, uzasadnienie, IPRZ, część III → „Czeka na zapoznanie”. */
export async function completeEvaluation(evaluationId: string, input: unknown): Promise<CompleteResult> {
  const { user, ev } = await own(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "W_OCENIE") return { ok: false, error: "Ocenę można sporządzić po ocenie wskaźników (etap „Do oceny”)." };
  const parsed = summaryFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane formularza." };
  const f = parsed.data;

  const data = await loadSummary(ev.id, user.id);
  if (!data) return { ok: false, error: NOT_FOUND };
  if (!data.summary.complete) return { ok: false, error: missingText(data.summary.missing) };
  const result = data.summary.result;
  const issues = summaryIssues(f, { result, isCivilServant: data.employee.isCivilServant, today: todayIso(), periodStart: data.periodStart });
  if (issues.length) return { ok: false, error: "Uzupełnij brakujące elementy, zanim sporządzisz ocenę.", issues };

  const promotion = f.promotionRequest && partThreeAvailable(data.employee.isCivilServant, result);
  const evaluatedAt = toDbDate(f.evaluatedAt!);
  const completed = await prisma.$transaction(async (tx) => {
    // Warunek na etap w samym zapisie – podwójne kliknięcie „Sporządź ocenę” nie zapisze oceny dwa razy.
    const updated = await tx.evaluation.updateMany({
      where: { id: ev.id, status: "W_OCENIE" },
      data: {
        status: "CZEKA_NA_ZAPOZNANIE",
        evaluatedAt,
        periodEnd: evaluatedAt,
        result: result.result,
        overallLevel: result.overallLevel,
        average: result.average,
        justification: f.justification.trim() || null,
        developmentPlan: f.developmentPlan.trim(),
        promotionRequest: promotion,
        promotionJustification: promotion ? f.promotionJustification.trim() : null,
        requestedGrade: promotion ? f.requestedGrade : null,
        previousResult: data.previous?.result ?? null,
        previousLevel: data.previous?.level ?? null,
        previousDate: data.previous ? toDbDate(data.previous.date) : null,
      },
    });
    if (updated.count === 0) return false;
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "SPORZADZENIE_OCENY",
        entity: "Evaluation",
        entityId: ev.id,
        newValue: {
          wynik: result.result,
          poziom: result.overallLevel,
          srednia: result.average,
          oceny: data.criteria.map((c) => ({ kryterium: c.competency, punkty: c.score })),
          wniosekOStopien: promotion,
        },
      },
    });
    return true;
  });
  if (!completed) return { ok: false, error: "Ta ocena jest już sporządzona. Odśwież stronę." };
  revalidatePath("/ocena/okresowa");
  revalidatePath(`/ocena/okresowa/${ev.id}`);
  revalidatePath("/pulpit");
  return { ok: true };
}

export type AckResult = { ok: true } | { ok: false; error: string };

/**
 * Zapoznanie ocenianego z oceną (§ 12): „Zakończona”, a dla kolejnego okresu powstaje nowa ocena okresowa
 * do ustalenia kryteriów (po ocenie negatywnej – ponowna, art. 81 ust. 9).
 */
export async function acknowledgeEvaluation(evaluationId: string, ackDate: string): Promise<AckResult> {
  const { user, ev } = await own(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "CZEKA_NA_ZAPOZNANIE" || !ev.evaluatedAt) return { ok: false, error: "Ta ocena nie czeka na zapoznanie." };
  const problem = acknowledgmentIssue(/^\d{4}-\d{2}-\d{2}$/.test(ackDate) ? ackDate : undefined, fromDbDate(ev.evaluatedAt), todayIso());
  if (problem) return { ok: false, error: problem };

  const applied = await prisma.$transaction((tx) => applyAcknowledgment(tx, ev, ackDate, user.id, "PRZELOZONY"));
  if (!applied) return { ok: false, error: "Zapoznanie się z tą oceną jest już odnotowane. Odśwież stronę." };
  revalidatePath("/ocena/okresowa");
  revalidatePath(`/ocena/okresowa/${ev.id}`);
  revalidatePath("/pulpit");
  return { ok: true };
}
