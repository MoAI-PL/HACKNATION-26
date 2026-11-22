// Ekran kierującego komórką: pierwsze oceny nowych pracowników jego komórki (czysta logika, bez bazy).
//
// Rola kierującego w pierwszej ocenie (przepisy w bazie wiedzy asystenta):
//  - pierwszej oceny dokonuje bezpośredni przełożony w porozumieniu z kierującym komórką (art. 38 ust. 2 ustawy);
//  - kierujący może uczestniczyć w rozmowie oceniającej (§ 8 ust. 2 rozporządzenia o pierwszej ocenie);
//  - wnioski dotyczące rozwoju zawodowego – w porozumieniu z kierującym (§ 10 ust. 6);
//  - po ocenie kierujący składa wniosek do dyrektora generalnego urzędu o umowę na czas nieokreślony
//    albo o jej niezawieranie / rozwiązanie umowy (art. 38 ust. 3 ustawy).
// Terminy liczy silnik terminów, tak samo jak w panelu HR.

import type { Deadline, DeadlineUrgency, IsoDate } from "@/lib/domain/types";
import { DEADLINE_KIND_LABELS, daysUntil, firstEvalWindow, initialConversationDeadline } from "@/lib/rules/terminy";
import { toHrRow, type HrEvaluationRecord, type HrRow } from "@/lib/hr/panel";

export interface CalendarStep {
  label: string;
  date: IsoDate;
  legalBasis?: string;
  /** Data już minęła. */
  past: boolean;
}

export interface FirstEvaluationRow extends HrRow {
  employmentStart: IsoDate;
  contractEnd: IsoDate | null;
  /** Kalendarz pierwszej oceny: rozmowa wstępna i okno, w którym trzeba sporządzić ocenę. */
  calendar: CalendarStep[];
  /** Co kierujący ma teraz zrobić – jedno zdanie. */
  nextStep: string;
}

const step = (d: Deadline, today: IsoDate): CalendarStep => ({
  label: DEADLINE_KIND_LABELS[d.kind],
  date: d.date,
  legalBasis: d.explanation.legalBasis,
  past: d.date < today,
});

function nextStep(r: HrEvaluationRecord): string {
  switch (r.status) {
    case "DO_ROZPOCZECIA":
      return "Przełożony przeprowadza rozmowę wstępną i wyznacza termin sprawozdania. Ty możesz wesprzeć wdrożenie nowej osoby.";
    case "W_OKRESIE_OCENY":
      return "Trwa pierwszy okres pracy. Przed oceną przełożony uzgodni z Tobą oceny cząstkowe; możesz uczestniczyć w rozmowie oceniającej.";
    case "W_OCENIE":
      return "Przełożony przygotowuje ocenę – oceny cząstkowe i wynik ustala w porozumieniu z Tobą (art. 38 ust. 2 ustawy).";
    case "CZEKA_NA_ZAPOZNANIE":
      return "Ocena jest sporządzona – arkusz podpisujesz obok przełożonego, a potem składasz wniosek do dyrektora generalnego urzędu (art. 38 ust. 3 ustawy).";
    case "ZAKONCZONA":
      return r.result === "POZYTYWNA"
        ? "Ocena pozytywna – złóż wniosek do dyrektora generalnego urzędu o zawarcie umowy na czas nieokreślony (art. 38 ust. 3 ustawy)."
        : "Ocena zakończona – złóż wniosek do dyrektora generalnego urzędu zgodny z wynikiem oceny (art. 38 ust. 3 ustawy).";
  }
}

export function firstEvaluationRow(r: HrEvaluationRecord, today: IsoDate): FirstEvaluationRow {
  const { employmentStart, contractEnd } = r.employee;
  const calendar: CalendarStep[] = [step(initialConversationDeadline(employmentStart), today)];
  if (contractEnd) calendar.push(...firstEvalWindow({ employmentStart, contractEnd }).map((d) => step(d, today)));
  return { ...toHrRow(r, today), employmentStart, contractEnd, calendar, nextStep: nextStep(r) };
}

/** Najpierw sprawy w toku według najbliższego terminu, na końcu zakończone. */
export function firstEvaluationRows(records: HrEvaluationRecord[], today: IsoDate): FirstEvaluationRow[] {
  const rank = (u: DeadlineUrgency | null) => (u === null ? 1 : 0);
  return records
    .filter((r) => r.type === "PIERWSZA")
    .map((r) => firstEvaluationRow(r, today))
    .sort((a, b) => rank(a.urgency) - rank(b.urgency) || (a.deadline ? daysUntil(a.deadline, today) : 0) - (b.deadline ? daysUntil(b.deadline, today) : 0));
}

