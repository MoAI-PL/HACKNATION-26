// Podsumowanie i wynik oceny okresowej (Z15) – czysta logika.
// § 11 ust. 1 pkt 2–5 (poziom ogólny, wynik, wnioski do IPRZ), § 11 ust. 3–5 (uzasadnienie, część III),
// § 12 (zapoznanie z oceną), art. 83 ustawy (sprzeciw). Wynik liczy silnik Z07.

import { z } from "zod";
import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import type { CompetencyCode, Explanation, IsoDate, PartialScore, PeriodicPoints, PeriodicScoreResult } from "@/lib/domain/types";
import { scorePeriodic } from "@/lib/rules/punktacja";
import { formatDatePl } from "@/lib/rules/kalendarz";

export interface ScoredCriterion {
  competency: CompetencyCode;
  kind: "OBOWIAZKOWE" | "DODATKOWE";
  score: number | null;
}

export type SummaryResult =
  | { complete: true; result: PeriodicScoreResult }
  | { complete: false; missing: CompetencyCode[] };

/** Wynik oceny z ocen cząstkowych (Z07) albo lista kryteriów bez oceny. */
export function summarize(criteria: ScoredCriterion[], r: Rules = defaultRules): SummaryResult {
  const missing = criteria.filter((c) => c.score === null).map((c) => c.competency);
  if (missing.length || criteria.length === 0) return { complete: false, missing };
  const scores: PartialScore[] = criteria.map((c) => ({ competency: c.competency, kind: c.kind, points: c.score as PeriodicPoints }));
  return { complete: true, result: scorePeriodic(scores, r) };
}

/** Formularz podsumowania (pola zapisywane automatycznie w Evaluation). */
export const summaryFormSchema = z.object({
  justification: z.string().max(8000).default(""),
  developmentPlan: z.string().max(8000).default(""),
  promotionRequest: z.boolean().default(false),
  promotionJustification: z.string().max(8000).default(""),
  requestedGrade: z.number().int().min(1).max(20).nullable().default(null),
  evaluatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type SummaryForm = z.infer<typeof summaryFormSchema>;

export interface SummaryContext {
  result: PeriodicScoreResult;
  isCivilServant: boolean;
  today: IsoDate;
  /** Początek okresu oceny (ocena nie może być sporządzona wcześniej). */
  periodStart?: IsoDate;
}

export interface SummaryIssue extends Explanation {
  field: "justification" | "developmentPlan" | "promotion" | "evaluatedAt";
}

/** Braki blokujące sporządzenie oceny – każdy z powodem i podstawą prawną. */
export function summaryIssues(form: SummaryForm, ctx: SummaryContext, r: Rules = defaultRules): SummaryIssue[] {
  const lb = r.periodic.legalBasis;
  const issues: SummaryIssue[] = [];
  if (ctx.result.justificationRequired && !form.justification.trim()) {
    issues.push({
      field: "justification",
      text: "Ocena jest negatywna, więc uzasadnienie jest obowiązkowe. Opisz konkretne zachowania, które o tym zdecydowały.",
      legalBasis: lb.justificationRequired,
    });
  }
  if (!form.developmentPlan.trim()) {
    issues.push({
      field: "developmentPlan",
      text: "Wpisz wnioski do indywidualnego programu rozwoju zawodowego – są częścią każdej oceny.",
      legalBasis: lb.developmentPlan,
    });
  }
  if (form.promotionRequest) {
    if (!ctx.isCivilServant) {
      issues.push({ field: "promotion", text: "Wniosek o kolejny stopień służbowy dotyczy tylko urzędnika służby cywilnej.", legalBasis: lb.promotionRequest });
    } else if (ctx.result.result !== "POZYTYWNA") {
      issues.push({ field: "promotion", text: "Wniosek o kolejny stopień służbowy można złożyć tylko przy ocenie pozytywnej.", legalBasis: lb.promotionRequest });
    } else {
      if (!form.requestedGrade) issues.push({ field: "promotion", text: "Podaj stopień służbowy, o który wnioskujesz.", legalBasis: lb.promotionRequest });
      if (!form.promotionJustification.trim()) {
        issues.push({ field: "promotion", text: "Wniosek o kolejny stopień musi być umotywowany – napisz uzasadnienie.", legalBasis: lb.promotionRequest });
      }
    }
  }
  if (!form.evaluatedAt) {
    issues.push({ field: "evaluatedAt", text: "Podaj datę sporządzenia oceny." });
  } else if (form.evaluatedAt > ctx.today) {
    issues.push({ field: "evaluatedAt", text: "Data sporządzenia oceny nie może być z przyszłości." });
  } else if (ctx.periodStart && form.evaluatedAt < ctx.periodStart) {
    issues.push({ field: "evaluatedAt", text: `Data sporządzenia oceny nie może być wcześniejsza niż początek okresu oceny (${formatDatePl(ctx.periodStart)}).` });
  }
  return issues;
}

/** Część III dostępna: urzędnik i ocena pozytywna (§ 11 ust. 5). */
export function partThreeAvailable(isCivilServant: boolean, result: PeriodicScoreResult): boolean {
  return isCivilServant && result.result === "POZYTYWNA";
}

/** Data zapoznania się z oceną: nie wcześniej niż sporządzenie i nie z przyszłości (§ 12 ust. 1). */
export function acknowledgmentIssue(ackDate: IsoDate | undefined, evaluatedAt: IsoDate, today: IsoDate): string | null {
  if (!ackDate) return "Podaj datę, w której oceniany zapoznał się z oceną.";
  if (ackDate < evaluatedAt) return `Zapoznanie nie może być wcześniejsze niż sporządzenie oceny (${formatDatePl(evaluatedAt)}).`;
  if (ackDate > today) return "Data zapoznania się z oceną nie może być z przyszłości.";
  return null;
}

/** Nazwy kryteriów bez oceny – do komunikatu „wróć do oceny wskaźników”. */
export function missingText(missing: CompetencyCode[]): string {
  return `Brakuje ocen cząstkowych: ${missing.map((c) => COMPETENCY_NAMES[c]).join(", ")}.`;
}
