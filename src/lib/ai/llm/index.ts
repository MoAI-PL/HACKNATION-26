// Punkt wejścia warstwy LLM.
//   const llm = getLLM();            // null = brak modelu → tryb bez AI
//   const r = await llm.chat([...]);
//   const dane = await chatJson(llm, [...], schemat);   // odpowiedź JSON walidowana zod

import type { z } from "zod";
import { readLLMConfig } from "./config";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { LLMError, type ChatMessage, type ChatOptions, type LLMProvider } from "./types";

export * from "./types";
export { readLLMConfig } from "./config";

let cached: { key: string; provider: LLMProvider | null } | null = null;

/** Dostawca z konfiguracji w .env albo null, gdy model nie jest skonfigurowany. */
export function getLLM(env: Record<string, string | undefined> = process.env): LLMProvider | null {
  const config = readLLMConfig(env);
  const key = JSON.stringify(config);
  if (cached?.key === key) return cached.provider;
  const provider = config ? new OpenAICompatibleProvider(config) : null;
  cached = { key, provider };
  return provider;
}

/** Jak getLLM(), ale rzuca czytelny błąd, gdy model nie jest skonfigurowany. */
export function requireLLM(): LLMProvider {
  const llm = getLLM();
  if (!llm) {
    throw new LLMError("BRAK_KONFIGURACJI", "Model AI nie jest skonfigurowany (ustaw LLM_BASE_URL i LLM_MODEL w pliku .env).");
  }
  return llm;
}

/** Wyciąga obiekt JSON z odpowiedzi modelu (także gdy model otoczy go blokiem ```json). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced ? fenced[1]! : text).trim();
  const start = candidate.search(/[[{]/);
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (start === -1 || end < start) throw new Error("brak obiektu JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Zapytanie o odpowiedź strukturalną (zasada AI nr 4): JSON walidowany schematem zod,
 * jedna ponowna próba przy niezgodności, potem błąd NIEPOPRAWNA_ODPOWIEDZ.
 */
export async function chatJson<T>(
  llm: LLMProvider,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  options: ChatOptions = {},
): Promise<{ data: T; model: string; durationMs: number }> {
  let lastProblem = "";
  let total = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const msgs: ChatMessage[] =
      attempt === 0
        ? messages
        : [...messages, { role: "user", content: `Poprzednia odpowiedź była niepoprawna (${lastProblem}). Odpowiedz wyłącznie poprawnym obiektem JSON zgodnym z opisanym formatem.` }];
    const r = await llm.chat(msgs, { ...options, json: true });
    total += r.durationMs;
    try {
      const parsed = schema.safeParse(extractJson(r.content));
      if (parsed.success) return { data: parsed.data, model: r.model, durationMs: total };
      lastProblem = parsed.error.issues.map((i) => `${i.path.join(".") || "obiekt"}: ${i.message}`).join("; ");
    } catch (e) {
      lastProblem = (e as Error).message;
    }
  }
  throw new LLMError("NIEPOPRAWNA_ODPOWIEDZ", "Model dwukrotnie zwrócił odpowiedź w niepoprawnym formacie.");
}
