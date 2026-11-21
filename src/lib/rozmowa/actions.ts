"use server";
// Akcje asystenta rozmowy (Z24): redakcja przez AI i zapis decyzji „Wstaw / Odrzuć” w dzienniku decyzji (sekcja 4.2).

import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { polishConversation, type PolishResult } from "./ai";
import { buildConversationPrep, CONVERSATION_KINDS, type ConversationKind } from "./przygotowanie";
import { loadPrepData } from "./repo";

const isKind = (k: string): k is ConversationKind => (CONVERSATION_KINDS as string[]).includes(k);

// Prosty limit zapytań do modelu na przełożonego (chroni darmowy limit dostawcy) – jak w asystencie formalnym.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function polishConversationAction(employeeId: string, kind: string): Promise<PolishResult> {
  const user = await requireRole("PRZELOZONY");
  if (!isKind(kind)) return { ok: false, reason: "Nieznany rodzaj rozmowy." };
  if (rateLimited(user.id)) return { ok: false, reason: "Zbyt wiele próśb do asystenta w krótkim czasie. Spróbuj ponownie za minutę." };
  const data = await loadPrepData(user.id, employeeId);
  if (!data) return { ok: false, reason: "Nie znaleziono pracownika wśród Twoich podwładnych." };
  if (!data.allowed.includes(kind)) return { ok: false, reason: "Ten rodzaj rozmowy nie dotyczy oceny tego pracownika." };
  const prep = buildConversationPrep({ ...data.input, kind });
  return polishConversation(prep, data.input.employeeName);
}

// Dane z przeglądarki – walidacja na serwerze (typy TypeScript nie chronią przed spreparowanym zapytaniem).
const decisionSchema = z.object({
  kind: z.enum(CONVERSATION_KINDS as [ConversationKind, ...ConversationKind[]]),
  decision: z.enum(["WSTAW", "ODRZUC"]),
  proposal: z.string().max(10_000),
  final: z.string().max(10_000).optional(),
});

export async function logConversationAiDecisionAction(employeeId: string, raw: unknown): Promise<{ ok: boolean }> {
  const user = await requireRole("PRZELOZONY");
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success || typeof employeeId !== "string") return { ok: false };
  const input = parsed.data;
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, supervisorId: user.id }, select: { id: true } });
  if (!employee) return { ok: false };
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: input.decision === "WSTAW" ? "AI_WSTAW" : "AI_ODRZUC",
      entity: "Employee",
      entityId: employee.id,
      aiProposal: { funkcja: "ASYSTENT_ROZMOWY", rozmowa: input.kind, propozycja: input.proposal },
      humanDecision: { decyzja: input.decision, wstawiono: input.final ?? null },
    },
  });
  return { ok: true };
}
