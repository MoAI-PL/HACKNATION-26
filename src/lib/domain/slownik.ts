// Słownik nazw domenowych: kody w kodzie → pełne polskie nazwy w interfejsie i PDF.
// KONTRAKT WSPÓLNY: zmiany ogłaszamy zespołowi.
// Nazwy kryteriów są dosłownie z załącznika nr 1 do rozporządzenia PRM z 4.04.2016 (Dz.U. poz. 470).

import type {
  AbsenceKind,
  BehaviorLevel,
  CompetencyCode,
  ConversationType,
  CriterionKind,
  EvaluationResult,
  EvaluationStatus,
  EvaluationType,
  ExamExemption,
  ExamResult,
  IndicatorId,
  Level,
  Role,
  Sheet,
  SubordinateOption,
} from "./types";

/** Pełne nazwy 14 kryteriów / kompetencji (załącznik nr 1). */
export const COMPETENCY_NAMES: Record<CompetencyCode, string> = {
  RZETELNOSC: "Rzetelność",
  KOMUNIKACJA: "Komunikacja",
  WIEDZA: "Wykorzystywanie wiedzy i doskonalenie zawodowe",
  ORGANIZACJA: "Organizacja pracy i orientacja na osiąganie celów",
  KREATYWNOSC: "Kreatywność",
  WSPOLPRACA: "Współpraca",
  ANALITYCZNE: "Myślenie analityczne",
  NEGOCJOWANIE: "Negocjowanie",
  WYSTAPIENIA: "Wystąpienia publiczne",
  KLIENT: "Orientacja na klienta/interesanta",
  KRYZYS: "Radzenie sobie w sytuacjach kryzysowych",
  STRATEGICZNE: "Zarządzanie strategiczne",
  LUDZIE: "Zarządzanie ludźmi",
  DECYZJE: "Podejmowanie decyzji i odpowiedzialność",
};

/** Nazwy arkuszy w materialy/Model_kompetencji.xlsx (Excel skraca je do 31 znaków) – dla importu modelu kompetencji. */
export const COMPETENCY_XLSX_SHEETS: Record<CompetencyCode, string> = {
  RZETELNOSC: "RZETELNOŚĆ",
  KOMUNIKACJA: "KOMUNIKACJA",
  WIEDZA: "WYKORZYSTYWANIE WIEDZY",
  ORGANIZACJA: "ORGANIZACJA PRACY",
  KREATYWNOSC: "KREATYWNOŚĆ",
  WSPOLPRACA: "WSPÓŁPRACA",
  ANALITYCZNE: "MYŚLENIE ANALITYCZNE",
  NEGOCJOWANIE: "NEGOCJOWANIE",
  WYSTAPIENIA: "WYSTĄPIENIA PUBLICZNE",
  KLIENT: "ORIENTACJA NA KLIENTA",
  KRYZYS: "RADZENIE SOBIE W SYTUACJIACH KR",
  STRATEGICZNE: "ZARZĄDZANIE STRATEGICZNE",
  LUDZIE: "ZARZĄDZANIE LUDŹMI",
  DECYZJE: "PODEJMOWANIE DECYZJI I ODPOWIED",
};

/** Buduje identyfikator wskaźnika, np. indicatorId("KOMUNIKACJA", 2) → "KOMUNIKACJA.2". */
export function indicatorId(competency: CompetencyCode, index: number): IndicatorId {
  return `${competency}.${index}`;
}

export const LEVEL_LABELS: Record<Level, string> = {
  ZNACZNIE_PONIZEJ: "znacznie poniżej oczekiwań",
  PONIZEJ: "poniżej oczekiwań",
  NA_POZIOMIE: "na poziomie oczekiwań",
  POWYZEJ: "powyżej oczekiwań",
  ZNACZNIE_POWYZEJ: "znacznie powyżej oczekiwań",
};

/** Poziom zachowania na karcie (1–5) → poziom z modelu kompetencji. */
export const BEHAVIOR_LEVEL_TO_LEVEL: Record<BehaviorLevel, Level> = {
  1: "ZNACZNIE_PONIZEJ",
  2: "PONIZEJ",
  3: "NA_POZIOMIE",
  4: "POWYZEJ",
  5: "ZNACZNIE_POWYZEJ",
};

export const NO_OBSERVATION_LABEL = "brak okazji do obserwacji";

export const ROLE_LABELS: Record<Role, string> = {
  PRZELOZONY: "Przełożony",
  HR: "HR / administrator",
  OCENIANY: "Oceniany",
  KIERUJACY_KOMORKA: "Kierujący komórką",
};

export const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  PIERWSZA: "Pierwsza ocena w służbie cywilnej",
  OKRESOWA: "Ocena okresowa",
};

export const SHEET_LABELS: Record<Sheet, string> = {
  A: "Arkusz A – kierownik urzędu",
  B: "Arkusz B – stanowisko kierownicze",
  C: "Arkusz C – pozostałe stanowiska",
  PIERWSZA: "Arkusz pierwszej oceny",
};

/** Etykiety etapów zależą od rodzaju oceny. */
export const EVALUATION_STATUS_LABELS: Record<EvaluationType, Record<EvaluationStatus, string>> = {
  OKRESOWA: {
    DO_ROZPOCZECIA: "Do ustalenia kryteriów",
    W_OKRESIE_OCENY: "Kryteria ustalone",
    W_OCENIE: "Do oceny",
    CZEKA_NA_ZAPOZNANIE: "Czeka na zapoznanie",
    ZAKONCZONA: "Zakończona",
  },
  PIERWSZA: {
    DO_ROZPOCZECIA: "Do rozmowy wstępnej",
    W_OKRESIE_OCENY: "Czeka na sprawozdanie",
    W_OCENIE: "Do oceny",
    CZEKA_NA_ZAPOZNANIE: "Czeka na zapoznanie",
    ZAKONCZONA: "Zakończona",
  },
};

export const CRITERION_KIND_LABELS: Record<CriterionKind, string> = {
  OBOWIAZKOWE: "kryterium obowiązkowe",
  DODATKOWE: "kryterium dodatkowe",
};

export const RESULT_LABELS: Record<EvaluationResult, string> = {
  POZYTYWNA: "ocena pozytywna",
  NEGATYWNA: "ocena negatywna",
};

export const CONVERSATION_TYPE_LABELS: Record<ConversationType, string> = {
  WSTEPNA: "Rozmowa wstępna",
  ROZPOCZYNAJACA: "Rozmowa rozpoczynająca",
  OCENIAJACA: "Rozmowa oceniająca",
  BIEZACA: "Rozmowa bieżąca",
};

/** Opcje dosłownie jak w polu „LICZBA PODLEGŁYCH PRACOWNIKÓW” w OSP (do rozpoznawania w imporcie OSP). */
export const SUBORDINATE_LABELS: Record<SubordinateOption, string> = {
  BRAK: "brak podległych pracowników",
  DO_4: "bezpośrednio kieruje lub koordynuje pracę do 4 pracowników",
  OD_5_DO_9: "bezpośrednio kieruje lub koordynuje pracę od 5 do 9 pracowników",
  POWYZEJ_9: "bezpośrednio kieruje lub koordynuje pracę powyżej 9 pracowników",
  PODLEGAJA_KIERUJACY: "bezpośrednio podlegają osoby kierujące pracą innych pracowników",
};

export const ABSENCE_KIND_LABELS: Record<AbsenceKind, string> = {
  ZWOLNIENIE_LEKARSKIE: "zwolnienie lekarskie",
  URLOP_MACIERZYNSKI: "urlop macierzyński",
  URLOP_RODZICIELSKI: "urlop rodzicielski",
  URLOP_OJCOWSKI: "urlop ojcowski",
  URLOP_WYCHOWAWCZY: "urlop wychowawczy",
  URLOP_BEZPLATNY: "urlop bezpłatny",
  INNA: "inna usprawiedliwiona nieobecność",
};

export const EXAM_RESULT_LABELS: Record<ExamResult, string> = {
  ZDANY: "TAK",
  NIEZDANY: "NIE",
  NIE_DOTYCZY: "NIE DOTYCZY",
};

export const EXAM_EXEMPTION_LABELS: Record<ExamExemption, string> = {
  ABSOLWENT_KSAP: "absolwent KSAP, który nie złożył wniosku o mianowanie",
  ZASTEPSTWO: "zatrudniony w celu zastępstwa nieobecnego członka korpusu służby cywilnej",
  WYZSZE_STANOWISKO: "zatrudniony na wyższym stanowisku w służbie cywilnej",
};

/** Krótkie wyjaśnienia żargonu do dymków. */
export const GLOSSARY: Record<string, string> = {
  OSP: "Opis stanowiska pracy – dokument z celem stanowiska, zadaniami i wymaganiami.",
  IPRZ: "Indywidualny program rozwoju zawodowego – plan szkoleń i działań rozwojowych pracownika.",
  "ocena cząstkowa": "Punkty za jedno kryterium oceny (1, 3, 5, 7 albo 9).",
  "poziom ogólny": "Średnia ze wszystkich ocen cząstkowych przełożona na poziom spełniania kryteriów.",
  "wskaźnik behawioralny": "Konkretne, obserwowalne zachowanie, po którym widać daną kompetencję.",
  SDR: "Sytuacja – Działanie – Rezultat: sposób zapisywania obserwacji.",
};
