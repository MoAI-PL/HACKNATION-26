// API asystenta formalnego (Z22).
//   GET  /api/asystent/formalny?krok=OCENA → podpowiedzi pytań dla kroku i informacja, czy model AI jest dostępny
//   POST /api/asystent/formalny { pytanie, krok? } → odpowiedź ze źródłami albo odmowa
//
// ZAŁOŻENIE: autoryzację (tylko zalogowani przełożeni, HR, kierujący) dodaje Z04 – wtedy userId trafi do dziennika zapytań.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { answerFormalQuestion, MAX_QUESTION_LENGTH } from "@/lib/ai/funkcje/asystent-formalny";
import { logAssistantQuery } from "@/lib/ai/funkcje/dziennik-zapytan";
import { suggestionsFor } from "@/lib/ai/funkcje/podpowiedzi";
import { getLLM } from "@/lib/ai/llm";

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

export function GET(req: NextRequest) {
  const llm = getLLM();
  return NextResponse.json({
    podpowiedzi: suggestionsFor(req.nextUrl.searchParams.get("krok")),
    aiDostepne: !!llm,
    model: llm?.model ?? null,
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "lokalny";
  if (rateLimited(ip)) {
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

  const answer = await answerFormalQuestion(parsed.data.pytanie);
  await logAssistantQuery(answer, { step: parsed.data.krok });
  return NextResponse.json(answer);
}
