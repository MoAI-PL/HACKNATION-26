// Import modelu kompetencji: materialy/Model_kompetencji.xlsx → data/model-kompetencji.json.
//
// Uruchomienie:
//   npm run model                      – import z domyślnego pliku
//   npm run model -- inny-plik.xlsx    – import z innego pliku (np. nowa wersja od MC)
//   npm run model -- --check           – tylko sprawdza, czy data/model-kompetencji.json jest aktualny (kod wyjścia 1, gdy nie)
//
// Data importu zmienia się tylko wtedy, gdy zmieniła się treść modelu – ponowny import tego samego pliku nie robi zmian w git.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { CompetencyModelImportError, parseCompetencyModel } from "../src/lib/import/model-kompetencji";
import type { CompetencyModel } from "../src/lib/domain/types";

const DEFAULT_SOURCE = "materialy/Model_kompetencji.xlsx";
const OUT = "data/model-kompetencji.json";

/** Treść modelu bez daty importu – do porównania, czy coś się zmieniło. */
function withoutDate(m: CompetencyModel): Omit<CompetencyModel, "importedAt"> {
  return { source: m.source, guidance: m.guidance, competencies: m.competencies };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const sourcePath = args.find((a) => !a.startsWith("--")) ?? DEFAULT_SOURCE;
  if (!existsSync(sourcePath)) {
    console.error(`Nie znaleziono pliku „${sourcePath}”.`);
    return 1;
  }
  const source = relative(process.cwd(), sourcePath).split("\\").join("/");

  const { model, warnings } = parseCompetencyModel(readFileSync(sourcePath), { source });
  for (const w of warnings) console.warn(`Uwaga: ${w}`);

  const previous: CompetencyModel | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const unchanged = previous !== null && JSON.stringify(withoutDate(previous)) === JSON.stringify(withoutDate(model));

  if (check) {
    if (unchanged) {
      console.log(`${OUT} jest aktualny względem ${source}.`);
      return 0;
    }
    console.error(`${OUT} nie odpowiada plikowi ${source}. Uruchom: npm run model`);
    return 1;
  }

  if (unchanged) model.importedAt = previous.importedAt;
  writeFileSync(OUT, JSON.stringify(model, null, 2) + "\n", "utf8");

  const total = model.competencies.reduce((n, c) => n + c.indicators.length, 0);
  console.log(`Zaimportowano ${source} → ${OUT}${unchanged ? " (bez zmian w treści)" : ""}`);
  console.log(`  ${model.competencies.length} kompetencji, ${total} wskaźników, 5 poziomów, ${model.guidance.length} wskazówki`);
  for (const c of model.competencies) console.log(`  ${String(c.indicators.length).padStart(2)}  ${c.code.padEnd(13)} ${c.name}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    if (e instanceof CompetencyModelImportError) console.error(e.message);
    else console.error(e);
    process.exit(1);
  },
);
