// Budowanie małych skoroszytów .xlsx w pamięci do testów importu (bez Excela i bez dodatkowych bibliotek).
// Komórki zapisujemy jako tekst w sharedStrings; opcja `prefixed` naśladuje plik MC zapisany przez Open XML SDK (<x:c>).

import { strToU8, zipSync } from "fflate";
import { cellAddress } from "@/lib/import/xlsx";
import { COMPETENCY_NAMES, COMPETENCY_XLSX_SHEETS } from "@/lib/domain/slownik";
import { COMPETENCY_CODES } from "@/lib/domain/types";

export type SheetRows = (string | null)[][];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildXlsx(sheets: Record<string, SheetRows>, opts: { prefixed?: boolean } = {}): Uint8Array {
  const p = opts.prefixed ? "x:" : "";
  const ns = opts.prefixed ? 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' : 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const rNs = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const strings: string[] = [];
  const idx = (s: string) => {
    const i = strings.indexOf(s);
    return i >= 0 ? i : strings.push(s) - 1;
  };

  const names = Object.keys(sheets);
  const files: Record<string, Uint8Array> = {};
  names.forEach((name, n) => {
    const rows = sheets[name]
      .map((row, r) => {
        const cells = row
          .map((v, c) => (v === null || v === "" ? "" : `<${p}c r="${cellAddress(r + 1, c + 1)}" t="s"><${p}v>${idx(v)}</${p}v></${p}c>`))
          .join("");
        return cells ? `<${p}row r="${r + 1}">${cells}</${p}row>` : "";
      })
      .join("");
    files[`xl/worksheets/sheet${n + 1}.xml`] = strToU8(`<?xml version="1.0" encoding="utf-8"?><${p}worksheet ${ns}><${p}sheetData>${rows}</${p}sheetData></${p}worksheet>`);
  });

  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0" encoding="utf-8"?><${p}workbook ${ns} ${rNs}><${p}sheets>` +
      names.map((name, n) => `<${p}sheet name="${esc(name)}" sheetId="${n + 1}" r:id="rId${n + 1}"/>`).join("") +
      `</${p}sheets></${p}workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      names.map((_, n) => `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet${n + 1}.xml"/>`).join("") +
      `</Relationships>`,
  );
  files["xl/sharedStrings.xml"] = strToU8(
    `<?xml version="1.0" encoding="utf-8"?><${p}sst ${ns}>` + strings.map((s) => `<${p}si><${p}t xml:space="preserve">${esc(s)}</${p}t></${p}si>`).join("") + `</${p}sst>`,
  );
  files["[Content_Types].xml"] = strToU8(`<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`);
  return zipSync(files);
}

export const HEADERS = ["Wskaźnik behawioralny", "Znacznie poniżej oczekiwań", "Poniżej oczekiwań", "Na poziomie oczekiwań", "Powyżej oczekiwań", "Znacznie powyżej oczekiwań"];

/** Poprawny, mały model: 14 kompetencji po jednym wskaźniku. Testy psują go w jednym miejscu. */
export function minimalModelSheets(): Record<string, SheetRows> {
  const summary: SheetRows = [
    ["MODEL KOMPETENCJI"],
    [],
    ["14 kompetencji • 14 wskaźników behawioralnych • 5 poziomów oceny"],
    ["Wskazówka pierwsza."],
    [],
    ["Lp.", "Kompetencja", "Liczba wskaźników"],
    ...COMPETENCY_CODES.map((c, i) => [String(i + 1), COMPETENCY_NAMES[c].toUpperCase(), "1"]),
  ];
  const sheets: Record<string, SheetRows> = { "Model kompetencji": summary };
  for (const c of COMPETENCY_CODES) {
    sheets[COMPETENCY_XLSX_SHEETS[c]] = [
      [COMPETENCY_NAMES[c].toUpperCase()],
      [],
      HEADERS,
      [`Wskaźnik ${c}\nw dwóch liniach.`, "opis 1", "opis 2", "opis 3", "opis 4", "opis 5"],
    ];
  }
  return sheets;
}
