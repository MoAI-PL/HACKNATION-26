// Widok ocen dla ocenianego (Z46) – czysta logika: co oceniany może zobaczyć na danym etapie.
//
// Zasady:
//  - przed sporządzeniem oceny oceniany widzi to, co i tak dostaje na piśmie po rozmowie rozpoczynającej
//    (kopia części I arkusza, § 6 ust. 3): arkusz, kryteria z uzasadnieniem wyboru, termin oceny i rozmowy;
//    NIE widzi roboczych ocen cząstkowych, sugestii systemu, powodów zmian ani notatek przełożonego;
//  - po sporządzeniu (§ 12) widzi całą ocenę: oceny cząstkowe, wynik z wyjaśnieniem, uzasadnienie, IPRZ, część III,
//    pouczenie o sprzeciwie; ocenę czekającą na zapoznanie może potwierdzić.

import type { CompetencyCode, ConversationType, Deadline, EvaluationResult, EvaluationStatus, EvaluationType, IsoDate, Level, PeriodicScoreResult } from "@/lib/domain/types";
import { COMPETENCY_NAMES, EVALUATION_STATUS_LABELS, EVALUATION_TYPE_LABELS, SHEET_LABELS } from "@/lib/domain/slownik";
import { objectionDeadline } from "@/lib/rules/terminy";
import { summarize, type ScoredCriterion } from "@/lib/ocena/podsumowanie";

/** Etapy, w których ocena jest sporządzona na piśmie (§ 12) – wtedy oceniany widzi wynik. */
export const FINALIZED_STATUSES: readonly EvaluationStatus[] = ["CZEKA_NA_ZAPOZNANIE", "ZAKONCZONA"];

export function isFinalized(status: EvaluationStatus): boolean {
  return FINALIZED_STATUSES.includes(status);
}

/** Dane oceny z bazy potrzebne do widoku (daty już jako "RRRR-MM-DD"). */
export interface OwnEvaluationRow {
  id: string;
  type: EvaluationType;
  sheet: "A" | "B" | "C" | "PIERWSZA";
  status: EvaluationStatus;
  isReevaluation: boolean;
  evaluatorName: string;
  criteriaSetAt?: IsoDate;
  dueDate?: IsoDate;
  evaluatedAt?: IsoDate;
  acknowledgedAt?: IsoDate;
  justification?: string;
  developmentPlan?: string;
  promotionRequest: boolean;
  requestedGrade?: number;
  isCivilServant: boolean;
  previous?: { date: IsoDate; result: EvaluationResult; level?: Level };
  criteria: { competency: CompetencyCode; kind: "OBOWIAZKOWE" | "DODATKOWE"; selectionReason?: string; score: number | null }[];
  conversations: { type: ConversationType; date: IsoDate }[];
}

export interface OwnCriterionView {
  competency: CompetencyCode;
  name: string;
  kind: "OBOWIAZKOWE" | "DODATKOWE";
  selectionReason?: string;
  /** Ocena cząstkowa – tylko po sporządzeniu oceny. */
  score?: number;
}

export interface OwnEvaluationView {
  id: string;
  type: EvaluationType;
  title: string;
  typeLabel: string;
  sheetLabel: string;
  status: EvaluationStatus;
  statusLabel: string;
  finalized: boolean;
  isReevaluation: boolean;
  evaluatorName: string;
  /** Jedno zdanie: co się teraz dzieje i co dalej. */
  stageText: string;
  criteriaSetAt?: IsoDate;
  dueDate?: IsoDate;
  evaluatedAt?: IsoDate;
  acknowledgedAt?: IsoDate;
  criteria: OwnCriterionView[];
  conversations: { type: ConversationType; date: IsoDate }[];
  /** Tylko po sporządzeniu oceny okresowej z kompletem ocen cząstkowych. */
  result?: PeriodicScoreResult;
  scoredCriteria?: (ScoredCriterion & { name: string })[];
  justification?: string;
  developmentPlan?: string;
  partThree?: string;
  previous?: { date: IsoDate; result: EvaluationResult; level?: Level };
  canAcknowledge: boolean;
  /** Termin sprzeciwu (art. 83 ustawy) – po zapoznaniu się z oceną okresową. */
  objection?: Deadline;
}

function stageText(row: OwnEvaluationRow): string {
  switch (row.status) {
    case "DO_ROZPOCZECIA":
      return row.type === "PIERWSZA"
        ? "Przełożony przeprowadzi z Tobą rozmowę wstępną: omówi sposób oceny i wyznaczy termin sprawozdania."
        : "Przełożony przeprowadzi z Tobą rozmowę rozpoczynającą: omówi obowiązki, kryteria oceny, swoje oczekiwania i ewentualne cele.";
    case "W_OKRESIE_OCENY":
      return "Trwa okres oceny. Kryteria i termin oceny są ustalone – poniżej to, co znajduje się w części I arkusza.";
    case "W_OCENIE":
      return "Przełożony przygotowuje ocenę. Przed jej sporządzeniem przeprowadzi z Tobą rozmowę oceniającą.";
    case "CZEKA_NA_ZAPOZNANIE":
      return "Ocena jest sporządzona. Zapoznaj się z nią i potwierdź to poniżej.";
    case "ZAKONCZONA":
      return "Ocena jest zakończona – zapoznałeś(-aś) się z nią.";
  }
}

/** Widok oceny dla ocenianego – ukrywa dane robocze przed sporządzeniem oceny. */
export function ownEvaluationView(row: OwnEvaluationRow): OwnEvaluationView {
  const finalized = isFinalized(row.status);
  const criteria: OwnCriterionView[] = row.criteria.map((c) => ({
    competency: c.competency,
    name: COMPETENCY_NAMES[c.competency],
    kind: c.kind,
    selectionReason: c.selectionReason,
    ...(finalized && c.score !== null ? { score: c.score } : {}),
  }));

  const view: OwnEvaluationView = {
    id: row.id,
    type: row.type,
    title: `${EVALUATION_TYPE_LABELS[row.type]}${row.isReevaluation ? " (ponowna, po ocenie negatywnej)" : ""}`,
    typeLabel: EVALUATION_TYPE_LABELS[row.type],
    sheetLabel: SHEET_LABELS[row.sheet],
    status: row.status,
    statusLabel: EVALUATION_STATUS_LABELS[row.type][row.status],
    finalized,
    isReevaluation: row.isReevaluation,
    evaluatorName: row.evaluatorName,
    stageText: stageText(row),
    criteriaSetAt: row.criteriaSetAt,
    dueDate: row.dueDate,
    evaluatedAt: finalized ? row.evaluatedAt : undefined,
    acknowledgedAt: row.acknowledgedAt,
    criteria,
    conversations: row.conversations,
    previous: row.previous,
    canAcknowledge: row.status === "CZEKA_NA_ZAPOZNANIE" && !!row.evaluatedAt,
  };

  if (!finalized) return view;

  if (row.type === "OKRESOWA") {
    const scored = row.criteria.map((c) => ({ competency: c.competency, kind: c.kind, score: c.score, name: COMPETENCY_NAMES[c.competency] }));
    view.scoredCriteria = scored;
    const summary = summarize(scored);
    if (summary.complete) view.result = summary.result;
    if (row.acknowledgedAt) view.objection = objectionDeadline(row.acknowledgedAt);
  }
  view.justification = row.justification;
  view.developmentPlan = row.developmentPlan;
  view.partThree = !row.isCivilServant
    ? "NIE DOTYCZY"
    : row.promotionRequest
      ? `Przełożony złożył wniosek o przyznanie kolejnego stopnia służbowego${row.requestedGrade ? ` (stopień ${row.requestedGrade})` : ""}.`
      : "Bez wniosku o kolejny stopień służbowy.";
  return view;
}

/** Kolejność na liście: najpierw sprawy wymagające działania, potem bieżące, na końcu zakończone (od najnowszej). */
export function sortOwnEvaluations(views: OwnEvaluationView[]): OwnEvaluationView[] {
  const rank = (v: OwnEvaluationView) => (v.status === "CZEKA_NA_ZAPOZNANIE" ? 0 : v.status === "ZAKONCZONA" ? 2 : 1);
  return [...views].sort(
    (a, b) => rank(a) - rank(b) || (b.evaluatedAt ?? b.criteriaSetAt ?? "").localeCompare(a.evaluatedAt ?? a.criteriaSetAt ?? ""),
  );
}
