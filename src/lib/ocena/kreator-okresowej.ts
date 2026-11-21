// Kreator oceny okresowej, część 1 (Z12): od opisu stanowiska do części I arkusza.
// Czysta logika (bez bazy i Reacta): szkic kreatora, kroki, terminy i walidacja przed zatwierdzeniem.
// § 3 (arkusz), § 4 (kryteria obowiązkowe), § 5 (rozmowa rozpoczynająca, maks. 3 kryteria dodatkowe),
// § 6 (zapoznanie i podpis), § 7 (termin rozmowy) rozporządzenia z 4.04.2016; art. 81 ust. 4, 7 i 9 ustawy (termin oceny).

import { z } from "zod";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import { COMPETENCY_CODES, type CompetencyCode, type Deadline, type Explanation, type IsoDate } from "@/lib/domain/types";
import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { validateAdditionalCriteria } from "@/lib/rules/kryteria";
import {
  afterNegativeDeadlines,
  criteriaConversationDeadline,
  periodicEvaluationDeadline,
  type AbsencePeriod,
} from "@/lib/rules/terminy";
import { formatDatePl } from "@/lib/rules/kalendarz";

export const WIZARD_STEPS = ["Opis stanowiska", "Arkusz", "Kryteria", "Rozmowa rozpoczynająca", "Część I arkusza"] as const;
export type WizardStepName = (typeof WIZARD_STEPS)[number];

/** Tematy rozmowy rozpoczynającej (§ 5 ust. 1 pkt 1–4) i zapoznanie z kryteriami (§ 6). */
export const CHECKLIST_ITEMS = [
  { key: "obowiazki", label: "Główne obowiązki wynikające z opisu stanowiska", legalBasis: "§ 5 ust. 1 pkt 1", required: true },
  { key: "kryteria", label: "Kryteria obowiązkowe i dodatkowe", legalBasis: "§ 5 ust. 1 pkt 2", required: true },
  { key: "oczekiwania", label: "Oczekiwania co do sposobu spełniania kryteriów", legalBasis: "§ 5 ust. 1 pkt 3", required: true },
  {
    key: "cele",
    label: "Cele na okres oceny i sposób ich realizacji (jeśli są uzasadnione charakterem obowiązków)",
    legalBasis: "§ 5 ust. 1 pkt 4",
    required: false,
  },
] as const;
export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];

const competency = z.enum(COMPETENCY_CODES);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Szkic kreatora zapisywany automatycznie w Evaluation.wizardState. */
export const draftSchema = z.object({
  step: z.number().int().min(1).max(WIZARD_STEPS.length).default(1),
  /** Arkusz wybrany przez przełożonego; brak = arkusz wskazany przez OSP. */
  sheet: z.enum(["B", "C"]).optional(),
  /** Powód zmiany arkusza wskazanego przez OSP (trafia do dziennika decyzji). */
  sheetChangeReason: z.string().max(500).default(""),
  additional: z.array(z.object({ competency, reason: z.string().max(1000).default("") })).max(14).default([]),
  checklist: z
    .object({ obowiazki: z.boolean(), kryteria: z.boolean(), oczekiwania: z.boolean(), cele: z.boolean() })
    .partial()
    .default({}),
  expectations: z.string().max(4000).default(""),
  goals: z.string().max(4000).default(""),
  conversationDate: isoDate.optional(),
  /** Oceniany zapoznał się z kryteriami i terminem oraz potwierdził to podpisem (§ 6 ust. 2). */
  acknowledged: z.boolean().default(false),
});
export type WizardDraft = z.infer<typeof draftSchema>;

/** Szkic z bazy (Json) albo pusty – nigdy nie rzuca, żeby uszkodzony szkic nie blokował ekranu. */
export function parseDraft(value: unknown): WizardDraft {
  const parsed = draftSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : draftSchema.parse({});
}

// ---------------------------------------------------------------------------
// Terminy kreatora
// ---------------------------------------------------------------------------

export interface PreviousEvaluation {
  evaluatedAt: IsoDate;
  result: "POZYTYWNA" | "NEGATYWNA";
  acknowledgedAt?: IsoDate;
}

export interface DeadlineContext {
  previous?: PreviousEvaluation;
  /** Zatrudnienie na czas nieokreślony (gdy nie było jeszcze oceny okresowej). */
  permanentFrom?: IsoDate;
  absences?: readonly AbsencePeriod[];
}

export interface WizardDeadlines {
  /** Do kiedy przeprowadzić rozmowę rozpoczynającą (§ 7). */
  conversation: Deadline;
  /** Termin sporządzenia oceny na piśmie – wpisywany do części I (§ 5 ust. 3). */
  evaluation: Deadline;
  /** Ocena po ocenie negatywnej (art. 81 ust. 9). */
  reevaluation: boolean;
}

/**
 * Termin rozmowy i termin oceny dla nowego okresu oceny.
 * - po ocenie negatywnej: rozmowa w 7 dni od jej sporządzenia, ocena po 6 miesiącach od zapoznania się z nią;
 * - po ocenie pozytywnej: 30 dni i 24 miesiące od jej sporządzenia;
 * - pierwsza ocena okresowa: od zatrudnienia na czas nieokreślony.
 * Zwraca null, gdy brakuje danych (wtedy kreator prosi HR o uzupełnienie kartoteki).
 */
export function wizardDeadlines(ctx: DeadlineContext, r: Rules = defaultRules): WizardDeadlines | null {
  if (ctx.previous?.result === "NEGATYWNA") {
    const [conversation, reevaluation] = afterNegativeDeadlines(
      { evaluatedAt: ctx.previous.evaluatedAt, acknowledgedAt: ctx.previous.acknowledgedAt },
      r,
    );
    if (!reevaluation) return null;
    return { conversation: conversation!, evaluation: reevaluation, reevaluation: true };
  }
  const anchor = ctx.previous
    ? { kind: "POPRZEDNIA_OCENA" as const, date: ctx.previous.evaluatedAt }
    : ctx.permanentFrom
      ? { kind: "ZATRUDNIENIE_NA_CZAS_NIEOKRESLONY" as const, date: ctx.permanentFrom }
      : null;
  if (!anchor) return null;
  return {
    conversation: criteriaConversationDeadline(anchor, r),
    evaluation: periodicEvaluationDeadline({ anchor, absences: ctx.absences }, r),
    reevaluation: false,
  };
}

/** Ostrzeżenie (nieblokujące), gdy rozmowa odbyła się po terminie z § 7. */
export function lateConversationWarning(conversationDate: IsoDate | undefined, deadline: Deadline): Explanation | null {
  if (!conversationDate || conversationDate <= deadline.date) return null;
  return {
    text: `Rozmowa ${formatDatePl(conversationDate)} odbyła się po terminie (${formatDatePl(deadline.date)}). Kryteria można ustalić, ale warto zapisać w notatce przyczynę opóźnienia.`,
    legalBasis: deadline.explanation.legalBasis?.split(",")[0],
  };
}

// ---------------------------------------------------------------------------
// Walidacja przed zatwierdzeniem części I
// ---------------------------------------------------------------------------

export interface StepIssue extends Explanation {
  /** Krok kreatora, w którym trzeba to poprawić (1–5). */
  step: number;
}

export interface CompletionInput {
  draft: WizardDraft;
  /** Arkusz wskazany przez OSP (null = brak OSP). */
  sheetFromOsp: "B" | "C" | null;
  today: IsoDate;
  r?: Rules;
}

/** Arkusz, który obowiązuje w kreatorze: wybór przełożonego albo wskazanie z OSP. */
export function effectiveSheet(draft: WizardDraft, sheetFromOsp: "B" | "C" | null): "B" | "C" | null {
  return draft.sheet ?? sheetFromOsp;
}

/** Problemy, które blokują zatwierdzenie części I – każdy mówi, co zrobić, i wskazuje krok. */
export function completionIssues({ draft, sheetFromOsp, today, r = defaultRules }: CompletionInput): StepIssue[] {
  const issues: StepIssue[] = [];
  if (!sheetFromOsp) {
    issues.push({ step: 1, text: "Dodaj opis stanowiska pracy (OSP) – na jego podstawie wybiera się arkusz i kryteria.", legalBasis: "§ 3" });
  }
  const sheet = effectiveSheet(draft, sheetFromOsp);
  if (!sheet) {
    issues.push({ step: 2, text: "Wybierz arkusz oceny (B albo C).", legalBasis: "§ 3" });
  } else if (sheetFromOsp && sheet !== sheetFromOsp && !draft.sheetChangeReason.trim()) {
    issues.push({ step: 2, text: `Podaj powód zmiany arkusza ${sheetFromOsp} wskazanego przez OSP na ${sheet}. Trafi do dziennika decyzji.` });
  }

  if (sheet) {
    const validation = validateAdditionalCriteria(sheet, draft.additional.map((a) => a.competency), r);
    for (const e of validation.errors) issues.push({ step: 3, ...e });
  }
  for (const a of draft.additional) {
    if (!a.reason.trim()) {
      issues.push({
        step: 3,
        text: `Napisz, dlaczego „${COMPETENCY_NAMES[a.competency]}” jest istotne dla obowiązków z OSP (np. cytat zadania).`,
        legalBasis: r.periodic.legalBasis.maxAdditionalCriteria,
      });
    }
  }

  for (const item of CHECKLIST_ITEMS) {
    if (item.required && !draft.checklist[item.key]) {
      issues.push({ step: 4, text: `Zaznacz, że w rozmowie omówiono: ${item.label.toLowerCase()}.`, legalBasis: item.legalBasis });
    }
  }
  if (draft.checklist.oczekiwania && !draft.expectations.trim()) {
    issues.push({ step: 4, text: "Zapisz krótko oczekiwania omówione w rozmowie – pomogą przy ocenie za dwa lata.", legalBasis: "§ 5 ust. 1 pkt 3" });
  }
  if (draft.checklist.cele && !draft.goals.trim()) {
    issues.push({ step: 4, text: "Zaznaczono, że omówiono cele – zapisz je albo odznacz ten punkt.", legalBasis: "§ 5 ust. 1 pkt 4" });
  }
  if (!draft.conversationDate) {
    issues.push({ step: 4, text: "Podaj datę rozmowy rozpoczynającej." });
  } else if (draft.conversationDate > today) {
    issues.push({ step: 4, text: "Data rozmowy nie może być z przyszłości. Zatwierdź kryteria po przeprowadzeniu rozmowy." });
  }

  if (!draft.acknowledged) {
    issues.push({
      step: 5,
      text: "Potwierdź, że oceniany zapoznał się z kryteriami i terminem oceny i podpisał część I arkusza.",
      legalBasis: "§ 6 ust. 2",
    });
  }
  return issues;
}

/** Pierwszy krok z problemem – tam kreator przenosi po kliknięciu „Popraw”. */
export function firstIssueStep(issues: StepIssue[]): number | null {
  return issues.length ? Math.min(...issues.map((i) => i.step)) : null;
}

/** Kryteria części I w kolejności arkusza: obowiązkowe, potem dodatkowe. */
export function criteriaForSheet(
  sheet: "B" | "C",
  additional: WizardDraft["additional"],
  r: Rules = defaultRules,
): { competency: CompetencyCode; kind: "OBOWIAZKOWE" | "DODATKOWE"; reason?: string }[] {
  return [
    ...r.periodic.mandatoryCriteria[sheet].map((competency) => ({ competency, kind: "OBOWIAZKOWE" as const })),
    ...additional.map((a) => ({ competency: a.competency, kind: "DODATKOWE" as const, reason: a.reason.trim() || undefined })),
  ];
}
