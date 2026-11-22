"use server";

// Akcje serwerowe zakończenia oceny (Z14) – wspólne z oceną elementów pierwszej oceny (Z17, skala 3/5/7).
// Każda sprawdza rolę i dostęp do oceny (Z04), a decyzję o ocenie cząstkowej waliduje z sugestią
// policzoną od nowa z ocen zapisanych w bazie.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { fromDbDate } from "@/lib/domain/daty";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import type { CompetencyCode, Explanation } from "@/lib/domain/types";
import { listObservations } from "@/lib/obserwacje/repo";
import { noteCountsByIndicator } from "@/lib/obserwacje/dziennik";
import { evaluationAccess } from "@/lib/ocena/dane-kreatora";
import { assessableStatuses } from "@/lib/ocena/dane-oceny";
import {
  checkDecision,
  decisionInputSchema,
  fromDbLevel,
  ratingInputSchema,
  suggestionFor,
  toDbLevel,
  type RatingsMap,
} from "@/lib/ocena/zakonczenie-oceny";

const NOT_FOUND = "Nie znaleziono oceny. Odśwież stronę i spróbuj ponownie.";
const NOT_ASSESSABLE = "Tej oceny nie można teraz zmieniać – sprawdź jej etap na liście ocen.";

async function assessable(evaluationId: string) {
  const user = await requireRole("PRZELOZONY");
  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, type: { in: ["OKRESOWA", "PIERWSZA"] }, ...evaluationAccess(user.id) },
    select: { id: true, type: true, status: true, employeeId: true, periodStart: true },
  });
  return { user, ev, open: ev ? assessableStatuses(ev.type).includes(ev.status) : false };
}

const pathFor = (ev: { id: string; type: "OKRESOWA" | "PIERWSZA" }) =>
  ev.type === "PIERWSZA" ? `/ocena/pierwsza/${ev.id}` : `/ocena/okresowa/${ev.id}`;

export type RatingResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Autozapis wyboru karty zachowania przy wskaźniku. Zmiana oceny wskaźnika kasuje decyzję kryterium (trzeba ją potwierdzić). */
export async function saveRating(evaluationId: string, input: unknown): Promise<RatingResult> {
  const { ev, open } = await assessable(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (!open) return { ok: false, error: NOT_ASSESSABLE };
  const parsed = ratingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane wskaźnika." };
  const { competency, indicatorId, value } = parsed.data;

  const indicator = competencyModel.getIndicator(indicatorId);
  if (!indicator || indicator.competency !== competency) return { ok: false, error: "Ten wskaźnik nie należy do kryterium." };
  const criterion = await prisma.evaluationCriterion.findFirst({
    where: { evaluationId: ev.id, competency: competency as CompetencyCode },
    select: { id: true },
  });
  if (!criterion) return { ok: false, error: "To kryterium nie należy do tej oceny." };

  await prisma.$transaction(async (tx) => {
    if (value === null) {
      await tx.indicatorRating.deleteMany({ where: { criterionId: criterion.id, indicatorId } });
    } else {
      await tx.indicatorRating.upsert({
        where: { criterionId_indicatorId: { criterionId: criterion.id, indicatorId } },
        create: { criterionId: criterion.id, indicatorId, level: toDbLevel(value) },
        update: { level: toDbLevel(value) },
      });
    }
    await tx.evaluationCriterion.update({ where: { id: criterion.id }, data: { score: null, suggestedScore: null, overrideReason: null } });
    if (ev.status === "W_OKRESIE_OCENY") await tx.evaluation.update({ where: { id: ev.id }, data: { status: "W_OCENIE" } });
  });
  return { ok: true, savedAt: new Date().toISOString() };
}

export type DecisionResult = { ok: true } | { ok: false; error: string; errors?: Explanation[] };

/** Decyzja przełożonego: ocena cząstkowa kryterium; przy różnicy od sugestii – powód i wpis w dzienniku decyzji. */
export async function saveDecision(evaluationId: string, input: unknown, nextStep: number): Promise<DecisionResult> {
  const { user, ev, open } = await assessable(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (!open) return { ok: false, error: NOT_ASSESSABLE };
  const parsed = decisionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane decyzji." };
  const { competency, points, justification } = parsed.data;

  const criterion = await prisma.evaluationCriterion.findFirst({
    where: { evaluationId: ev.id, competency: competency as CompetencyCode },
    include: { ratings: true },
  });
  if (!criterion) return { ok: false, error: "To kryterium nie należy do tej oceny." };

  const def = competencyModel.getCompetency(criterion.competency);
  const ratings: RatingsMap = {};
  for (const r of criterion.ratings) ratings[r.indicatorId] = fromDbLevel(r.level);
  const observations = await listObservations(user.id, {
    employeeId: ev.employeeId,
    from: ev.periodStart ? fromDbDate(ev.periodStart) : undefined,
  });
  const suggestion = suggestionFor(
    { competency: criterion.competency, indicatorIds: def.indicators.map((i) => i.id), ratings },
    noteCountsByIndicator(observations, ev.employeeId),
    undefined,
    ev.type,
  );
  const check = checkDecision(suggestion, points, justification);
  if (!check.valid) return { ok: false, error: "Popraw decyzję.", errors: check.errors };

  const reason = check.differsFromSuggestion ? justification.trim() : null;
  await prisma.$transaction(async (tx) => {
    await tx.evaluationCriterion.update({
      where: { id: criterion.id },
      data: { score: points, suggestedScore: suggestion.suggestedPoints, overrideReason: reason },
    });
    await tx.evaluation.update({
      where: { id: ev.id },
      data: { lastWizardStep: `ocena:${Math.max(0, nextStep)}`, ...(ev.status === "W_OKRESIE_OCENY" ? { status: "W_OCENIE" } : {}) },
    });
    if (check.differsFromSuggestion) {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "ZMIANA_SUGESTII",
          entity: "EvaluationCriterion",
          entityId: criterion.id,
          oldValue: { kryterium: criterion.competency, sugestia: suggestion.suggestedPoints },
          newValue: { kryterium: criterion.competency, ocena: points },
          reason,
        },
      });
    }
  });
  revalidatePath(pathFor(ev));
  return { ok: true };
}

/** Zapamiętanie kryterium, na którym przełożony skończył (wznowienie pracy). */
export async function saveStep(evaluationId: string, step: number): Promise<void> {
  const { ev, open } = await assessable(evaluationId);
  if (!ev || !open) return;
  await prisma.evaluation.update({ where: { id: ev.id }, data: { lastWizardStep: `ocena:${Math.max(0, Math.floor(step))}` } });
}
