// Formularz parametrów przepisów w panelu HR (Z19): które parametry można zmienić, jak je opisać i jak sprawdzić.
// Czysta logika (bez bazy), wspólna dla ekranu i akcji serwerowej. Ostateczna walidacja: rulesSchema (zod) z Z03.

import { rulesSchema, type Rules } from "@/lib/domain/przepisy";

export type RuleUnit = "dni" | "miesiące" | "liczba" | "procent" | "punkty";

export interface RuleField {
  /** Ścieżka w data/przepisy.json, np. "periodicDeadlines.objectionDays". */
  path: string;
  label: string;
  unit: RuleUnit;
  /** Ścieżka do podstawy prawnej w tym samym pliku (jedno źródło prawdy) albo stały tekst. */
  basisPath?: string;
  basis?: string;
  min: number;
  max: number;
  step?: number;
}

export interface RuleGroup {
  id: string;
  title: string;
  description: string;
  /** Parametry, które są założeniem zespołu, a nie wymogiem przepisu (docs/ZALOZENIA.md). */
  assumption?: boolean;
  fields: RuleField[];
}

const DAYS = { unit: "dni", min: 1, max: 365 } as const;
const MONTHS = { unit: "miesiące", min: 1, max: 60 } as const;

export const RULE_GROUPS: RuleGroup[] = [
  {
    id: "okresowa-terminy",
    title: "Ocena okresowa – terminy",
    description: "Ustawa o służbie cywilnej i rozporządzenie o ocenach okresowych. Terminy liczy silnik z Kodeksem cywilnym (dni wolne, koniec miesiąca).",
    fields: [
      { path: "periodicDeadlines.periodMonths", label: "Ocena okresowa co", ...MONTHS, basisPath: "periodicDeadlines.legalBasis.period" },
      { path: "periodicDeadlines.criteriaConversationDays", label: "Rozmowa rozpoczynająca – od poprzedniej oceny lub zatrudnienia na czas nieokreślony", ...DAYS, basisPath: "periodicDeadlines.legalBasis.criteriaConversation" },
      { path: "periodicDeadlines.afterNegativeConversationDays", label: "Rozmowa rozpoczynająca po ocenie negatywnej", ...DAYS, basisPath: "periodicDeadlines.legalBasis.afterNegativeConversation" },
      { path: "periodicDeadlines.reevaluationAfterNegativeMonths", label: "Ponowna ocena po ocenie negatywnej – po upływie", ...MONTHS, basisPath: "periodicDeadlines.legalBasis.reevaluationAfterNegative" },
      { path: "periodicDeadlines.absenceExtensionMinMonths", label: "Nieobecność wydłuża termin oceny, gdy trwa dłużej niż", ...MONTHS, basisPath: "periodicDeadlines.legalBasis.absenceExtension" },
      { path: "periodicDeadlines.positionChange.thresholdMonths", label: "Zmiana stanowiska – granica między nowymi kryteriami a oceną", ...MONTHS, basisPath: "periodicDeadlines.legalBasis.positionChangeEarly" },
      { path: "periodicDeadlines.positionChange.newCriteriaDays", label: "Nowe kryteria po zmianie stanowiska", ...DAYS, basisPath: "periodicDeadlines.legalBasis.positionChangeEarly" },
      { path: "periodicDeadlines.positionChange.evaluationDaysBefore", label: "Ocena przy późnej zmianie stanowiska – najwcześniej przed zmianą", ...DAYS, basisPath: "periodicDeadlines.legalBasis.positionChangeLate" },
      { path: "periodicDeadlines.positionChange.evaluationDaysAfter", label: "Ocena przy późnej zmianie stanowiska – najpóźniej po zmianie", ...DAYS, basisPath: "periodicDeadlines.legalBasis.positionChangeLate" },
      { path: "periodicDeadlines.objectionDays", label: "Sprzeciw od oceny – od zapoznania się z oceną", ...DAYS, basisPath: "periodicDeadlines.legalBasis.objection" },
    ],
  },
  {
    id: "okresowa-kryteria",
    title: "Ocena okresowa – kryteria",
    description: "Rozporządzenie o ocenach okresowych.",
    fields: [
      { path: "periodic.maxAdditionalCriteria", label: "Najwięcej kryteriów dodatkowych", unit: "liczba", min: 1, max: 10, basisPath: "periodic.legalBasis.maxAdditionalCriteria" },
    ],
  },
  {
    id: "pierwsza",
    title: "Pierwsza ocena",
    description: "Ustawa o służbie cywilnej (art. 38) i rozporządzenie w sprawie pierwszej oceny.",
    fields: [
      { path: "firstEval.initialConversationDays", label: "Rozmowa wstępna – od nawiązania stosunku pracy", ...DAYS, basisPath: "firstEval.legalBasis.initialConversation" },
      { path: "firstEval.evaluationEarliestMonths", label: "Pierwsza ocena – po upływie od nawiązania stosunku pracy", ...MONTHS, basisPath: "firstEval.legalBasis.evaluationWindow" },
      { path: "firstEval.evaluationLatestMonthsBeforeContractEnd", label: "Pierwsza ocena – najpóźniej przed końcem umowy", ...MONTHS, basisPath: "firstEval.legalBasis.evaluationWindow" },
      { path: "firstEval.reportMinMonths", label: "Sprawozdanie – po co najmniej", ...MONTHS, basisPath: "firstEval.legalBasis.reportDue" },
      { path: "firstEval.minAverage", label: "Ocena pozytywna – najniższa średnia ocen cząstkowych", unit: "punkty", min: 3, max: 7, step: 0.1, basisPath: "firstEval.legalBasis.positive" },
      { path: "firstEval.maxScoresAtMinimum", label: "Ocena pozytywna – najwięcej ocen cząstkowych 3 pkt", unit: "liczba", min: 0, max: 5, basisPath: "firstEval.legalBasis.positive" },
    ],
  },
  {
    id: "zalozenia",
    title: "Założenia zespołu: pilność, sugestia, Lustro",
    description: "Tego nie określa przepis – to ustawienia aplikacji (docs/ZALOZENIA.md). Urząd może je dopasować do swojej praktyki.",
    assumption: true,
    fields: [
      { path: "deadlineUrgency.urgentDays", label: "Termin „pilny” – do", ...DAYS, basis: "ustawienie aplikacji (pulpit i panel HR)" },
      { path: "deadlineUrgency.soonDays", label: "Termin „wkrótce” – do", ...DAYS, basis: "ustawienie aplikacji (pulpit i panel HR)" },
      { path: "suggestion.minObservedShare", label: "Sugestia poziomu – najmniejszy udział ocenionych wskaźników", unit: "procent", min: 0, max: 100, basis: "założenie #2" },
      { path: "mirror.recencyWindowDays", label: "Lustro – „świeże” notatki z ostatnich", ...DAYS, basis: "założenie #11" },
      { path: "mirror.recencyMinShare", label: "Lustro – sygnał, gdy świeże notatki to co najmniej", unit: "procent", min: 1, max: 100, basis: "założenie #11" },
      { path: "mirror.haloMinIndicators", label: "Lustro – efekt aureoli od liczby wskaźników", unit: "liczba", min: 2, max: 49, basis: "założenie #11" },
      { path: "mirror.leniencyDiffPoints", label: "Lustro – łagodność: różnica od średniej w komórce", unit: "punkty", min: 0.1, max: 8, step: 0.1, basis: "założenie #11" },
      { path: "mirror.leniencyMinEvaluationsInUnit", label: "Lustro – łagodność: najmniej ocen w komórce", unit: "liczba", min: 1, max: 100, basis: "założenie #11" },
    ],
  },
];

export const RULE_FIELDS: RuleField[] = RULE_GROUPS.flatMap((g) => g.fields);

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys.at(-1)!] = value;
}

/** Wartość parametru tak, jak widzi ją człowiek (procenty zamiast ułamka). */
export function displayValue(f: RuleField, r: Rules): number {
  const v = Number(getPath(r, f.path));
  return f.unit === "procent" ? Math.round(v * 1000) / 10 : v;
}

export function basisOf(f: RuleField, r: Rules): string | undefined {
  return f.basis ?? (f.basisPath ? String(getPath(r, f.basisPath) ?? "") || undefined : undefined);
}

const UNIT_WORDS: Record<RuleUnit, string> = { dni: "dni", miesiące: "mies.", liczba: "", procent: "%", punkty: "pkt" };
export const unitWord = (u: RuleUnit) => UNIT_WORDS[u];

export interface RuleChange {
  path: string;
  label: string;
  old: number;
  new: number;
}

export type RulesFormResult =
  | { ok: true; rules: Rules; changes: RuleChange[] }
  | { ok: false; errors: Record<string, string>; message: string };

/** Pola formularza → nowy zestaw parametrów. Błędy przy polach po polsku: co jest nie tak i jaki zakres jest dozwolony. */
export function rulesFromForm(base: Rules, form: Record<string, string | undefined>): RulesFormResult {
  const next = structuredClone(base) as unknown as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const changes: RuleChange[] = [];

  for (const f of RULE_FIELDS) {
    const raw = (form[f.path] ?? "").trim().replace(",", ".");
    const shown = raw === "" ? NaN : Number(raw);
    const range = `od ${f.min} do ${f.max}${unitWord(f.unit) ? ` ${unitWord(f.unit)}` : ""}`;
    if (!Number.isFinite(shown)) {
      errors[f.path] = `Wpisz liczbę (${range}).`;
      continue;
    }
    if (shown < f.min || shown > f.max) {
      errors[f.path] = `Dozwolona wartość: ${range}.`;
      continue;
    }
    const wholeOnly = !f.step && f.unit !== "procent";
    if (wholeOnly && !Number.isInteger(shown)) {
      errors[f.path] = "Wpisz liczbę całkowitą.";
      continue;
    }
    const value = f.unit === "procent" ? Math.round(shown * 10) / 1000 : shown;
    const old = Number(getPath(base, f.path));
    if (value !== old) {
      setPath(next, f.path, value);
      changes.push({ path: f.path, label: f.label, old, new: value });
    }
  }

  const urgent = Number(getPath(next, "deadlineUrgency.urgentDays"));
  const soon = Number(getPath(next, "deadlineUrgency.soonDays"));
  if (!errors["deadlineUrgency.soonDays"] && !errors["deadlineUrgency.urgentDays"] && soon <= urgent) {
    errors["deadlineUrgency.soonDays"] = `Próg „wkrótce” musi być większy niż próg „pilny” (${urgent} dni).`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: `Popraw ${Object.keys(errors).length === 1 ? "zaznaczone pole" : "zaznaczone pola"} – nic nie zostało zapisane.` };
  }

  const parsed = rulesSchema.safeParse(next);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, errors: {}, message: `Parametry nie przeszły walidacji (${issue?.path.join(".")}: ${issue?.message}). Nic nie zostało zapisane.` };
  }
  return { ok: true, rules: { ...parsed.data, version: base.version }, changes };
}

/** Lista zmian do dziennika: { "periodicDeadlines.objectionDays": 7 } → stare i nowe wartości. */
export function changesForAudit(changes: RuleChange[]) {
  return {
    oldValue: Object.fromEntries(changes.map((c) => [c.path, c.old])),
    newValue: Object.fromEntries(changes.map((c) => [c.path, c.new])),
  };
}

const short = (v: unknown, n = 140) => {
  const s = String(v ?? "");
  return s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s;
};

/** Wpis z dziennika zmian (EDYCJA_PRZEPISOW / EDYCJA_MODELU) → linie „parametr: stara → nowa wartość”. */
export function describeChange(action: string, oldValue: unknown, newValue: unknown): string[] {
  const before = (oldValue ?? {}) as Record<string, unknown>;
  const after = (newValue ?? {}) as Record<string, unknown>;
  return Object.keys(after).map((key) => {
    if (action === "EDYCJA_MODELU") return `${key}: „${short(before[key])}” → „${short(after[key])}”`;
    const f = RULE_FIELDS.find((x) => x.path === key);
    if (!f) return `${key}: ${before[key]} → ${after[key]}`;
    const show = (v: unknown) => (f.unit === "procent" ? `${Math.round(Number(v) * 1000) / 10}%` : `${v}${unitWord(f.unit) ? ` ${unitWord(f.unit)}` : ""}`);
    return `${f.label}: ${show(before[key])} → ${show(after[key])}`;
  });
}
