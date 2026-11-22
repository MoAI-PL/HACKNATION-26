// Silnik terminów.
// Ocena okresowa: art. 81 ust. 4, 6, 7 i 9 oraz art. 83 ustawy o służbie cywilnej, § 7 i § 9 rozporządzenia
// z 4.04.2016 (Dz.U. poz. 470). Pierwsza ocena: art. 38 ust. 1 ustawy, § 3–5 rozporządzenia z 23.07.2015 (Dz.U. poz. 1144).
// Liczenie terminów: art. 111, 112 i 115 KC (kalendarz.ts). Doprecyzowania z poradnika KPRM o ocenach okresowych
// (rozdz. „Terminy”) są opisane przy funkcjach. Parametry liczbowe z data/przepisy.json (parametr `r`).

import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { ABSENCE_KIND_LABELS } from "@/lib/domain/slownik";
import type {
  AbsenceKind,
  Deadline,
  DeadlineKind,
  DeadlineUrgency,
  IsoDate,
  PositionChangeEvent,
  TodoItem,
} from "@/lib/domain/types";
import { RulesInputError } from "./bledy";
import {
  addDays,
  addMonths,
  dayOffReason,
  daysBetween,
  formatDatePl,
  formatDateShortPl,
  formatRangePl,
  inclusiveDays,
  isDayOff,
  maxDate,
  nextWorkingDay,
  previousWorkingDay,
  weekdayName,
} from "./kalendarz";
import { plural } from "./tekst";

/** Usprawiedliwiona nieobecność (model Absence) – wejście silnika terminów. */
export interface AbsencePeriod {
  kind: AbsenceKind;
  from: IsoDate;
  to: IsoDate;
}

/** Od czego biegnie 24-miesięczny termin oceny okresowej i 30 dni na rozmowę rozpoczynającą. */
export type PeriodicAnchorKind = "POPRZEDNIA_OCENA" | "ZATRUDNIENIE_NA_CZAS_NIEOKRESLONY";

export interface PeriodicAnchor {
  kind: PeriodicAnchorKind;
  /** Dzień sporządzenia poprzedniej oceny na piśmie albo zatrudnienia na czas nieokreślony. */
  date: IsoDate;
}

/** Nazwy terminów na kartach „Do zrobienia”, osi czasu i w panelu HR. */
export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  ROZMOWA_ROZPOCZYNAJACA: "Rozmowa rozpoczynająca",
  ROZMOWA_PO_NEGATYWNEJ: "Rozmowa po ocenie negatywnej",
  OCENA_OKRESOWA: "Ocena okresowa",
  PONOWNA_OCENA_PO_NEGATYWNEJ: "Ponowna ocena po ocenie negatywnej",
  PONOWNE_KRYTERIA_PO_ZMIANIE_STANOWISKA: "Ponowne ustalenie kryteriów po zmianie stanowiska",
  OCENA_PRZY_ZMIANIE_STANOWISKA: "Ocena przy zmianie stanowiska",
  ROZMOWA_WSTEPNA: "Rozmowa wstępna",
  SPRAWOZDANIE: "Sprawozdanie z pierwszego okresu pracy",
  PIERWSZA_OCENA_OD: "Pierwsza ocena – najwcześniej",
  PIERWSZA_OCENA_DO: "Pierwsza ocena",
  SPRZECIW: "Termin na sprzeciw",
};

/** Etykiety pilności – kolor odznaki zawsze razem z tym tekstem. */
export const URGENCY_LABELS: Record<DeadlineUrgency, string> = {
  PO_TERMINIE: "po terminie",
  PILNE: "do 7 dni",
  WKROTCE: "do 30 dni",
  W_TERMINIE: "w terminie",
};

const ANCHOR_TEXT: Record<PeriodicAnchorKind, string> = {
  POPRZEDNIA_OCENA: "od sporządzenia poprzedniej oceny",
  ZATRUDNIENIE_NA_CZAS_NIEOKRESLONY: "od zatrudnienia na czas nieokreślony",
};

const LB_KC_DAYS = "art. 111 § 2 KC";
const LB_KC_SHIFT = "art. 115 KC";

// ---------------------------------------------------------------------------
// Wspólne kroki
// ---------------------------------------------------------------------------

function days(n: number): string {
  return `${n} ${plural(n, ["dzień", "dni", "dni"])}`;
}

function months(n: number): string {
  return `${n} ${plural(n, ["miesiąc", "miesiące", "miesięcy"])}`;
}

/** Koniec terminu po art. 115 KC: przesunięcie z soboty / dnia wolnego na następny dzień roboczy. */
function shiftEnd(raw: IsoDate, r: Rules): { date: IsoDate; note: string } {
  if (!r.dateCounting.moveToNextWorkingDay || !isDayOff(raw, r.dateCounting.saturdayIsDayOff)) {
    return { date: raw, note: "" };
  }
  const date = nextWorkingDay(raw, r.dateCounting.saturdayIsDayOff);
  return {
    date,
    note: ` Termin wypadał w ${dayOffReason(raw)} ${formatDatePl(raw)}, więc przesuwa się na ${weekdayName(date)} ${formatDatePl(date)}.`,
  };
}

function withShiftBasis(basis: string, note: string): string {
  return note ? `${basis}, ${LB_KC_SHIFT}` : basis;
}

interface MergedAbsence {
  from: IsoDate;
  to: IsoDate;
  kinds: AbsenceKind[];
}

/**
 * Łączy nieobecności w okresy ciągłe. Według poradnika KPRM nieobecność „nieprzerwana” liczy się łącznie,
 * bez względu na przyczynę, a dni wolne od pracy pomiędzy (weekend, święto) jej nie przerywają.
 */
export function mergeAbsences(absences: readonly AbsencePeriod[], r: Rules = defaultRules): MergedAbsence[] {
  for (const a of absences) {
    if (a.to < a.from) {
      throw new RulesInputError(`Nieobecność ${formatDatePl(a.from)}–${formatDatePl(a.to)} kończy się przed początkiem. Popraw daty.`);
    }
  }
  const sorted = [...absences].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const merged: MergedAbsence[] = [];
  for (const a of sorted) {
    const last = merged.at(-1);
    if (last && continuesAbsence(last.to, a.from, r)) {
      last.to = maxDate(last.to, a.to);
      if (!last.kinds.includes(a.kind)) last.kinds.push(a.kind);
    } else {
      merged.push({ from: a.from, to: a.to, kinds: [a.kind] });
    }
  }
  return merged;
}

/** Czy nieobecność od `nextFrom` jest kontynuacją tej kończącej się `prevTo` (styka się, nakłada albo dzielą je tylko dni wolne). */
function continuesAbsence(prevTo: IsoDate, nextFrom: IsoDate, r: Rules): boolean {
  if (nextFrom <= addDays(prevTo, 1)) return true;
  for (let d = addDays(prevTo, 1); d < nextFrom; d = addDays(d, 1)) {
    if (!isDayOff(d, r.dateCounting.saturdayIsDayOff)) return false;
  }
  return true;
}

function absenceReason(a: MergedAbsence): string {
  return `${a.kinds.map((k) => ABSENCE_KIND_LABELS[k]).join(" + ")} ${formatRangePl(a.from, a.to)}`;
}

/**
 * Wydłużenia terminu o nieobecności przypadające między `periodStart` a (wydłużanym) terminem.
 * `minMonths` = próg „dłużej niż N miesięcy” (null = każda nieobecność wydłuża termin).
 * Zwraca wydłużenia i nieobecności pominięte jako zbyt krótkie.
 */
function absenceExtensions(
  periodStart: IsoDate,
  rawDeadline: IsoDate,
  absences: readonly AbsencePeriod[],
  minMonths: number | null,
  r: Rules,
): { deadline: IsoDate; extensions: Deadline["extensions"]; tooShort: MergedAbsence[] } {
  let deadline = rawDeadline;
  const extensions: Deadline["extensions"] = [];
  const tooShort: MergedAbsence[] = [];
  for (const a of mergeAbsences(absences, r)) {
    // ZAŁOŻENIE: liczymy tylko część nieobecności po początku okresu (docs/ZALOZENIA.md #12).
    if (a.to <= periodStart) continue;
    const from = maxDate(a.from, addDays(periodStart, 1));
    if (from > deadline) break;
    const clipped: MergedAbsence = { ...a, from };
    // „Dłużej niż miesiąc”: koniec nieobecności po dniu, w którym mija miesiąc od jej początku (poradnik KPRM, przykład 9.09–19.10).
    if (minMonths !== null && clipped.to <= addMonths(clipped.from, minMonths)) {
      tooShort.push(clipped);
      continue;
    }
    const n = inclusiveDays(clipped.from, clipped.to);
    extensions.push({ days: n, reason: absenceReason(clipped) });
    deadline = addDays(deadline, n);
  }
  return { deadline, extensions, tooShort };
}

function extensionsText(extensions: Deadline["extensions"]): string {
  if (extensions.length === 0) return "";
  const total = extensions.reduce((s, e) => s + e.days, 0);
  return ` Termin wydłużają usprawiedliwione nieobecności: +${days(total)} (${extensions.map((e) => `${e.reason}: ${days(e.days)}`).join("; ")}).`;
}

// ---------------------------------------------------------------------------
// Ocena okresowa
// ---------------------------------------------------------------------------

/** Rozmowa rozpoczynająca (kryteria i termin oceny): 30 dni od poprzedniej oceny / zatrudnienia na czas nieokreślony (§ 7 pkt 1). */
export function criteriaConversationDeadline(anchor: PeriodicAnchor, r: Rules = defaultRules): Deadline {
  const pd = r.periodicDeadlines;
  const { date, note } = shiftEnd(addDays(anchor.date, pd.criteriaConversationDays), r);
  return {
    kind: "ROZMOWA_ROZPOCZYNAJACA",
    date,
    extensions: [],
    explanation: {
      text: `Rozmowę rozpoczynającą (kryteria i termin oceny) trzeba przeprowadzić do ${formatDatePl(date)}: ${days(pd.criteriaConversationDays)} ${ANCHOR_TEXT[anchor.kind]} (${formatDatePl(anchor.date)}).${note}`,
      legalBasis: withShiftBasis(`${pd.legalBasis.criteriaConversation}, ${LB_KC_DAYS}`, note),
    },
  };
}

/**
 * Termin sporządzenia oceny okresowej: 24 miesiące od poprzedniej oceny / zatrudnienia na czas nieokreślony (art. 81 ust. 4),
 * wydłużone o każdą nieprzerwaną usprawiedliwioną nieobecność dłuższą niż miesiąc (art. 81 ust. 7).
 */
export function periodicEvaluationDeadline(
  input: { anchor: PeriodicAnchor; absences?: readonly AbsencePeriod[] },
  r: Rules = defaultRules,
): Deadline {
  const pd = r.periodicDeadlines;
  const base = addMonths(input.anchor.date, pd.periodMonths);
  const ext = absenceExtensions(input.anchor.date, base, input.absences ?? [], pd.absenceExtensionMinMonths, r);
  const { date, note } = shiftEnd(ext.deadline, r);

  const shortText = ext.tooShort.length
    ? ` Nie wydłużają terminu nieobecności trwające nie dłużej niż ${months(pd.absenceExtensionMinMonths)}: ${ext.tooShort.map(absenceReason).join("; ")}.`
    : "";
  const basis = ext.extensions.length ? `${pd.legalBasis.period}, ${pd.legalBasis.absenceExtension}` : pd.legalBasis.period;

  return {
    kind: "OCENA_OKRESOWA",
    date,
    extensions: ext.extensions,
    explanation: {
      text: `Ocenę okresową trzeba sporządzić do ${formatDatePl(date)}: ${months(pd.periodMonths)} ${ANCHOR_TEXT[input.anchor.kind]} (${formatDatePl(input.anchor.date)}) to ${formatDatePl(base)}.${extensionsText(ext.extensions)}${shortText}${note}`,
      legalBasis: withShiftBasis(`${basis}, art. 112 KC`, note),
    },
  };
}

/**
 * Po ocenie negatywnej:
 * - rozmowa rozpoczynająca nowy okres w 7 dni od sporządzenia oceny negatywnej (§ 7 pkt 2);
 * - ponowna ocena niezwłocznie po upływie 6 miesięcy od zapoznania się z oceną (art. 81 ust. 9). Według poradnika KPRM
 *   tego terminu nie wydłużają nieobecności (art. 81 ust. 7 dotyczy tylko terminu 24-miesięcznego).
 */
export function afterNegativeDeadlines(
  input: { evaluatedAt: IsoDate; acknowledgedAt?: IsoDate },
  r: Rules = defaultRules,
): Deadline[] {
  const pd = r.periodicDeadlines;
  const conv = shiftEnd(addDays(input.evaluatedAt, pd.afterNegativeConversationDays), r);
  const result: Deadline[] = [
    {
      kind: "ROZMOWA_PO_NEGATYWNEJ",
      date: conv.date,
      extensions: [],
      explanation: {
        text: `Po ocenie negatywnej rozmowę o kryteriach nowej oceny trzeba przeprowadzić do ${formatDatePl(conv.date)}: ${days(pd.afterNegativeConversationDays)} od sporządzenia oceny (${formatDatePl(input.evaluatedAt)}).${conv.note}`,
        legalBasis: withShiftBasis(`${pd.legalBasis.afterNegativeConversation}, ${LB_KC_DAYS}`, conv.note),
      },
    },
  ];
  if (input.acknowledgedAt) {
    // ZAŁOŻENIE: dzień wolny → najbliższy dzień roboczy, „najwcześniej” zostaje bez zmian (docs/ZALOZENIA.md #14).
    const earliest = addDays(addMonths(input.acknowledgedAt, pd.reevaluationAfterNegativeMonths), 1);
    const date = r.dateCounting.moveToNextWorkingDay ? nextWorkingDay(earliest, r.dateCounting.saturdayIsDayOff) : earliest;
    const moved = date !== earliest ? ` Ten dzień wypada w ${dayOffReason(earliest)}, więc ocenę sporządza się w najbliższym dniu roboczym: ${formatDatePl(date)}.` : "";
    result.push({
      kind: "PONOWNA_OCENA_PO_NEGATYWNEJ",
      date,
      earliest,
      extensions: [],
      explanation: {
        text: `Ponowną ocenę sporządza się niezwłocznie po upływie ${months(pd.reevaluationAfterNegativeMonths)} od zapoznania się z oceną negatywną (${formatDatePl(input.acknowledgedAt)}), czyli ${formatDatePl(earliest)}.${moved} Nieobecności nie wydłużają tego terminu.`,
        legalBasis: pd.legalBasis.reevaluationAfterNegative,
      },
    });
  }
  return result;
}

/**
 * Zmiana stanowiska z istotną zmianą obowiązków. Punkt odniesienia: sporządzenie ostatniej oceny,
 * a przy pierwszej ocenie okresowej – ustalenie kryteriów (§ 9 ust. 1).
 * - w ciągu 6 miesięcy: ponowne kryteria w 30 dni, termin oceny bez zmian (§ 9 ust. 1);
 * - po 6 miesiącach: ocena od 7 dni przed do 30 dni po zmianie (art. 81 ust. 6, § 9 ust. 2).
 * Zwraca null, gdy zmiana nie wiąże się z istotną zmianą obowiązków.
 */
export function positionChangeDeadline(
  input: { change: PositionChangeEvent; lastEvaluationAt?: IsoDate; criteriaSetAt?: IsoDate },
  r: Rules = defaultRules,
): Deadline | null {
  if (!input.change.significantDutiesChange) return null;
  const pc = r.periodicDeadlines.positionChange;
  const lb = r.periodicDeadlines.legalBasis;
  const anchor = input.lastEvaluationAt ?? input.criteriaSetAt;
  if (!anchor) {
    throw new RulesInputError("Podaj datę ostatniej oceny albo ustalenia kryteriów, żeby ustalić skutki zmiany stanowiska.");
  }
  const anchorText = input.lastEvaluationAt
    ? `od sporządzenia ostatniej oceny (${formatDatePl(anchor)})`
    : `od ustalenia kryteriów (${formatDatePl(anchor)})`;
  const changeDate = input.change.date;

  if (changeDate <= addMonths(anchor, pc.thresholdMonths)) {
    const { date, note } = shiftEnd(addDays(changeDate, pc.newCriteriaDays), r);
    return {
      kind: "PONOWNE_KRYTERIA_PO_ZMIANIE_STANOWISKA",
      date,
      extensions: [],
      explanation: {
        text: `Zmiana stanowiska ${formatDatePl(changeDate)} nastąpiła w ciągu ${months(pc.thresholdMonths)} ${anchorText}, więc do ${formatDatePl(date)} trzeba ponownie ustalić kryteria. Termin oceny się nie zmienia.${note}`,
        legalBasis: withShiftBasis(lb.positionChangeEarly, note),
      },
    };
  }

  const earliest = addDays(changeDate, -pc.evaluationDaysBefore);
  const { date, note } = shiftEnd(addDays(changeDate, pc.evaluationDaysAfter), r);
  return {
    kind: "OCENA_PRZY_ZMIANIE_STANOWISKA",
    date,
    earliest,
    extensions: [],
    explanation: {
      text: `Zmiana stanowiska ${formatDatePl(changeDate)} nastąpiła po upływie ${months(pc.thresholdMonths)} ${anchorText}, więc trzeba sporządzić ocenę: nie wcześniej niż ${formatDatePl(earliest)} i nie później niż ${formatDatePl(date)}.${note}`,
      legalBasis: withShiftBasis(lb.positionChangeLate, note),
    },
  };
}

/** Sprzeciw od oceny okresowej: 7 dni od zapoznania się z oceną (art. 83 ustawy). */
export function objectionDeadline(acknowledgedAt: IsoDate, r: Rules = defaultRules): Deadline {
  const pd = r.periodicDeadlines;
  const { date, note } = shiftEnd(addDays(acknowledgedAt, pd.objectionDays), r);
  return {
    kind: "SPRZECIW",
    date,
    extensions: [],
    explanation: {
      text: `Oceniany może złożyć sprzeciw do ${formatDatePl(date)}: ${days(pd.objectionDays)} od zapoznania się z oceną (${formatDatePl(acknowledgedAt)}).${note}`,
      legalBasis: withShiftBasis(`${pd.legalBasis.objection}, ${LB_KC_DAYS}`, note),
    },
  };
}

// ---------------------------------------------------------------------------
// Pierwsza ocena
// ---------------------------------------------------------------------------

/** Rozmowa wstępna: 21 dni od nawiązania stosunku pracy (§ 3). */
export function initialConversationDeadline(employmentStart: IsoDate, r: Rules = defaultRules): Deadline {
  const fe = r.firstEval;
  const { date, note } = shiftEnd(addDays(employmentStart, fe.initialConversationDays), r);
  return {
    kind: "ROZMOWA_WSTEPNA",
    date,
    extensions: [],
    explanation: {
      text: `Rozmowę wstępną trzeba przeprowadzić do ${formatDatePl(date)}: ${days(fe.initialConversationDays)} od nawiązania stosunku pracy (${formatDatePl(employmentStart)}). W jej trakcie wyznacza się termin sprawozdania.${note}`,
      legalBasis: withShiftBasis(`${fe.legalBasis.initialConversation}, ${LB_KC_DAYS}`, note),
    },
  };
}

/**
 * Okno pierwszej oceny (art. 38 ust. 1 ustawy): po upływie 8 miesięcy od nawiązania stosunku pracy
 * i nie później niż miesiąc przed jego końcem.
 * ZAŁOŻENIE: „po upływie 8 miesięcy” = dzień po dniu z art. 112 KC; ostatni dzień okna, który wypada w dzień wolny,
 * cofamy na poprzedni dzień roboczy, żeby nie przekroczyć granicy „miesiąc przed końcem” (docs/ZALOZENIA.md #13).
 */
export function firstEvalWindow(
  input: { employmentStart: IsoDate; contractEnd: IsoDate },
  r: Rules = defaultRules,
): [Deadline, Deadline] {
  const fe = r.firstEval;
  const earliest = addDays(addMonths(input.employmentStart, fe.evaluationEarliestMonths), 1);
  const rawLatest = addMonths(input.contractEnd, -fe.evaluationLatestMonthsBeforeContractEnd);
  const latest = r.dateCounting.moveToNextWorkingDay ? previousWorkingDay(rawLatest, r.dateCounting.saturdayIsDayOff) : rawLatest;
  const moved = latest !== rawLatest ? ` ${formatDatePl(rawLatest)} wypada w ${dayOffReason(rawLatest)}, więc ostatnim dniem roboczym jest ${formatDatePl(latest)}.` : "";
  const invalid = latest < earliest ? " Uwaga: okno jest puste – umowa kończy się zbyt wcześnie. Skontaktuj się z HR." : "";

  return [
    {
      kind: "PIERWSZA_OCENA_OD",
      date: earliest,
      extensions: [],
      explanation: {
        text: `Pierwszą ocenę można sporządzić najwcześniej ${formatDatePl(earliest)}: po upływie ${months(fe.evaluationEarliestMonths)} od nawiązania stosunku pracy (${formatDatePl(input.employmentStart)}).`,
        legalBasis: fe.legalBasis.evaluationWindow,
      },
    },
    {
      kind: "PIERWSZA_OCENA_DO",
      date: latest,
      earliest,
      extensions: [],
      explanation: {
        text: `Pierwszą ocenę trzeba sporządzić między ${formatDatePl(earliest)} a ${formatDatePl(latest)}: najpóźniej ${months(fe.evaluationLatestMonthsBeforeContractEnd)} przed końcem umowy (${formatDatePl(input.contractEnd)}).${moved}${invalid}`,
        legalBasis: fe.legalBasis.evaluationWindow,
      },
    },
  ];
}

/**
 * Termin złożenia sprawozdania. Wyznacza go przełożony w rozmowie wstępnej (`reportDue`) tak, by przypadał
 * po upływie 8 miesięcy od nawiązania stosunku pracy (§ 4 ust. 1). Bez `reportDue` silnik proponuje najwcześniejszy dzień.
 * ZAŁOŻENIE: każda usprawiedliwiona nieobecność wydłuża termin, bez progu miesiąca (§ 5 ust. 1, docs/ZALOZENIA.md #8).
 */
export function reportDeadline(
  input: { employmentStart: IsoDate; reportDue?: IsoDate; absences?: readonly AbsencePeriod[] },
  r: Rules = defaultRules,
): Deadline {
  const fe = r.firstEval;
  const earliestAllowed = addDays(addMonths(input.employmentStart, fe.evaluationEarliestMonths), 1);
  const base = input.reportDue ?? earliestAllowed;
  const ext = absenceExtensions(input.employmentStart, base, input.absences ?? [], null, r);
  const { date, note } = shiftEnd(ext.deadline, r);

  const origin = input.reportDue
    ? `termin wyznaczony w rozmowie wstępnej to ${formatDatePl(base)}.`
    : `proponowany termin to ${formatDatePl(base)} – najwcześniejszy dzień po upływie ${months(fe.evaluationEarliestMonths)} od nawiązania stosunku pracy.`;
  const tooEarly =
    input.reportDue && input.reportDue < earliestAllowed
      ? ` Uwaga: termin musi przypadać po upływie ${months(fe.evaluationEarliestMonths)} od nawiązania stosunku pracy, czyli najwcześniej ${formatDatePl(earliestAllowed)}.`
      : "";
  const notice = ext.extensions.length ? " O nowym terminie trzeba pisemnie zawiadomić ocenianego (§ 5 ust. 4)." : "";

  return {
    kind: "SPRAWOZDANIE",
    date,
    extensions: ext.extensions,
    explanation: {
      text: `Sprawozdanie trzeba złożyć do ${formatDatePl(date)}: ${origin}${extensionsText(ext.extensions)}${notice}${tooEarly}${note}`,
      legalBasis: withShiftBasis(ext.extensions.length ? `${fe.legalBasis.reportDue}, ${fe.legalBasis.reportNewDate}` : fe.legalBasis.reportDue, note),
    },
  };
}

// ---------------------------------------------------------------------------
// Pilność i karta „Do zrobienia”
// ---------------------------------------------------------------------------

/** Dni do terminu (ujemne = po terminie). */
export function daysUntil(deadline: Deadline, today: IsoDate): number {
  return daysBetween(today, deadline.date);
}

/** Po terminie / do 7 dni / do 30 dni / w terminie (progi z data/przepisy.json). */
export function deadlineUrgency(deadline: Deadline, today: IsoDate, r: Rules = defaultRules): DeadlineUrgency {
  const left = daysUntil(deadline, today);
  if (left < 0) return "PO_TERMINIE";
  if (left <= r.deadlineUrgency.urgentDays) return "PILNE";
  if (left <= r.deadlineUrgency.soonDays) return "WKROTCE";
  return "W_TERMINIE";
}

/** Rodzaje terminów, które są zadaniem przełożonego. „Najwcześniej” i sprzeciw (termin ocenianego) pomijamy. */
const TODO_ACTIONS: Partial<Record<DeadlineKind, string>> = {
  ROZMOWA_ROZPOCZYNAJACA: "Przygotuj rozmowę",
  ROZMOWA_PO_NEGATYWNEJ: "Przygotuj rozmowę",
  OCENA_OKRESOWA: "Rozpocznij ocenę",
  PONOWNA_OCENA_PO_NEGATYWNEJ: "Rozpocznij ocenę",
  PONOWNE_KRYTERIA_PO_ZMIANIE_STANOWISKA: "Ustal kryteria",
  OCENA_PRZY_ZMIANIE_STANOWISKA: "Rozpocznij ocenę",
  ROZMOWA_WSTEPNA: "Przygotuj rozmowę",
  SPRAWOZDANIE: "Sprawdź sprawozdanie",
  PIERWSZA_OCENA_DO: "Rozpocznij ocenę",
};

export interface TodoSource {
  employeeId: string;
  /** Imię i nazwisko do treści karty, np. „Jan Nowak”. */
  employeeName: string;
  evaluationId?: string;
  /** Otwarte terminy pracownika (wykonane czynności wywołujący pomija). */
  deadlines: Deadline[];
}

export interface TodoOptions {
  /** Ile kart pokazać (domyślnie 5). */
  limit?: number;
  /** Adres przycisku akcji; domyślnie karta pracownika. */
  hrefFor?: (source: TodoSource, deadline: Deadline) => string;
  rules?: Rules;
}

/** „J. Nowak” */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName.trim();
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`;
}

function basisForTitle(d: Deadline): string {
  const basis = d.explanation.legalBasis?.split(",")[0]?.trim();
  return basis ? ` (${basis})` : "";
}

/**
 * Najpilniejsze sprawy przełożonego, posortowane od najwcześniejszego terminu.
 * Karta: „Rozmowa rozpoczynająca – J. Nowak – do pt. 28.11 (§ 7 pkt 1)” z jednym przyciskiem akcji.
 */
export function buildTodoItems(sources: readonly TodoSource[], today: IsoDate, options: TodoOptions = {}): TodoItem[] {
  const r = options.rules ?? defaultRules;
  const hrefFor = options.hrefFor ?? ((s: TodoSource) => `/pracownicy/${encodeURIComponent(s.employeeId)}`);
  const items: TodoItem[] = [];
  for (const s of sources) {
    for (const d of s.deadlines) {
      const actionLabel = TODO_ACTIONS[d.kind];
      if (!actionLabel) continue;
      const urgency = deadlineUrgency(d, today, r);
      // Rok dopisujemy, gdy termin wypada w innym roku niż dziś – inaczej „22.12” byłoby niejednoznaczne.
      const day = d.date.slice(0, 4) === today.slice(0, 4) ? formatDateShortPl(d.date) : formatDatePl(d.date);
      const when = urgency === "PO_TERMINIE" ? `termin minął ${day}` : `do ${day}`;
      items.push({
        employeeId: s.employeeId,
        evaluationId: s.evaluationId,
        deadline: d,
        urgency,
        title: `${DEADLINE_KIND_LABELS[d.kind]} – ${shortName(s.employeeName)} – ${when}${basisForTitle(d)}`,
        actionLabel,
        href: hrefFor(s, d),
      });
    }
  }
  items.sort((a, b) => (a.deadline.date < b.deadline.date ? -1 : a.deadline.date > b.deadline.date ? 1 : 0));
  return items.slice(0, options.limit ?? 5);
}
