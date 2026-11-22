// Kontrakt domeny Kompasu Kompetencji.
// KONTRAKT WSPÓLNY: zmiany małymi, osobnymi commitami i zawsze ogłaszamy zespołowi.
//
// Konwencja: identyfikatory po angielsku, wartości domenowe po polsku (bez polskich znaków),
// tak samo jak enumy w prisma/schema.prisma. Zgodność obu list pilnuje test tests/domain/kontrakt.test.ts.
// Daty w czystej logice (silnik reguł) przekazujemy jako "RRRR-MM-DD" (IsoDate), bez stref czasowych.

// ---------------------------------------------------------------------------
// Wartości wyliczeniowe (listy `as const` + typy pochodne)
// ---------------------------------------------------------------------------

/** Role użytkowników. */
export const ROLES = ["PRZELOZONY", "HR", "OCENIANY", "KIERUJACY_KOMORKA"] as const;
export type Role = (typeof ROLES)[number];

/** Rodzaj oceny: pierwsza ocena w służbie cywilnej albo ocena okresowa. */
export const EVALUATION_TYPES = ["PIERWSZA", "OKRESOWA"] as const;
export type EvaluationType = (typeof EVALUATION_TYPES)[number];

/** Arkusz: A, B, C (ocena okresowa, § 3) albo arkusz pierwszej oceny. A jest poza zakresem prototypu. */
export const SHEETS = ["A", "B", "C", "PIERWSZA"] as const;
export type Sheet = (typeof SHEETS)[number];
export type PeriodicSheet = Exclude<Sheet, "PIERWSZA">;

/**
 * Etap procesu oceny (odznaka statusu na pulpicie i w panelu HR).
 * - DO_ROZPOCZECIA: trzeba przeprowadzić rozmowę rozpoczynającą (okresowa) albo wstępną (pierwsza);
 * - W_OKRESIE_OCENY: kryteria ustalone / czekamy na sprawozdanie, trwa zbieranie obserwacji;
 * - W_OCENIE: przełożony wypełnia ocenę (kreator „Zakończ ocenę”);
 * - CZEKA_NA_ZAPOZNANIE: ocena sporządzona, oceniany jeszcze się nie zapoznał;
 * - ZAKONCZONA: oceniany zapoznał się z oceną.
 * Etykiety dla obu rodzajów oceny są w slownik.ts (EVALUATION_STATUS_LABELS).
 */
export const EVALUATION_STATUSES = [
  "DO_ROZPOCZECIA",
  "W_OKRESIE_OCENY",
  "W_OCENIE",
  "CZEKA_NA_ZAPOZNANIE",
  "ZAKONCZONA",
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

/** Rodzaj kryterium oceny okresowej (§ 2 ust. 2). */
export const CRITERION_KINDS = ["OBOWIAZKOWE", "DODATKOWE"] as const;
export type CriterionKind = (typeof CRITERION_KINDS)[number];

/** Wynik oceny (§ 11 ust. 1 pkt 3–4 rozp. o ocenach okresowych, § 10 rozp. o pierwszej ocenie). */
export const RESULTS = ["POZYTYWNA", "NEGATYWNA"] as const;
export type EvaluationResult = (typeof RESULTS)[number];

/**
 * Poziom spełniania (pięć poziomów: ocena cząstkowa i poziom ogólny oceny okresowej, poziomy modelu kompetencji).
 * Pierwsza ocena używa tylko PONIZEJ / NA_POZIOMIE / POWYZEJ.
 */
export const LEVELS = [
  "ZNACZNIE_PONIZEJ",
  "PONIZEJ",
  "NA_POZIOMIE",
  "POWYZEJ",
  "ZNACZNIE_POWYZEJ",
] as const;
export type Level = (typeof LEVELS)[number];

/** Rodzaj rozmowy. BIEZACA = rozmowa w trakcie okresu oceny (informacja zwrotna). */
export const CONVERSATION_TYPES = ["WSTEPNA", "ROZPOCZYNAJACA", "OCENIAJACA", "BIEZACA"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

/** Skąd pochodzi obserwacja w dzienniku. */
export const OBSERVATION_SOURCES = ["RECZNA", "SZYBKA_AI"] as const;
export type ObservationSource = (typeof OBSERVATION_SOURCES)[number];

/** Pole „LICZBA PODLEGŁYCH PRACOWNIKÓW” z opisu stanowiska pracy (OSP). */
export const SUBORDINATE_OPTIONS = [
  "BRAK",
  "DO_4",
  "OD_5_DO_9",
  "POWYZEJ_9",
  "PODLEGAJA_KIERUJACY",
] as const;
export type SubordinateOption = (typeof SUBORDINATE_OPTIONS)[number];

/** Usprawiedliwiona nieobecność (art. 81 ust. 7 ustawy o służbie cywilnej). */
export const ABSENCE_KINDS = [
  "ZWOLNIENIE_LEKARSKIE",
  "URLOP_MACIERZYNSKI",
  "URLOP_RODZICIELSKI",
  "URLOP_OJCOWSKI",
  "URLOP_WYCHOWAWCZY",
  "URLOP_BEZPLATNY",
  "INNA",
] as const;
export type AbsenceKind = (typeof ABSENCE_KINDS)[number];

/** Egzamin ze służby przygotowawczej (§ 10 ust. 1 pkt 1 i ust. 3 rozp. o pierwszej ocenie). */
export const EXAM_RESULTS = ["ZDANY", "NIEZDANY", "NIE_DOTYCZY"] as const;
export type ExamResult = (typeof EXAM_RESULTS)[number];

/** Powód „nie dotyczy” przy egzaminie (§ 10 ust. 3 rozp. o pierwszej ocenie). */
export const EXAM_EXEMPTIONS = ["ABSOLWENT_KSAP", "ZASTEPSTWO", "WYZSZE_STANOWISKO"] as const;
export type ExamExemption = (typeof EXAM_EXEMPTIONS)[number];

/** Kody 14 kompetencji / kryteriów z załącznika nr 1 (nazwy w slownik.ts). */
export const COMPETENCY_CODES = [
  "RZETELNOSC",
  "KOMUNIKACJA",
  "WIEDZA",
  "ORGANIZACJA",
  "KREATYWNOSC",
  "WSPOLPRACA",
  "ANALITYCZNE",
  "NEGOCJOWANIE",
  "WYSTAPIENIA",
  "KLIENT",
  "KRYZYS",
  "STRATEGICZNE",
  "LUDZIE",
  "DECYZJE",
] as const;
export type CompetencyCode = (typeof COMPETENCY_CODES)[number];

// ---------------------------------------------------------------------------
// Wartości proste
// ---------------------------------------------------------------------------

/** Data kalendarzowa "RRRR-MM-DD". */
export type IsoDate = string;

/** Poziom zachowania wybrany na karcie (1 = znacznie poniżej … 5 = znacznie powyżej oczekiwań). */
export type BehaviorLevel = 1 | 2 | 3 | 4 | 5;

/** Ocena wskaźnika: poziom zachowania albo „brak okazji do obserwacji”. */
export type IndicatorRatingValue = BehaviorLevel | "BRAK_OBSERWACJI";

/** Punkty oceny cząstkowej: okresowa 1/3/5/7/9 (§ 11 ust. 1 pkt 1), pierwsza 3/5/7 (§ 9 ust. 1). */
export type PeriodicPoints = 1 | 3 | 5 | 7 | 9;
export type FirstEvalPoints = 3 | 5 | 7;

/** Identyfikator wskaźnika behawioralnego: "<KOD_KOMPETENCJI>.<nr>", nr od 1 w kolejności z arkusza xlsx, np. "KOMUNIKACJA.2". */
export type IndicatorId = `${CompetencyCode}.${number}`;

// ---------------------------------------------------------------------------
// Model kompetencji (wynik importu modelu kompetencji: data/model-kompetencji.json)
// ---------------------------------------------------------------------------

export interface IndicatorDefinition {
  id: IndicatorId;
  competency: CompetencyCode;
  /** Nazwa wskaźnika – identyczna z załącznikiem nr 1 do rozporządzenia. */
  name: string;
  /** Opisy zachowań dla poziomów 1–5 (karty zachowań w ocenie wskaźników). */
  levels: Record<BehaviorLevel, string>;
}

export interface CompetencyDefinition {
  code: CompetencyCode;
  name: string;
  indicators: IndicatorDefinition[];
}

export interface CompetencyModel {
  /** Skąd zaimportowano (nazwa pliku) i kiedy (data "RRRR-MM-DD"). */
  source: string;
  importedAt: IsoDate;
  /** Wskazówki z arkusza „Model kompetencji” – wyświetlane przy ocenie wskaźników. */
  guidance: string[];
  competencies: CompetencyDefinition[];
}

// ---------------------------------------------------------------------------
// Opis stanowiska pracy (wynik importu OSP)
// ---------------------------------------------------------------------------

export interface PositionDescription {
  title: string;
  orgUnit?: string;
  purpose: string;
  dominantTasks: string[];
  otherTasks: string[];
  subordinates: SubordinateOption;
  /** Zaznaczone upoważnienia i pełnomocnictwa (bez „brak…”), połączone średnikiem; brak pola = brak upoważnień. */
  authorizations?: string;
  /** „Kompetencje miękkie” z OSP – nazwy kompetencji z modelu (załącznik nr 1). */
  requiredCompetencies: string[];
  /** Te same kompetencje jako kody – do porównania z kryteriami obowiązkowymi i propozycji kryteriów dodatkowych. */
  requiredCompetencyCodes?: CompetencyCode[];
  /** Symbol stanowiska, np. "DSI WWI 5". */
  symbol?: string;
  office?: string;
  /** Stanowisko bezpośrednio nadzorujące, np. „naczelnik wydziału”. */
  supervisor?: string;
  /** Opisy „Złożoność i kreatywność” oraz „Niezbędna samodzielność i inicjatywa” – kontekst dla AI. */
  complexity?: string;
  independence?: string;
  /** „Inne kompetencje, wiedza lub umiejętności” – wymagana znajomość przepisów i zagadnień. */
  knowledge?: string[];
}

/** Automatyczny wybór arkusza oceny okresowej z OSP (§ 3) – przełożony może go zmienić (zmiana trafia do dziennika). */
export interface SheetSelection {
  sheet: Exclude<PeriodicSheet, "A">;
  subordinates: SubordinateOption;
  /** Kryteria obowiązkowe wybranego arkusza (§ 4). */
  mandatoryCriteria: CompetencyCode[];
  /** Np. „Wybrano arkusz C, bo w OSP zaznaczono »brak podległych pracowników«.” */
  explanation: Explanation;
}

// ---------------------------------------------------------------------------
// Wyjaśnienia i ostrzeżenia (wspólne dla silników silniku punktacji)
// ---------------------------------------------------------------------------

/** Zdanie zwykłym językiem z podstawą prawną, np. { text: "Ocena jest negatywna, bo…", legalBasis: "§ 11 ust. 1 pkt 4" }. */
export interface Explanation {
  text: string;
  legalBasis?: string;
}

export type WarningSeverity = "INFO" | "OSTRZEZENIE";

export interface Warning {
  /** Stały kod do testów i filtrowania, np. "OCENA_1_PKT", "NISKA_WIARYGODNOSC", "BRAK_NOTATKI". */
  code: string;
  severity: WarningSeverity;
  message: string;
  legalBasis?: string;
  /** Wskaźnik, którego dotyczy ostrzeżenie (np. „uzasadnij przykładem”) – do pokazania przy jego karcie. */
  indicatorId?: IndicatorId;
}

// ---------------------------------------------------------------------------
// Wejście i wyjście silnika punktacji
// ---------------------------------------------------------------------------

export interface PartialScore {
  competency: CompetencyCode;
  kind: CriterionKind;
  points: PeriodicPoints;
}

export interface PeriodicScoreResult {
  average: number;
  overallLevel: Level;
  result: EvaluationResult;
  justificationRequired: boolean;
  explanations: Explanation[];
}

export interface FirstEvalInput {
  scores: { competency: CompetencyCode; points: FirstEvalPoints }[];
  exam: ExamResult;
  examExemption?: ExamExemption;
  reportSubmittedOnTime: boolean;
}

export interface FirstEvalScoreResult {
  average: number;
  result: EvaluationResult;
  justificationRequired: boolean;
  explanations: Explanation[];
}

/** Wynik walidacji kryteriów dodatkowych (maks. 3, bez powtórzeń obowiązkowych – § 5 ust. 2). */
export interface CriteriaValidation {
  valid: boolean;
  errors: Explanation[];
}

// ---------------------------------------------------------------------------
// Sugerowany poziom kompetencji
// ---------------------------------------------------------------------------

/** Ocena jednego wskaźnika – wejście sugestii. */
export interface IndicatorRatingInput {
  indicatorId: IndicatorId;
  /** Wybrana karta zachowania albo „brak okazji do obserwacji”; null = wskaźnik jeszcze nieoceniony. */
  value: IndicatorRatingValue | null;
  /** Czy przy wskaźniku jest notatka SDR (własna albo przypięta obserwacja z dziennika). */
  hasNote: boolean;
}

/** Wiersz panelu „Dlaczego ten poziom?”: jeden wskaźnik kompetencji. */
export interface IndicatorBreakdown {
  indicatorId: IndicatorId;
  name: string;
  value: IndicatorRatingValue | null;
  /** Punkty wskaźnika na skali oceny (1/3/5/7/9 albo 3/5/7); null, gdy nieobserwowany lub nieoceniony. */
  points: number | null;
  hasNote: boolean;
}

export interface LevelSuggestion {
  competency: CompetencyCode;
  evaluationType: EvaluationType;
  /** null = brak podstaw do sugestii (żaden wskaźnik nie został zaobserwowany). */
  suggestedPoints: PeriodicPoints | FirstEvalPoints | null;
  /** Poziom odpowiadający suggestedPoints (w pierwszej ocenie: PONIZEJ / NA_POZIOMIE / POWYZEJ). */
  suggestedLevel: Level | null;
  average: number | null;
  /** true, gdy średnia wypadła dokładnie pomiędzy dwiema wartościami skali i zaokrąglono w dół. */
  tieRoundedDown: boolean;
  observedCount: number;
  totalCount: number;
  /** Rozkład wyborów do panelu „Dlaczego ten poziom?” (wskaźniki nieocenione nie są liczone). */
  distribution: Record<IndicatorRatingValue, number>;
  /** Wskaźniki w kolejności z modelu kompetencji. */
  indicators: IndicatorBreakdown[];
  /** Wzór i zaokrąglenie zwykłym językiem, np. „(7 + 5 + 7) : 3 = 6,33 pkt → 7 pkt”. */
  explanations: Explanation[];
  warnings: Warning[];
}

/** Decyzja przełożonego o ocenie cząstkowej kryterium – do walidacji przed zapisem. */
export interface FinalDecisionInput {
  suggestion: LevelSuggestion;
  finalPoints: number;
  /** Jedno zdanie powodu – wymagane, gdy finalPoints różni się od sugestii. */
  justification?: string;
}

export interface FinalDecisionValidation {
  valid: boolean;
  justificationRequired: boolean;
  /** Ocena ostateczna różni się od sugestii – oba wpisy trafiają do dziennika decyzji. */
  differsFromSuggestion: boolean;
  errors: Explanation[];
}

// ---------------------------------------------------------------------------
// Terminy i karta „Do zrobienia”
// ---------------------------------------------------------------------------

export type DeadlineKind =
  | "ROZMOWA_ROZPOCZYNAJACA"
  | "ROZMOWA_PO_NEGATYWNEJ"
  | "OCENA_OKRESOWA"
  | "PONOWNA_OCENA_PO_NEGATYWNEJ"
  | "PONOWNE_KRYTERIA_PO_ZMIANIE_STANOWISKA"
  | "OCENA_PRZY_ZMIANIE_STANOWISKA"
  | "ROZMOWA_WSTEPNA"
  | "SPRAWOZDANIE"
  | "PIERWSZA_OCENA_OD"
  | "PIERWSZA_OCENA_DO"
  | "SPRZECIW";

export interface Deadline {
  kind: DeadlineKind;
  /** Ostateczny dzień terminu (po przesunięciu na dzień roboczy, jeśli dotyczy). */
  date: IsoDate;
  /** Dla przedziałów (np. ocena przy zmianie stanowiska): najwcześniejszy dopuszczalny dzień. */
  earliest?: IsoDate;
  /** Przesunięcia terminu z powodami, np. { days: 44, reason: "L4 12.03–24.04" }. */
  extensions: { days: number; reason: string }[];
  explanation: Explanation;
}

/** Zmiana stanowiska (model PositionChange) – wejście silnika terminów (§ 9, art. 81 ust. 6 ustawy). */
export interface PositionChangeEvent {
  date: IsoDate;
  /** Terminy zmienia tylko zmiana z istotną zmianą obowiązków. */
  significantDutiesChange: boolean;
}

/** Kolor odznaki terminu – zawsze razem z tekstem. */
export type DeadlineUrgency = "PO_TERMINIE" | "PILNE" | "WKROTCE" | "W_TERMINIE";

export interface TodoItem {
  employeeId: string;
  evaluationId?: string;
  deadline: Deadline;
  urgency: DeadlineUrgency;
  /** Treść karty, np. „Rozmowa rozpoczynająca z J. Nowakiem – do piątku 28.11 (§ 5)”. */
  title: string;
  /** Etykieta jedynego przycisku akcji, np. „Przygotuj rozmowę”. */
  actionLabel: string;
  /** Ścieżka w aplikacji, do której prowadzi przycisk. */
  href: string;
}
