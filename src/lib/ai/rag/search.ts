// Wyszukiwarka bazy wiedzy: BM25 (MiniSearch) z prostą normalizacją dla języka polskiego.
// Asystent formalny bierze do kontekstu wyłącznie `hits`, a przy `sufficient === false` odmawia odpowiedzi.

import MiniSearch from "minisearch";
import knowledgeBase from "../../../../data/wiedza/fragmenty.json";
import type { KnowledgeBase, KnowledgeFragment, SearchHit, SearchOptions, SearchResult } from "./types";

// ZAŁOŻENIE: progi dopasowania dobrane na pytaniach z zestawu testowego (tests/rag, eval/pytania.json).
/** Minimalny udział słów pytania obecnych w najlepszym fragmencie (pytania z 3+ słów znaczących). */
export const MIN_COVERAGE = 0.6;
/** Minimalny wynik BM25 najlepszego fragmentu. */
export const MIN_SCORE = 6;

/** Ile słów pytania musi pasować: przy 1–2 słowach znaczących – jedno, dalej co najmniej MIN_COVERAGE. */
export function requiredMatches(queryTermCount: number): number {
  return queryTermCount <= 2 ? 1 : Math.ceil(queryTermCount * MIN_COVERAGE);
}

/** Słowa bez znaczenia dla wyszukiwania (po usunięciu polskich znaków). */
const STOPWORDS = new Set(
  (
    "a aby ale albo bo by byc byl byla bylo czy dla do gdy gdzie i ich ile im jak jaka jaki jakie jakim jaką jest jestem " +
    "jesli jezeli juz kiedy kto ktora ktore ktory ma mam mozna moze musi na nad nie niz o od oraz po pod przez przy sa " +
    "sie sobie ta tak takze tam te tego tej ten to tu ty tylko w we wiec z za ze zeby co czym mi mnie moj moja nam nas " +
    "jego jej lub tez badz czyli bedzie beda trzeba prosze powinien powinna"
  ).split(" "),
);

/** Usuwa polskie znaki i ujednolica wielkość liter. */
export function foldPolish(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

// ZAŁOŻENIE: „stemming przez obcięcie” – pierwsze 6 znaków słowa łączy odmiany (sprzeciw/sprzeciwu, kryteria/kryteriów).
// Krótkie słowa (5–6 znaków) tracą ostatnią literę, żeby łączyć końcówki fleksyjne: ocena/oceny/ocenę → „ocen”.
const STEM_LENGTH = 6;

/** Normalizacja słowa: bez polskich znaków, bez słów pomijanych, obcięte do rdzenia. */
export function normalizeTerm(term: string): string | null {
  const t = foldPolish(term).replace(/[^a-z0-9§]/g, "");
  if (!t || STOPWORDS.has(t)) return null;
  if (/^\d+$/.test(t)) return t; // numery artykułów, paragrafów, dni
  if (t.length < 3) return null;
  return t.length > 4 ? t.slice(0, Math.min(STEM_LENGTH, t.length - 1)) : t;
}

function tokenize(text: string): string[] {
  return text.split(/[^\p{L}\p{N}§]+/u).filter(Boolean);
}

const kb = knowledgeBase as KnowledgeBase;
let index: MiniSearch<KnowledgeFragment> | null = null;
const byId = new Map<string, KnowledgeFragment>();

function getIndex(): MiniSearch<KnowledgeFragment> {
  if (index) return index;
  index = new MiniSearch<KnowledgeFragment>({
    fields: ["text", "unit", "documentShort"],
    storeFields: [],
    tokenize,
    processTerm: (t) => normalizeTerm(t),
    searchOptions: { boost: { unit: 2, documentShort: 0.5 }, combineWith: "OR" },
  });
  index.addAll(kb.fragments);
  for (const f of kb.fragments) byId.set(f.id, f);
  return index;
}

/** Wszystkie fragmenty bazy (np. do podglądu źródła po identyfikatorze). */
export function getFragment(id: string): KnowledgeFragment | undefined {
  getIndex();
  return byId.get(id);
}

export function fragmentCount(): number {
  return kb.fragments.length;
}

/** Wyszukuje fragmenty pasujące do pytania i ocenia, czy wystarczą do odpowiedzi ze źródłem. */
export function searchKnowledge(query: string, options: SearchOptions = {}): SearchResult {
  const { limit = 5, documents } = options;
  const queryTerms = [...new Set(tokenize(query).map(normalizeTerm).filter((t): t is string => t !== null))];
  if (queryTerms.length === 0) return { query, hits: [], sufficient: false };

  const raw = getIndex().search(query, {
    filter: documents ? (r) => documents.includes(byId.get(r.id)!.document) : undefined,
  });

  const hits: SearchHit[] = raw.slice(0, limit).map((r) => ({
    fragment: byId.get(r.id)!,
    score: r.score,
    coverage: new Set(r.terms).size / queryTerms.length,
  }));

  const best = hits[0];
  const matched = best ? Math.round(best.coverage * queryTerms.length) : 0;
  const sufficient = !!best && matched >= requiredMatches(queryTerms.length) && best.score >= MIN_SCORE;
  return { query, hits, sufficient };
}

/** Krótki opis źródła do wyświetlenia pod odpowiedzią, np. „§ 11 ust. 3 – rozporządzenie o ocenach okresowych (Dz.U. 2016 poz. 470)”. */
export function citation(f: KnowledgeFragment): string {
  const pub = f.publication ? ` (${f.publication})` : "";
  const page = f.page && !f.publication ? `, s. ${f.page}` : "";
  return `${f.unit} – ${f.documentShort}${pub}${page}`;
}
