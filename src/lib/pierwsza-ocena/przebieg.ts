// Przebieg pierwszej oceny (Z17) – czysta logika bez bazy i Reacta, używana w formularzach i ponownie na serwerze.
// Etapy: rozmowa wstępna (§ 3) → sprawozdanie i egzamin (§ 4–6, § 10 ust. 3) → ocena 5 elementów w skali 3/5/7
// (§ 2 pkt 1, § 9 ust. 1) → wynik według § 10 → zapoznanie. Terminy liczy silnik Z08, wynik – silnik Z07.

import { z } from "zod";
import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import {
  EXAM_EXEMPTIONS,
  EXAM_RESULTS,
  type CompetencyCode,
  type EvaluationStatus,
  type ExamExemption,
  type ExamResult,
  type FirstEvalPoints,
  type FirstEvalScoreResult,
  type IsoDate,
} from "@/lib/domain/types";
import { addDays, addMonths, formatDatePl } from "@/lib/rules/kalendarz";
import { scoreFirstEval } from "@/lib/rules/punktacja";
import { MIN_JUSTIFICATION_LENGTH } from "@/lib/rules/sugestia";
import { firstEvalWindow, initialConversationDeadline, reportDeadline, type AbsencePeriod } from "@/lib/rules/terminy";
import type { Deadline } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Etapy
// ---------------------------------------------------------------------------

export type FirstEvalStage = "ROZMOWA_WSTEPNA" | "SPRAWOZDANIE" | "OCENA" | "ZAPOZNANIE" | "ZAKONCZONA";

/** Etap ścieżki wynika ze statusu oceny (etykiety statusów: EVALUATION_STATUS_LABELS.PIERWSZA). */
export const STAGE_FOR_STATUS: Record<EvaluationStatus, FirstEvalStage> = {
  DO_ROZPOCZECIA: "ROZMOWA_WSTEPNA",
  W_OKRESIE_OCENY: "SPRAWOZDANIE",
  W_OCENIE: "OCENA",
  CZEKA_NA_ZAPOZNANIE: "ZAPOZNANIE",
  ZAKONCZONA: "ZAKONCZONA",
};

export const FIRST_EVAL_STEPS = ["Rozmowa wstępna", "Sprawozdanie i egzamin", "Ocena elementów", "Wynik i zapoznanie"] as const;

/** Numer kroku (1–4) do paska postępu. */
export function stepNumber(stage: FirstEvalStage): number {
  return { ROZMOWA_WSTEPNA: 1, SPRAWOZDANIE: 2, OCENA: 3, ZAPOZNANIE: 4, ZAKONCZONA: 4 }[stage];
}

// ---------------------------------------------------------------------------
// Terminy
// ---------------------------------------------------------------------------

export interface FirstEvalPerson {
  employmentStart: IsoDate;
  contractEnd?: IsoDate;
  absences?: readonly AbsencePeriod[];
}

/** Najwcześniejszy dzień terminu sprawozdania: po upływie 8 miesięcy od nawiązania stosunku pracy (§ 4 ust. 1). */
export function earliestReportDay(employmentStart: IsoDate, r: Rules = defaultRules): IsoDate {
  return addDays(addMonths(employmentStart, r.firstEval.evaluationEarliestMonths), 1);
}

/** Ostatni dzień okna pierwszej oceny (miesiąc przed końcem umowy) albo undefined, gdy nie znamy końca umowy. */
export function windowLatest(p: FirstEvalPerson, r: Rules = defaultRules): Deadline | undefined {
  return p.contractEnd ? firstEvalWindow({ employmentStart: p.employmentStart, contractEnd: p.contractEnd }, r)[1] : undefined;
}

/** Dni na złożenie sprawozdania w propozycji systemu (przełożony może je zmienić). */
export const PROPOSED_REPORT_DAYS = 14;

/**
 * Proponowany termin sprawozdania do formularza rozmowy wstępnej: od pierwszego dnia po 8 miesiącach
 * (z wydłużeniem o nieobecności, § 5) przez 14 dni, ale nie dłużej niż do końca okna pierwszej oceny.
 */
export function proposedReportWindow(p: FirstEvalPerson, r: Rules = defaultRules): { dueFrom: IsoDate; dueTo: IsoDate; deadline: Deadline } {
  const deadline = reportDeadline({ employmentStart: p.employmentStart, absences: p.absences }, r);
  const dueFrom = deadline.date;
  const latest = windowLatest(p, r)?.date;
  let dueTo = addDays(dueFrom, PROPOSED_REPORT_DAYS);
  if (latest && dueTo > latest) dueTo = latest < dueFrom ? dueFrom : latest;
  return { dueFrom, dueTo, deadline };
}

/** Termin sprawozdania po wydłużeniach o nieobecności (silnik Z08, § 5). */
export function effectiveReportDeadline(p: FirstEvalPerson, dueTo: IsoDate, r: Rules = defaultRules): Deadline {
  return reportDeadline({ employmentStart: p.employmentStart, reportDue: dueTo, absences: p.absences }, r);
}

// ---------------------------------------------------------------------------
// Rozmowa wstępna
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę.");

export const initialConversationSchema = z.object({
  date: isoDate,
  dueFrom: isoDate,
  dueTo: isoDate,
  notes: z.string().max(4000).default(""),
});
export type InitialConversationForm = z.infer<typeof initialConversationSchema>;

export interface FormIssue {
  field: string;
  text: string;
  legalBasis?: string;
}

export function initialConversationIssues(f: InitialConversationForm, p: FirstEvalPerson, today: IsoDate, r: Rules = defaultRules): FormIssue[] {
  const lb = r.firstEval.legalBasis;
  const issues: FormIssue[] = [];
  if (f.date < p.employmentStart) issues.push({ field: "date", text: `Rozmowa nie może się odbyć przed nawiązaniem stosunku pracy (${formatDatePl(p.employmentStart)}).` });
  if (f.date > today) issues.push({ field: "date", text: "Data rozmowy nie może być z przyszłości – zapisz rozmowę po jej przeprowadzeniu." });
  const earliest = earliestReportDay(p.employmentStart, r);
  if (f.dueFrom < earliest) {
    issues.push({
      field: "dueFrom",
      text: `Termin sprawozdania musi przypadać po upływie ${r.firstEval.evaluationEarliestMonths} miesięcy od nawiązania stosunku pracy, czyli najwcześniej ${formatDatePl(earliest)}.`,
      legalBasis: lb.reportDue,
    });
  }
  if (f.dueTo < f.dueFrom) issues.push({ field: "dueTo", text: "Koniec terminu nie może być wcześniejszy niż jego początek." });
  const latest = windowLatest(p, r);
  if (latest && f.dueTo > latest.date) {
    issues.push({
      field: "dueTo",
      text: `Sprawozdanie musi wpłynąć przed końcem okna pierwszej oceny (${formatDatePl(latest.date)}), żeby zdążyć sporządzić ocenę.`,
      legalBasis: lb.evaluationWindow,
    });
  }
  return issues;
}

/** Ostrzeżenie (nie blokuje zapisu): rozmowa po 21 dniach od nawiązania stosunku pracy. */
export function lateConversationWarning(date: IsoDate, employmentStart: IsoDate, r: Rules = defaultRules): string | null {
  const d = initialConversationDeadline(employmentStart, r);
  return date > d.date
    ? `Rozmowa odbyła się po terminie z ${r.firstEval.legalBasis.initialConversation} (${formatDatePl(d.date)}). Zapisz w notatce, dlaczego – to ważne przy kontroli.`
    : null;
}

// ---------------------------------------------------------------------------
// Sprawozdanie i egzamin
// ---------------------------------------------------------------------------

export const REPORT_MODES = ["ZLOZONE", "NIE_ZLOZONE"] as const;
export type ReportMode = (typeof REPORT_MODES)[number];

export const reportFormSchema = z.object({
  mode: z.enum(REPORT_MODES),
  submittedAt: z.string().default(""),
  content: z.string().max(50_000).default(""),
  fileName: z.string().max(255).default(""),
  exam: z.enum(EXAM_RESULTS).optional(),
  examExemption: z.enum(EXAM_EXEMPTIONS).optional(),
});
export type ReportForm = z.infer<typeof reportFormSchema>;

export interface ReportContext extends FirstEvalPerson {
  conversationDate?: IsoDate;
  dueFrom: IsoDate;
  dueTo: IsoDate;
}

export function reportIssues(f: ReportForm, c: ReportContext, today: IsoDate, r: Rules = defaultRules): FormIssue[] {
  const lb = r.firstEval.legalBasis;
  const issues: FormIssue[] = [];
  const deadline = effectiveReportDeadline(c, c.dueTo, r);
  if (f.mode === "ZLOZONE") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.submittedAt)) issues.push({ field: "submittedAt", text: "Podaj datę złożenia sprawozdania." });
    else {
      if (f.submittedAt > today) issues.push({ field: "submittedAt", text: "Data złożenia nie może być z przyszłości." });
      if (f.submittedAt < c.dueFrom) {
        issues.push({
          field: "submittedAt",
          text: `Sprawozdanie składa się w wyznaczonym terminie, od ${formatDatePl(c.dueFrom)} – musi obejmować co najmniej ${r.firstEval.reportMinMonths} miesięcy pracy.`,
          legalBasis: `${lb.reportDue}, ${lb.reportScope}`,
        });
      }
    }
    if (!f.content.trim() && !f.fileName.trim()) issues.push({ field: "content", text: "Wpisz treść sprawozdania albo wgraj plik." });
  } else if (today <= deadline.date) {
    issues.push({
      field: "mode",
      text: `Termin na sprawozdanie trwa do ${formatDatePl(deadline.date)}. Brak sprawozdania można odnotować dopiero po tym dniu.`,
      legalBasis: lb.reportDue,
    });
  }
  if (!f.exam) issues.push({ field: "exam", text: "Wskaż wynik egzaminu ze służby przygotowawczej." });
  else if (f.exam === "NIE_DOTYCZY" && !f.examExemption) {
    issues.push({ field: "examExemption", text: "Wskaż, dlaczego egzamin nie dotyczy ocenianego.", legalBasis: lb.examExemption });
  }
  return issues;
}

export const REPORT_MAX_BYTES = 5 * 1024 * 1024;
export const REPORT_ACCEPT = ".docx,.txt";

/** Sprawdzenie pliku sprawozdania przed wysłaniem (w przeglądarce) i na serwerze. */
export function reportFileProblem(file: { name: string; size: number }): string | null {
  if (!/\.(docx|txt)$/i.test(file.name)) return "Wgraj sprawozdanie w formacie Word (.docx) albo tekstowym (.txt).";
  if (file.size === 0) return "Plik jest pusty.";
  if (file.size > REPORT_MAX_BYTES) return "Plik jest za duży (najwyżej 5 MB).";
  return null;
}

/** Czy sprawozdanie wpłynęło w wyznaczonym terminie (z wydłużeniami o nieobecności). */
export function reportOnTime(submittedAt: IsoDate | undefined, c: ReportContext, r: Rules = defaultRules): boolean {
  if (!submittedAt) return false;
  return submittedAt >= c.dueFrom && submittedAt <= effectiveReportDeadline(c, c.dueTo, r).date;
}

// ---------------------------------------------------------------------------
// Wynik (§ 10) i sporządzenie oceny
// ---------------------------------------------------------------------------

export interface FirstEvalSummaryInput {
  scores: { competency: CompetencyCode; score: number | null }[];
  exam?: ExamResult;
  examExemption?: ExamExemption;
  reportSubmittedOnTime: boolean;
}

export type FirstEvalSummary =
  | { complete: true; result: FirstEvalScoreResult }
  | { complete: false; missing: string[] };

/** Wynik z silnika Z07 – gdy brakuje ocen elementów albo egzaminu, zwraca listę braków zamiast wyjątku. */
export function firstEvalSummary(input: FirstEvalSummaryInput, r: Rules = defaultRules): FirstEvalSummary {
  const missing: string[] = [];
  for (const el of r.firstEval.elements) {
    const s = input.scores.find((x) => x.competency === el);
    if (!s || s.score === null) missing.push(`ocena elementu „${COMPETENCY_NAMES[el]}”`);
  }
  if (!input.exam) missing.push("wynik egzaminu ze służby przygotowawczej");
  else if (input.exam === "NIE_DOTYCZY" && !input.examExemption) missing.push("powód, dla którego egzamin nie dotyczy ocenianego");
  if (missing.length) return { complete: false, missing };
  const result = scoreFirstEval(
    {
      scores: r.firstEval.elements.map((el) => ({ competency: el, points: input.scores.find((x) => x.competency === el)!.score as FirstEvalPoints })),
      exam: input.exam!,
      examExemption: input.exam === "NIE_DOTYCZY" ? input.examExemption : undefined,
      reportSubmittedOnTime: input.reportSubmittedOnTime,
    },
    r,
  );
  return { complete: true, result };
}

export const completionFormSchema = z.object({
  evaluatedAt: z.string().default(""),
  justification: z.string().max(8000).default(""),
  developmentPlan: z.string().max(8000).default(""),
});
export type CompletionForm = z.infer<typeof completionFormSchema>;

export interface CompletionContext extends FirstEvalPerson {
  result: FirstEvalScoreResult;
  reportSubmittedAt?: IsoDate;
  today: IsoDate;
}

export function completionIssues(f: CompletionForm, c: CompletionContext, r: Rules = defaultRules): FormIssue[] {
  const lb = r.firstEval.legalBasis;
  const issues: FormIssue[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.evaluatedAt)) issues.push({ field: "evaluatedAt", text: "Podaj datę sporządzenia oceny." });
  else {
    if (f.evaluatedAt > c.today) issues.push({ field: "evaluatedAt", text: "Data sporządzenia oceny nie może być z przyszłości." });
    const earliest = earliestReportDay(c.employmentStart, r);
    if (f.evaluatedAt < earliest) {
      issues.push({
        field: "evaluatedAt",
        text: `Pierwszą ocenę można sporządzić najwcześniej ${formatDatePl(earliest)} – po upływie ${r.firstEval.evaluationEarliestMonths} miesięcy od nawiązania stosunku pracy.`,
        legalBasis: lb.evaluationWindow,
      });
    }
    const latest = windowLatest(c, r);
    if (latest && f.evaluatedAt > latest.date) {
      issues.push({
        field: "evaluatedAt",
        text: `Pierwszą ocenę trzeba sporządzić najpóźniej ${formatDatePl(latest.date)} – miesiąc przed końcem umowy.`,
        legalBasis: lb.evaluationWindow,
      });
    }
    if (c.reportSubmittedAt && f.evaluatedAt < c.reportSubmittedAt) {
      issues.push({ field: "evaluatedAt", text: `Ocenę sporządza się po złożeniu sprawozdania (${formatDatePl(c.reportSubmittedAt)}).` });
    }
  }
  if (c.result.justificationRequired && f.justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
    issues.push({ field: "justification", text: "Ocena jest negatywna – uzasadnienie jest obowiązkowe.", legalBasis: lb.justificationRequired });
  }
  if (c.result.result === "NEGATYWNA" && f.developmentPlan.trim()) {
    issues.push({
      field: "developmentPlan",
      text: "Wnioski dotyczące rozwoju zawodowego formułuje się tylko przy ocenie pozytywnej – usuń je.",
      legalBasis: lb.developmentPlan,
    });
  }
  return issues;
}

/** Domyślna data sporządzenia: dziś, o ile mieści się w oknie oceny. */
export function defaultEvaluationDate(p: FirstEvalPerson, today: IsoDate, r: Rules = defaultRules): IsoDate | undefined {
  const earliest = earliestReportDay(p.employmentStart, r);
  const latest = windowLatest(p, r)?.date;
  if (today < earliest) return undefined;
  if (latest && today > latest) return undefined;
  return today;
}
