// Zapasowe odpowiedzi AI dla scen pitchu – data/demo-cache.json.
//
// Kiedy działają: tylko przy DEMO_MODE=true i tylko gdy model JEST skonfigurowany, ale nie odpowiedział
// (błąd, limit, przekroczony czas). Gdy modelu nie ma wcale, aplikacja działa w zwykłym trybie bez AI.
// Każde użycie: komunikat dla użytkownika („odpowiedź przygotowana wcześniej”) i wpis w logach serwera.
// Odpowiedzi nie są wymyślane na scenie: źródła muszą istnieć w bazie wiedzy, a cytaty zadań w OSP (test).

import { z } from "zod";
import rawCache from "../../../data/demo-cache.json";
import { isDemoMode } from "@/lib/auth/demo";

const cacheSchema = z.object({
  asystentFormalny: z.array(z.object({ pytania: z.array(z.string().min(3)).min(1), odpowiedz: z.string().min(10), zrodla: z.array(z.string()).min(1) })),
  kryteriaZOsp: z.array(
    z.object({
      symbol: z.string(),
      /** Nazwa stanowiska – OSP zapisany w bazie (kreator oceny okresowej) nie ma symbolu. */
      tytul: z.string(),
      arkusz: z.enum(["B", "C"]),
      propozycje: z.array(z.object({ kryterium: z.string(), uzasadnienie: z.string(), zadanie: z.number().int().positive(), cytat: z.string() })).min(1).max(3),
    }),
  ),
});

export type DemoCache = z.infer<typeof cacheSchema>;
export const demoCache: DemoCache = cacheSchema.parse(rawCache);

/** Pytanie bez wielkości liter, polskich znaków, interpunkcji i nadmiarowych spacji – do porównania z listą pytań. */
export function normalizeQuestion(q: string): string {
  return q
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function demoCacheEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return isDemoMode(env.DEMO_MODE);
}

export function cachedFormalAnswer(question: string, cache: DemoCache = demoCache): DemoCache["asystentFormalny"][number] | undefined {
  const q = normalizeQuestion(question);
  return cache.asystentFormalny.find((e) => e.pytania.some((p) => normalizeQuestion(p) === q));
}

/** Propozycja dla OSP z materiałów MC: po symbolu stanowiska, a gdy go brak (OSP z bazy) – po nazwie stanowiska. */
export function cachedCriteria(position: { symbol?: string; title: string }, sheet: "B" | "C", cache: DemoCache = demoCache): DemoCache["kryteriaZOsp"][number] | undefined {
  const title = normalizeQuestion(position.title);
  return cache.kryteriaZOsp.find((e) => e.arkusz === sheet && (position.symbol ? e.symbol === position.symbol : normalizeQuestion(e.tytul) === title));
}

/** Ślad w logach serwera – żeby po pitchu było wiadomo, które odpowiedzi nie pochodziły z modelu. */
export function logCacheUse(feature: string, key: string, reason: string): void {
  console.warn(`[demo-cache] ${feature}: użyto zapasowej odpowiedzi dla „${key}” (powód: ${reason})`);
}

export const CACHE_NOTICE = "Model AI jest chwilowo niedostępny – to odpowiedź przygotowana wcześniej dla demo, oparta na wskazanych źródłach.";
