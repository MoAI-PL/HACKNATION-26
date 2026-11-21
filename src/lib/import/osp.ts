// Import opisu stanowiska pracy (OSP) z pliku .docx (Z06) i automatyczny wybór arkusza B/C.
//
// Układ formularza (wzór OSP stanowiska niebędącego wyższym stanowiskiem w służbie cywilnej, pliki MC w materialy/OSP/):
//  - część I: tabela „etykieta | wartość” (nazwa urzędu, komórki, stanowiska, symbol, stanowiska nadzorujące);
//  - część II: sekcje z nagłówkami („CEL ISTNIENIA STANOWISKA PRACY”, „LICZBA PODLEGŁYCH PRACOWNIKÓW”,
//    „ZADANIA DOMINUJĄCE”, „POZOSTAŁE ZADANIA”, „UPOWAŻNIENIA I PEŁNOMOCNICTWA”…), treść w kolejnym wierszu;
//  - pola wyboru ☒/☐ – stan odczytuje docx.ts.
// Sekcje szukamy po nagłówkach, a nie po numerach wierszy, bo urzędy dodają wiersze (np. więcej zadań).
// Błąd importu tylko wtedy, gdy bez danej informacji nie da się pracować (nazwa stanowiska, liczba podległych);
// brak pozostałych sekcji to uwaga – przełożony uzupełni je w kreatorze (Z12).

import { COMPETENCY_NAMES, SUBORDINATE_LABELS } from "@/lib/domain/slownik";
import { COMPETENCY_CODES, SUBORDINATE_OPTIONS, type CompetencyCode, type PositionDescription, type SheetSelection, type SubordinateOption } from "@/lib/domain/types";
import { selectSheet } from "@/lib/rules/arkusz";
import { DocxReadError, readDocx, type DocxCell, type DocxParagraph } from "./docx";
import { normalizeText, sameText } from "./tekst";

export class OspImportError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Nie udało się odczytać opisu stanowiska pracy:\n` + problems.map((p) => `  – ${p}`).join("\n"));
    this.name = "OspImportError";
  }
}

export interface OspImportResult {
  position: PositionDescription;
  /** Automatyczny wybór arkusza z wyjaśnieniem (§ 3). */
  sheet: SheetSelection;
  /**
   * Kompetencje miękkie z OSP, które nie są kryteriami obowiązkowymi wybranego arkusza – kandydaci na kryteria dodatkowe
   * (podpowiedź bez AI dla Z12/Z23; wybór i limit 3 kryteriów sprawdza silnik kryteriów).
   */
  additionalCriteriaFromOsp: CompetencyCode[];
  /** Pełny tekst dokumentu (Position.rawText, kontekst dla AI w Z23). */
  rawText: string;
  warnings: string[];
}

/** Teksty zastępcze pustych pól Worda – na wypadek kontrolek bez znacznika „showingPlcHdr”. */
const PLACEHOLDERS = [/^wybierz element\.?$/i, /^kliknij (lub naciśnij )?tutaj,? aby wprowadzić tekst\.?$/i];

const HEADINGS = {
  title: "NAZWA STANOWISKA PRACY",
  office: "NAZWA URZĘDU",
  orgUnit: "NAZWA KOMÓRKI ORGANIZACYJNEJ URZĘDU",
  symbol: "SYMBOL STANOWISKA PRACY",
  supervisor: "STANOWISKO PRACY BEZPOŚREDNIO NADZORUJĄCE",
  purpose: "CEL ISTNIENIA STANOWISKA PRACY",
  subordinates: "LICZBA PODLEGŁYCH PRACOWNIKÓW",
  dominant: "ZADANIA DOMINUJĄCE",
  other: "POZOSTAŁE ZADANIA",
  authorizations: "UPOWAŻNIENIA I PEŁNOMOCNICTWA",
  complexity: "ZŁOŻONOŚĆ I KREATYWNOŚĆ",
  independence: "NIEZBĘDNA SAMODZIELNOŚĆ I INICJATYWA",
  knowledge: "Inne kompetencje, wiedza lub umiejętności",
} as const;

/** Nagłówki, na których kończy się lista zadań. */
const AFTER_TASKS = [HEADINGS.authorizations, HEADINGS.complexity, HEADINGS.independence, "HORYZONT CZASOWY PLANOWANIA", "CZĘŚĆ III"];

type Row = DocxCell[];

const clean = (s: string) => {
  const t = normalizeText(s);
  return PLACEHOLDERS.some((p) => p.test(t)) ? "" : t;
};
const rowText = (row: Row) => clean(row.map((c) => c.text).join(" "));
const startsWithText = (text: string, heading: string) => clean(text).toLocaleLowerCase("pl").startsWith(heading.toLocaleLowerCase("pl"));
const cellParagraphs = (cell: DocxCell | undefined): DocxParagraph[] =>
  (cell?.paragraphs ?? []).map((p) => ({ ...p, text: clean(p.text) })).filter((p) => p.text !== "" || p.checked !== null);

/** Tekst komórek wiersza połączony jednym ciągiem – akapity spacją. */
const joinCell = (cell: DocxCell | undefined) => cellParagraphs(cell).map((p) => p.text).filter(Boolean).join(" ");

class OspReader {
  constructor(private readonly rows: Row[]) {}

  /** Indeks wiersza, który zaczyna się nagłówkiem (szukamy od `from`). */
  heading(heading: string, from = 0): number {
    for (let i = from; i < this.rows.length; i++) if (startsWithText(rowText(this.rows[i]), heading)) return i;
    return -1;
  }

  /** Wartość z części I: ostatnia niepusta komórka po komórce z etykietą. */
  labelValue(label: string): { value: string; row: number } | undefined {
    for (let i = 0; i < this.rows.length; i++) {
      const cells = this.rows[i];
      const at = cells.findIndex((c) => sameText(clean(c.text), label));
      if (at < 0) continue;
      const value = cells.slice(at + 1).map((c) => joinCell(c)).filter(Boolean).pop();
      return { value: value ?? "", row: i };
    }
    return undefined;
  }

  row(i: number): Row | undefined {
    return this.rows[i];
  }
}

const TASK_PREFIX = /^zadanie\s*(nr\s*)?\d+\s*[:.)\-–]?\s*/i;

function readTasks(reader: OspReader, start: number, stopAt: string[]): string[] {
  const tasks: string[] = [];
  for (let i = start; ; i++) {
    const row = reader.row(i);
    if (!row) break;
    const text = rowText(row);
    if (stopAt.some((h) => startsWithText(text, h))) break;
    if (!text) continue;
    tasks.push(text.replace(TASK_PREFIX, "").trim());
  }
  return tasks.filter(Boolean);
}

/** „- zasad funkcjonowania ¶ administracji publicznej” → jedna pozycja; akapity bez myślnika dopisujemy do poprzedniej. */
function splitList(paragraphs: string[]): string[] {
  const bullet = /^\s*[-–•]\s*/;
  const lines = paragraphs.flatMap((p) => p.split(/;\s*(?=[-–•]\s)/)).map((p) => p.trim()).filter(Boolean);
  const hasBullets = lines.some((l) => bullet.test(l));
  const items: string[] = [];
  for (const line of lines) {
    if (hasBullets && !bullet.test(line) && items.length > 0) items[items.length - 1] += ` ${line}`;
    else items.push(line.replace(bullet, ""));
  }
  return items.map((i) => normalizeText(i).replace(/[,;.]+$/, "")).filter(Boolean);
}

/** Kody kompetencji wymienionych w tekście, w kolejności wystąpienia. */
function competenciesIn(text: string): CompetencyCode[] {
  const lower = normalizeText(text).toLocaleLowerCase("pl");
  return COMPETENCY_CODES.map((code) => ({ code, at: lower.indexOf(COMPETENCY_NAMES[code].toLocaleLowerCase("pl")) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.code);
}

function describeSection(reader: OspReader, heading: string): string | undefined {
  // Układ: nagłówek, wiersz „OPIS | PRZYKŁADY”, wiersz z treścią.
  const at = reader.heading(heading);
  if (at < 0) return undefined;
  let i = at + 1;
  if (startsWithText(rowText(reader.row(i) ?? []), "OPIS")) i++;
  const row = reader.row(i);
  if (!row) return undefined;
  const [opis, przyklady] = row.map(joinCell);
  const text = [opis, przyklady ? `Przykłady: ${przyklady}` : ""].filter(Boolean).join(" ");
  return text || undefined;
}

export function parseOsp(data: Uint8Array): OspImportResult {
  let doc;
  try {
    doc = readDocx(data);
  } catch (e) {
    throw new OspImportError([e instanceof DocxReadError ? e.message : `Nie można odczytać pliku: ${(e as Error).message}`]);
  }

  // Akapity poza tabelami traktujemy jak wiersze z jedną komórką – nagłówki sekcji bywają w obu postaciach.
  const rows: Row[] = doc.blocks.map((b) => (b.kind === "row" ? b.cells : [{ paragraphs: [b.paragraph], text: b.paragraph.text }]));
  const reader = new OspReader(rows);
  const problems: string[] = [];
  const warnings: string[] = [];

  // Część I
  const title = reader.labelValue(HEADINGS.title)?.value ?? "";
  if (!title) problems.push(`Brak nazwy stanowiska (pole „${HEADINGS.title}” w części I).`);
  const office = reader.labelValue(HEADINGS.office)?.value || undefined;
  const symbol = reader.labelValue(HEADINGS.symbol)?.value || undefined;
  const supervisor = reader.labelValue(HEADINGS.supervisor)?.value || undefined;

  // Komórka: wiersz z etykietą i kolejne wiersze bez etykiety (np. wydział pod departamentem).
  let orgUnit: string | undefined;
  const unit = reader.labelValue(HEADINGS.orgUnit);
  if (unit) {
    const parts = [unit.value];
    for (let i = unit.row + 1; ; i++) {
      const row = reader.row(i);
      if (!row || row.length < 2) break;
      const texts = row.map(joinCell);
      if (texts.slice(0, -1).some(Boolean) || !texts[texts.length - 1]) break;
      parts.push(texts[texts.length - 1]);
    }
    orgUnit = parts.filter(Boolean).join(", ") || undefined;
  }

  // Cel istnienia stanowiska
  const purposeAt = reader.heading(HEADINGS.purpose);
  const purpose = purposeAt >= 0 ? (reader.row(purposeAt + 1) ?? []).map(joinCell).filter(Boolean).join(" ") : "";
  if (!purpose) warnings.push(`Nie znaleziono celu istnienia stanowiska (sekcja „${HEADINGS.purpose}”).`);

  // Liczba podległych pracowników → arkusz
  let subordinates: SubordinateOption | undefined;
  const subAt = reader.heading(HEADINGS.subordinates);
  if (subAt < 0) {
    problems.push(`Brak sekcji „${HEADINGS.subordinates}” – bez niej nie da się wybrać arkusza oceny. Wybierz arkusz ręcznie.`);
  } else {
    const options = (reader.row(subAt + 1) ?? []).flatMap(cellParagraphs).filter((p) => p.checked !== null);
    const checked = options.filter((p) => p.checked);
    const recognized = checked.map((p) => ({ text: p.text, option: SUBORDINATE_OPTIONS.find((o) => sameText(SUBORDINATE_LABELS[o], p.text)) }));
    const unknown = recognized.filter((r) => !r.option);
    if (options.length === 0) {
      problems.push(`W sekcji „${HEADINGS.subordinates}” nie ma pól wyboru. Wybierz arkusz ręcznie.`);
    } else if (checked.length === 0) {
      problems.push(`W OSP nie zaznaczono żadnej opcji w polu „${HEADINGS.subordinates}”. Zaznacz ją w dokumencie albo wybierz arkusz ręcznie.`);
    } else if (unknown.length > 0) {
      problems.push(`Nieznana opcja w polu „${HEADINGS.subordinates}”: „${unknown[0].text}”. Wybierz arkusz ręcznie.`);
    } else if (checked.length > 1) {
      problems.push(
        `W polu „${HEADINGS.subordinates}” zaznaczono kilka opcji (${recognized.map((r) => `„${r.text}”`).join(", ")}). Popraw OSP albo wybierz arkusz ręcznie.`,
      );
    } else {
      subordinates = recognized[0].option;
    }
  }

  // Zadania
  const domAt = reader.heading(HEADINGS.dominant);
  const otherAt = reader.heading(HEADINGS.other);
  const dominantTasks = domAt >= 0 ? readTasks(reader, domAt + 1, [HEADINGS.other, ...AFTER_TASKS]) : [];
  const otherTasks = otherAt >= 0 ? readTasks(reader, otherAt + 1, AFTER_TASKS) : [];
  if (dominantTasks.length === 0) warnings.push(`Nie znaleziono zadań dominujących (sekcja „${HEADINGS.dominant}”).`);

  // Upoważnienia i pełnomocnictwa
  let authorizations: string | undefined;
  const authAt = reader.heading(HEADINGS.authorizations);
  if (authAt >= 0) {
    const paragraphs = (reader.row(authAt + 1) ?? []).flatMap(cellParagraphs);
    const items: string[] = [];
    let noneChecked = false;
    paragraphs.forEach((p, i) => {
      if (!p.checked) return;
      if (/^brak\b/i.test(p.text)) {
        noneChecked = true;
        return;
      }
      if (/^inne\b/i.test(p.text)) {
        // „inne (należy wskazać jakie)” – opis jest w kolejnych akapitach bez pola wyboru
        const desc: string[] = [];
        for (let j = i + 1; j < paragraphs.length && paragraphs[j].checked === null; j++) desc.push(paragraphs[j].text);
        items.push(desc.filter(Boolean).join(" ") || "inne");
        return;
      }
      items.push(p.text);
    });
    if (noneChecked && items.length > 0) warnings.push("W OSP zaznaczono jednocześnie „brak upoważnień i pełnomocnictw” i konkretne upoważnienia – przyjęto upoważnienia.");
    authorizations = items.length > 0 ? items.join("; ") : undefined;
  }

  // Wymagania: wiedza i kompetencje miękkie (z modelu kompetencji)
  let knowledge: string[] | undefined;
  let requiredCompetencyCodes: CompetencyCode[] = [];
  const knowledgeRow = rows.find((r) => r.length > 1 && sameText(clean(r[0].text), HEADINGS.knowledge));
  if (knowledgeRow) {
    const paragraphs = cellParagraphs(knowledgeRow[1]).map((p) => p.text).filter(Boolean);
    const softAt = paragraphs.findIndex((p) => /^kompetencje miękkie/i.test(p));
    const knowledgePart = (softAt >= 0 ? paragraphs.slice(0, softAt) : paragraphs).filter((p) => !/^znajomość:?$/i.test(p));
    knowledge = splitList(knowledgePart.map((p) => p.replace(/^znajomość:\s*/i, "")));
    if (softAt >= 0) requiredCompetencyCodes = competenciesIn(paragraphs.slice(softAt).join(" ").replace(/^kompetencje miękkie:?/i, ""));
    if (knowledge.length === 0) knowledge = undefined;
  }
  if (requiredCompetencyCodes.length === 0) {
    warnings.push("W OSP nie znaleziono „Kompetencji miękkich” z nazwami z modelu kompetencji – propozycja kryteriów dodatkowych oprze się tylko na zadaniach.");
  }

  if (problems.length > 0 || !subordinates) throw new OspImportError(problems);

  const position: PositionDescription = {
    title,
    orgUnit,
    purpose,
    dominantTasks,
    otherTasks,
    subordinates,
    authorizations,
    requiredCompetencies: requiredCompetencyCodes.map((c) => COMPETENCY_NAMES[c]),
    requiredCompetencyCodes,
    symbol,
    office,
    supervisor,
    complexity: describeSection(reader, HEADINGS.complexity),
    independence: describeSection(reader, HEADINGS.independence),
    knowledge,
  };
  const sheet = selectSheet(subordinates);
  const additionalCriteriaFromOsp = requiredCompetencyCodes.filter((c) => !sheet.mandatoryCriteria.includes(c));
  return { position, sheet, additionalCriteriaFromOsp, rawText: doc.text, warnings };
}
