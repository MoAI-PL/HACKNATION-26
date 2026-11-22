"use server";
// Akcje serwerowe szybkiej notatki (Z41). Autoryzacja w każdej akcji (Z04): tylko przełożony i tylko własni podwładni.

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { toDbDate, todayIso } from "@/lib/domain/daty";
import type { IsoDate } from "@/lib/domain/types";
import { competencyOptions } from "@/components/obserwacje/form-data";
import type { CompetencyOption } from "@/components/obserwacje/ObservationForm";
import {
  MAX_NOTE_LENGTH,
  proposeQuickNote,
  validateQuickNote,
  type QuickNoteErrors,
  type QuickNoteProposal,
} from "@/lib/ai/funkcje/szybka-notatka";

export interface QuickNoteContext {
  people: { id: string; name: string }[];
  competencies: CompetencyOption[];
  today: IsoDate;
}

export type QuickNoteProposalResult = { ok: true; proposal: QuickNoteProposal } | { ok: false; message: string };

export type QuickNoteSaveResult =
  | { ok: true; id: string; employeeId: string; employeeName: string; pinned: boolean }
  | { ok: false; errors: QuickNoteErrors; message: string };

async function subordinates(supervisorId: string) {
  return prisma.employee.findMany({
    where: { supervisorId },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

/** Dane do okna notatki: podwładni i model kompetencji (ładowane przy pierwszym otwarciu). */
export async function quickNoteContextAction(): Promise<QuickNoteContext> {
  const user = await requireRole("PRZELOZONY");
  const people = await subordinates(user.id);
  return {
    people: people.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })),
    competencies: competencyOptions(),
    today: todayIso(),
  };
}

// Prosty limit zapytań do modelu na użytkownika (chroni darmowy limit dostawcy).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

/** Propozycja AI: pracownik, wskaźnik, SDR i poziom zachowania. Imiona nie trafiają do modelu. */
export async function proposeQuickNoteAction(note: string): Promise<QuickNoteProposalResult> {
  const user = await requireRole("PRZELOZONY");
  const text = String(note ?? "").trim();
  if (!text) return { ok: false, message: "Wpisz notatkę – wystarczy jedno zdanie." };
  if (text.length > MAX_NOTE_LENGTH) return { ok: false, message: `Notatka może mieć najwyżej ${MAX_NOTE_LENGTH} znaków.` };

  const people = await subordinates(user.id);
  if (rateLimited(user.id)) {
    const proposal = await proposeQuickNote(text, people, { llm: null });
    return { ok: true, proposal: { ...proposal, notice: "Zbyt wiele notatek w krótkim czasie – tę zapisz bez AI, przypniesz ją później." } };
  }
  return { ok: true, proposal: await proposeQuickNote(text, people) };
}

/** Zapis notatki. Z propozycji AI (`fromAi`) – źródło SZYBKA_AI i wpis w dzienniku decyzji. */
export async function saveQuickNoteAction(input: {
  employeeId: string;
  date?: string;
  originalText: string;
  indicatorId?: string | null;
  behaviorLevel?: number | null;
  situation?: string | null;
  action?: string | null;
  outcome?: string | null;
  fromAi?: boolean;
  /** Propozycja AI przed poprawkami przełożonego (do AuditLog). */
  proposal?: Partial<QuickNoteProposal>;
}): Promise<QuickNoteSaveResult> {
  const user = await requireRole("PRZELOZONY");
  const today = todayIso();
  const result = validateQuickNote({ ...input, date: input.date ?? today }, today);
  if (!result.ok) return { ok: false, errors: result.errors, message: "Popraw zaznaczone pola – notatka nie została zapisana." };
  const d = result.data;

  const employee = await prisma.employee.findFirst({
    where: { id: d.employeeId, supervisorId: user.id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return { ok: false, errors: { employeeId: "Notatki dodajesz tylko swoim pracownikom. Wybierz osobę z listy." }, message: "Wybierz pracownika z listy." };
  }

  const created = await prisma.observation.create({
    data: {
      employeeId: d.employeeId,
      authorId: user.id,
      date: toDbDate(d.date),
      competency: d.competency,
      indicatorId: d.indicatorId,
      behaviorLevel: d.behaviorLevel,
      situation: d.situation,
      action: d.action,
      outcome: d.outcome,
      originalText: d.originalText,
      source: d.source,
    },
    select: { id: true },
  });

  if (input.fromAi && input.proposal) {
    const p = input.proposal;
    // Ten sam kształt co wspólna akcja logAiDecision (Z10), żeby dziennik decyzji (Z35) pokazywał wszystko jednolicie.
    const aiProposal = {
      funkcja: "SZYBKA_NOTATKA",
      tryb: "AI",
      propozycja: {
        pracownik: p.employeeId ?? null,
        wskaznik: p.indicatorId ?? null,
        poziom: p.behaviorLevel ?? null,
        sytuacja: p.situation ?? "",
        dzialanie: p.action ?? "",
        rezultat: p.outcome ?? "",
        model: p.model ?? null,
      },
    } satisfies Prisma.InputJsonValue;
    const final = {
      pracownik: d.employeeId,
      wskaznik: d.indicatorId,
      poziom: d.behaviorLevel,
      sytuacja: d.situation,
      dzialanie: d.action,
      rezultat: d.outcome,
    } satisfies Prisma.InputJsonValue;
    await prisma.auditLog
      .create({ data: { userId: user.id, action: "AI_WSTAW", entity: "Observation", entityId: created.id, aiProposal, humanDecision: final, reason: "Szybka notatka (Z41)" } })
      .catch(() => undefined); // dziennik nie może zablokować zapisu notatki
  }

  revalidatePath("/obserwacje");
  revalidatePath("/pulpit");
  return { ok: true, id: created.id, employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, pinned: !!d.indicatorId };
}

/** Odrzucenie propozycji AI – zapis decyzji (sekcja 4.2). */
export async function rejectQuickNoteProposalAction(proposal: Partial<QuickNoteProposal>): Promise<void> {
  const user = await requireRole("PRZELOZONY");
  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        action: "AI_ODRZUC",
        entity: "Observation",
        aiProposal: {
          funkcja: "SZYBKA_NOTATKA",
          tryb: "AI",
          propozycja: { wskaznik: proposal.indicatorId ?? null, poziom: proposal.behaviorLevel ?? null, model: proposal.model ?? null },
        },
        reason: "Szybka notatka (Z41)",
      },
    })
    .catch(() => undefined);
}
