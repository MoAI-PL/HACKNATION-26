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

/**
 * Ekrany docelowe akcji z karty „Do zrobienia”. Dopóki ekranu nie ma (zadanie w toku),
 * przycisk prowadzi do karty pracownika z wyjaśnieniem terminu i ma uczciwy napis „Zobacz szczegóły”
 * – bez martwych linków i bez obietnic, których ekran nie spełni.
 */
export const ACTION_SCREENS_READY = false;

export function buildDashboardTodo(employees: EmployeeInfo[], today: IsoDate, limit = 5): TodoItem[] {
  const sources: TodoSource[] = employees.map((e) => ({
    employeeId: e.id,
    employeeName: fullName(e),
    evaluationId: currentEvaluation(e)?.id,
    deadlines: openDeadlines(e),
  }));
  const items = buildTodoItems(sources, today, { limit, hrefFor: (s) => employeeHref(s.employeeId) });
  return ACTION_SCREENS_READY ? items : items.map((i) => ({ ...i, actionLabel: "Zobacz szczegóły" }));
}
