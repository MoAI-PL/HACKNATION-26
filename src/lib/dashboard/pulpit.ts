// Pulpit przełożonego (Z11) – czysta logika, bez bazy danych. Testy: tests/dashboard/pulpit.test.ts.
//
// Z danych pracownika (bieżąca ocena, poprzednie oceny, nieobecności, zmiany stanowiska) ustalamy,
// jakie terminy są teraz OTWARTE dla przełożonego. Terminy liczy silnik Z08 – tu decydujemy tylko, który dotyczy
// danego etapu procesu. Z tego powstaje karta „Do zrobienia” (buildTodoItems z Z08) i lista podwładnych.

import type {
  Deadline,
  DeadlineUrgency,
  EvaluationResult,
  EvaluationStatus,
  EvaluationType,
  IsoDate,
  Level,
  PositionChangeEvent,
  Sheet,
  TodoItem,
} from "@/lib/domain/types";
import {
  afterNegativeDeadlines,
  buildTodoItems,
  criteriaConversationDeadline,
  daysUntil,
  deadlineUrgency,
  firstEvalWindow,
  initialConversationDeadline,
  periodicEvaluationDeadline,
  positionChangeDeadline,
  reportDeadline,
  type AbsencePeriod,
  type PeriodicAnchor,
  type TodoSource,
} from "@/lib/rules/terminy";
import { formatDatePl, formatDateShortPl } from "@/lib/rules/kalendarz";
import { isScreenReady } from "@/lib/ui/nav";
import { plural } from "@/lib/rules/tekst";

/** Ocena pracownika potrzebna do ustalenia terminów. */
export interface EvaluationInfo {
  id: string;
  type: EvaluationType;
  sheet: Sheet;
  status: EvaluationStatus;
  isReevaluation: boolean;
  criteriaSetAt?: IsoDate;
  evaluatedAt?: IsoDate;
  acknowledgedAt?: IsoDate;
  result?: EvaluationResult;
  /** Poziom ogólny sporządzonej oceny. */
  level?: Level;
  /** Zapisany termin sporządzenia oceny – zapasowo, gdy brak danych do wyliczenia. */
  dueDate?: IsoDate;
  /** Pierwsza ocena: termin sprawozdania wyznaczony w rozmowie wstępnej. */
  reportDue?: IsoDate;
  reportSubmittedAt?: IsoDate;
}

export interface EmployeeInfo {
  id: string;
  firstName: string;
  lastName: string;
  positionTitle?: string;
  orgUnit?: string;
  employmentStart: IsoDate;
  permanentFrom?: IsoDate;
  contractEnd?: IsoDate;
  /** Wszystkie oceny pracownika (bieżąca i poprzednie). */
  evaluations: EvaluationInfo[];
  absences: AbsencePeriod[];
  positionChanges: (PositionChangeEvent & { date: IsoDate })[];
  observationsCount: number;
  lastObservationDate?: IsoDate;
}

/** „pt. 27.11” w bieżącym roku, „22.12.2025” w innym – data na kartach pulpitu bez niejednoznaczności. */
export function formatDay(date: IsoDate, today: IsoDate): string {
  return date.slice(0, 4) === today.slice(0, 4) ? formatDateShortPl(date) : formatDatePl(date);
}

export function fullName(e: Pick<EmployeeInfo, "firstName" | "lastName">): string {
  return `${e.firstName} ${e.lastName}`;
}

/** Bieżąca (niezakończona) ocena – najnowsza, jeśli jest kilka. */
export function currentEvaluation(e: EmployeeInfo): EvaluationInfo | undefined {
  const open = e.evaluations.filter((ev) => ev.status !== "ZAKONCZONA");
  return open[open.length - 1];
}

/** Ostatnia sporządzona ocena okresowa (punkt odniesienia dla 24 miesięcy). */
export function lastCompletedPeriodic(e: EmployeeInfo, exceptId?: string): EvaluationInfo | undefined {
  return e.evaluations
    .filter((ev) => ev.id !== exceptId && ev.type === "OKRESOWA" && ev.evaluatedAt)
    .sort((a, b) => (a.evaluatedAt! < b.evaluatedAt! ? -1 : 1))
    .at(-1);
}

function periodicAnchor(e: EmployeeInfo, current: EvaluationInfo): PeriodicAnchor | undefined {
  const prev = lastCompletedPeriodic(e, current.id);
  if (prev?.evaluatedAt) return { kind: "POPRZEDNIA_OCENA", date: prev.evaluatedAt };
  if (e.permanentFrom) return { kind: "ZATRUDNIENIE_NA_CZAS_NIEOKRESLONY", date: e.permanentFrom };
  return undefined;
}

/**
 * Otwarte terminy przełożonego dla pracownika, zależnie od etapu bieżącej oceny:
 * - ocena okresowa przed rozmową rozpoczynającą: 30 dni (albo 7 dni po ocenie negatywnej);
 * - w okresie oceny / w trakcie oceny: termin sporządzenia oceny (24 mies. z wydłużeniem o nieobecności
 *   albo ponowna ocena po 6 mies.) oraz terminy po zmianie stanowiska;
 * - pierwsza ocena: rozmowa wstępna (21 dni), sprawozdanie, okno pierwszej oceny.
 * Etap „czeka na zapoznanie” i „zakończona” nie mają terminów przełożonego.
 */
export function openDeadlines(e: EmployeeInfo): Deadline[] {
  const current = currentEvaluation(e);
  if (!current) return [];
  const result: Deadline[] = [];

  if (current.type === "OKRESOWA") {
    const prev = lastCompletedPeriodic(e, current.id);
    const afterNegative =
      prev?.result === "NEGATYWNA" && prev.evaluatedAt
        ? afterNegativeDeadlines({ evaluatedAt: prev.evaluatedAt, acknowledgedAt: prev.acknowledgedAt })
        : undefined;

    if (current.status === "DO_ROZPOCZECIA") {
      if (afterNegative) result.push(afterNegative[0]!);
      else {
        const anchor = periodicAnchor(e, current);
        if (anchor) result.push(criteriaConversationDeadline(anchor));
      }
    } else if (current.status === "W_OKRESIE_OCENY" || current.status === "W_OCENIE") {
      const reeval = afterNegative?.find((d) => d.kind === "PONOWNA_OCENA_PO_NEGATYWNEJ");
      if (current.isReevaluation) {
        // Ponowna ocena po negatywnej: 6 miesięcy od zapoznania (bez zapoznania – termin zapisany w arkuszu).
        if (reeval) result.push(reeval);
        else if (current.dueDate) result.push(fallbackDue(current.dueDate));
      } else {
        const anchor = periodicAnchor(e, current);
        if (anchor) result.push(periodicEvaluationDeadline({ anchor, absences: e.absences }));
        else if (current.dueDate) result.push(fallbackDue(current.dueDate));
      }
      for (const change of e.positionChanges) {
        if (current.criteriaSetAt && change.date < current.criteriaSetAt) continue;
        const d = positionChangeDeadline({ change, lastEvaluationAt: prev?.evaluatedAt, criteriaSetAt: current.criteriaSetAt });
        if (d) result.push(d);
      }
    }
  } else {
    if (current.status === "DO_ROZPOCZECIA") {
      result.push(initialConversationDeadline(e.employmentStart));
    } else if (current.status === "W_OKRESIE_OCENY" && !current.reportSubmittedAt) {
      result.push(reportDeadline({ employmentStart: e.employmentStart, reportDue: current.reportDue, absences: e.absences }));
    }
    if ((current.status === "W_OKRESIE_OCENY" || current.status === "W_OCENIE") && e.contractEnd) {
      result.push(firstEvalWindow({ employmentStart: e.employmentStart, contractEnd: e.contractEnd })[1]);
    }
  }

  return result.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function fallbackDue(date: IsoDate): Deadline {
  return {
    kind: "OCENA_OKRESOWA",
    date,
    extensions: [],
    explanation: { text: "Termin sporządzenia oceny zapisany w arkuszu (część I).", legalBasis: "§ 5 ust. 3" },
  };
}

// ---------------------------------------------------------------------------
// Lista podwładnych
// ---------------------------------------------------------------------------

export interface EmployeeRow {
  id: string;
  name: string;
  positionTitle?: string;
  orgUnit?: string;
  evaluation?: { id: string; type: EvaluationType; sheet: Sheet; status: EvaluationStatus; isReevaluation: boolean };
  next?: { deadline: Deadline; daysLeft: number; urgency: DeadlineUrgency };
  observationsCount: number;
  lastObservationDate?: IsoDate;
}

export function employeeRow(e: EmployeeInfo, today: IsoDate): EmployeeRow {
  const current = currentEvaluation(e);
  const first = openDeadlines(e)[0];
  return {
    id: e.id,
    name: fullName(e),
    positionTitle: e.positionTitle,
    orgUnit: e.orgUnit,
    evaluation: current && {
      id: current.id,
      type: current.type,
      sheet: current.sheet,
      status: current.status,
      isReevaluation: current.isReevaluation,
    },
    next: first && { deadline: first, daysLeft: daysUntil(first, today), urgency: deadlineUrgency(first, today) },
    observationsCount: e.observationsCount,
    lastObservationDate: e.lastObservationDate,
  };
}

/** Kolejność listy: najpierw najpilniejsze terminy, osoby bez terminu na końcu, potem alfabetycznie. */
export function sortRows(rows: EmployeeRow[]): EmployeeRow[] {
  return [...rows].sort((a, b) => {
    const da = a.next?.deadline.date ?? "9999-12-31";
    const db = b.next?.deadline.date ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    return a.name.localeCompare(b.name, "pl");
  });
}

// ---------------------------------------------------------------------------
// Karta „Do zrobienia”
// ---------------------------------------------------------------------------

/** Karta pracownika na pulpicie – szczegóły terminów z wyjaśnieniem (Z11). */
export function employeeHref(employeeId: string): string {
  return `/pulpit/pracownik/${encodeURIComponent(employeeId)}`;
}

/** Kreator oceny okresowej (Z12) dla danej oceny. */
export function periodicEvaluationHref(evaluationId: string): string {
  return `/ocena/okresowa/${encodeURIComponent(evaluationId)}`;
}

export interface TodoTarget {
  href: string;
  label: string;
}

/** Zakończenie oceny okresowej – karty zachowań, sugestia i decyzja przełożonego (Z14). */
export function periodicAssessmentHref(evaluationId: string): string {
  return `${periodicEvaluationHref(evaluationId)}/ocena`;
}

/** Terminy, przy których przełożony sporządza ocenę okresową (ekran Z14). */
const ASSESSMENT_KINDS = new Set(["OCENA_OKRESOWA", "PONOWNA_OCENA_PO_NEGATYWNEJ", "OCENA_PRZY_ZMIANIE_STANOWISKA"]);

/** „Kontynuuj ocenę”, gdy przełożony już zaczął oceniać wskaźniki, w przeciwnym razie „Zakończ ocenę” (jak w Z12/Z14). */
function assessmentLabel(status: EvaluationStatus | undefined): string {
  return status === "W_OCENIE" ? "Kontynuuj ocenę" : "Zakończ ocenę";
}

/**
 * Dokąd prowadzi przycisk sprawy z „Do zrobienia”.
 * - rozmowa rozpoczynająca (także po ocenie negatywnej) → kreator części I (Z12): „Ustal kryteria”;
 * - sporządzenie oceny okresowej (24 mies., ponowna po negatywnej, przy zmianie stanowiska) → zakończenie oceny (Z14):
 *   „Zakończ ocenę” / „Kontynuuj ocenę”;
 * - pozostałe sprawy (pierwsza ocena – Z17, ponowne kryteria po zmianie stanowiska) → karta pracownika z wyjaśnieniem terminu.
 * Gotowość ekranu bierzemy z menu (isScreenReady) – bez martwych linków i bez obietnic, których ekran nie spełni.
 */
export function todoTarget(
  item: Pick<TodoItem, "employeeId" | "evaluationId" | "deadline">,
  ready: (href: string) => boolean = isScreenReady,
  status?: EvaluationStatus,
): TodoTarget {
  const kind = item.deadline.kind;
  if (item.evaluationId) {
    if (kind === "ROZMOWA_ROZPOCZYNAJACA" || kind === "ROZMOWA_PO_NEGATYWNEJ") {
      const href = periodicEvaluationHref(item.evaluationId);
      if (ready(href)) return { href, label: "Ustal kryteria" };
    }
    if (ASSESSMENT_KINDS.has(kind) && (status === "W_OKRESIE_OCENY" || status === "W_OCENIE")) {
      const href = periodicAssessmentHref(item.evaluationId);
      if (ready(href)) return { href, label: assessmentLabel(status) };
    }
  }
  return { href: employeeHref(item.employeeId), label: "Zobacz szczegóły" };
}

export function buildDashboardTodo(
  employees: EmployeeInfo[],
  today: IsoDate,
  limit = 5,
  ready: (href: string) => boolean = isScreenReady,
): TodoItem[] {
  const statusById = new Map<string, EvaluationStatus>();
  const sources: TodoSource[] = employees.map((e) => {
    const current = currentEvaluation(e);
    if (current) statusById.set(current.id, current.status);
    return { employeeId: e.id, employeeName: fullName(e), evaluationId: current?.id, deadlines: openDeadlines(e) };
  });
  return buildTodoItems(sources, today, { limit }).map((item) => {
    const target = todoTarget(item, ready, item.evaluationId ? statusById.get(item.evaluationId) : undefined);
    return { ...item, href: target.href, actionLabel: target.label };
  });
}

/** Główna akcja na karcie pracownika: kreator / część I oceny okresowej, gdy ekran jest gotowy. */
export function evaluationLink(
  e: EmployeeInfo,
  ready: (href: string) => boolean = isScreenReady,
): TodoTarget | null {
  const current = currentEvaluation(e);
  if (!current || current.type !== "OKRESOWA") return null;
  if (current.status === "W_OKRESIE_OCENY" || current.status === "W_OCENIE") {
    const href = periodicAssessmentHref(current.id);
    if (ready(href)) return { href, label: assessmentLabel(current.status) };
  }
  const href = periodicEvaluationHref(current.id);
  if (!ready(href)) return null;
  return { href, label: current.status === "DO_ROZPOCZECIA" ? "Ustal kryteria" : "Otwórz ocenę okresową" };
}

// ---------------------------------------------------------------------------
// Wejścia w ścieżki (grafika MC: dwie ścieżki oceny i dwóch asystentów)
// ---------------------------------------------------------------------------

export type PathKey = "OKRESOWA" | "PIERWSZA" | "ASYSTENT_FORMALNY" | "ASYSTENT_ROZMOWY";

export interface PathEntry {
  key: PathKey;
  title: string;
  href: string;
  /** Krótkie podsumowanie, np. „5 osób, 1 do ustalenia kryteriów”. */
  summary: string;
}

const PATHS: { key: PathKey; title: string; href: string }[] = [
  { key: "OKRESOWA", title: "Ocena okresowa", href: "/ocena/okresowa" },
  { key: "PIERWSZA", title: "Pierwsza ocena", href: "/ocena/pierwsza" },
  { key: "ASYSTENT_FORMALNY", title: "Asystent formalny", href: "/asystent" },
  { key: "ASYSTENT_ROZMOWY", title: "Asystent rozmowy", href: "/ocena/rozmowa" },
];

function people(n: number): string {
  return `${n} ${plural(n, ["osoba", "osoby", "osób"])}`;
}

/** Wejścia w ścieżki z podsumowaniem – tylko te, których ekrany są gotowe (bez martwych linków). */
export function pathEntries(employees: EmployeeInfo[], ready: (href: string) => boolean = isScreenReady): PathEntry[] {
  const current = employees.map(currentEvaluation).filter((e): e is EvaluationInfo => Boolean(e));
  const periodic = current.filter((e) => e.type === "OKRESOWA");
  const first = current.filter((e) => e.type === "PIERWSZA");
  const toStart = (list: EvaluationInfo[]) => list.filter((e) => e.status === "DO_ROZPOCZECIA").length;

  const summary: Record<PathKey, string> = {
    OKRESOWA: `${people(periodic.length)}${toStart(periodic) ? `, ${toStart(periodic)} do ustalenia kryteriów` : ""}`,
    PIERWSZA: `${people(first.length)}${toStart(first) ? `, ${toStart(first)} przed rozmową wstępną` : ""}`,
    ASYSTENT_FORMALNY: "Procedura, formularze i terminy – odpowiedzi ze wskazaniem przepisu",
    ASYSTENT_ROZMOWY: "Rozmowa oceniająca, informacja zwrotna i plan rozwoju",
  };
  return PATHS.filter((p) => ready(p.href)).map((p) => ({ ...p, summary: summary[p.key] }));
}

// ---------------------------------------------------------------------------
// Dziennik obserwacji (Z13)
// ---------------------------------------------------------------------------

export interface JournalLinks {
  /** Notatki tej osoby w dzienniku. */
  list: string;
  /** Nowa notatka z wybraną osobą. */
  add: string;
}

/** Linki do dziennika obserwacji pracownika – null, dopóki ekran dziennika nie jest gotowy. */
export function journalLinks(employeeId: string, ready: (href: string) => boolean = isScreenReady): JournalLinks | null {
  if (!ready("/obserwacje")) return null;
  const osoba = encodeURIComponent(employeeId);
  return { list: `/obserwacje?osoba=${osoba}`, add: `/obserwacje/nowa?osoba=${osoba}` };
}
