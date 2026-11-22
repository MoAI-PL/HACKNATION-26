// Arkusz oceny okresowej B / C w PDF – czysta logika: co drukujemy, z jakich danych i kiedy wolno.
// Dane pochodzą z oceny zapisanej w kreatorze oceny okresowej (część I), w ocenie wskaźników (oceny cząstkowe) i w podsumowaniu (wynik, uzasadnienie, IPRZ,
// część III, zapoznanie). Puste pole (np. brak danych oceniającego w kartotece) drukujemy jako linię do wpisania,
// tak jak we wzorze papierowym – niczego nie zgadujemy. Testy: tests/pdf/arkusz.test.ts.

import type { Prisma } from "@prisma/client";
import { fromDbDate } from "@/lib/domain/daty";
import { COMPETENCY_NAMES, LEVEL_LABELS } from "@/lib/domain/slownik";
import type { CriterionKind, EvaluationResult, EvaluationStatus, IsoDate, Level, Role } from "@/lib/domain/types";
import { FINALIZED_STATUSES } from "@/lib/oceniany/moje-oceny";
import { evaluationScope } from "@/lib/api/eksport-oceny";

/** PEŁNY – arkusz po sporządzeniu oceny (części I–III); CZESC_I – kopia części I dla ocenianego (§ 6 ust. 3). */
export type SheetVariant = "PELNY" | "CZESC_I";

export const SHEET_VARIANTS: Record<string, SheetVariant> = { pelny: "PELNY", "czesc-i": "CZESC_I" };

export interface SheetPerson {
  firstName: string;
  lastName: string;
  orgUnit: string | null;
  position: string | null;
}

export interface SheetCriterion {
  name: string;
  kind: CriterionKind;
  points: number | null;
}

export interface SheetData {
  variant: SheetVariant;
  sheet: "B" | "C";
  office: string | null;
  employee: SheetPerson;
  evaluator: SheetPerson;
  criteria: SheetCriterion[];
  criteriaSetAt: IsoDate | null;
  dueDate: IsoDate | null;
  /** Część II – tylko w wariancie PEŁNY. */
  partII: {
    interviewDate: IsoDate | null;
    periodStart: IsoDate | null;
    periodEnd: IsoDate | null;
    average: number | null;
    overallLevel: Level | null;
    result: EvaluationResult | null;
    justification: string | null;
    developmentPlan: string | null;
    previous: { result: EvaluationResult; level: Level | null; date: IsoDate } | null;
    /** TAK / NIE / NIE_DOTYCZY – pytanie o wniosek o kolejny stopień (pracownik = NIE DOTYCZY). */
    promotion: "TAK" | "NIE" | "NIE_DOTYCZY";
    acknowledgedAt: IsoDate | null;
  } | null;
  /** Część III – tylko przy wniosku o stopień (przypis 18). */
  partIII: {
    appointmentYear: number | null;
    serviceGrade: number | null;
    serviceGradeDate: IsoDate | null;
    requestedGrade: number | null;
    justification: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Dostęp i warunki wydania
// ---------------------------------------------------------------------------

/**
 * Kto może pobrać arkusz: HR – wszystkie, przełożony – jak w eksporcie REST API (oceniający albo bezpośredni przełożony),
 * oceniany – pełny arkusz po sporządzeniu oceny (§ 12 ust. 2), część I po ustaleniu kryteriów (§ 6 ust. 3).
 * Kierujący komórką – brak dostępu (null).
 */
export function sheetScope(user: { id: string; role: Role }, variant: SheetVariant): Prisma.EvaluationWhereInput | null {
  if (user.role === "OCENIANY") {
    const own = { employee: { user: { id: user.id } } };
    return variant === "PELNY"
      ? { ...own, status: { in: [...FINALIZED_STATUSES] } }
      : { ...own, OR: [{ criteriaSetAt: { not: null } }, { status: { in: [...FINALIZED_STATUSES] } }] };
  }
  return evaluationScope(user);
}

/** Dlaczego nie można jeszcze wydrukować arkusza – null, gdy można. Komunikat po polsku z podstawą. */
export function sheetProblem(
  ev: { type: string; sheet: string; status: EvaluationStatus; criteriaSetAt: Date | null; periodStart: Date | null },
  variant: SheetVariant,
): string | null {
  if (ev.type !== "OKRESOWA" || (ev.sheet !== "B" && ev.sheet !== "C")) {
    return "Ten wydruk dotyczy oceny okresowej na arkuszu B albo C.";
  }
  const finalized = FINALIZED_STATUSES.includes(ev.status);
  if (ev.status === "DO_ROZPOCZECIA" || (!finalized && !criteriaDate(ev))) {
    return "Najpierw ustal kryteria i termin oceny na rozmowie rozpoczynającej – część I arkusza (§ 5–6).";
  }
  if (variant === "PELNY" && !FINALIZED_STATUSES.includes(ev.status)) {
    return "Pełny arkusz można wydrukować po sporządzeniu oceny na piśmie (§ 11). Do tego czasu dostępna jest część I.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dane z bazy → arkusz
// ---------------------------------------------------------------------------

const orgUnitWithParents = {
  select: { name: true, parent: { select: { name: true, parent: { select: { name: true, parent: { select: { name: true } } } } } } },
} as const;

export const sheetInclude = {
  employee: { include: { position: { select: { title: true } }, orgUnit: orgUnitWithParents } },
  evaluator: {
    select: {
      name: true,
      employee: { select: { firstName: true, lastName: true, position: { select: { title: true } }, orgUnit: { select: { name: true } } } },
    },
  },
  criteria: { orderBy: { order: "asc" } },
  conversations: { orderBy: { date: "asc" }, select: { type: true, date: true } },
} satisfies Prisma.EvaluationInclude;

export type SheetRow = Prisma.EvaluationGetPayload<{ include: typeof sheetInclude }>;

type UnitChain = { name: string; parent?: UnitChain | null } | null | undefined;

/** Nazwa urzędu = najwyższa komórka w drzewie (bez rodzica), np. „Ministerstwo Cyfryzacji”. */
export function officeName(unit: UnitChain): string | null {
  let u = unit;
  if (!u) return null;
  while (u.parent) u = u.parent;
  return u.name;
}

/** „Ewa Kowalczyk” → imię i nazwisko; nazwisko wieloczłonowe zostaje w całości. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const [firstName = "", ...rest] = full.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}

const iso = (d: Date | null | undefined): IsoDate | null => (d ? fromDbDate(d) : null);

/**
 * Data zapoznania z kryteriami (część I, przypis 6 „od”). Oceny sporządzone przed wprowadzeniem do systemu
 * (np. poprzednie oceny w danych demo) mają tylko początek okresu – wtedy to on jest tą datą.
 */
function criteriaDate(ev: { criteriaSetAt: Date | null; periodStart: Date | null }): Date | null {
  return ev.criteriaSetAt ?? ev.periodStart;
}

export function buildSheetData(ev: SheetRow, variant: SheetVariant): SheetData {
  const sheet = ev.sheet === "B" ? "B" : "C";
  const evaluatorRecord = ev.evaluator.employee;
  const evaluatorName = evaluatorRecord ?? splitName(ev.evaluator.name);
  const interview = [...ev.conversations].reverse().find((c) => c.type === "OCENIAJACA");
  const full = variant === "PELNY";
  const civilServant = ev.employee.isCivilServant;
  const promotion = !civilServant ? "NIE_DOTYCZY" : ev.promotionRequest ? "TAK" : "NIE";

  return {
    variant,
    sheet,
    office: officeName(ev.employee.orgUnit),
    employee: {
      firstName: ev.employee.firstName,
      lastName: ev.employee.lastName,
      orgUnit: ev.employee.orgUnit?.name ?? null,
      position: ev.employee.position?.title ?? null,
    },
    evaluator: {
      firstName: evaluatorName.firstName,
      lastName: evaluatorName.lastName,
      orgUnit: evaluatorRecord?.orgUnit?.name ?? null,
      position: evaluatorRecord?.position?.title ?? null,
    },
    criteria: ev.criteria.map((c) => ({ name: COMPETENCY_NAMES[c.competency], kind: c.kind, points: full ? c.score : null })),
    criteriaSetAt: iso(criteriaDate(ev)),
    dueDate: iso(ev.dueDate),
    partII: full
      ? {
          interviewDate: iso(interview?.date),
          periodStart: iso(ev.periodStart ?? ev.criteriaSetAt),
          periodEnd: iso(ev.periodEnd ?? ev.evaluatedAt),
          average: ev.average,
          overallLevel: ev.overallLevel,
          result: ev.result,
          justification: ev.justification,
          developmentPlan: ev.developmentPlan,
          previous: ev.previousResult && ev.previousDate ? { result: ev.previousResult, level: ev.previousLevel, date: fromDbDate(ev.previousDate) } : null,
          promotion,
          acknowledgedAt: iso(ev.acknowledgedAt),
        }
      : null,
    partIII:
      full && promotion === "TAK"
        ? {
            appointmentYear: ev.employee.appointmentYear,
            serviceGrade: ev.employee.serviceGrade,
            serviceGradeDate: iso(ev.employee.serviceGradeDate),
            requestedGrade: ev.requestedGrade,
            justification: ev.promotionJustification,
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Formatowanie pól
// ---------------------------------------------------------------------------

/** Średnia jak w arkuszu: „4,60”. */
export function formatAverage(value: number | null): string | null {
  return value === null ? null : value.toFixed(2).replace(".", ",");
}

export function levelLabel(level: Level | null): string | null {
  return level ? LEVEL_LABELS[level] : null;
}

/** Kolumny ocen cząstkowych (1/3/5/7/9) i progi poziomu ogólnego – kolejność jak we wzorze. */
export const PARTIAL_COLUMNS: { points: number; label: string }[] = [
  { points: 1, label: "Znacznie poniżej oczekiwań" },
  { points: 3, label: "Poniżej oczekiwań" },
  { points: 5, label: "Na poziomie oczekiwań" },
  { points: 7, label: "Powyżej oczekiwań" },
  { points: 9, label: "Znacznie powyżej oczekiwań" },
];

export const OVERALL_ROWS: { level: Level; range: string }[] = [
  { level: "ZNACZNIE_PONIZEJ", range: "od 1 punktu do 2 punktów" },
  { level: "PONIZEJ", range: "powyżej 2 punktów do 4 punktów" },
  { level: "NA_POZIOMIE", range: "powyżej 4 punktów do 6 punktów" },
  { level: "POWYZEJ", range: "powyżej 6 punktów do 8 punktów" },
  { level: "ZNACZNIE_POWYZEJ", range: "powyżej 8 punktów do 9 punktów" },
];

/** Nazwa pliku: „arkusz-C-Wojcik-Katarzyna-czesc-I.pdf” – bez polskich znaków i spacji. */
export function sheetFileName(data: Pick<SheetData, "sheet" | "employee" | "variant">): string {
  const ascii = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/Ł/g, "L")
      .replace(/[^A-Za-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `arkusz-${data.sheet}-${ascii(data.employee.lastName)}-${ascii(data.employee.firstName)}${data.variant === "CZESC_I" ? "-czesc-I" : ""}.pdf`;
}

// ---------------------------------------------------------------------------
// Linki do pobrania (przyciski na ekranach kreator oceny okresowej)
// ---------------------------------------------------------------------------

export function sheetHref(evaluationId: string, variant: SheetVariant): string {
  return `/api/v1/oceny/${encodeURIComponent(evaluationId)}/pdf${variant === "CZESC_I" ? "?wariant=czesc-i" : ""}`;
}

/** Które wydruki są dostępne dla oceny – zgodnie z warunkami endpointu (sheetProblem, firstSheetProblem). */
export function sheetDownloads(ev: {
  evaluationId: string;
  type: string;
  status: EvaluationStatus;
  hasCriteria: boolean;
}): { href: string; label: string }[] {
  if (ev.status === "DO_ROZPOCZECIA") return [];
  // Pierwsza ocena: jeden arkusz – po rozmowie wstępnej z jej danymi, po sporządzeniu oceny z wynikiem.
  if (ev.type === "PIERWSZA") return [{ href: sheetHref(ev.evaluationId, "PELNY"), label: "Pobierz arkusz pierwszej oceny (PDF)" }];
  if (ev.type !== "OKRESOWA") return [];
  const finalized = FINALIZED_STATUSES.includes(ev.status);
  const out: { href: string; label: string }[] = [];
  if (finalized) out.push({ href: sheetHref(ev.evaluationId, "PELNY"), label: "Pobierz arkusz (PDF)" });
  if (finalized || ev.hasCriteria) out.push({ href: sheetHref(ev.evaluationId, "CZESC_I"), label: "Pobierz część I (PDF)" });
  return out;
}
