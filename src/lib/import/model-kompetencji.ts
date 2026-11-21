// Import modelu kompetencji (Z05): materialy/Model_kompetencji.xlsx → CompetencyModel.
//
// Układ pliku (sekcja 8.4 master promptu, sprawdzony na pliku od MC):
//  - arkusz „Model kompetencji”: tytuł, wiersz „14 kompetencji • 49 wskaźników • 5 poziomów”, wskazówki,
//    a niżej tabela „Lp. | Kompetencja | Liczba wskaźników”;
//  - jeden arkusz na kompetencję (nazwy skrócone przez Excela do 31 znaków – COMPETENCY_XLSX_SHEETS):
//    wiersz 1 – nazwa kompetencji, wiersz 3 – nagłówki, od wiersza 4 – wskaźnik i 5 opisów zachowań.
//
// Import jest ścisły: każda niezgodność z tym układem to czytelny błąd z adresem komórki,
// a nie cicho pominięty wiersz. Dzięki temu panel HR (Z19) może bezpiecznie przyjąć nową wersję pliku.

import { COMPETENCY_NAMES, COMPETENCY_XLSX_SHEETS, LEVEL_LABELS, indicatorId } from "@/lib/domain/slownik";
import {
  COMPETENCY_CODES,
  LEVELS,
  type BehaviorLevel,
  type CompetencyCode,
  type CompetencyDefinition,
  type CompetencyModel,
  type IndicatorDefinition,
  type IsoDate,
} from "@/lib/domain/types";
import { competencyModelSchema } from "@/lib/domain/model-kompetencji";
import { XlsxReadError, cellAddress, readXlsx, type XlsxSheet } from "./xlsx";

export const SUMMARY_SHEET = "Model kompetencji";
export const HEADER_ROW = 3;
export const FIRST_INDICATOR_ROW = 4;
const BEHAVIOR_LEVELS: readonly BehaviorLevel[] = [1, 2, 3, 4, 5];
/** Nagłówki kolumn arkusza kompetencji (A–F): wskaźnik + 5 poziomów. */
export const EXPECTED_HEADERS = ["Wskaźnik behawioralny", ...LEVELS.map((l) => LEVEL_LABELS[l])];

export class CompetencyModelImportError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Nie udało się zaimportować modelu kompetencji. Problemy (${problems.length}):\n` + problems.map((p) => `  – ${p}`).join("\n"));
    this.name = "CompetencyModelImportError";
  }
}

export interface CompetencyModelImportResult {
  model: CompetencyModel;
  /** Uwagi, które nie blokują importu (np. dodatkowy, nieznany arkusz w pliku). */
  warnings: string[];
}

export interface ImportOptions {
  /** Nazwa pliku źródłowego zapisywana w modelu, np. "materialy/Model_kompetencji.xlsx". */
  source: string;
  /** Data importu "RRRR-MM-DD"; domyślnie dzisiejsza. */
  importedAt?: IsoDate;
}

/** Ujednolica tekst z komórki: łamania linii i twarde spacje → spacja, bez miękkich łączników, podwójnych spacji i spacji na końcach. */
export function normalizeText(value: string): string {
  return value
    .replace(/­/g, "")
    .replace(/[\s   ]+/g, " ")
    .trim();
}

/** Porównanie nazw niezależne od wielkości liter i białych znaków („ORGANIZACJA PRACY i …” = „Organizacja pracy i …”). */
function sameName(a: string, b: string): boolean {
  return normalizeText(a).toLocaleLowerCase("pl") === normalizeText(b).toLocaleLowerCase("pl");
}

function addr(sheet: string, ref: string): string {
  return `„${sheet}”!${ref}`;
}

const cell = (ws: XlsxSheet, row: number, col: number) => normalizeText(ws.text(row, col));

interface SummaryData {
  rows: { code: CompetencyCode; declaredCount: number }[];
  guidance: string[];
  declared?: { competencies: number; indicators: number; levels: number };
}

function readSummary(ws: XlsxSheet, problems: string[]): SummaryData {
  const guidance: string[] = [];
  let declared: SummaryData["declared"];
  let headerRow: number | undefined;

  for (let r = 2; r <= ws.maxRow; r++) {
    // wiersz 1 to tytuł arkusza
    const a = cell(ws, r, 1);
    if (sameName(a, "Lp.")) {
      headerRow = r;
      break;
    }
    if (!a) continue;
    const m = a.match(/^(\d+)\s+kompetencji\D+(\d+)\s+wskaźnik\D+(\d+)\s+poziom/i);
    if (m) declared = { competencies: Number(m[1]), indicators: Number(m[2]), levels: Number(m[3]) };
    else guidance.push(a);
  }

  if (headerRow === undefined) {
    problems.push(`Arkusz „${SUMMARY_SHEET}”: brak tabeli z nagłówkiem „Lp. | Kompetencja | Liczba wskaźników” w kolumnie A.`);
    return { rows: [], guidance, declared };
  }
  if (guidance.length === 0) {
    problems.push(`${addr(SUMMARY_SHEET, `A2:A${headerRow - 1}`)}: brak wskazówek do oceny nad tabelą kompetencji.`);
  }

  const rows: SummaryData["rows"] = [];
  for (let r = headerRow + 1; r <= ws.maxRow; r++) {
    const name = cell(ws, r, 2);
    const countText = cell(ws, r, 3);
    if (!name && !countText) break;
    const code = COMPETENCY_CODES.find((c) => sameName(COMPETENCY_NAMES[c], name));
    if (!code) {
      problems.push(`${addr(SUMMARY_SHEET, `B${r}`)}: nieznana kompetencja „${name}” (spoza załącznika nr 1 do rozporządzenia).`);
      continue;
    }
    const declaredCount = Number(countText);
    if (!Number.isInteger(declaredCount) || declaredCount < 1) {
      problems.push(`${addr(SUMMARY_SHEET, `C${r}`)}: liczba wskaźników „${countText}” nie jest dodatnią liczbą całkowitą.`);
      continue;
    }
    if (rows.some((x) => x.code === code)) {
      problems.push(`${addr(SUMMARY_SHEET, `B${r}`)}: kompetencja „${name}” występuje w spisie dwa razy.`);
      continue;
    }
    rows.push({ code, declaredCount });
  }
  return { rows, guidance, declared };
}

function readCompetencySheet(ws: XlsxSheet, code: CompetencyCode, problems: string[]): IndicatorDefinition[] {
  const title = cell(ws, 1, 1);
  if (!sameName(title, COMPETENCY_NAMES[code])) {
    problems.push(`${addr(ws.name, "A1")}: tytuł „${title}” nie odpowiada kompetencji „${COMPETENCY_NAMES[code]}”.`);
  }

  EXPECTED_HEADERS.forEach((expected, i) => {
    const actual = cell(ws, HEADER_ROW, i + 1);
    if (!sameName(actual, expected)) {
      problems.push(`${addr(ws.name, cellAddress(HEADER_ROW, i + 1))}: oczekiwano nagłówka „${expected}”, jest „${actual || "(puste)"}”.`);
    }
  });
  const extra = cell(ws, HEADER_ROW, EXPECTED_HEADERS.length + 1);
  if (extra) {
    problems.push(`${addr(ws.name, cellAddress(HEADER_ROW, EXPECTED_HEADERS.length + 1))}: nieoczekiwana kolumna „${extra}” – model ma dokładnie 5 poziomów.`);
  }

  const indicators: IndicatorDefinition[] = [];
  let r = FIRST_INDICATOR_ROW;
  for (; r <= ws.maxRow; r++) {
    const [name, ...descriptions] = [1, 2, 3, 4, 5, 6].map((c) => cell(ws, r, c));
    if (!name && descriptions.every((d) => !d)) break; // koniec tabeli wskaźników

    if (!name) {
      problems.push(`${addr(ws.name, `A${r}`)}: brak nazwy wskaźnika, a w wierszu są opisy zachowań.`);
      continue;
    }
    const missing = descriptions.flatMap((d, i) => (d ? [] : [LEVEL_LABELS[LEVELS[i]]]));
    if (missing.length > 0) {
      problems.push(`${addr(ws.name, `A${r}`)}: wskaźnik „${name}” nie ma opisu zachowania dla poziomu: ${missing.join(", ")}.`);
      continue;
    }
    if (indicators.some((ind) => sameName(ind.name, name))) {
      problems.push(`${addr(ws.name, `A${r}`)}: wskaźnik „${name}” występuje w arkuszu dwa razy.`);
      continue;
    }
    const levels = Object.fromEntries(BEHAVIOR_LEVELS.map((lvl) => [lvl, descriptions[lvl - 1]])) as Record<BehaviorLevel, string>;
    indicators.push({ id: indicatorId(code, indicators.length + 1), competency: code, name, levels });
  }

  // Treść poniżej pustego wiersza to najpewniej wskaźnik oddzielony przypadkiem – nie pomijamy go po cichu.
  for (let rest = r + 1; rest <= ws.maxRow; rest++) {
    if ([1, 2, 3, 4, 5, 6].some((c) => cell(ws, rest, c))) {
      problems.push(`${addr(ws.name, `A${rest}`)}: treść poniżej pustego wiersza ${r} – usuń pusty wiersz albo tę treść.`);
      break;
    }
  }

  if (indicators.length === 0 && !problems.some((p) => p.startsWith(addr(ws.name, `A${FIRST_INDICATOR_ROW}`)))) {
    problems.push(`${addr(ws.name, `A${FIRST_INDICATOR_ROW}`)}: arkusz nie zawiera żadnego wskaźnika.`);
  }
  return indicators;
}

/** Parsuje skoroszyt z modelem kompetencji. Rzuca CompetencyModelImportError z listą wszystkich znalezionych problemów. */
export function parseCompetencyModel(data: Uint8Array, options: ImportOptions): CompetencyModelImportResult {
  let wb;
  try {
    wb = readXlsx(data);
  } catch (e) {
    throw new CompetencyModelImportError([e instanceof XlsxReadError ? e.message : `Nie można odczytać pliku: ${(e as Error).message}`]);
  }

  const problems: string[] = [];
  const warnings: string[] = [];
  const findSheet = (name: string) => wb.sheets.find((s) => sameName(s.name, name));

  const summaryWs = findSheet(SUMMARY_SHEET);
  const summary: SummaryData = summaryWs ? readSummary(summaryWs, problems) : { rows: [], guidance: [] };
  if (!summaryWs) problems.push(`Brak arkusza „${SUMMARY_SHEET}” ze spisem kompetencji i wskazówkami.`);

  const missingInSummary = COMPETENCY_CODES.filter((c) => !summary.rows.some((r) => r.code === c));
  if (summaryWs && missingInSummary.length > 0) {
    problems.push(`Arkusz „${SUMMARY_SHEET}”: w spisie brakuje kompetencji: ${missingInSummary.map((c) => COMPETENCY_NAMES[c]).join(", ")}.`);
  }

  // Kolejność kompetencji jak w spisie (Lp.), a brakujące w spisie – jak w słowniku.
  const competencies: CompetencyDefinition[] = [];
  for (const code of [...summary.rows.map((r) => r.code), ...missingInSummary]) {
    const sheetName = COMPETENCY_XLSX_SHEETS[code];
    const ws = findSheet(sheetName);
    if (!ws) {
      problems.push(`Brak arkusza „${sheetName}” z opisami zachowań dla kompetencji „${COMPETENCY_NAMES[code]}”.`);
      continue;
    }
    const indicators = readCompetencySheet(ws, code, problems);
    const declared = summary.rows.find((r) => r.code === code)?.declaredCount;
    if (declared !== undefined && indicators.length > 0 && declared !== indicators.length) {
      problems.push(`Kompetencja „${COMPETENCY_NAMES[code]}”: w spisie podano ${declared} wskaźników, a arkusz „${ws.name}” zawiera ${indicators.length}.`);
    }
    competencies.push({ code, name: COMPETENCY_NAMES[code], indicators });
  }

  const known = [SUMMARY_SHEET, ...Object.values(COMPETENCY_XLSX_SHEETS)];
  for (const ws of wb.sheets) {
    if (!known.some((k) => sameName(k, ws.name))) warnings.push(`Pominięto nieznany arkusz „${ws.name}”.`);
  }

  if (summary.declared) {
    const total = competencies.reduce((n, c) => n + c.indicators.length, 0);
    const d = summary.declared;
    if (d.competencies !== competencies.length || d.indicators !== total || d.levels !== LEVELS.length) {
      problems.push(
        `Arkusz „${SUMMARY_SHEET}” deklaruje ${d.competencies} kompetencji, ${d.indicators} wskaźników i ${d.levels} poziomów, ` +
          `a plik zawiera ${competencies.length} kompetencji, ${total} wskaźników i ${LEVELS.length} poziomów.`,
      );
    }
  }

  if (problems.length > 0) throw new CompetencyModelImportError(problems);

  const model: CompetencyModel = {
    source: options.source,
    importedAt: options.importedAt ?? new Date().toISOString().slice(0, 10),
    guidance: summary.guidance,
    competencies,
  };

  // Ostatnia linia obrony: wynik musi spełniać ten sam schemat, którym aplikacja czyta data/model-kompetencji.json.
  const checked = competencyModelSchema.safeParse(model);
  if (!checked.success) {
    throw new CompetencyModelImportError(checked.error.issues.map((i) => `${i.path.join(".") || "model"}: ${i.message}`));
  }
  return { model, warnings };
}
