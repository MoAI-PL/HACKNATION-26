// Podgląd importu opisu stanowiska pracy: co system odczyta z pliku .docx i jaki arkusz wybierze.
//
// Uruchomienie:
//   npm run osp -- materialy/OSP/OSP_radca_DSI_WWI.docx
//   npm run osp -- materialy/OSP/*.docx --json     – pełny wynik w JSON (np. do danych demo)

import { existsSync, readFileSync } from "node:fs";
import { OspImportError, parseOsp } from "../src/lib/import/osp";

const args = process.argv.slice(2);
const json = args.includes("--json");
const files = args.filter((a) => !a.startsWith("--"));
if (files.length === 0) {
  console.error("Podaj plik OSP, np.: npm run osp -- materialy/OSP/OSP_radca_DSI_WWI.docx");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  if (!existsSync(file)) {
    console.error(`Nie znaleziono pliku „${file}”.`);
    failed++;
    continue;
  }
  try {
    const r = parseOsp(readFileSync(file));
    if (json) {
      console.log(JSON.stringify({ file, ...r, rawText: undefined }, null, 2));
      continue;
    }
    const p = r.position;
    console.log(`\n${file}`);
    console.log(`  Stanowisko:   ${p.title}${p.symbol ? ` (${p.symbol})` : ""}`);
    if (p.orgUnit) console.log(`  Komórka:      ${p.orgUnit}`);
    console.log(`  Arkusz:       ${r.sheet.sheet} – ${r.sheet.explanation.text} (${r.sheet.explanation.legalBasis})`);
    console.log(`  Zadania:      ${p.dominantTasks.length} dominujące, ${p.otherTasks.length} pozostałe`);
    console.log(`  Upoważnienia: ${p.authorizations ?? "brak"}`);
    console.log(`  Kompetencje:  ${p.requiredCompetencies.join(", ") || "–"}`);
    if (r.additionalCriteriaFromOsp.length > 0) console.log(`  Kandydaci na kryteria dodatkowe: ${r.additionalCriteriaFromOsp.join(", ")}`);
    for (const w of r.warnings) console.log(`  Uwaga: ${w}`);
  } catch (e) {
    failed++;
    console.error(`\n${file}\n${e instanceof OspImportError ? e.message : String(e)}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
