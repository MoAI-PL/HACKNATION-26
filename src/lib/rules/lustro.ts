// Lustro oceniającego: łagodne, nieblokujące sygnały typowych błędów oceniania.
// ZAŁOŻENIE: progi z data/przepisy.json („mirror”, docs/ZALOZENIA.md #11) – do potwierdzenia przez urząd:
//  - efekt świeżości: ≥ 60% notatek o osobie z ostatnich 30 dni okresu oceny;
//  - efekt aureoli: wszystkie zaobserwowane wskaźniki na jednym poziomie (przy ≥ 5 wskaźnikach);
//  - łagodność / surowość: średnia ocen przełożonego różni się o ≥ 1,5 pkt od średniej w komórce (gdy w komórce ≥ 3 oceny);
//  - brak dowodów: poziom skrajny (1 albo 5) bez notatki.
// Sygnały nigdy nie blokują zamknięcia oceny. W panelu HR dane są zanonimizowane (bez nazwisk ocenianych).

import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { LEVEL_LABELS, BEHAVIOR_LEVEL_TO_LEVEL } from "@/lib/domain/slownik";
import type { BehaviorLevel, EvaluationResult, IsoDate, Level } from "@/lib/domain/types";
import { addDays } from "./kalendarz";
import { formatPoints, plural } from "./tekst";

/** ZAŁOŻENIE: efekt świeżości liczymy dopiero od 3 notatek – przy 1–2 notatkach odsetek nic nie mówi (docs/ZALOZENIA.md #20). */
export const RECENCY_MIN_NOTES = 3;

export type MirrorCode = "SWIEZOSC" | "AUREOLA" | "LAGODNOSC" | "SUROWOSC" | "BRAK_DOWODOW";

export interface MirrorSignal {
  code: MirrorCode;
  title: string;
  text: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Efekt świeżości: większość notatek z ostatnich `recencyWindowDays` dni przed dniem odniesienia (zwykle dziś). */
export function recencySignal(
  noteDates: readonly IsoDate[],
  reference: IsoDate,
  periodStart?: IsoDate,
  r: Rules = defaultRules,
): MirrorSignal | null {
  const inPeriod = noteDates.filter((d) => d <= reference && (!periodStart || d >= periodStart));
  if (inPeriod.length < RECENCY_MIN_NOTES) return null;
  const windowStart = addDays(reference, -r.mirror.recencyWindowDays);
  const recent = inPeriod.filter((d) => d > windowStart).length;
  const share = recent / inPeriod.length;
  if (share < r.mirror.recencyMinShare) return null;
  return {
    code: "SWIEZOSC",
    title: "Większość notatek pochodzi z ostatniego miesiąca",
    text: `${recent} z ${inPeriod.length} notatek (${pct(share)}) dotyczy ostatnich ${r.mirror.recencyWindowDays} dni. Sprawdź, czy ocena obejmuje cały okres, a nie tylko ostatnie tygodnie.`,
  };
}

/** Efekt aureoli: wszystkie zaobserwowane wskaźniki na jednym poziomie. */
export function haloSignal(observedLevels: readonly BehaviorLevel[], r: Rules = defaultRules): MirrorSignal | null {
  if (observedLevels.length < r.mirror.haloMinIndicators) return null;
  const first = observedLevels[0]!;
  if (!observedLevels.every((l) => l === first)) return null;
  return {
    code: "AUREOLA",
    title: "Wszystkie wskaźniki na jednym poziomie",
    text: `Każdy z ocenionych wskaźników (${observedLevels.length}) jest na poziomie „${LEVEL_LABELS[BEHAVIOR_LEVEL_TO_LEVEL[first]]}”. Sprawdź, czy ogólne wrażenie nie przesłoniło różnic między kompetencjami.`,
  };
}

/**
 * Łagodność / surowość: średnia ocen przełożonego (wcześniejsze oceny i bieżąca) na tle średniej w komórce.
 * Liczona tylko, gdy w komórce jest co najmniej `leniencyMinEvaluationsInUnit` ocen – inaczej można by zidentyfikować osoby.
 */
export function leniencySignal(
  supervisorAverages: readonly number[],
  unitAverages: readonly number[],
  r: Rules = defaultRules,
): MirrorSignal | null {
  if (supervisorAverages.length === 0 || unitAverages.length < r.mirror.leniencyMinEvaluationsInUnit) return null;
  const sup = mean([...supervisorAverages]);
  const unit = mean([...unitAverages]);
  const diff = sup - unit;
  if (Math.abs(diff) < r.mirror.leniencyDiffPoints) return null;
  const higher = diff > 0;
  return {
    code: higher ? "LAGODNOSC" : "SUROWOSC",
    title: higher ? "Twoje oceny są wyraźnie wyższe niż w komórce" : "Twoje oceny są wyraźnie niższe niż w komórce",
    text: `Średnia Twoich ocen to ${formatPoints(sup)} pkt, a średnia w komórce ${formatPoints(unit)} pkt (${unitAverages.length} ${plural(unitAverages.length, ["ocena", "oceny", "ocen"])}, dane zanonimizowane). Sprawdź, czy stosujesz te same oczekiwania co inni.`,
  };
}

export interface RatedIndicator {
  name: string;
  level: BehaviorLevel;
  hasNote: boolean;
}

/** Brak dowodów: poziom skrajny bez notatki z dziennika. */
export function missingEvidenceSignal(indicators: readonly RatedIndicator[], r: Rules = defaultRules): MirrorSignal | null {
  const extreme = new Set(r.suggestion.requireNoteAtLevels);
  const missing = indicators.filter((i) => extreme.has(i.level) && !i.hasNote);
  if (missing.length === 0) return null;
  const names = missing.slice(0, 3).map((i) => `„${i.name}”`).join(", ");
  return {
    code: "BRAK_DOWODOW",
    title: `${missing.length} ${plural(missing.length, ["wskaźnik", "wskaźniki", "wskaźników"])} na poziomie skrajnym bez notatki`,
    text: `Ocena skrajna (znacznie poniżej albo znacznie powyżej oczekiwań) powinna mieć przykład z dziennika: ${names}${missing.length > 3 ? " i inne" : ""}. Dodaj notatkę albo sprawdź wybór.`,
  };
}

export interface MirrorInput {
  noteDates: readonly IsoDate[];
  reference: IsoDate;
  periodStart?: IsoDate;
  indicators: readonly RatedIndicator[];
  supervisorAverages: readonly number[];
  unitAverages: readonly number[];
}

/** Wszystkie sygnały dla zamykanej oceny – w kolejności od najważniejszego. */
export function evaluatorMirror(input: MirrorInput, r: Rules = defaultRules): MirrorSignal[] {
  return [
    missingEvidenceSignal(input.indicators, r),
    recencySignal(input.noteDates, input.reference, input.periodStart, r),
    haloSignal(input.indicators.map((i) => i.level), r),
    leniencySignal(input.supervisorAverages, input.unitAverages, r),
  ].filter((s): s is MirrorSignal => s !== null);
}

// ---------------------------------------------------------------------------
// Panel HR: zanonimizowany rozkład ocen w komórkach
// ---------------------------------------------------------------------------

export interface CompletedEvaluation {
  unitId: string;
  unitName: string;
  evaluatorId: string;
  evaluatorName: string;
  average: number;
  result: EvaluationResult;
  level: Level;
}

export interface UnitMirror {
  unitId: string;
  unitName: string;
  count: number;
  /** null, gdy ocen jest za mało, by pokazać rozkład bez ryzyka identyfikacji osób. */
  average: number | null;
  results: Record<EvaluationResult, number> | null;
  levels: Record<Level, number> | null;
  outliers: { evaluatorId: string; evaluatorName: string; average: number; count: number; signal: MirrorSignal }[];
}

/** Rozkład ocen w komórkach i przełożeni odstający od średniej komórki (bez nazwisk ocenianych). */
export function unitMirror(evals: readonly CompletedEvaluation[], r: Rules = defaultRules): UnitMirror[] {
  const byUnit = new Map<string, CompletedEvaluation[]>();
  for (const e of evals) byUnit.set(e.unitId, [...(byUnit.get(e.unitId) ?? []), e]);
  const enough = r.mirror.leniencyMinEvaluationsInUnit;

  return [...byUnit.values()]
    .map((list) => {
      const visible = list.length >= enough;
      const results = { POZYTYWNA: 0, NEGATYWNA: 0 } as Record<EvaluationResult, number>;
      const levels = { ZNACZNIE_PONIZEJ: 0, PONIZEJ: 0, NA_POZIOMIE: 0, POWYZEJ: 0, ZNACZNIE_POWYZEJ: 0 } as Record<Level, number>;
      for (const e of list) {
        results[e.result]++;
        levels[e.level]++;
      }
      const evaluators = new Map<string, CompletedEvaluation[]>();
      for (const e of list) evaluators.set(e.evaluatorId, [...(evaluators.get(e.evaluatorId) ?? []), e]);
      const outliers = visible
        ? [...evaluators.values()].flatMap((own) => {
            const signal = leniencySignal(
              own.map((e) => e.average),
              list.map((e) => e.average),
              r,
            );
            return signal
              ? [{ evaluatorId: own[0]!.evaluatorId, evaluatorName: own[0]!.evaluatorName, average: mean(own.map((e) => e.average)), count: own.length, signal }]
              : [];
          })
        : [];
      return {
        unitId: list[0]!.unitId,
        unitName: list[0]!.unitName,
        count: list.length,
        average: visible ? mean(list.map((e) => e.average)) : null,
        results: visible ? results : null,
        levels: visible ? levels : null,
        outliers,
      };
    })
    .sort((a, b) => a.unitName.localeCompare(b.unitName, "pl"));
}
