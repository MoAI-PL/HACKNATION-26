// Dziennik obserwacji: czysta logika bez bazy – walidacja wpisu SDR, filtry, oś czasu, widok według wskaźników.
// Obserwacja = Sytuacja – Działanie – Rezultat, przypięta do pracownika i (opcjonalnie, do czasu przypięcia) do wskaźnika
// z modelu kompetencji. Te same dane zasilają ocenę: notatki przy wskaźniku i `hasNote` sugestii.

import { z } from "zod";
import { competencyModel as defaultModel } from "@/lib/domain/model-kompetencji-dane";
import type { CompetencyModelIndex } from "@/lib/domain/model-kompetencji";
import { isIsoDate } from "@/lib/domain/daty";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import { COMPETENCY_CODES, type BehaviorLevel, type CompetencyCode, type IsoDate, type ObservationSource } from "@/lib/domain/types";

import { MAX_SDR_LENGTH } from "./stale";

export { MAX_SDR_LENGTH };

/** Obserwacja w postaci do wyświetlenia (z bazy, po złączeniu z pracownikiem). */
export interface ObservationView {
  id: string;
  employeeId: string;
  employeeName: string;
  date: IsoDate;
  competency: CompetencyCode | null;
  indicatorId: string | null;
  behaviorLevel: BehaviorLevel | null;
  situation: string | null;
  action: string | null;
  outcome: string | null;
  originalText: string | null;
  source: ObservationSource;
}

// ---------------------------------------------------------------------------
// Walidacja wpisu
// ---------------------------------------------------------------------------

export interface ObservationInput {
  employeeId: string;
  date: IsoDate;
  indicatorId: string | null;
  competency: CompetencyCode | null;
  behaviorLevel: BehaviorLevel | null;
  situation: string | null;
  action: string | null;
  outcome: string | null;
}

export type FieldErrors = Partial<Record<"employeeId" | "date" | "indicatorId" | "behaviorLevel" | "sdr" | "situation" | "action" | "outcome", string>>;

export type ValidationResult = { ok: true; data: ObservationInput } | { ok: false; errors: FieldErrors };

const text = z
  .string()
  .trim()
  .max(MAX_SDR_LENGTH, `Najwyżej ${MAX_SDR_LENGTH} znaków. Skróć opis do najważniejszych faktów.`)
  .transform((v) => (v === "" ? null : v));

const raw = z.object({
  employeeId: z.string().trim().min(1, "Wybierz pracownika, którego dotyczy obserwacja."),
  date: z.string().trim(),
  indicatorId: z.string().trim().optional(),
  behaviorLevel: z.string().trim().optional(),
  situation: text,
  action: text,
  outcome: text,
});

/**
 * Sprawdza wpis z formularza. Błędy są zdaniami „co się stało i co zrobić” przypięte do pól.
 * `today` – data „dziś” (obserwacja nie może być z przyszłości).
 */
export function validateObservation(input: Record<string, unknown>, today: IsoDate, model: CompetencyModelIndex = defaultModel): ValidationResult {
  const parsed = raw.safeParse({
    employeeId: input.employeeId ?? "",
    date: input.date ?? "",
    indicatorId: input.indicatorId ?? undefined,
    behaviorLevel: input.behaviorLevel ?? undefined,
    situation: input.situation ?? "",
    action: input.action ?? "",
    outcome: input.outcome ?? "",
  });
  const errors: FieldErrors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof FieldErrors;
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const d = parsed.data;

  if (!isIsoDate(d.date)) errors.date = "Podaj datę w formacie RRRR-MM-DD, np. 2026-11-21.";
  else if (d.date > today) errors.date = "Obserwacja nie może mieć daty z przyszłości. Wpisz dzień, w którym zdarzenie miało miejsce.";

  const indicatorId = d.indicatorId ? d.indicatorId : null;
  const indicator = indicatorId ? model.getIndicator(indicatorId) : undefined;
  if (indicatorId && !indicator) errors.indicatorId = "Nie ma takiego wskaźnika w modelu kompetencji. Wybierz wskaźnik z listy.";

  let behaviorLevel: BehaviorLevel | null = null;
  if (d.behaviorLevel) {
    const n = Number(d.behaviorLevel);
    if (![1, 2, 3, 4, 5].includes(n)) errors.behaviorLevel = "Wybierz jeden z pięciu opisów zachowania albo zostaw bez poziomu.";
    else if (!indicatorId) errors.behaviorLevel = "Poziom zachowania można wskazać dopiero po wybraniu wskaźnika.";
    else behaviorLevel = n as BehaviorLevel;
  }

  if (!d.situation && !d.action && !d.outcome) {
    errors.sdr = "Opisz co najmniej jedno: sytuację, działanie albo rezultat. Najlepiej wszystkie trzy – to podstawa oceny opartej na zachowaniach.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      employeeId: d.employeeId,
      date: d.date,
      indicatorId,
      competency: indicator?.competency ?? null,
      behaviorLevel,
      situation: d.situation,
      action: d.action,
      outcome: d.outcome,
    },
  };
}

// ---------------------------------------------------------------------------
// Filtry listy (parametry adresu – działają bez JavaScriptu i dają się udostępnić linkiem)
// ---------------------------------------------------------------------------

export type JournalView = "os" | "wskazniki";

export interface JournalFilters {
  employeeId?: string;
  competency?: CompetencyCode;
  from?: IsoDate;
  to?: IsoDate;
  view: JournalView;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Parametry adresu → filtry. Niepoprawne wartości pomijamy (zamiast błędu pokazujemy pełną listę). */
export function parseFilters(params: Params): JournalFilters {
  const competency = first(params.kompetencja);
  const from = first(params.od);
  const to = first(params.do);
  return {
    employeeId: first(params.osoba),
    competency: COMPETENCY_CODES.includes(competency as CompetencyCode) ? (competency as CompetencyCode) : undefined,
    from: from && isIsoDate(from) ? from : undefined,
    to: to && isIsoDate(to) ? to : undefined,
    view: first(params.widok) === "wskazniki" ? "wskazniki" : "os",
  };
}

/** Filtry → parametry adresu (np. link „Dodaj obserwację” z wybraną osobą, powrót po zapisie). */
export function filtersToQuery(f: Partial<JournalFilters>): string {
  const q = new URLSearchParams();
  if (f.employeeId) q.set("osoba", f.employeeId);
  if (f.competency) q.set("kompetencja", f.competency);
  if (f.from) q.set("od", f.from);
  if (f.to) q.set("do", f.to);
  if (f.view === "wskazniki") q.set("widok", "wskazniki");
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Filtrowanie w pamięci – ta sama reguła co w zapytaniu do bazy (do testów i list już pobranych). */
export function applyFilters(items: ObservationView[], f: JournalFilters): ObservationView[] {
  return items.filter(
    (o) =>
      (!f.employeeId || o.employeeId === f.employeeId) &&
      (!f.competency || o.competency === f.competency) &&
      (!f.from || o.date >= f.from) &&
      (!f.to || o.date <= f.to),
  );
}

// ---------------------------------------------------------------------------
// Oś czasu i widok według wskaźników
// ---------------------------------------------------------------------------

const MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const MONTHS_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

/** „2026-11-21” → „21 listopada 2026”. */
export function formatDatePl(date: IsoDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS_GEN[m! - 1]} ${y}`;
}

export interface MonthGroup {
  key: string;
  /** „listopad 2026” */
  label: string;
  items: ObservationView[];
}

/** Oś czasu: miesiące od najnowszego, w miesiącu wpisy od najnowszego. */
export function groupByMonth(items: ObservationView[]): MonthGroup[] {
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const groups: MonthGroup[] = [];
  for (const o of sorted) {
    const key = o.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const [y, m] = key.split("-").map(Number);
      g = { key, label: `${MONTHS[m! - 1]} ${y}`, items: [] };
      groups.push(g);
    }
    g.items.push(o);
  }
  return groups;
}

export interface IndicatorGroup {
  indicatorId: string;
  name: string;
  items: ObservationView[];
}

export interface CompetencyGroup {
  competency: CompetencyCode;
  name: string;
  indicators: IndicatorGroup[];
  count: number;
}

export interface IndicatorView {
  competencies: CompetencyGroup[];
  /** Notatki jeszcze nieprzypięte do wskaźnika (np. szybka notatka bez AI). */
  unpinned: ObservationView[];
}

/** Od najwyższego poziomu zachowania do najniższego; bez poziomu na końcu; przy remisie od najnowszej. */
export function byLevelDesc(a: ObservationView, b: ObservationView): number {
  return (b.behaviorLevel ?? 0) - (a.behaviorLevel ?? 0) || b.date.localeCompare(a.date);
}

/** Widok „przy wskaźnikach”: kompetencje i wskaźniki w kolejności modelu, w każdym wpisy od najlepszego zachowania do najsłabszego. */
export function groupByIndicator(items: ObservationView[], model: CompetencyModelIndex = defaultModel): IndicatorView {
  const newestFirst = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const bestFirst = [...items].sort(byLevelDesc);
  const competencies: CompetencyGroup[] = [];
  for (const c of model.competencies) {
    const indicators = c.indicators
      .map((ind) => ({ indicatorId: ind.id, name: ind.name, items: bestFirst.filter((o) => o.indicatorId === ind.id) }))
      .filter((g) => g.items.length > 0);
    if (indicators.length > 0) {
      competencies.push({ competency: c.code, name: COMPETENCY_NAMES[c.code], indicators, count: indicators.reduce((n, g) => n + g.items.length, 0) });
    }
  }
  const known = new Set<string>(model.indicators.map((i) => i.id));
  return { competencies, unpinned: newestFirst.filter((o) => !o.indicatorId || !known.has(o.indicatorId)) };
}

/** Notatki przy wskaźnikach jednej osoby (panel obok kart zachowań; sugestia poziomu: `hasNote`). */
export function observationsForIndicator(items: ObservationView[], employeeId: string, indicatorId: string): ObservationView[] {
  return items.filter((o) => o.employeeId === employeeId && o.indicatorId === indicatorId).sort((a, b) => b.date.localeCompare(a.date));
}

/** Liczba notatek przy każdym wskaźniku pracownika – wejście `hasNote` sugestii. */
export function noteCountsByIndicator(items: ObservationView[], employeeId: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of items) if (o.employeeId === employeeId && o.indicatorId) counts.set(o.indicatorId, (counts.get(o.indicatorId) ?? 0) + 1);
  return counts;
}
