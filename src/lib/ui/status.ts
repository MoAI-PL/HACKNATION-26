// Statusy i znaczniki w interfejsie (Z10). Czysta logika – testy w tests/ui/status.test.ts.

import type { DeadlineUrgency } from "@/lib/domain/types";
import { rules } from "@/lib/domain/przepisy";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "ai";

/** Kolor odznaki terminu: czerwony „po terminie / do 7 dni”, pomarańczowy „do 30 dni”, zielony „w terminie”. */
export const URGENCY_TONE: Record<DeadlineUrgency, Tone> = {
  PO_TERMINIE: "danger",
  PILNE: "danger",
  WKROTCE: "warning",
  W_TERMINIE: "success",
};

/** Pilność z liczby dni do terminu (ujemna = po terminie). Progi z data/przepisy.json (deadlineUrgency). */
export function urgencyFromDaysLeft(
  daysLeft: number,
  thresholds = rules.deadlineUrgency,
): DeadlineUrgency {
  if (daysLeft < 0) return "PO_TERMINIE";
  if (daysLeft <= thresholds.urgentDays) return "PILNE";
  if (daysLeft <= thresholds.soonDays) return "WKROTCE";
  return "W_TERMINIE";
}

/** Odmiana „dzień” po polsku: 1 dzień, 2 dni, 5 dni. */
export function pluralDays(n: number): string {
  return Math.abs(n) === 1 ? "dzień" : "dni";
}

/** Tekst odznaki terminu – zawsze obok koloru (sekcja 4.1 pkt 8). */
export function deadlineText(daysLeft: number): string {
  if (daysLeft < 0) return `Po terminie (${-daysLeft} ${pluralDays(daysLeft)})`;
  if (daysLeft === 0) return "Termin dziś";
  if (daysLeft === 1) return "Termin jutro";
  return `Zostało ${daysLeft} ${pluralDays(daysLeft)}`;
}

/** Godzina w formacie „14:32” (czas polski) – do znacznika „Zapisano 14:32”. */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

export type AutosaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; at: Date }
  | { status: "error"; message?: string };

export function autosaveText(state: AutosaveState): string {
  switch (state.status) {
    case "idle":
      return "Zmiany zapisują się automatycznie";
    case "saving":
      return "Zapisywanie…";
    case "saved":
      return `Zapisano ${formatTime(state.at)}`;
    case "error":
      return state.message ?? "Nie udało się zapisać. Spróbujemy ponownie za chwilę.";
  }
}

/** „Krok 3 z 6: Ocena wskaźników” (sekcja 4.1 pkt 3). */
export function wizardStepLabel(current: number, total: number, name: string): string {
  return `Krok ${current} z ${total}: ${name}`;
}
