// Konfiguracja modelu wyłącznie ze zmiennych środowiskowych (.env) – zmiana modelu nie wymaga zmiany kodu.

import { z } from "zod";

const envSchema = z.object({
  LLM_BASE_URL: z.string().trim().optional(),
  LLM_MODEL: z.string().trim().optional(),
  LLM_API_KEY: z.string().trim().optional(),
  LLM_EMBED_MODEL: z.string().trim().optional(),
  // Pusta wartość z .env.example (LLM_TIMEOUT_MS="") = brak ustawienia, a nie 0.
  LLM_TIMEOUT_MS: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.coerce.number().int().positive().optional()),
});

export interface LLMConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  embedModel?: string;
  timeoutMs: number;
}

export const DEFAULT_TIMEOUT_MS = 30_000;

/** Konfiguracja albo null, gdy model nie jest skonfigurowany (aplikacja działa wtedy w trybie bez AI). */
export function readLLMConfig(env: Record<string, string | undefined> = process.env): LLMConfig | null {
  const e = envSchema.parse(env);
  if (!e.LLM_BASE_URL || !e.LLM_MODEL) return null;
  return {
    baseUrl: e.LLM_BASE_URL.replace(/\/+$/, ""),
    model: e.LLM_MODEL,
    apiKey: e.LLM_API_KEY || undefined,
    embedModel: e.LLM_EMBED_MODEL || undefined,
    timeoutMs: e.LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  };
}
