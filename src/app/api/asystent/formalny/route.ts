// API asystenta formalnego.
//   GET  /api/asystent/formalny?krok=OCENA → podpowiedzi pytań dla kroku i informacja, czy model AI jest dostępny
//   POST /api/asystent/formalny { pytanie, krok? } → odpowiedź ze źródłami albo odmowa
//
// Dostęp: przełożony, HR i kierujący komórką; bez sesji 401, inna rola (oceniany) 403.

import { NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/auth/guard";
import type { Role } from "@/lib/domain/types";
import { answerFormalQuestion, MAX_QUESTION_LENGTH } from "@/lib/ai/funkcje/asystent-formalny";
import { logAssistantQuery } from "@/lib/ai/funkcje/dziennik-zapytan";
import { suggestionsFor } from "@/lib/ai/funkcje/podpowiedzi";
import { getLLM } from "@/lib/ai/llm";
import type { PseudoPerson } from "@/lib/ai/pseudonimizacja";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pytanie: z
    .string({ error: "Wpisz pytanie." })
    .trim()
    .min(3, "Pytanie jest za krótkie.")
    .max(MAX_QUESTION_LENGTH, `Pytanie może mieć najwyżej ${MAX_QUESTION_LENGTH} znaków.`),
  krok: z.string().max(40).optional(),
});

// Prosty limit zapytań na adres (chroni darmowy limit dostawcy modelu). Wystarcza dla jednej instancji demo.
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

/**
 * Pseudonimizacja: podwładni przełożonego – ich imiona i nazwiska w pytaniu zostaną ukryte przed modelem.
 * Brak bazy nie blokuje odpowiedzi (wtedy działa samo rozpoznawanie imion i nazwisk ze słownika).
 */
async function subordinatesOf(user: { id: string; role: Role }): Promise<PseudoPerson[]> {
  if (user.role !== "PRZELOZONY" || !process.env.DATABASE_URL) return [];
  try {
    const { prisma } = await import("@/lib/db");
    return await prisma.employee.findMany({ where: { supervisorId: user.id }, select: { id: true, firstName: true, lastName: true } });
  } catch {
    return [];
  }
}

/** Role z dostępem do asystenta formalnego (te same co ekran /asystent w src/lib/auth/role.ts). */
const ASSISTANT_ROLES: readonly Role[] = ["PRZELOZONY", "HR", "KIERUJACY_KOMORKA"];

export const GET = withRole(ASSISTANT_ROLES, (req) => {
  const llm = getLLM();
  return NextResponse.json({
    podpowiedzi: suggestionsFor(new URL(req.url).searchParams.get("krok")),
    aiDostepne: !!llm,
    model: llm?.model ?? null,
  });
});

export const POST = withRole(ASSISTANT_ROLES, async (req, _ctx, user) => {
  // Limit liczony na użytkownika (po zalogowaniu znamy go pewniej niż adres IP).
  if (rateLimited(user.id)) {
    return NextResponse.json({ blad: "Zbyt wiele pytań w krótkim czasie. Spróbuj ponownie za minutę." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ blad: "Niepoprawne dane zapytania." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ blad: parsed.error.issues[0]?.message ?? "Niepoprawne pytanie." }, { status: 400 });
  }

  const answer = await answerFormalQuestion(parsed.data.pytanie, { people: await subordinatesOf(user) });
  await logAssistantQuery(answer, { userId: user.id, step: parsed.data.krok });
  return NextResponse.json(answer);
});
