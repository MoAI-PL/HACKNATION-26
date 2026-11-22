"use server";

// Akcje serwerowe ścieżki pierwszej oceny (Z17). Każda sprawdza rolę i dostęp do oceny (Z04), waliduje dane
// tą samą logiką co formularz (src/lib/pierwsza-ocena/przebieg.ts), a wynik liczy od nowa z danych w bazie (Z07).
// Zmiana etapu jest warunkiem w samym zapisie (updateMany z filtrem statusu) – podwójne kliknięcie nic nie psuje.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { fromDbDate, toDbDate, todayIso } from "@/lib/domain/daty";
import type { IsoDate } from "@/lib/domain/types";
import { evaluationAccess } from "@/lib/ocena/dane-kreatora";
import { acknowledgmentIssue } from "@/lib/ocena/podsumowanie";
import { loadFirstEval } from "@/lib/pierwsza-ocena/dane";
import { readReportFile } from "@/lib/pierwsza-ocena/plik";
import {
  completionFormSchema,
  completionIssues,
  firstEvalCriteria,
  initialConversationIssues,
  initialConversationSchema,
  reportFormSchema,
  reportIssues,
  type FormIssue,
} from "@/lib/pierwsza-ocena/przebieg";

const NOT_FOUND = "Nie znaleziono oceny. Odśwież stronę i spróbuj ponownie.";
const STALE = "Etap oceny zmienił się w międzyczasie. Odśwież stronę.";

export type StepResult = { ok: true } | { ok: false; error: string; issues?: FormIssue[] };

async function own(evaluationId: string) {
  const user = await requireRole("PRZELOZONY");
  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, type: "PIERWSZA", ...evaluationAccess(user.id) },
    include: {
      employee: { select: { id: true, employmentStart: true, contractEnd: true, absences: { select: { kind: true, from: true, to: true } } } },
      report: true,
    },
  });
  if (!ev) return { user, ev: null, person: null };
  const person = {
    employmentStart: fromDbDate(ev.employee.employmentStart),
    contractEnd: ev.employee.contractEnd ? fromDbDate(ev.employee.contractEnd) : undefined,
    absences: ev.employee.absences.map((a) => ({ kind: a.kind, from: fromDbDate(a.from), to: fromDbDate(a.to) })),
  };
  return { user, ev, person };
}

function refresh(id: string) {
  revalidatePath("/ocena/pierwsza");
  revalidatePath(`/ocena/pierwsza/${id}`);
  revalidatePath("/pulpit");
  revalidatePath("/kierujacy");
}

/** Rozmowa wstępna (§ 3): data, notatka i wyznaczony termin sprawozdania (§ 4 ust. 1) → „Czeka na sprawozdanie”. */
export async function saveInitialConversation(evaluationId: string, input: unknown): Promise<StepResult> {
  const { user, ev, person } = await own(evaluationId);
  if (!ev || !person) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "DO_ROZPOCZECIA") return { ok: false, error: "Rozmowa wstępna jest już zapisana." };
  const parsed = initialConversationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Uzupełnij daty rozmowy i terminu sprawozdania." };
  const f = parsed.data;
  const issues = initialConversationIssues(f, person, todayIso());
  if (issues.length) return { ok: false, error: "Popraw zaznaczone pola.", issues };

  const done = await prisma.$transaction(async (tx) => {
    const updated = await tx.evaluation.updateMany({
      where: { id: ev.id, status: "DO_ROZPOCZECIA" },
      data: { status: "W_OKRESIE_OCENY", criteriaSetAt: toDbDate(f.date) },
    });
    if (updated.count === 0) return false;
    await tx.evaluationCriterion.createMany({ data: firstEvalCriteria().map((c) => ({ ...c, evaluationId: ev.id })), skipDuplicates: true });
    await tx.conversation.create({
      data: { employeeId: ev.employeeId, evaluationId: ev.id, type: "WSTEPNA", date: toDbDate(f.date), notes: f.notes.trim() || null },
    });
    await tx.firstEvalReport.upsert({
      where: { evaluationId: ev.id },
      create: { evaluationId: ev.id, dueFrom: toDbDate(f.dueFrom), dueTo: toDbDate(f.dueTo) },
      update: { dueFrom: toDbDate(f.dueFrom), dueTo: toDbDate(f.dueTo) },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "ROZMOWA_WSTEPNA",
        entity: "Evaluation",
        entityId: ev.id,
        newValue: { data: f.date, sprawozdanieOd: f.dueFrom, sprawozdanieDo: f.dueTo },
      },
    });
    return true;
  });
  if (!done) return { ok: false, error: STALE };
  refresh(ev.id);
  return { ok: true };
}

/**
 * Sprawozdanie (wpisane albo wgrane z pliku) i egzamin ze służby przygotowawczej → „Do oceny”.
 * Wynik egzaminu nie jest wymagany na tym etapie (egzamin bywa później) – do czasu sporządzenia oceny można go uzupełnić.
 */
export async function saveReport(evaluationId: string, formData: FormData): Promise<StepResult> {
  const { user, ev, person } = await own(evaluationId);
  if (!ev || !person) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "W_OKRESIE_OCENY" && ev.status !== "W_OCENIE") return { ok: false, error: "Sprawozdanie można zapisać po rozmowie wstępnej, przed sporządzeniem oceny." };
  if (!ev.report) return { ok: false, error: "Najpierw zapisz rozmowę wstępną z terminem sprawozdania." };

  const file = await readReportFile(formData.get("file"));
  if (file.status === "error") return { ok: false, error: file.problem, issues: [{ field: "file", text: file.problem }] };
  const str = (k: string) => (typeof formData.get(k) === "string" ? (formData.get(k) as string) : "");
  const parsed = reportFormSchema.safeParse({
    mode: str("mode") || undefined,
    submittedAt: str("submittedAt"),
    content: file.status === "ok" ? file.text : str("content"),
    fileName: file.status === "ok" ? file.fileName : str("keepFileName"),
    exam: str("exam") || undefined,
    examExemption: str("examExemption") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane formularza." };
  const f = parsed.data;
  const ctx = { ...person, dueFrom: fromDbDate(ev.report.dueFrom), dueTo: fromDbDate(ev.report.dueTo) };
  const issues = reportIssues(f, ctx, todayIso());
  if (issues.length) return { ok: false, error: "Popraw zaznaczone pola.", issues };

  const submitted = f.mode === "ZLOZONE";
  const done = await prisma.$transaction(async (tx) => {
    const updated = await tx.evaluation.updateMany({
      where: { id: ev.id, status: { in: ["W_OKRESIE_OCENY", "W_OCENIE"] } },
      data: {
        status: "W_OCENIE",
        // Egzamin może się jeszcze nie odbyć – wtedy zostaje pusty i blokuje dopiero sporządzenie oceny.
        examResult: f.exam ?? null,
        examExemption: f.exam === "NIE_DOTYCZY" ? f.examExemption! : null,
      },
    });
    if (updated.count === 0) return false;
    await tx.evaluationCriterion.createMany({ data: firstEvalCriteria().map((c) => ({ ...c, evaluationId: ev.id })), skipDuplicates: true });
    await tx.firstEvalReport.update({
      where: { evaluationId: ev.id },
      data: {
        submittedAt: submitted ? toDbDate(f.submittedAt as IsoDate) : null,
        content: submitted ? f.content.trim() || null : null,
        fileName: submitted ? f.fileName.trim() || null : null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "SPRAWOZDANIE_I_EGZAMIN",
        entity: "Evaluation",
        entityId: ev.id,
        newValue: {
          sprawozdanie: submitted ? f.submittedAt : "nie złożono",
          plik: submitted ? f.fileName || null : null,
          egzamin: f.exam ?? "jeszcze się nie odbył",
          zwolnienie: f.exam === "NIE_DOTYCZY" ? f.examExemption : null,
        },
      },
    });
    return true;
  });
  if (!done) return { ok: false, error: STALE };
  refresh(ev.id);
  return { ok: true };
}

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Autozapis uzasadnienia i wniosków rozwojowych przed sporządzeniem oceny. */
export async function saveCompletionDraft(evaluationId: string, input: unknown): Promise<SaveResult> {
  const { ev } = await own(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "W_OCENIE") return { ok: false, error: "Ocena jest już sporządzona – pól nie można zmieniać." };
  const parsed = completionFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane formularza." };
  // Warunek statusu w zapisie: spóźniony autozapis nie nadpisze pól oceny sporządzonej w międzyczasie.
  const saved = await prisma.evaluation.updateMany({
    where: { id: ev.id, status: "W_OCENIE" },
    data: { justification: parsed.data.justification.trim() || null, developmentPlan: parsed.data.developmentPlan.trim() || null },
  });
  if (saved.count === 0) return { ok: false, error: "Ocena jest już sporządzona – pól nie można zmieniać." };
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Sporządzenie pierwszej oceny: wynik z § 10 liczony od nowa, uzasadnienie (obowiązkowe przy negatywnej) → „Czeka na zapoznanie”. */
export async function completeFirstEval(evaluationId: string, input: unknown): Promise<StepResult> {
  const { user, ev } = await own(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "W_OCENIE") return { ok: false, error: "Ocenę można sporządzić po zapisaniu sprawozdania i ocenie elementów." };
  const parsed = completionFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane formularza." };
  const f = parsed.data;

  const data = await loadFirstEval(ev.id, user.id);
  if (!data) return { ok: false, error: NOT_FOUND };
  if (!data.summary.complete) return { ok: false, error: `Brakuje: ${data.summary.missing.join(", ")}.` };
  const result = data.summary.result;
  const issues = completionIssues(f, { ...data.employee, result, reportSubmittedAt: data.report.submittedAt, today: data.today });
  if (issues.length) return { ok: false, error: "Uzupełnij brakujące elementy, zanim sporządzisz ocenę.", issues };

  const evaluatedAt = toDbDate(f.evaluatedAt as IsoDate);
  const done = await prisma.$transaction(async (tx) => {
    const updated = await tx.evaluation.updateMany({
      where: { id: ev.id, status: "W_OCENIE" },
      data: {
        status: "CZEKA_NA_ZAPOZNANIE",
        evaluatedAt,
        periodEnd: evaluatedAt,
        result: result.result,
        average: result.average,
        overallLevel: null,
        justification: f.justification.trim() || null,
        developmentPlan: result.result === "POZYTYWNA" ? f.developmentPlan.trim() || null : null,
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
          rodzaj: "PIERWSZA",
          wynik: result.result,
          ocenaLaczna: result.average,
          oceny: data.elements.map((e) => ({ element: e.competency, punkty: e.score })),
          egzamin: data.exam,
          sprawozdanieWTerminie: data.report.onTime,
        },
      },
    });
    return true;
  });
  if (!done) return { ok: false, error: "Ta ocena jest już sporządzona. Odśwież stronę." };
  refresh(ev.id);
  return { ok: true };
}

/** Zapoznanie ocenianego z pierwszą oceną → „Zakończona”. Dalsze zatrudnienie (umowa na czas nieokreślony) prowadzi HR. */
export async function acknowledgeFirstEval(evaluationId: string, ackDate: string): Promise<StepResult> {
  const { user, ev } = await own(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "CZEKA_NA_ZAPOZNANIE" || !ev.evaluatedAt) return { ok: false, error: "Ta ocena nie czeka na zapoznanie." };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(ackDate) ? (ackDate as IsoDate) : undefined;
  const problem = acknowledgmentIssue(date, fromDbDate(ev.evaluatedAt), todayIso());
  if (problem) return { ok: false, error: problem };

  const done = await prisma.$transaction(async (tx) => {
    const updated = await tx.evaluation.updateMany({
      where: { id: ev.id, status: "CZEKA_NA_ZAPOZNANIE" },
      data: { status: "ZAKONCZONA", acknowledgedAt: toDbDate(date!) },
    });
    if (updated.count === 0) return false;
    await tx.auditLog.create({
      data: { userId: user.id, action: "ZAPOZNANIE_Z_OCENA", entity: "Evaluation", entityId: ev.id, newValue: { data: date, potwierdzil: "PRZELOZONY" } },
    });
    return true;
  });
  if (!done) return { ok: false, error: "Zapoznanie się z tą oceną jest już odnotowane. Odśwież stronę." };
  refresh(ev.id);
  return { ok: true };
}
