// Minimalny czytnik skoroszytów .xlsx (tylko odczyt wartości tekstowych i liczbowych komórek).
//
// Dlaczego własny: plik od MC (Model_kompetencji.xlsx) jest zapisany przez Open XML SDK z prefiksami przestrzeni nazw
// (<x:workbook>, <x:c>), których nie obsługuje exceljs, a wersja SheetJS dostępna w rejestrze npm (0.18.5)
// ma znane podatności. Format OOXML w zakresie, którego potrzebujemy, jest prosty: ZIP + kilka plików XML.
// Zależności: fflate (MIT) do ZIP i fast-xml-parser (MIT) do XML.
//
// Zabezpieczenia dla plików wgrywanych przez użytkownika (panel HR): ooxml.ts (limit rozmiaru, odrzucenie DOCTYPE)
// i odczyt wyłącznie części wskazanych w relacjach skoroszytu.

import { XMLParser } from "fast-xml-parser";
import { OoxmlReadError, openOoxml } from "./ooxml";

export { OoxmlReadError as XlsxReadError, MAX_UNCOMPRESSED_BYTES } from "./ooxml";

export interface XlsxSheet {
  name: string;
  /** Numer ostatniego wiersza z jakąkolwiek wartością (0, gdy arkusz jest pusty). */
  maxRow: number;
  /** Surowy tekst komórki (wiersz i kolumna od 1); pusty napis, gdy komórka jest pusta. */
  text(row: number, col: number): string;
}

export interface XlsxWorkbook {
  sheets: XlsxSheet[];
  sheet(name: string): XlsxSheet | undefined;
}

/** Numer kolumny → litera, np. 1 → "A", 27 → "AA". */
export function columnLetter(col: number): string {
  let s = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Adres komórki, np. cellAddress(3, 2) → "B3". */
export function cellAddress(row: number, col: number): string {
  return `${columnLetter(col)}${row}`;
}

function parseAddress(ref: string): { row: number; col: number } | null {
  const m = /^([A-Z]{1,3})(\d+)$/.exec(ref);
  if (!m) return null;
  const col = [...m[1]].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
  return { row: Number(m[2]), col };
}

const ARRAY_TAGS = new Set(["sheet", "Relationship", "si", "r", "row", "c"]);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

type XmlNode = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

/** Tekst elementu <t>: napis albo obiekt { "#text": …, "@_space": "preserve" }. */
function textOf(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as XmlNode)) return String((node as XmlNode)["#text"] ?? "");
  return "";
}

/** Tekst elementu <si> / <is>: zwykły <t> albo ciąg przebiegów rich text <r><t>…</t></r>. Pomija wymowę (rPh). */
function stringItemText(si: XmlNode | undefined): string {
  if (!si) return "";
  if (si.t !== undefined) return textOf(si.t);
  return asArray(si.r as XmlNode[] | undefined)
    .map((r) => textOf(r.t))
    .join("");
}

function resolveTarget(target: string): string {
  // Relacje skoroszytu bywają względne ("worksheets/sheet1.xml") albo bezwzględne ("/xl/worksheets/sheet1.xml").
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const parts: string[] = [];
  for (const p of path.split("/")) {
    if (p === "..") parts.pop();
    else if (p !== "." && p !== "") parts.push(p);
  }
  return parts.join("/");
}

export function readXlsx(data: Uint8Array): XlsxWorkbook {
  const pkg = openOoxml(data, "skoroszytem .xlsx");
  const readXml = (path: string): XmlNode | undefined => {
    const text = pkg.part(path);
    return text === undefined ? undefined : (xml.parse(text) as XmlNode);
  };

  const workbook = readXml("xl/workbook.xml")?.workbook as XmlNode | undefined;
  if (!workbook) throw new OoxmlReadError("W pliku brakuje części xl/workbook.xml – to nie jest skoroszyt Excela.");
  const rels = (readXml("xl/_rels/workbook.xml.rels")?.Relationships as XmlNode | undefined)?.Relationship as XmlNode[] | undefined;
  const relTarget = new Map(asArray(rels).map((r) => [String(r["@_Id"]), String(r["@_Target"])]));

  const shared = asArray(((readXml("xl/sharedStrings.xml")?.sst as XmlNode | undefined)?.si as XmlNode[] | undefined)).map(stringItemText);

  const sheets: XlsxSheet[] = asArray((workbook.sheets as XmlNode | undefined)?.sheet as XmlNode[] | undefined).map((s) => {
    const name = String(s["@_name"]);
    const target = relTarget.get(String(s["@_id"]));
    if (!target) throw new OoxmlReadError(`Arkusz „${name}” nie ma powiązanej części w pliku.`);
    const ws = readXml(resolveTarget(target))?.worksheet as XmlNode | undefined;
    if (!ws) throw new OoxmlReadError(`Nie można odczytać arkusza „${name}”.`);

    const cells = new Map<string, string>();
    let maxRow = 0;
    for (const row of asArray((ws.sheetData as XmlNode | undefined)?.row as XmlNode[] | undefined)) {
      for (const c of asArray(row.c as XmlNode[] | undefined)) {
        const ref = parseAddress(String(c["@_r"] ?? ""));
        if (!ref) continue;
        const type = c["@_t"];
        let value: string;
        if (type === "s") value = shared[Number(textOf(c.v))] ?? "";
        else if (type === "inlineStr") value = stringItemText(c.is as XmlNode | undefined);
        else if (type === "b") value = textOf(c.v) === "1" ? "TRUE" : "FALSE";
        else value = textOf(c.v); // n, str (wynik formuły), e (błąd), brak typu
        if (value === "") continue;
        cells.set(cellAddress(ref.row, ref.col), value);
        maxRow = Math.max(maxRow, ref.row);
      }
    }
    return { name, maxRow, text: (r, col) => cells.get(cellAddress(r, col)) ?? "" };
  });

  return { sheets, sheet: (name) => sheets.find((s) => s.name === name) };
}
