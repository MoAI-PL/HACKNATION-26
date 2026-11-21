// Typy bazy wiedzy asystenta formalnego (Z21). Z nich korzysta asystent (Z22) i podpowiedzi „ⓘ Dlaczego?” (Z42).

/** Dokumenty źródłowe bazy wiedzy. */
export const KNOWLEDGE_DOCUMENTS = [
  "ROZP_OKRESOWE",
  "ROZP_PIERWSZA",
  "PORADNIK_OKRESOWE",
  "PORADNIK_PIERWSZA",
  "USTAWA",
  "MODEL_KOMPETENCJI",
  "FAQ",
] as const;
export type KnowledgeDocument = (typeof KNOWLEDGE_DOCUMENTS)[number];

/** Fragment bazy wiedzy – najmniejsza cytowalna jednostka (ustęp, rozdział poradnika, pytanie FAQ). */
export interface KnowledgeFragment {
  /** Stały identyfikator, np. "ROZP_OKRESOWE:§11:ust.1" albo "PORADNIK_OKRESOWE:s32:2". */
  id: string;
  document: KnowledgeDocument;
  /** Pełny tytuł dokumentu do wyświetlenia pod odpowiedzią. */
  documentTitle: string;
  /** Krótka nazwa dokumentu, np. „rozporządzenie o ocenach okresowych”. */
  documentShort: string;
  /** Jednostka redakcyjna albo rozdział, np. „§ 11 ust. 1”, „Załącznik nr 1 – Komunikacja”, „rozdz. 7. Sprzeciw od otrzymanej oceny”. */
  unit: string;
  /** Numer strony w pliku PDF (jeśli dotyczy). */
  page?: number;
  /** Data aktu lub wydania dokumentu "RRRR-MM-DD" / "RRRR-MM". */
  actDate?: string;
  /** Publikator, np. „Dz.U. 2016 poz. 470”. */
  publication?: string;
  /** Plik źródłowy w repozytorium. */
  sourceFile: string;
  text: string;
}

/** Plik data/wiedza/fragmenty.json generowany przez `npm run wiedza`. */
export interface KnowledgeBase {
  generatedAt: string;
  fragments: KnowledgeFragment[];
}

export interface SearchHit {
  fragment: KnowledgeFragment;
  /** Wynik BM25 z MiniSearch (nieograniczony z góry). */
  score: number;
  /** Udział słów pytania (po normalizacji), które występują we fragmencie: 0–1. */
  coverage: number;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  /**
   * true = dopasowanie wystarcza do odpowiedzi na podstawie źródeł.
   * false = asystent ma odpowiedzieć „Nie znalazłem tej informacji w dostępnych źródłach…”.
   */
  sufficient: boolean;
}

export interface SearchOptions {
  /** Maksymalna liczba wyników (domyślnie 5). */
  limit?: number;
  /** Ogranicz do wybranych dokumentów. */
  documents?: KnowledgeDocument[];
}
