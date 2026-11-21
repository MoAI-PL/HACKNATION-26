"use server";
// Akcje asystenta rozmowy (Z24): redakcja przez AI i zapis decyzji „Wstaw / Odrzuć” w dzienniku decyzji (sekcja 4.2).

import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { polishConversation, type PolishResult } from "./ai";
import { buildConversationPrep, CONVERSATION_KINDS, type ConversationKind } from "./przygotowanie";
import { loadPrepData } from "./repo";

const isKind = (k: string): k is ConversationKind => (CONVERSATION_KINDS as string[]).includes(k);

export async function polishConversationAction(employeeId: string, kind: string): Promise<PolishResult> {
  const user = await requireRole("PRZELOZONY");
  if (!isKind(kind)) return { ok: false, reason: "Nieznany rodzaj rozmowy." };
  const data = await loadPrepData(user.id, employeeId);
  if (!data) return { ok: false, reason: "Nie znaleziono pracownika wśród Twoich podwładnych." };
  const prep = buildConversationPrep({ ...data.input, kind });
  return polishConversation(prep, data.input.employeeName);
}

export async function logConversationAiDecisionAction(employeeId: string, input: { kind: string; decision: "WSTAW" | "ODRZUC"; proposal: string; final?: string }): Promise<{ ok: boolean }> {
  const user = await requireRole("PRZELOZONY");
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, supervisorId: user.id }, select: { id: true } });
  if (!employee || !isKind(input.kind)) return { ok: false };
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
