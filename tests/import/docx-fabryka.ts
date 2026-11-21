// Budowanie małych dokumentów .docx w pamięci do testów importu OSP.

import { strToU8, zipSync } from "fflate";

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type Check = "w14" | "legacy" | "glyph" | "sym";

/** Akapit z tekstem; opcjonalnie z polem wyboru zapisanym na jeden z czterech sposobów. */
export function p(text: string, check?: { checked: boolean; as?: Check }): string {
  const run = `<w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  if (!check) return `<w:p>${run}</w:p>`;
  const v = check.checked;
  switch (check.as ?? "w14") {
    case "w14":
      return `<w:p><w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="${v ? 1 : 0}"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:t>${v ? "☒" : "☐"}</w:t></w:r></w:sdtContent></w:sdt>${run}</w:p>`;
    case "legacy":
      return `<w:p><w:r><w:fldChar w:fldCharType="begin"><w:ffData><w:checkBox><w:sizeAuto/><w:default w:val="0"/>${v ? "<w:checked/>" : ""}</w:checkBox></w:ffData></w:fldChar></w:r><w:r><w:instrText> FORMCHECKBOX </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>${run}</w:p>`;
    case "glyph":
      return `<w:p><w:r><w:t xml:space="preserve">${v ? "☒" : "☐"} </w:t></w:r>${run}</w:p>`;
    case "sym":
      return `<w:p><w:r><w:sym w:font="Wingdings" w:char="${v ? "F0FE" : "F0A8"}"/></w:r>${run}</w:p>`;
  }
}

/** Akapit z tekstem zastępczym pustej kontrolki („Wybierz element.”). */
export const placeholder = () =>
  `<w:p><w:sdt><w:sdtPr><w:showingPlcHdr/><w:dropDownList/></w:sdtPr><w:sdtContent><w:r><w:t>Wybierz element.</w:t></w:r></w:sdtContent></w:sdt></w:p>`;

/** Komórka z akapitami (napis = jeden akapit). */
export const tc = (...paragraphs: string[]) => `<w:tc>${(paragraphs.length ? paragraphs : [p("")]).map((x) => (x.startsWith("<w:") ? x : p(x))).join("")}</w:tc>`;
export const tr = (...cells: string[]) => `<w:tr>${cells.map((c) => (c.startsWith("<w:tc") || c.startsWith("<w:sdt") ? c : tc(c))).join("")}</w:tr>`;
export const tbl = (...rows: string[]) => `<w:tbl>${rows.join("")}</w:tbl>`;

export function buildDocx(body: string, parts: Record<string, string> = {}): Uint8Array {
  return zipSync({
    "[Content_Types].xml": strToU8(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`),
    "word/document.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}</w:body></w:document>`),
    ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])),
  });
}

const SUB = [
  "brak podległych pracowników",
  "bezpośrednio kieruje lub koordynuje pracę do 4 pracowników",
  "bezpośrednio kieruje lub koordynuje pracę od 5 do 9 pracowników",
  "bezpośrednio kieruje lub koordynuje pracę powyżej 9 pracowników",
  "bezpośrednio podlegają osoby kierujące pracą innych pracowników",
];

export interface OspOptions {
  title?: string;
  /** Indeksy zaznaczonych opcji liczby podległych (0 = brak). */
  checked?: number[];
  as?: Check;
  tasks?: string[];
  other?: string[];
  soft?: string;
  authorizations?: { brak?: boolean; kontrola?: boolean; inne?: string };
  omit?: ("subordinates" | "purpose")[];
}

/** Minimalny OSP w układzie formularza MC. */
export function ospDocx(o: OspOptions = {}): Uint8Array {
  const checked = o.checked ?? [0];
  const auth = o.authorizations ?? { brak: true };
  const body = [
    p("OPIS STANOWISKA PRACY"),
    tbl(
      tr("", "NAZWA URZĘDU", "Urząd Testowy"),
      tr("", "NAZWA KOMÓRKI ORGANIZACYJNEJ URZĘDU", "Departament A"),
      tr("", "", "Wydział B"),
      tr("", "NAZWA STANOWISKA PRACY", o.title ?? "specjalista"),
      tr("", "SYMBOL STANOWISKA PRACY", "DA WB 3"),
    ),
    tbl(
      ...(o.omit?.includes("purpose") ? [] : [tr("CEL ISTNIENIA STANOWISKA PRACY"), tr("Cel testowy stanowiska.")]),
      ...(o.omit?.includes("subordinates")
        ? []
        : [tr("LICZBA PODLEGŁYCH PRACOWNIKÓW"), tr(tc(...SUB.map((s, i) => p(s, { checked: checked.includes(i), as: o.as }))))]),
    ),
    p("GŁÓWNE ZADANIA REALIZOWANE NA STANOWISKU PRACY"),
    tbl(
      tr("ZADANIA DOMINUJĄCE (najczęściej wykonywane)"),
      ...(o.tasks ?? ["Zadanie 1: Pierwsze zadanie.", "Zadanie 2. Drugie zadanie."]).map((t) => tr(t)),
      tr("POZOSTAŁE ZADANIA"),
      ...(o.other ?? ["Zadanie 3 – Trzecie zadanie."]).map((t) => tr(t)),
    ),
    tbl(
      tr("UPOWAŻNIENIA I PEŁNOMOCNICTWA"),
      tr(
        tc(
          p("brak upoważnień i pełnomocnictw", { checked: !!auth.brak }),
          p("upoważnienie do przeprowadzania kontroli", { checked: !!auth.kontrola }),
          p("inne (należy wskazać jakie)", { checked: !!auth.inne }),
          ...(auth.inne ? [p(auth.inne)] : []),
        ),
      ),
    ),
    tbl(tr("Wykształcenie", "wyższe", tc(placeholder())), tr("Inne kompetencje, wiedza lub umiejętności", tc(p("Znajomość:"), p("- ustawy A,"), p("- ustawy B"), p("Kompetencje miękkie:"), p(o.soft ?? "współpraca, komunikacja")))),
  ].join("");
  return buildDocx(body);
}
