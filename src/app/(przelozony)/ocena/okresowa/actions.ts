"use server";

// Akcje serwerowe kreatora oceny okresowej (Z12). Każda sprawdza rolę i dostęp do oceny (Z04).

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { toDbDate, todayIso } from "@/lib/domain/daty";
import type { PositionDescription, SheetSelection } from "@/lib/domain/types";
import { OspImportError, parseOsp } from "@/lib/import/osp";
import { selectSheet } from "@/lib/rules/arkusz";
import { evaluationAccess, loadWizardData } from "@/lib/ocena/dane-kreatora";
import {
  CHECKLIST_ITEMS,
  completionIssues,
  criteriaForSheet,
  draftSchema,
  effectiveSheet,
  type StepIssue,
  type WizardDraft,
} from "@/lib/ocena/kreator-okresowej";

const MAX_OSP_BYTES = 5 * 1024 * 1024;

async function ownEvaluation(evaluationId: string) {
  const user = await requireRole("PRZELOZONY");
  const ev = await prisma.evaluation.findFirst({
    where: { id: evaluationId, type: "OKRESOWA", ...evaluationAccess(user.id) },
    select: { id: true, status: true, employeeId: true, sheet: true },
  });
  return { user, ev };
}

const NOT_FOUND = "Nie znaleziono oceny. Odśwież stronę i spróbuj ponownie.";
const ALREADY_SET = "Kryteria tej oceny są już ustalone – kreatora nie można zmienić.";

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

/** Autozapis szkicu kreatora (Evaluation.wizardState i ostatni krok). */
export async function saveDraft(evaluationId: string, draft: WizardDraft): Promise<SaveResult> {
  const { ev } = await ownEvaluation(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "DO_ROZPOCZECIA") return { ok: false, error: ALREADY_SET };
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "Nie udało się zapisać zmian – niepoprawne dane formularza." };
  await prisma.evaluation.update({
    where: { id: ev.id },
    data: { wizardState: parsed.data as Prisma.InputJsonValue, lastWizardStep: String(parsed.data.step) },
  });
  return { ok: true, savedAt: new Date().toISOString() };
}

export type OspUploadResult =
  | { ok: true; position: PositionDescription; sheetFromOsp: SheetSelection; fileName: string; warnings: string[] }
  | { ok: false; error: string; problems?: string[] };

/** Wgranie OSP (.docx): odczyt, zapis stanowiska i przypisanie go ocenianemu. */
export async function uploadOsp(evaluationId: string, form: FormData): Promise<OspUploadResult> {
  const { user, ev } = await ownEvaluation(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "DO_ROZPOCZECIA") return { ok: false, error: ALREADY_SET };

  const file = form.get("plik");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Wybierz plik OSP w formacie .docx." };
  if (file.size > MAX_OSP_BYTES) return { ok: false, error: "Plik OSP może mieć najwyżej 5 MB." };
  if (!file.name.toLowerCase().endsWith(".docx")) return { ok: false, error: "OSP musi być plikiem Worda (.docx)." };

  let parsed;
  try {
    parsed = parseOsp(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof OspImportError) return { ok: false, error: "Nie udało się odczytać opisu stanowiska.", problems: e.problems };
    return { ok: false, error: "Nie udało się odczytać pliku. Sprawdź, czy to opis stanowiska pracy w formacie .docx." };
  }
  const p = parsed.position;
  await prisma.$transaction(async (tx) => {
    const position = await tx.position.create({
      data: {
        title: p.title,
        purpose: p.purpose,
        dominantTasks: p.dominantTasks,
        otherTasks: p.otherTasks,
        subordinates: p.subordinates,
        authorizations: p.authorizations ?? null,
        requiredCompetencies: p.requiredCompetencies,
        rawText: parsed.rawText,
        sourceFileName: file.name,
      },
    });
    await tx.employee.update({ where: { id: ev.employeeId }, data: { positionId: position.id } });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "IMPORT_OSP",
        entity: "Evaluation",
        entityId: ev.id,
        newValue: { positionId: position.id, plik: file.name, arkusz: parsed.sheet.sheet },
      },
    });
  });
  revalidatePath(`/ocena/okresowa/${ev.id}`);
  return { ok: true, position: p, sheetFromOsp: selectSheet(p.subordinates), fileName: file.name, warnings: parsed.warnings };
}

export interface AiDecisionInput {
  decision: "WSTAW" | "ODRZUC";
  /** Propozycja AI (kryteria z uzasadnieniem i cytatem). */
  proposal: unknown;
  /** Co przełożony faktycznie wstawił. */
  final?: unknown;
  mode?: "AI" | "BEZ_AI";
}

/** Każde „Wstaw” i „Odrzuć” propozycji AI trafia do dziennika decyzji (sekcja 4.2). */
export async function logAiDecision(evaluationId: string, input: AiDecisionInput): Promise<{ ok: boolean }> {
  const { user, ev } = await ownEvaluation(evaluationId);
  if (!ev) return { ok: false };
  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: input.decision === "WSTAW" ? "AI_WSTAW" : "AI_ODRZUC",
        entity: "Evaluation",
        entityId: ev.id,
        aiProposal: { funkcja: "KRYTERIA_DODATKOWE_Z_OSP", tryb: input.mode ?? "AI", propozycja: input.proposal } as Prisma.InputJsonValue,
        humanDecision: { decyzja: input.decision, wstawiono: input.final ?? null } as Prisma.InputJsonValue,
      },
    });
    return { ok: true };
  } catch (e) {
    console.warn("Nie udało się zapisać decyzji AI w dzienniku:", (e as Error).message);
    return { ok: false };
  }
}

export type CompleteResult = { ok: true } | { ok: false; error: string; issues?: StepIssue[] };

/** Zatwierdzenie części I: arkusz, kryteria, rozmowa rozpoczynająca i termin oceny (§ 5 ust. 3, § 6). */
export async function completePartOne(evaluationId: string, draft: WizardDraft): Promise<CompleteResult> {
  const { user, ev } = await ownEvaluation(evaluationId);
  if (!ev) return { ok: false, error: NOT_FOUND };
  if (ev.status !== "DO_ROZPOCZECIA") return { ok: false, error: ALREADY_SET };
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane formularza. Odśwież stronę i spróbuj ponownie." };
  const d = parsed.data;

  const data = await loadWizardData(ev.id, user.id);
  if (!data) return { ok: false, error: NOT_FOUND };
  const sheetFromOsp = data.sheetFromOsp?.sheet ?? null;
  const issues = completionIssues({ draft: d, sheetFromOsp, today: todayIso() });
  if (issues.length) return { ok: false, error: "Uzupełnij brakujące elementy, zanim zatwierdzisz część I.", issues };
  if (!data.deadlines) {
    return {
      ok: false,
      error: "Brakuje daty poprzedniej oceny albo zatrudnienia na czas nieokreślony – bez niej nie da się wyznaczyć terminu oceny. Poproś HR o uzupełnienie kartoteki.",
    };
  }

  const sheet = effectiveSheet(d, sheetFromOsp)!;
  const criteria = criteriaForSheet(sheet, d.additional);
  const conversationDate = toDbDate(d.conversationDate!);
  const dueDate = toDbDate(data.deadlines.evaluation.date);
  const overridden = sheet !== sheetFromOsp;
  const checklist = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, !!d.checklist[i.key]]));

  const started = await prisma.$transaction(async (tx) => {
    // Warunek na etap w samym zapisie – podwójne kliknięcie „Zatwierdź” nie utworzy drugiej rozmowy ani drugiego wpisu.
    const claimed = await tx.evaluation.updateMany({ where: { id: ev.id, status: "DO_ROZPOCZECIA" }, data: { status: "W_OKRESIE_OCENY" } });
    if (claimed.count === 0) return false;
    await tx.evaluationCriterion.deleteMany({ where: { evaluationId: ev.id } });
    await tx.evaluation.update({
      where: { id: ev.id },
      data: {
        sheet,
        sheetOverridden: overridden,
        status: "W_OKRESIE_OCENY",
        criteriaSetAt: conversationDate,
        periodStart: conversationDate,
        dueDate,
        isReevaluation: data.deadlines!.reevaluation,
        startChecklist: checklist,
        expectations: d.expectations.trim() || null,
        goals: d.checklist.cele ? d.goals.trim() || null : null,
        wizardState: d as Prisma.InputJsonValue,
        lastWizardStep: String(d.step),
        criteria: {
          create: criteria.map((c, order) => ({ competency: c.competency, kind: c.kind, selectionReason: c.reason ?? null, order })),
        },
      },
    });
    await tx.conversation.create({
      data: {
        employeeId: ev.employeeId,
        evaluationId: ev.id,
        type: "ROZPOCZYNAJACA",
        date: conversationDate,
        notes: [d.expectations.trim() && `Oczekiwania: ${d.expectations.trim()}`, d.checklist.cele && d.goals.trim() && `Cele: ${d.goals.trim()}`]
          .filter(Boolean)
          .join("\n") || null,
      },
    });
    if (overridden) {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "ZMIANA_ARKUSZA",
          entity: "Evaluation",
          entityId: ev.id,
          oldValue: { arkusz: sheetFromOsp },
          newValue: { arkusz: sheet },
          reason: d.sheetChangeReason.trim(),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "USTALENIE_KRYTERIOW",
        entity: "Evaluation",
        entityId: ev.id,
        newValue: {
          arkusz: sheet,
          kryteria: criteria.map((c) => ({ kryterium: c.competency, rodzaj: c.kind })),
          dataRozmowy: d.conversationDate,
          terminOceny: data.deadlines!.evaluation.date,
        },
      },
    });
    return true;
  });
  if (!started) return { ok: false, error: ALREADY_SET };

  revalidatePath("/ocena/okresowa");
  revalidatePath(`/ocena/okresowa/${ev.id}`);
  revalidatePath("/pulpit");
  return { ok: true };
}
