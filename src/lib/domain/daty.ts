// Konwersja dat kalendarzowych "RRRR-MM-DD" (IsoDate) ↔ kolumny @db.Date w Prisma.
// KONTRAKT WSPÓLNY. Używaj tych funkcji zamiast `new Date(rok, miesiąc, dzień)`:
// Prisma zapisuje @db.Date według UTC, więc data utworzona o północy czasu polskiego
// trafiłaby do bazy jako poprzedni dzień.

import type { IsoDate } from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Czy tekst to poprawna data kalendarzowa "RRRR-MM-DD" (np. odrzuca 2026-02-30). */
export function isIsoDate(value: string): value is IsoDate {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** "RRRR-MM-DD" → Date do zapisu w kolumnie @db.Date (północ UTC). */
export function toDbDate(value: IsoDate): Date {
  if (!isIsoDate(value)) throw new Error(`Niepoprawna data (oczekiwano RRRR-MM-DD): ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date odczytana z kolumny @db.Date → "RRRR-MM-DD". */
export function fromDbDate(value: Date): IsoDate {
  return value.toISOString().slice(0, 10);
}

/** Dzisiejsza data w strefie Europe/Warsaw jako "RRRR-MM-DD" (niezależnie od strefy serwera). */
export function todayIso(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(now);
}
