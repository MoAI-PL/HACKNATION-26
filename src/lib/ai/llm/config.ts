// Konfiguracja modelu wyłącznie ze zmiennych środowiskowych (.env) – zmiana modelu nie wymaga zmiany kodu.

import { z } from "zod";

/** Pusta wartość w .env (np. LLM_TIMEOUT_MS="") = brak ustawienia. */
const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().optional());
const optionalPositiveInt = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const envSchema = z.object({
  LLM_BASE_URL: optionalText,
  LLM_MODEL: optionalText,
  LLM_API_KEY: optionalText,
  LLM_EMBED_MODEL: optionalText,
  LLM_TIMEOUT_MS: optionalPositiveInt,
  /**
   * Opcjonalny parametr `reasoning_effort` (API zgodne z OpenAI). Modele „myślące” (np. Gemini 2.5+)
   * odpowiadają znacznie szybciej przy wartości "low" albo "none". Wysyłany tylko, gdy ustawiony.
   */
  LLM_REASONING_EFFORT: optionalText,
});

export interface LLMConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  embedModel?: string;
  timeoutMs: number;
  reasoningEffort?: string;
}

export const DEFAULT_TIMEOUT_MS = 30_000;

/** Konfiguracja albo null, gdy model nie jest skonfigurowany (aplikacja działa wtedy w trybie bez AI). */
export function readLLMConfig(env: Record<string, string | undefined> = process.env): LLMConfig | null {
  const e = envSchema.parse(env);
  if (!e.LLM_BASE_URL || !e.LLM_MODEL) return null;
  return {
    baseUrl: e.LLM_BASE_URL.replace(/\/+$/, ""),
    model: e.LLM_MODEL,
    apiKey: e.LLM_API_KEY,
    embedModel: e.LLM_EMBED_MODEL,
    timeoutMs: e.LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
    ...(e.LLM_REASONING_EFFORT ? { reasoningEffort: e.LLM_REASONING_EFFORT } : {}),
  };
}
