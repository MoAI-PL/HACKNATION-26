"use server";
// Tryb rozmowy: zapis przebiegu rozmowy (`Conversation`) – tylko przełożony, tylko własny podwładny,
// tylko rodzaj rozmowy właściwy dla bieżącej oceny. Notatki do dziennika obserwacji zapisuje szybka notatka.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { fromDbDate, toDbDate, todayIso } from "@/lib/domain/daty";
import { CONVERSATION_KINDS, type ConversationKind } from "./przygotowanie";
import { loadPrepData } from "./repo";
import { appendNotes, conversationSavePlan, MAX_CONVERSATION_NOTES_LENGTH } from "./tryb";

export type SaveConversationResult =
  | { ok: true; appended: boolean }
  | { ok: false; reason: string; /** Gdzie dokończyć zapis (rozmowa rozpoczynająca → kreator oceny okresowej). */ href?: string };

// Dane z przeglądarki – walidacja na serwerze (typy TypeScript nie chronią przed spreparowanym zapytaniem).
const saveSchema = z.object({
  kind: z.enum(CONVERSATION_KINDS as [ConversationKind, ...ConversationKind[]]),
  notes: z
    .string()
    .trim()
    .min(1, "Zapis przebiegu rozmowy jest pusty.")
    .max(MAX_CONVERSATION_NOTES_LENGTH, `Zapis może mieć najwyżej ${MAX_CONVERSATION_NOTES_LENGTH} znaków – skróć notatki.`),
});

export async function saveConversationAction(employeeId: string, raw: unknown): Promise<SaveConversationResult> {
  const user = await requireRole("PRZELOZONY");
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Niepoprawne dane rozmowy." };
  if (typeof employeeId !== "string" || !employeeId) return { ok: false, reason: "Nie wskazano pracownika." };
  const { kind, notes } = parsed.data;

  const data = await loadPrepData(user.id, employeeId);
  if (!data) return { ok: false, reason: "Nie znaleziono tej osoby wśród Twoich pracowników." };
  if (!data.allowed.includes(kind)) return { ok: false, reason: "Ten rodzaj rozmowy nie dotyczy oceny tego pracownika." };

  const today = todayIso();
  const existing = await prisma.conversation.findMany({
    where: { employeeId, evaluationId: data.evaluationId },
    select: { id: true, type: true, date: true, notes: true },
  });
  const plan = conversationSavePlan(
    kind,
    existing.map((c) => ({ id: c.id, type: c.type, date: fromDbDate(c.date) })),
    today,
  );

  if (plan.action === "KREATOR") {
    if (kind === "WSTEPNA") {
      return {
        ok: false,
        reason: "Rozmowę wstępną zapisuje przebieg pierwszej oceny razem z terminem sprawozdania. Skopiuj notatki i dokończ zapis w pierwszej ocenie.",
        href: data.evaluationId ? `/ocena/pierwsza/${encodeURIComponent(data.evaluationId)}` : "/ocena/pierwsza",
      };
    }
    return {
      ok: false,
      reason: "Rozmowę rozpoczynającą zapisuje kreator oceny okresowej razem z kryteriami, oczekiwaniami i celami. Skopiuj notatki i dokończ zapis w kreatorze.",
      href: data.evaluationId ? `/ocena/okresowa/${encodeURIComponent(data.evaluationId)}` : "/ocena/okresowa",
    };
  }
  if (plan.action === "APPEND") {
    const previous = existing.find((c) => c.id === plan.conversationId)?.notes ?? null;
    await prisma.conversation.update({ where: { id: plan.conversationId }, data: { notes: appendNotes(previous, notes) } });
  } else {
    await prisma.conversation.create({
      data: { employeeId, evaluationId: data.evaluationId, type: kind, date: toDbDate(today), notes },
    });
  }
  revalidatePath(`/pulpit/pracownik/${employeeId}`);
  return { ok: true, appended: plan.action === "APPEND" };
}
