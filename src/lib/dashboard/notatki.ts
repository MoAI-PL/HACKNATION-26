// Przypomnienia o regularnych notatkach: pulpit przełożonego pokazuje osoby w okresie oceny,
// o których od dawna nie ma notatki w dzienniku obserwacji. Czysta logika – dane z loadSubordinates.
//
// Po co: ocena ma objąć cały okres (§ 10 rozporządzenia), a notatki tylko z ostatnich tygodni to efekt
// świeżości (Lustro). Przypomnienie jest zachętą – niczego nie blokuje.
//
// ZAŁOŻENIE: próg 90 dni bez notatki (docs/ZALOZENIA.md #24); liczony od ostatniej notatki, a gdy w okresie
// oceny jej nie ma – od początku okresu (ustalenia kryteriów albo rozmowy wstępnej).

import type { IsoDate } from "@/lib/domain/types";
import { daysBetween } from "@/lib/rules/kalendarz";
import { currentEvaluation, type EmployeeInfo } from "./pulpit";

export const NOTE_REMINDER_DAYS = 90;
/** Ile przypomnień pokazać na pulpicie – reszta jako „i jeszcze N osób”. */
export const NOTE_REMINDER_LIMIT = 3;

export interface NoteReminder {
  employeeId: string;
  employeeName: string;
  /** Dni od ostatniej notatki w okresie oceny albo od początku okresu, gdy notatki nie ma. */
  days: number;
  /** Data ostatniej notatki w okresie oceny; brak = od początku okresu nie ma żadnej. */
  lastNote?: IsoDate;
  periodStart: IsoDate;
}

/** Początek okresu, w którym zbiera się notatki: ustalenie kryteriów (okresowa) albo rozmowa wstępna (pierwsza ocena). */
function observationPeriodStart(e: EmployeeInfo): IsoDate | null {
  const ev = currentEvaluation(e);
  if (!ev || ev.status !== "W_OKRESIE_OCENY") return null;
  return ev.criteriaSetAt ?? (ev.type === "PIERWSZA" ? e.employmentStart : null);
}

/** Osoby w okresie oceny bez notatki od co najmniej `threshold` dni – najdłużej czekające na górze. */
export function noteReminders(employees: EmployeeInfo[], today: IsoDate, threshold = NOTE_REMINDER_DAYS): NoteReminder[] {
  const out: NoteReminder[] = [];
  for (const e of employees) {
    const periodStart = observationPeriodStart(e);
    if (!periodStart || periodStart > today) continue;
    const lastNote = e.lastObservationDate && e.lastObservationDate >= periodStart ? e.lastObservationDate : undefined;
    const days = daysBetween(lastNote ?? periodStart, today);
    if (days < threshold) continue;
    out.push({ employeeId: e.id, employeeName: `${e.firstName} ${e.lastName}`, days, lastNote, periodStart });
  }
  return out.sort((a, b) => b.days - a.days || a.employeeName.localeCompare(b.employeeName, "pl"));
}

/** „ponad 3 miesiące” / „ponad 4 miesiące” – zaokrąglone w dół, jak mówi się o czasie bez notatki. */
export function monthsAgoText(days: number): string {
  const months = Math.floor(days / 30);
  if (months < 1) return `${days} dni`;
  const word = months === 1 ? "miesiąc" : months % 10 >= 2 && months % 10 <= 4 && !(months % 100 >= 12 && months % 100 <= 14) ? "miesiące" : "miesięcy";
  return `ponad ${months} ${word}`;
}
