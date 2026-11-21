// Zestaw testowy asystenta formalnego (Z25): `npm run eval`.
//
//   npm run eval              – wyszukiwanie + odpowiedzi modelu (gdy model jest w .env)
//   npm run eval -- --bez-ai  – tylko poziom wyszukiwania (bez modelu, kilka sekund)
//   npm run eval -- Q03 P05   – wybrane pytania
//
// Wynik: tabela w konsoli, eval/wynik.md (do docs/AI.md i na slajd) oraz eval/wynik.json (szczegóły).
// Przerwa między pytaniami do modelu (darmowe limity API): EVAL_DELAY_MS, domyślnie 1500 ms.

import { readFileSync, writeFileSync } from "node:fs";
import { answerFormalQuestion } from "../src/lib/ai/funkcje/asystent-formalny";
import { getLLM } from "../src/lib/ai/llm";
import { fragmentCount, searchKnowledge } from "../src/lib/ai/rag/search";
import {
  evalSetSchema,
  markdownReport,
  scoreAnswerInScope,
  scoreAnswerOutOfScope,
  scoreRetrievalInScope,
  scoreRetrievalOutOfScope,
  summarizeAnswers,
  summarizeRetrieval,
  type AnswerInput,
  type AnswerResult,
  type RetrievalResult,
} from "../src/lib/ai/eval/ocena";

// .env jak w aplikacji (Next.js wczyta go sam, skrypt – tutaj).
try {
  (process as NodeJS.Process & { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(".env");
} catch {
  // brak .env = tryb bez modelu
}

const args = process.argv.slice(2);
const withoutAi = args.includes("--bez-ai");
const only = new Set(args.filter((a) => !a.startsWith("--")));
const delayMs = Number(process.env.EVAL_DELAY_MS ?? 1500);

const set = evalSetSchema.parse(JSON.parse(readFileSync("eval/pytania.json", "utf8")));
const inScope = set.pytania.filter((q) => only.size === 0 || only.has(q.id));
const outOfScope = set.pozaZakresem.filter((q) => only.size === 0 || only.has(q.id));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mark = (ok: boolean) => (ok ? "✓" : "✗");
const short = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function main() {
  // Poziom 1: wyszukiwanie
  const retrieval: RetrievalResult[] = [];
  for (const q of inScope) {
    const r = searchKnowledge(q.pytanie, { limit: 5 });
    retrieval.push(scoreRetrievalInScope(q, { sufficient: r.sufficient, hitIds: r.hits.map((h) => h.fragment.id) }));
  }
  for (const q of outOfScope) {
    const r = searchKnowledge(q.pytanie, { limit: 5 });
    retrieval.push(scoreRetrievalOutOfScope(q, { sufficient: r.sufficient, hitIds: r.hits.map((h) => h.fragment.id) }));
  }

  console.log("\nPoziom 1 – wyszukiwanie w bazie wiedzy");
  for (const r of retrieval) {
    const pos = r.inScope ? (r.rank ? `#${r.rank}` : "–") : r.sufficient ? "przepuszczone" : "odmowa";
    console.log(`  ${mark(r.ok)} ${r.id}  ${short(r.pytanie).padEnd(70)}  ${pos}${r.powod ? `  (${r.powod})` : ""}`);
  }
  const retrievalSummary = summarizeRetrieval(retrieval);

  // Poziom 2: odpowiedzi modelu
  const llm = withoutAi ? null : getLLM();
  let answers: { model: string; summary: ReturnType<typeof summarizeAnswers>; results: AnswerResult[] } | undefined;

  if (!llm) {
    console.log(
      withoutAi
        ? "\nPominięto odpowiedzi modelu (--bez-ai)."
        : "\nModel nie jest skonfigurowany (LLM_BASE_URL, LLM_MODEL w .env) – zmierzono tylko wyszukiwanie.",
    );
  } else {
    console.log(`\nPoziom 2 – odpowiedzi asystenta (model: ${llm.model})`);
    const results: AnswerResult[] = [];
    const all = [...inScope.map((q) => ({ q, inScope: true as const })), ...outOfScope.map((q) => ({ q, inScope: false as const }))];
    for (const [i, item] of all.entries()) {
      if (i > 0 && delayMs > 0) await sleep(delayMs);
      const a = await answerFormalQuestion(item.q.pytanie, { llm });
      const input: AnswerInput = {
        answer: a.answer,
        refused: a.refused,
        mode: a.mode,
        sourceIds: a.sources.map((s) => s.id),
        notice: a.notice,
        durationMs: a.durationMs,
      };
      const r = item.inScope
        ? scoreAnswerInScope(item.q as (typeof inScope)[number], input)
        : scoreAnswerOutOfScope(item.q, input);
      results.push(r);
      console.log(`  ${mark(r.ok)} ${r.id}  ${short(r.pytanie).padEnd(70)}  ${(r.durationMs / 1000).toFixed(1)} s${r.powod ? `  (${r.powod})` : ""}`);
    }
    answers = { model: llm.model, summary: summarizeAnswers(results), results };
  }

  const date = new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
  const md = markdownReport({ date, fragments: fragmentCount(), retrieval: retrievalSummary, retrievalResults: retrieval, answers });
  console.log(`\n${md}`);

  if (only.size === 0) {
    writeFileSync("eval/wynik.md", md);
    writeFileSync(
      "eval/wynik.json",
      `${JSON.stringify({ data: date, wyszukiwanie: { podsumowanie: retrievalSummary, wyniki: retrieval }, odpowiedzi: answers ?? null }, null, 2)}\n`,
    );
    console.log("Zapisano eval/wynik.md i eval/wynik.json.");
  }
}

main().catch((e) => {
  console.error("Zestaw testowy nie powiódł się:", e);
  process.exit(1);
});
