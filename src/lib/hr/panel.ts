// Panel HR, część 1: czysta logika bez bazy – bieżący termin każdej oceny, filtry, przypomnienia i zawiadomienie.
//
// Terminy liczy zawsze silnik terminów (src/lib/rules/terminy.ts) na podstawie danych pracownika i nieobecności,
// a nie zapisane `Evaluation.dueDate`. Dzięki temu nieobecność dopisana później od razu wydłuża termin w panelu,
// a HR widzi wyjaśnienie, np. „+44 dni: zwolnienie lekarskie 12.03–24.04”.

import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { EVALUATION_STATUS_LABELS } from "@/lib/domain/slownik";
import {
  EVALUATION_STATUSES,
  type Deadline,
  type DeadlineKind,
  type DeadlineUrgency,
  type EvaluationResult,
  type EvaluationStatus,
  type EvaluationType,
  type IsoDate,
  type Sheet,
} from "@/lib/domain/types";
import { formatDatePl } from "@/lib/rules/kalendarz";
import {
  DEADLINE_KIND_LABELS,
  afterNegativeDeadlines,
  criteriaConversationDeadline,
  daysUntil,
  deadlineUrgency,
  firstEvalWindow,
  initialConversationDeadline,
  periodicEvaluationDeadline,
  type AbsencePeriod,
} from "@/lib/rules/terminy";

/** Ocena z danymi potrzebnymi do policzenia terminu (z bazy, po złączeniu z pracownikiem). */
export interface HrEvaluationRecord {
  id: string;
  type: EvaluationType;
  sheet: Sheet;
  status: EvaluationStatus;
  isReevaluation: boolean;
  criteriaSetAt: IsoDate | null;
  evaluatedAt: IsoDate | null;
  acknowledgedAt: IsoDate | null;
  result: EvaluationResult | null;
  previousDate: IsoDate | null;
  previousResult: EvaluationResult | null;
  /** Dzień zapoznania się z poprzednią oceną (po ocenie negatywnej od niego biegnie 6 miesięcy – art. 81 ust. 9). */
  previousAcknowledgedAt: IsoDate | null;
  evaluatorId: string;
  evaluatorName: string;
  employee: {
    id: string;
    name: string;
    orgUnit: string | null;
    employmentStart: IsoDate;
    permanentFrom: IsoDate | null;
    contractEnd: IsoDate | null;
    absences: AbsencePeriod[];
    /** Wyniki zakończonych ocen pracownika od najnowszej (do ostrzeżenia z art. 71). */
    pastResults: EvaluationResult[];
  };
}

export interface HrRow {
  evaluationId: string;
  evaluatorId: string;
  employeeId: string;
  employeeName: string;
  orgUnit: string | null;
  evaluatorName: string;
  type: EvaluationType;
  sheet: Sheet;
  status: EvaluationStatus;
  statusLabel: string;
  /** Najbliższy termin, który HR ma pilnować; null, gdy ocena czeka na zapoznanie albo jest zakończona. */
  deadline: Deadline | null;
  urgency: DeadlineUrgency | null;
  daysLeft: number | null;
  /** „+44 dni: zwolnienie lekarskie 12.03–24.04” – wydłużenia z nieobecności. */
  extensionText: string | null;
  /** Ostrzeżenia dla HR (nigdy automatyczna akcja). */
  warnings: string[];
}

const days = (n: number) => `${n} ${n === 1 ? "dzień" : "dni"}`;

/** Od czego biegnie 24-miesięczny termin: poprzednia ocena albo zatrudnienie na czas nieokreślony. */
function periodicAnchor(e: HrEvaluationRecord) {
  if (e.previousDate) return { kind: "POPRZEDNIA_OCENA" as const, date: e.previousDate };
  if (e.employee.permanentFrom) return { kind: "ZATRUDNIENIE_NA_CZAS_NIEOKRESLONY" as const, date: e.employee.permanentFrom };
  return null;
}

/** Bieżący termin oceny według etapu procesu (silnik terminów). */
export function currentDeadline(e: HrEvaluationRecord, r: Rules = defaultRules): Deadline | null {
  if (e.status === "CZEKA_NA_ZAPOZNANIE" || e.status === "ZAKONCZONA") return null;

  if (e.type === "PIERWSZA") {
    if (e.status === "DO_ROZPOCZECIA") return initialConversationDeadline(e.employee.employmentStart, r);
    if (!e.employee.contractEnd) return null;
    return firstEvalWindow({ employmentStart: e.employee.employmentStart, contractEnd: e.employee.contractEnd }, r).find((d) => d.kind === "PIERWSZA_OCENA_DO") ?? null;
  }

  // Ocena okresowa po ocenie negatywnej: rozmowa w 7 dni, ponowna ocena po 6 miesiącach (art. 81 ust. 9).
  if (e.isReevaluation && e.previousDate) {
    const [conv, reeval] = afterNegativeDeadlines({ evaluatedAt: e.previousDate, acknowledgedAt: e.previousAcknowledgedAt ?? undefined }, r);
    return e.status === "DO_ROZPOCZECIA" ? conv! : (reeval ?? conv!);
  }

  const anchor = periodicAnchor(e);
  if (!anchor) return null;
  if (e.status === "DO_ROZPOCZECIA") return criteriaConversationDeadline(anchor, r);
  return periodicEvaluationDeadline({ anchor, absences: e.employee.absences }, r);
}

export function extensionText(d: Deadline | null): string | null {
  if (!d || d.extensions.length === 0) return null;
  const total = d.extensions.reduce((n, x) => n + x.days, 0);
  return `+${days(total)}: ${d.extensions.map((x) => x.reason).join("; ")}`;
}

/** Ostrzeżenie z art. 71 ustawy: dwie kolejne oceny negatywne. Tylko informacja dla HR. */
export function hrWarnings(e: HrEvaluationRecord): string[] {
  const [last, beforeLast] = e.employee.pastResults;
  return last === "NEGATYWNA" && beforeLast === "NEGATYWNA"
    ? ["Dwie kolejne oceny negatywne – przesłanka rozwiązania stosunku pracy (art. 71 ustawy o służbie cywilnej). Decyzja należy do dyrektora generalnego; system niczego nie robi automatycznie."]
    : [];
}

export function toHrRow(e: HrEvaluationRecord, today: IsoDate, r: Rules = defaultRules): HrRow {
  const deadline = currentDeadline(e, r);
  return {
    evaluationId: e.id,
    evaluatorId: e.evaluatorId,
    employeeId: e.employee.id,
    employeeName: e.employee.name,
    orgUnit: e.employee.orgUnit,
    evaluatorName: e.evaluatorName,
    type: e.type,
    sheet: e.sheet,
    status: e.status,
    statusLabel: EVALUATION_STATUS_LABELS[e.type][e.status],
    deadline,
    urgency: deadline ? deadlineUrgency(deadline, today, r) : null,
    daysLeft: deadline ? daysUntil(deadline, today) : null,
    extensionText: extensionText(deadline),
    warnings: hrWarnings(e),
  };
}

// ---------------------------------------------------------------------------
// Filtry tabeli (parametry adresu – działają bez JavaScriptu)
// ---------------------------------------------------------------------------

export type UrgencyFilter = DeadlineUrgency | "BEZ_TERMINU";

export interface HrFilters {
  /** Brak = oceny w toku (bez zakończonych); "WSZYSTKIE" = także zakończone. */
  status?: EvaluationStatus | "WSZYSTKIE";
  urgency?: UrgencyFilter;
  orgUnit?: string;
}

const URGENCY_FILTERS: UrgencyFilter[] = ["PO_TERMINIE", "PILNE", "WKROTCE", "W_TERMINIE", "BEZ_TERMINU"];
type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export function parseHrFilters(params: Params): HrFilters {
  const status = first(params.etap);
  const urgency = first(params.termin);
  return {
    status: status === "WSZYSTKIE" || EVALUATION_STATUSES.includes(status as EvaluationStatus) ? (status as HrFilters["status"]) : undefined,
    urgency: URGENCY_FILTERS.includes(urgency as UrgencyFilter) ? (urgency as UrgencyFilter) : undefined,
    orgUnit: first(params.komorka),
  };
}

export function applyHrFilters(rows: HrRow[], f: HrFilters): HrRow[] {
  return rows.filter(
    (row) =>
      (f.status === "WSZYSTKIE" || (f.status ? row.status === f.status : row.status !== "ZAKONCZONA")) &&
      (!f.urgency || (f.urgency === "BEZ_TERMINU" ? row.urgency === null : row.urgency === f.urgency)) &&
      (!f.orgUnit || row.orgUnit === f.orgUnit),
  );
}

/** Najpierw oceny z terminem (od najwcześniejszego), potem bez terminu; w obrębie – alfabetycznie. */
export function sortHrRows(rows: HrRow[]): HrRow[] {
  return [...rows].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.date.localeCompare(b.deadline.date) || a.employeeName.localeCompare(b.employeeName, "pl");
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return a.employeeName.localeCompare(b.employeeName, "pl");
  });
}

export interface HrSummary {
  open: number;
  overdue: number;
  urgent: number;
  extended: number;
}

export function summarize(rows: HrRow[]): HrSummary {
  return {
    open: rows.filter((r) => r.status !== "ZAKONCZONA").length,
    overdue: rows.filter((r) => r.urgency === "PO_TERMINIE").length,
    urgent: rows.filter((r) => r.urgency === "PILNE").length,
    extended: rows.filter((r) => r.extensionText).length,
  };
}

// ---------------------------------------------------------------------------
// Przypomnienia (symulacja wysyłki e-mail)
// ---------------------------------------------------------------------------

export interface ReminderDraft {
  kind: DeadlineKind;
  dueDate: IsoDate;
  subject: string;
  body: string;
}

/** Treść przypomnienia dla oceniającego – z wyjaśnieniem terminu i podstawą prawną. */
export function reminderFor(row: HrRow): ReminderDraft | null {
  const d = row.deadline;
  if (!d) return null;
  const when = row.urgency === "PO_TERMINIE" ? `termin minął ${formatDatePl(d.date)}` : `termin: ${formatDatePl(d.date)}`;
  return {
    kind: d.kind,
    dueDate: d.date,
    subject: `${DEADLINE_KIND_LABELS[d.kind]} – ${row.employeeName} – ${when}`,
    body: [
      `Dzień dobry,`,
      ``,
      `przypominamy o terminie: ${DEADLINE_KIND_LABELS[d.kind].toLocaleLowerCase("pl")} (${row.employeeName}).`,
      d.explanation.text,
      d.explanation.legalBasis ? `Podstawa: ${d.explanation.legalBasis}.` : "",
      ``,
      `Szczegóły i kolejne kroki znajdziesz w aplikacji Kompas Kompetencji.`,
      `Komórka kadr`,
    ]
      .filter((line, i, all) => line !== "" || all[i - 1] !== "")
      .join("\n"),
  };
}

/**
 * Czy dla oceny warto dodać przypomnienie: termin do 30 dni albo po terminie, a o tym samym terminie
 * (pracownik, rodzaj, data) nie ma jeszcze przypomnienia – wysłanego ani czekającego w kolejce.
 * Gdy termin się zmieni (np. nowa nieobecność), można przypomnieć ponownie.
 */
export function needsReminder(row: HrRow, existing: { employeeId: string | null; kind: string; dueDate: IsoDate }[]): boolean {
  if (!row.deadline || row.urgency === "W_TERMINIE") return false;
  const d = row.deadline;
  return !existing.some((q) => q.employeeId === row.employeeId && q.kind === d.kind && q.dueDate === d.date);
}

// ---------------------------------------------------------------------------
// Pisemne zawiadomienie o zmianie terminu oceny (§ 8 rozporządzenia)
// ---------------------------------------------------------------------------

export interface ChangeNotice {
  employeeName: string;
  previousDate: IsoDate;
  newDate: IsoDate;
  reasons: string[];
  /** Treść pisma do druku (akapity). */
  paragraphs: string[];
  legalBasis: string;
}

/**
 * Wzór zawiadomienia: termin sporządzenia oceny zmienił się z powodu nieobecności (art. 81 ust. 7).
 * Zwraca null, gdy termin się nie zmienił (brak wydłużeń).
 */
export function changeNoticeFor(e: HrEvaluationRecord, r: Rules = defaultRules): ChangeNotice | null {
  if (e.type !== "OKRESOWA" || e.isReevaluation) return null;
  const anchor = periodicAnchor(e);
  if (!anchor) return null;
  const withAbsences = periodicEvaluationDeadline({ anchor, absences: e.employee.absences }, r);
  if (withAbsences.extensions.length === 0) return null;
  const base = periodicEvaluationDeadline({ anchor }, r);
  const total = withAbsences.extensions.reduce((n, x) => n + x.days, 0);
  const pd = r.periodicDeadlines.legalBasis;
  return {
    employeeName: e.employee.name,
    previousDate: base.date,
    newDate: withAbsences.date,
    reasons: withAbsences.extensions.map((x) => `${x.reason} (${days(x.days)})`),
    legalBasis: `${pd.absenceExtension} o służbie cywilnej, § 8 rozporządzenia w sprawie ocen okresowych`,
    paragraphs: [
      `Uprzejmie informuję, że termin sporządzenia Pani/Pana oceny okresowej uległ zmianie.`,
      `Dotychczasowy termin: ${formatDatePl(base.date)}. Nowy termin: ${formatDatePl(withAbsences.date)}.`,
      `Przyczyną zmiany jest usprawiedliwiona nieobecność w pracy trwająca dłużej niż miesiąc, o którą przedłuża się termin oceny (łącznie ${days(total)}): ${withAbsences.extensions.map((x) => x.reason).join("; ")}.`,
      `Kopię niniejszego zawiadomienia dołącza się do arkusza oceny okresowej.`,
    ],
  };
}
