// Dziennik zapytań asystenta (Z22, zasada AI nr 7): pytanie, źródła, odpowiedź, czas, model.
// Brak bazy danych nie może zablokować odpowiedzi – błąd zapisu tylko logujemy.

import type { AssistantAnswer } from "./asystent-formalny";

export async function logAssistantQuery(a: AssistantAnswer, extra: { userId?: string; step?: string } = {}): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.assistantQuery.create({
      data: {
        userId: extra.userId,
        // Z34: w dzienniku zostaje pytanie bez danych osobowych (minimalizacja danych).
        question: a.sentQuestion ?? a.question,
        sources: a.sources.map((s) => ({ id: s.id, unit: s.unit, citation: s.citation })),
        answer: a.answer,
        refused: a.refused,
        step: extra.step,
        model: a.mode === "AI" ? (a.model ?? null) : "BEZ_AI",
        durationMs: a.durationMs,
      },
    });
  } catch (e) {
    console.warn("Nie udało się zapisać zapytania asystenta w dzienniku:", (e as Error).message);
  }
}
