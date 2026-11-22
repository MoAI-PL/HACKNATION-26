// Ocena asystenta formalnego na zestawie testowym. Czysta logika bez modelu i bazy – testowana w tests/ai/eval.test.ts.
//
// Dwa poziomy:
//  1. WYSZUKIWANIE (zawsze, bez modelu): czy baza wiedzy zwraca właściwy fragment i czy odmawia przy pytaniach spoza zakresu;
//  2. ODPOWIEDŹ (gdy model jest skonfigurowany): czy asystent odpowiada poprawnie, ze źródłem, i czy odmawia, gdy powinien.

import { z } from "zod";

const keywordGroups = z.array(z.array(z.string().min(1)).min(1)).min(1);

export const evalSetSchema = z.object({
  opis: z.string().optional(),
  pytania: z
    .array(
      z.object({
        id: z.string().min(1),
        pytanie: z.string().min(5),
        wzorcowa: z.string().min(5),
        zrodla: z.array(z.string().min(3)).min(1),
        kluczowe: keywordGroups,
      }),
    )
    .min(1),
  pozaZakresem: z.array(z.object({ id: z.string().min(1), pytanie: z.string().min(3) })).min(1),
});

export type EvalSet = z.infer<typeof evalSetSchema>;
export type InScopeQuestion = EvalSet["pytania"][number];
export type OutOfScopeQuestion = EvalSet["pozaZakresem"][number];

/** Małe litery, bez polskich znaków i nadmiarowych spacji – do porównań słów kluczowych. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[-‐–—]/g, " ") // „24-miesięczny” = „24 miesięczny”
    .replace(/\s+/g, " ");
}

/** Czy identyfikator fragmentu pasuje do akceptowanego źródła (dokładnie albo jako prefiks przed „:” / „.”). */
export function matchesSource(fragmentId: string, accepted: readonly string[]): boolean {
  return accepted.some((a) => fragmentId === a || fragmentId.startsWith(`${a}:`) || fragmentId.startsWith(`${a}.`));
}

/** Grupy słów kluczowych, których brakuje w odpowiedzi (pusta lista = wszystkie są). */
export function missingKeywords(answer: string, groups: readonly (readonly string[])[]): string[][] {
  const text = fold(answer);
  return groups.filter((g) => !g.some((k) => text.includes(fold(k)))).map((g) => [...g]);
}

// ---------------------------------------------------------------------------
// Poziom 1: wyszukiwanie
// ---------------------------------------------------------------------------

export interface RetrievalInput {
  sufficient: boolean;
  /** Identyfikatory zwróconych fragmentów w kolejności trafności. */
  hitIds: string[];
}

export interface RetrievalResult {
  id: string;
  pytanie: string;
  inScope: boolean;
  ok: boolean;
  /** Pozycja pierwszego właściwego fragmentu (1 = najlepszy), null = brak w wynikach. */
  rank: number | null;
  sufficient: boolean;
  powod?: string;
}

export function scoreRetrievalInScope(q: InScopeQuestion, r: RetrievalInput): RetrievalResult {
  const idx = r.hitIds.findIndex((id) => matchesSource(id, q.zrodla));
  const rank = idx === -1 ? null : idx + 1;
  const ok = r.sufficient && rank !== null;
  const powod = ok
    ? undefined
    : !r.sufficient
      ? "wyszukiwarka uznała dopasowanie za zbyt słabe (asystent odmówi)"
      : "brak właściwego fragmentu wśród wyników";
  return { id: q.id, pytanie: q.pytanie, inScope: true, ok, rank, sufficient: r.sufficient, powod };
}

export function scoreRetrievalOutOfScope(q: OutOfScopeQuestion, r: RetrievalInput): RetrievalResult {
  const ok = !r.sufficient;
  return {
    id: q.id,
    pytanie: q.pytanie,
    inScope: false,
    ok,
    rank: null,
    sufficient: r.sufficient,
    powod: ok ? undefined : "wyszukiwarka przepuściła pytanie spoza zakresu (decyzja przechodzi na model)",
  };
}

// ---------------------------------------------------------------------------
// Poziom 2: odpowiedź asystenta
// ---------------------------------------------------------------------------

export interface AnswerInput {
  answer: string;
  refused: boolean;
  mode: "AI" | "BEZ_AI";
  sourceIds: string[];
  notice?: string;
  durationMs: number;
}

export interface AnswerResult {
  id: string;
  pytanie: string;
  inScope: boolean;
  /** W zakresie: odpowiedź poprawna. Poza zakresem: poprawna odmowa. */
  ok: boolean;
  refused: boolean;
  withSource: boolean;
  citedExpected: boolean;
  missing: string[][];
  mode: "AI" | "BEZ_AI";
  /** Fragmenty wskazane przez asystenta (do analizy błędów). */
  sourceIds: string[];
  /** Odpowiedź wymienia przepis spoza wskazanych źródeł. */
  unverified: boolean;
  durationMs: number;
  answer: string;
  powod?: string;
}

export function scoreAnswerInScope(q: InScopeQuestion, a: AnswerInput): AnswerResult {
  const withSource = !a.refused && a.sourceIds.length > 0;
  const citedExpected = a.sourceIds.some((id) => matchesSource(id, q.zrodla));
  const missing = a.refused ? q.kluczowe.map((g) => [...g]) : missingKeywords(a.answer, q.kluczowe);
  const ok = a.mode === "AI" && withSource && citedExpected && missing.length === 0;
  let powod: string | undefined;
  if (!ok) {
    if (a.mode !== "AI") powod = `tryb bez AI (model niedostępny)${a.notice ? `: ${a.notice}` : ""}`;
    else if (a.refused) powod = "niepotrzebna odmowa";
    else if (!withSource) powod = "odpowiedź bez źródła";
    else if (!citedExpected) powod = "źródło spoza oczekiwanych";
    else powod = `brak w odpowiedzi: ${missing.map((g) => g.join(" / ")).join("; ")}`;
  }
  return {
    id: q.id,
    pytanie: q.pytanie,
    inScope: true,
    ok,
    refused: a.refused,
    withSource,
    citedExpected,
    missing,
    mode: a.mode,
    sourceIds: a.sourceIds,
    unverified: !!a.notice?.startsWith("Uwaga"),
    durationMs: a.durationMs,
    answer: a.answer,
    powod,
  };
}

export function scoreAnswerOutOfScope(q: OutOfScopeQuestion, a: AnswerInput): AnswerResult {
  return {
    id: q.id,
    pytanie: q.pytanie,
    inScope: false,
    ok: a.refused,
    refused: a.refused,
    withSource: !a.refused && a.sourceIds.length > 0,
    citedExpected: false,
    missing: [],
    mode: a.mode,
    sourceIds: a.sourceIds,
    unverified: !!a.notice?.startsWith("Uwaga"),
    durationMs: a.durationMs,
    answer: a.answer,
    powod: a.refused ? undefined : "brak odmowy przy pytaniu spoza zakresu",
  };
}

// ---------------------------------------------------------------------------
// Podsumowanie
// ---------------------------------------------------------------------------

export interface Ratio {
  ok: number;
  all: number;
  /** 0–100, zaokrąglone do pełnych procent. */
  percent: number;
}

export function ratio(ok: number, all: number): Ratio {
  return { ok, all, percent: all === 0 ? 0 : Math.round((ok / all) * 100) };
}

export interface RetrievalSummary {
  trafnoscZrodla: Ratio;
  odmowy: Ratio;
  /** Średnia pozycja właściwego fragmentu tam, gdzie się pojawił. */
  sredniaPozycja: number | null;
}

export function summarizeRetrieval(results: RetrievalResult[]): RetrievalSummary {
  const inScope = results.filter((r) => r.inScope);
  const out = results.filter((r) => !r.inScope);
  const ranks = inScope.map((r) => r.rank).filter((r): r is number => r !== null);
  return {
    trafnoscZrodla: ratio(inScope.filter((r) => r.ok).length, inScope.length),
    odmowy: ratio(out.filter((r) => r.ok).length, out.length),
    sredniaPozycja: ranks.length ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10 : null,
  };
}

export interface AnswerSummary {
  /** Odpowiedzi poprawne (właściwe źródło i treść) wśród pytań w zakresie. */
  trafnosc: Ratio;
  /** Odpowiedzi ze źródłem wśród pytań w zakresie. */
  zeZrodlem: Ratio;
  /** Poprawne odmowy wśród pytań spoza zakresu. */
  odmowy: Ratio;
  /** Odpowiedzi z ostrzeżeniem o przepisie spoza źródeł. */
  ostrzezeniaCytowan: number;
  trybBezAi: number;
  sredniCzasMs: number;
}

export function summarizeAnswers(results: AnswerResult[]): AnswerSummary {
  const inScope = results.filter((r) => r.inScope);
  const out = results.filter((r) => !r.inScope);
  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.durationMs, 0) / results.length) : 0;
  return {
    trafnosc: ratio(inScope.filter((r) => r.ok).length, inScope.length),
    zeZrodlem: ratio(inScope.filter((r) => r.withSource).length, inScope.length),
    odmowy: ratio(out.filter((r) => r.ok).length, out.length),
    ostrzezeniaCytowan: results.filter((r) => r.unverified).length,
    trybBezAi: results.filter((r) => r.mode === "BEZ_AI").length,
    sredniCzasMs: avg,
  };
}

const fmt = (r: Ratio) => `${r.ok}/${r.all} (${r.percent}%)`;

/** Raport w Markdown do eval/wynik.md, docs/AI.md i na slajd. */
export function markdownReport(opts: {
  date: string;
  fragments: number;
  retrieval: RetrievalSummary;
  retrievalResults: RetrievalResult[];
  answers?: { model: string; summary: AnswerSummary; results: AnswerResult[] };
}): string {
  const { retrieval, answers } = opts;
  const lines: string[] = [
    `# Wynik zestawu testowego asystenta formalnego`,
    ``,
    `Data: ${opts.date} · baza wiedzy: ${opts.fragments} fragmentów · pytania: ${opts.retrievalResults.filter((r) => r.inScope).length} w zakresie + ${opts.retrievalResults.filter((r) => !r.inScope).length} spoza zakresu (\`eval/pytania.json\`)`,
    ``,
    `| Miara | Wynik |`,
    `|---|---|`,
  ];
  if (answers) {
    lines.push(
      `| **Trafność odpowiedzi** (właściwe źródło i treść) | **${fmt(answers.summary.trafnosc)}** |`,
      `| **Odpowiedzi ze źródłem** | **${fmt(answers.summary.zeZrodlem)}** |`,
      `| **Poprawne odmowy** (pytania spoza zakresu) | **${fmt(answers.summary.odmowy)}** |`,
      `| Ostrzeżenia o przepisie spoza źródeł | ${answers.summary.ostrzezeniaCytowan} |`,
      `| Średni czas odpowiedzi | ${(answers.summary.sredniCzasMs / 1000).toFixed(1)} s |`,
      `| Model | ${answers.model} |`,
    );
  }
  lines.push(
    `| Wyszukiwanie: właściwy fragment w top 5 | ${fmt(retrieval.trafnoscZrodla)} |`,
    `| Wyszukiwanie: odmowa bez pytania modelu (spoza zakresu) | ${fmt(retrieval.odmowy)} |`,
    `| Wyszukiwanie: średnia pozycja właściwego fragmentu | ${retrieval.sredniaPozycja ?? "–"} |`,
  );
  if (!answers) lines.push(``, `Zmierzono tylko poziom wyszukiwania (bez modelu). Pełny pomiar: model w \`.env\` (\`LLM_BASE_URL\`, \`LLM_MODEL\`) i \`npm run eval\`.`);

  const fails = [
    ...(answers?.results.filter((r) => !r.ok).map((r) => `| ${r.id} | odpowiedź | ${r.pytanie} | ${r.powod ?? ""} |`) ?? []),
    ...opts.retrievalResults.filter((r) => !r.ok).map((r) => `| ${r.id} | wyszukiwanie | ${r.pytanie} | ${r.powod ?? ""} |`),
  ];
  if (fails.length) {
    lines.push(``, `## Błędy do poprawy`, ``, `| ID | Poziom | Pytanie | Powód |`, `|---|---|---|---|`, ...fails);
  }
  return `${lines.join("\n")}\n`;
}
