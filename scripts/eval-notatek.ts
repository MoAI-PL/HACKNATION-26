// Szybka notatka (Z41): czy 5 przykładowych zdań trafia w sensowny wskaźnik – `npm run eval:notatki`.
// Wymaga modelu w .env (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY). Wynik: eval/notatki-wynik.md.
import { readFileSync, writeFileSync } from "node:fs";
import { proposeQuickNote, type NotePerson } from "../src/lib/ai/funkcje/szybka-notatka";
import { getLLM } from "../src/lib/ai/llm";
import { competencyModel } from "../src/lib/domain/model-kompetencji-dane";

try {
  (process as NodeJS.Process & { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(".env");
} catch {
  // brak .env = brak modelu
}

interface Sample {
  id: string;
  tekst: string;
  osoba: string;
  kompetencje: string[];
}
const set = JSON.parse(readFileSync("eval/notatki.json", "utf8")) as { zespol: NotePerson[]; notatki: Sample[] };
const delayMs = Number(process.env.EVAL_DELAY_MS ?? 1500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const llm = getLLM();
  if (!llm) {
    console.error("Brak modelu w .env (LLM_BASE_URL, LLM_MODEL) – ten test wymaga modelu.");
    process.exit(1);
  }
  const rows: string[] = [];
  let ok = 0;
  let aiAnswers = 0;
  for (const [i, s] of set.notatki.entries()) {
    if (i > 0) await sleep(delayMs);
    let r = await proposeQuickNote(s.tekst, set.zespol, { llm });
    for (let retry = 1; retry <= 3 && r.mode === "BEZ_AI" && /HTTP 5\d\d|limit|nie odpowiedział/i.test(r.notice ?? ""); retry++) {
      console.log(`     … ${s.id}: model chwilowo niedostępny, ponawiam (${retry}/3)`);
      await sleep(10_000 * retry);
      r = await proposeQuickNote(s.tekst, set.zespol, { llm });
    }
    if (r.mode === "AI") aiAnswers++;
    const indicator = r.indicatorId ? competencyModel.getIndicator(r.indicatorId) : undefined;
    const good = r.mode === "AI" && r.employeeId === s.osoba && !!r.competency && s.kompetencje.includes(r.competency);
    if (good) ok++;
    const where = indicator ? `${competencyModel.getCompetency(indicator.competency).name}: ${indicator.name}` : "—";
    console.log(`  ${good ? "✓" : "✗"} ${s.id}  ${s.tekst}\n       → ${where}${r.behaviorLevel ? ` (poziom ${r.behaviorLevel})` : ""}  ${(r.durationMs / 1000).toFixed(1)} s${r.mode === "BEZ_AI" ? `  [bez AI: ${r.notice}]` : ""}`);
    rows.push(`| ${s.id} | ${good ? "✓" : "✗"} | ${s.tekst} | ${where} | ${(r.durationMs / 1000).toFixed(1)} s |`);
  }
  if (aiAnswers === 0) {
    console.error("\nModel nie odpowiedział na żadną notatkę – sprawdź .env. Wyniku nie zapisano.");
    process.exit(1);
  }
  const md = [
    `# Szybka notatka – przypięcie do wskaźnika`,
    ``,
    `Data: ${new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })} · model: ${llm.model} · trafne: **${ok}/${set.notatki.length}** (właściwa osoba i wskaźnik z akceptowanej kompetencji)`,
    ``,
    `| ID | Wynik | Notatka | Wskaźnik zaproponowany przez AI | Czas |`,
    `|---|---|---|---|---|`,
    ...rows,
    ``,
  ].join("\n");
  writeFileSync("eval/notatki-wynik.md", md);
  console.log(`\nTrafne: ${ok}/${set.notatki.length}. Zapisano eval/notatki-wynik.md.`);
}

main().catch((e) => {
  console.error("Test notatek nie powiódł się:", e);
  process.exit(1);
});
