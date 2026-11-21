// Kalendarz silnika terminów (Z08): arytmetyka dat "RRRR-MM-DD", dni wolne i zasady liczenia terminów z KC.
// - art. 111 § 2 KC: termin w dniach liczymy od dnia następnego po zdarzeniu;
// - art. 112 KC: termin w miesiącach kończy się w dniu o tej samej dacie, a gdy go nie ma – w ostatnim dniu miesiąca;
// - art. 115 KC: koniec terminu w dzień ustawowo wolny od pracy lub w sobotę przesuwa się na następny dzień roboczy;
// - ustawa z 18.01.1951 o dniach wolnych od pracy (Wigilia wolna od 2025 r.).
// Wszystko w UTC, bez stref czasowych – daty to dni kalendarzowe.

import { isIsoDate } from "@/lib/domain/daty";
import type { IsoDate } from "@/lib/domain/types";
import { RulesInputError } from "./bledy";

const DAY_MS = 86_400_000;

function parse(date: IsoDate): Date {
  if (!isIsoDate(date)) throw new RulesInputError(`Niepoprawna data (oczekiwano RRRR-MM-DD): ${date}`);
  return new Date(`${date}T00:00:00.000Z`);
}

function format(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** Data przesunięta o `days` dni (także ujemnie). */
export function addDays(date: IsoDate, days: number): IsoDate {
  return format(new Date(parse(date).getTime() + days * DAY_MS));
}

/** Data przesunięta o `months` miesięcy według art. 112 KC (31.08 + 6 mies. = 28/29.02). Działa też wstecz. */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = parse(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(targetYear, targetMonth, Math.min(d.getUTCDate(), lastDay))));
}

/** Liczba dni od `from` do `to` (to − from); ujemna, gdy `to` jest wcześniej. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS);
}

/** Liczba dni kalendarzowych okresu od–do włącznie (12.03–24.04 = 44 dni). */
export function inclusiveDays(from: IsoDate, to: IsoDate): number {
  return daysBetween(from, to) + 1;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

/** Dzień tygodnia: 0 = niedziela … 6 = sobota. */
export function dayOfWeek(date: IsoDate): number {
  return parse(date).getUTCDay();
}

const WEEKDAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"] as const;
const WEEKDAYS_SHORT = ["nd.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."] as const;

export function weekdayName(date: IsoDate): string {
  return WEEKDAYS[dayOfWeek(date)];
}

/** "2026-11-28" → "28.11.2026". */
export function formatDatePl(date: IsoDate): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** "2026-11-28" → "sob. 28.11" (krótka forma na kartach „Do zrobienia”). */
export function formatDateShortPl(date: IsoDate): string {
  const [, m, d] = date.split("-");
  return `${WEEKDAYS_SHORT[dayOfWeek(date)]} ${d}.${m}`;
}

/** Okres "12.03–24.04.2026" albo "20.12.2026–15.01.2027". */
export function formatRangePl(from: IsoDate, to: IsoDate): string {
  if (from.slice(0, 4) === to.slice(0, 4)) {
    const [, m, d] = from.split("-");
    return `${d}.${m}–${formatDatePl(to)}`;
  }
  return `${formatDatePl(from)}–${formatDatePl(to)}`;
}

// ---------------------------------------------------------------------------
// Święta ustawowe
// ---------------------------------------------------------------------------

/** Niedziela Wielkanocna (algorytm Meeusa/Jonesa/Butchera, kalendarz gregoriański). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return format(new Date(Date.UTC(year, month - 1, day)));
}

const holidayCache = new Map<number, Map<IsoDate, string>>();

/** Dni ustawowo wolne od pracy w danym roku: data → nazwa. */
export function polishHolidays(year: number): Map<IsoDate, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const y = String(year).padStart(4, "0");
  const easter = easterSunday(year);
  const list: [IsoDate, string][] = [
    [`${y}-01-01`, "Nowy Rok"],
    [`${y}-01-06`, "Święto Trzech Króli"],
    [easter, "Wielkanoc"],
    [addDays(easter, 1), "Poniedziałek Wielkanocny"],
    [`${y}-05-01`, "Święto Pracy"],
    [`${y}-05-03`, "Święto Konstytucji 3 Maja"],
    [addDays(easter, 49), "Zielone Świątki"],
    [addDays(easter, 60), "Boże Ciało"],
    [`${y}-08-15`, "Wniebowzięcie NMP"],
    [`${y}-11-01`, "Wszystkich Świętych"],
    [`${y}-11-11`, "Narodowe Święto Niepodległości"],
    [`${y}-12-25`, "Boże Narodzenie (pierwszy dzień)"],
    [`${y}-12-26`, "Boże Narodzenie (drugi dzień)"],
  ];
  if (year >= 2025) list.push([`${y}-12-24`, "Wigilia Bożego Narodzenia"]);
  const map = new Map(list);
  holidayCache.set(year, map);
  return map;
}

/** Nazwa święta ustawowego albo null. */
export function holidayName(date: IsoDate): string | null {
  return polishHolidays(Number(date.slice(0, 4))).get(date) ?? null;
}

/** Dzień wolny w rozumieniu art. 115 KC: niedziela, święto ustawowe i (domyślnie) sobota. */
export function isDayOff(date: IsoDate, saturdayIsDayOff = true): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || (saturdayIsDayOff && dow === 6) || holidayName(date) !== null;
}

/** Najbliższy dzień roboczy od `date` włącznie. */
export function nextWorkingDay(date: IsoDate, saturdayIsDayOff = true): IsoDate {
  let d = date;
  while (isDayOff(d, saturdayIsDayOff)) d = addDays(d, 1);
  return d;
}

/** Najbliższy dzień roboczy przed `date` albo `date`, jeśli jest roboczy. */
export function previousWorkingDay(date: IsoDate, saturdayIsDayOff = true): IsoDate {
  let d = date;
  while (isDayOff(d, saturdayIsDayOff)) d = addDays(d, -1);
  return d;
}

/** Opis dnia wolnego do wyjaśnień: „sobotę”, „niedzielę”, „święto (Boże Ciało)”. */
export function dayOffReason(date: IsoDate): string {
  const holiday = holidayName(date);
  if (holiday) return `dzień ustawowo wolny (${holiday})`;
  return dayOfWeek(date) === 6 ? "sobotę" : "niedzielę";
}
