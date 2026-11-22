// Zmiany przepisów i modelu kompetencji z panelu HR – stan w pamięci procesu, bez bazy.
//
// Silniki i ekrany czytają wspólne obiekty `rules` (data/przepisy.json) i `competencyModel`
// (data/model-kompetencji.json). Zmiana z panelu HR podmienia ich zawartość w miejscu, więc działa od razu wszędzie –
// bez przekazywania parametrów przez kod i bez zmian w sygnaturach funkcji.
//   - serwer: strażnicy autoryzacji (src/lib/auth/guard.ts) przed każdym ekranem, akcją i API wczytują zmiany z bazy;
//   - przeglądarka: AppShell przekazuje bieżące zmiany do <ZastosujKonfiguracje> (komponenty klienta liczą ocenę na żywo).
// Plik działa w obu środowiskach – nie importuje Prisma.

import { z } from "zod";
import { rules, rulesSchema, type Rules } from "@/lib/domain/przepisy";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";

/** Klucze w tabeli AppInfo. Brak wiersza = wartości z plików w repozytorium. */
export const RULES_KEY = "panel-hr:przepisy";
export const MODEL_KEY = "panel-hr:model-kompetencji";

export const LEVEL_KEYS = ["1", "2", "3", "4", "5"] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

/** Zmienione opisy zachowań: wskaźnik → poziom → nowy opis. Tylko różnice względem pliku. */
export type ModelOverride = Record<string, Partial<Record<LevelKey, string>>>;

export interface RuntimeConfig {
  /** Pełny zestaw parametrów przepisów albo null = data/przepisy.json. */
  rules: Rules | null;
  model: ModelOverride | null;
  /** Znacznik wersji (czas zapisu w bazie) – ten sam znacznik nie jest stosowany drugi raz. */
  stamp: string;
}

export const DEFAULT_CONFIG: RuntimeConfig = { rules: null, model: null, stamp: "domyslne" };

// Wartości z plików zapamiętane przed pierwszą zmianą – do porównań i „Przywróć”.
const DEFAULT_RULES: Rules = structuredClone(rules);
const DEFAULT_LEVELS = new Map<string, Record<1 | 2 | 3 | 4 | 5, string>>(competencyModel.indicators.map((i) => [i.id, { ...i.levels }]));

/** Parametry przepisów z pliku data/przepisy.json (kopia). */
export function defaultRules(): Rules {
  return structuredClone(DEFAULT_RULES);
}

/** Opis zachowania z pliku data/model-kompetencji.json. */
export function defaultBehavior(indicatorId: string, level: LevelKey): string | undefined {
  return DEFAULT_LEVELS.get(indicatorId)?.[Number(level) as 1 | 2 | 3 | 4 | 5];
}

const modelOverrideSchema = z.record(
  z.string().regex(/^[A-Z]+\.[1-9]\d*$/),
  z.partialRecord(z.enum(LEVEL_KEYS), z.string().trim().min(1, "Opis zachowania nie może być pusty.")),
);

/** Odczyt zmian modelu z bazy: niepoprawne wpisy i nieznane wskaźniki pomijamy. */
export function parseModelOverride(raw: unknown): ModelOverride | null {
  const r = modelOverrideSchema.safeParse(raw);
  if (!r.success) return null;
  const out: ModelOverride = {};
  for (const [id, levels] of Object.entries(r.data)) {
    if (!DEFAULT_LEVELS.has(id)) continue;
    const diff = Object.fromEntries(Object.entries(levels).filter(([l, text]) => text !== defaultBehavior(id, l as LevelKey)));
    if (Object.keys(diff).length > 0) out[id] = diff;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Odczyt parametrów z bazy – ten sam schemat zod co przy starcie aplikacji. Niepoprawne → null (wartości z pliku). */
export function parseRulesOverride(raw: unknown): Rules | null {
  const r = rulesSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * Ostatnio wczytane z bazy zmiany (src/lib/konfiguracja/repo.ts). Next.js kompiluje akcje serwerowe i ekrany
 * w osobnych warstwach modułów – każda ma własną kopię `rules` i tego pliku. Wczytane zmiany są więc w globalThis
 * (wspólne dla warstw), a każda warstwa stosuje je u siebie przy najbliższym sprawdzeniu roli.
 */
export const loadedConfig = ((globalThis as unknown as { __kompasPanelHr?: { checkedAt: number; config: RuntimeConfig } }).__kompasPanelHr ??= {
  checkedAt: 0,
  config: DEFAULT_CONFIG,
});

let current: RuntimeConfig = DEFAULT_CONFIG;

/** Zmiany, które obowiązują teraz w tym procesie (np. do przekazania przeglądarce). */
export function currentRuntimeConfig(): RuntimeConfig {
  return current;
}

/** Podmienia w miejscu `rules` i opisy zachowań w `competencyModel`. Idempotentne dla tego samego znacznika. */
export function applyRuntimeConfig(cfg: RuntimeConfig): void {
  if (cfg.stamp === current.stamp) return;
  const next = structuredClone(cfg.rules ?? DEFAULT_RULES);
  const target = rules as unknown as Record<string, unknown>;
  for (const key of Object.keys(target)) if (!(key in next)) delete target[key];
  Object.assign(target, next);
  for (const indicator of competencyModel.indicators) {
    Object.assign(indicator.levels, DEFAULT_LEVELS.get(indicator.id), cfg.model?.[indicator.id] ?? {});
  }
  current = cfg;
}

/** Powrót do wartości z plików bez czekania na odczyt z bazy (reset danych demo, testy). */
export function resetRuntimeConfig(): void {
  loadedConfig.config = DEFAULT_CONFIG;
  loadedConfig.checkedAt = 0;
  applyRuntimeConfig(DEFAULT_CONFIG);
}
