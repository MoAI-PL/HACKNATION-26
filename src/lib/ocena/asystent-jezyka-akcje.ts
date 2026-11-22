"use server";
// Akcja serwerowa asystenta języka. Tylko przełożony i tylko w ocenie, którą sam prowadzi.

import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { MAX_REWRITE_LENGTH, rewriteToBehavior, type RewriteField, type RewriteResult } from "@/lib/ai/funkcje/asystent-jezyka";

const FIELDS: readonly RewriteField[] = ["UZASADNIENIE", "IPRZ", "WNIOSEK_O_STOPIEN"];

// Prosty limit zapytań do modelu na użytkownika (chroni darmowy limit dostawcy).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

export type RewriteActionResult = { ok: true; result: RewriteResult } | { ok: false; message: string };

/** Przeformułowanie tekstu z pola oceny na opis zachowań. Imiona ocenianego i zespołu nie trafiają do modelu. */
export async function rewriteLanguageAction(evaluationId: string, field: RewriteField, text: string): Promise<RewriteActionResult> {
  const user = await requireRole("PRZELOZONY");
  if (!FIELDS.includes(field)) return { ok: false, message: "Nieznane pole formularza." };
  const value = String(text ?? "");
  if (!value.trim()) return { ok: false, message: "Pole jest puste." };
  if (value.length > MAX_REWRITE_LENGTH) return { ok: false, message: `Tekst może mieć najwyżej ${MAX_REWRITE_LENGTH} znaków.` };

  // Cudza ocena wygląda jak nieistniejąca – bez ujawniania danych.
  const evaluation = await prisma.evaluation.findFirst({
    where: { id: evaluationId, evaluatorId: user.id },
    select: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!evaluation) return { ok: false, message: "Nie znaleziono oceny." };

  const team = await prisma.employee.findMany({ where: { supervisorId: user.id }, select: { id: true, firstName: true, lastName: true } });
  const people = [evaluation.employee, ...team.filter((t) => t.id !== evaluation.employee.id)];

  if (rateLimited(user.id)) {
    return { ok: true, result: { ...(await rewriteToBehavior(value, field, { llm: null })), notice: "Zbyt wiele zapytań w krótkim czasie – skorzystaj z podpowiedzi pod polem." } };
  }
  return { ok: true, result: await rewriteToBehavior(value, field, { people }) };
}
