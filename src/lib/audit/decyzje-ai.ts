"use server";

// Wspólny zapis decyzji o propozycji AI do dziennika decyzji.
// Każde „Wstaw” i „Odrzuć” w <PropozycjaAI> trafia do AuditLog razem z treścią propozycji.
// Użytkownik zawsze z sesji – nie z danych przesłanych przez przeglądarkę.

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";

const inputSchema = z.object({
  /** Funkcja AI, np. "SZKIC_UZASADNIENIA", "ASYSTENT_JEZYKA", "SZYBKA_NOTATKA". */
  funkcja: z.string().min(1).max(60),
  /** Czego dotyczy decyzja, np. "Evaluation" + id oceny. */
  entity: z.string().min(1).max(60),
  entityId: z.string().max(60).optional(),
  decision: z.enum(["WSTAW", "ODRZUC"]),
  proposal: z.unknown(),
  final: z.unknown().optional(),
  mode: z.enum(["AI", "BEZ_AI"]).optional(),
});

export type AiDecisionLogInput = z.input<typeof inputSchema>;

/** Zapis decyzji; błąd zapisu nie blokuje pracy użytkownika (zwraca ok: false). */
export async function logAiDecision(input: AiDecisionLogInput): Promise<{ ok: boolean }> {
  const user = await requireRole("PRZELOZONY", "HR", "KIERUJACY_KOMORKA");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const d = parsed.data;
  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: d.decision === "WSTAW" ? "AI_WSTAW" : "AI_ODRZUC",
        entity: d.entity,
        entityId: d.entityId,
        aiProposal: { funkcja: d.funkcja, tryb: d.mode ?? "AI", propozycja: d.proposal ?? null } as Prisma.InputJsonValue,
        humanDecision: { decyzja: d.decision, wstawiono: d.final ?? null } as Prisma.InputJsonValue,
      },
    });
    return { ok: true };
  } catch (e) {
    console.warn("Nie udało się zapisać decyzji AI w dzienniku:", (e as Error).message);
    return { ok: false };
  }
}
