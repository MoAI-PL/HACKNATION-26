// Minimalny czytnik dokumentów .docx: kolejne akapity i wiersze tabel z tekstem i stanem pól wyboru.
//
// Dlaczego własny, a nie mammoth: opisy stanowisk pracy (OSP) to formularze z polami wyboru (☒/☐), np. „LICZBA PODLEGŁYCH
// PRACOWNIKÓW”, od których zależy wybór arkusza oceny. mammoth zamienia dokument na HTML i gubi stan pól.
// Obsługujemy trzy zapisy pola wyboru:
//  - kontrolka zawartości Worda 2010+ (<w14:checkbox><w14:checked w14:val="1"/>) – tak są zapisane OSP od MC;
//  - starsze pole formularza FORMCHECKBOX (<w:ffData><w:checkBox><w:checked/>);
//  - sam znak w tekście: ☒ ☑ ⊠ (zaznaczone) albo ☐ (puste), także symbole Wingdings (<w:sym>).
// Tekst zastępczy pustych kontrolek („Wybierz element.”, „Kliknij tutaj…”) pomijamy.

import { XMLParser } from "fast-xml-parser";
import { OoxmlReadError, openOoxml } from "./ooxml";

export { OoxmlReadError as DocxReadError } from "./ooxml";

export interface DocxParagraph {
  /** Tekst akapitu bez znaków pól wyboru; łamania linii jako "\n", tabulatory jako "\t". */
  text: string;
  /** Stan pierwszego pola wyboru w akapicie; null, gdy akapit nie ma pola. */
  checked: boolean | null;
}

export interface DocxCell {
  paragraphs: DocxParagraph[];
  /** Akapity komórki połączone znakiem nowej linii. */
  text: string;
}

export type DocxBlock = { kind: "paragraph"; paragraph: DocxParagraph } | { kind: "row"; cells: DocxCell[] };

export interface DocxDocument {
  /** Akapity poza tabelami i wiersze wszystkich tabel w kolejności dokumentu (tabele zagnieżdżone – w komórce). */
  blocks: DocxBlock[];
  /** Cały tekst dokumentu (do zapisu w bazie i jako kontekst dla AI). */
  text: string;
}

// preserveOrder: kolejność elementów w akapicie ma znaczenie (tekst, pola wyboru, łamania linii).
const xml = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
});

type Node = Record<string, unknown>;

const CHECKED_GLYPHS = /[☒☑⊠]/;
const UNCHECKED_GLYPHS = /[☐]/;
const GLYPHS = /[☒☑⊠☐]/g;
// Wingdings: F0FE ☑, F0FD ☒, F078 ☒, F0FB ☒; F0A8 ☐, F06F ☐, F071 ☐.
const SYM_CHECKED = new Set(["F0FE", "F0FD", "F078", "F0FB"]);
const SYM_UNCHECKED = new Set(["F0A8", "F06F", "F071"]);

function tagOf(node: Node): string | undefined {
  return Object.keys(node).find((k) => k !== ":@");
}
function childrenOf(node: Node): Node[] {
  const tag = tagOf(node);
  const v = tag ? node[tag] : undefined;
  return Array.isArray(v) ? (v as Node[]) : [];
}
function attr(node: Node, name: string): string | undefined {
  const a = node[":@"] as Record<string, string> | undefined;
  return a?.[`@_${name}`];
}
function find(nodes: Node[], tag: string): Node | undefined {
  return nodes.find((n) => tagOf(n) === tag);
}
function isTrue(v: string | undefined): boolean {
  return v === undefined || v === "1" || v === "true" || v === "on";
}

interface ParagraphState {
  parts: string[];
  checked: boolean | null;
}

function setCheck(state: ParagraphState, value: boolean) {
  if (state.checked === null) state.checked = value;
}

/** Zbiera tekst i pola wyboru z zawartości akapitu (przebiegi, hiperłącza, kontrolki, wstawienia). */
function collectInline(nodes: Node[], state: ParagraphState): void {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (!tag) continue;
    const kids = childrenOf(node);
    switch (tag) {
      case "#text":
        break;
      case "t":
        state.parts.push(kids.map((k) => String(k["#text"] ?? "")).join(""));
        break;
      case "tab":
        state.parts.push("\t");
        break;
      case "br":
      case "cr":
        state.parts.push("\n");
        break;
      case "sym": {
        const ch = (attr(node, "char") ?? "").toUpperCase();
        if (SYM_CHECKED.has(ch)) setCheck(state, true);
        else if (SYM_UNCHECKED.has(ch)) setCheck(state, false);
        break;
      }
      case "fldChar": {
        // Starsze pole formularza: <w:fldChar w:fldCharType="begin"><w:ffData><w:checkBox>…
        const cb = find(childrenOf(find(kids, "ffData") ?? {}), "checkBox");
        if (cb) {
          const cbKids = childrenOf(cb);
          const checked = find(cbKids, "checked");
          const def = find(cbKids, "default");
          setCheck(state, checked ? isTrue(attr(checked, "val")) : def ? isTrue(attr(def, "val")) : false);
        }
        break;
      }
      case "sdt": {
        const pr = childrenOf(find(kids, "sdtPr") ?? {});
        const cb = find(pr, "checkbox");
        const content = childrenOf(find(kids, "sdtContent") ?? {});
        if (cb) {
          const checked = find(childrenOf(cb), "checked");
          setCheck(state, checked ? isTrue(attr(checked, "val")) : false);
          break; // znak ☒/☐ wewnątrz kontrolki pomijamy – stan wzięty z kontrolki
        }
        if (find(pr, "showingPlcHdr")) break; // tekst zastępczy pustej kontrolki
        collectInline(content, state);
        break;
      }
      // pomijamy: usunięte zmiany, kody pól, właściwości, przypisy, rysunki
      case "del":
      case "instrText":
      case "delText":
      case "pPr":
      case "rPr":
      case "footnoteReference":
      case "endnoteReference":
      case "drawing":
      case "pict":
        break;
      default:
        collectInline(kids, state); // r, hyperlink, ins, smartTag, fldSimple…
    }
  }
}

function readParagraph(p: Node): DocxParagraph {
  const state: ParagraphState = { parts: [], checked: null };
  collectInline(childrenOf(p), state);
  let text = state.parts.join("");
  if (state.checked === null) {
    if (CHECKED_GLYPHS.test(text)) state.checked = true;
    else if (UNCHECKED_GLYPHS.test(text)) state.checked = false;
  }
  text = text.replace(GLYPHS, "");
  // Spacja oddzielająca znak pola od opisu nie należy do opisu.
  if (state.checked !== null) text = text.replace(/^[ \t ]+/, "");
  return { text, checked: state.checked };
}

/** Akapity komórki, w tym z tabel zagnieżdżonych i kontrolek blokowych. */
function cellParagraphs(nodes: Node[], out: DocxParagraph[]): void {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === "p") out.push(readParagraph(node));
    else if (tag === "tbl") for (const row of tableRows(node)) for (const c of row) out.push(...c.paragraphs);
    else if (tag === "sdt") {
      const kids = childrenOf(node);
      if (!find(childrenOf(find(kids, "sdtPr") ?? {}), "showingPlcHdr")) cellParagraphs(childrenOf(find(kids, "sdtContent") ?? {}), out);
    }
  }
}

function makeCell(paragraphs: DocxParagraph[]): DocxCell {
  return { paragraphs, text: paragraphs.map((p) => p.text).join("\n") };
}

/** Wiersze tabeli; wiersze i komórki mogą być opakowane w kontrolki zawartości (<w:sdt>). */
function tableRows(tbl: Node): DocxCell[][] {
  const rows: DocxCell[][] = [];
  const visitRows = (nodes: Node[]) => {
    for (const n of nodes) {
      const tag = tagOf(n);
      if (tag === "tr") {
        const cells: DocxCell[] = [];
        const visitCells = (cs: Node[]) => {
          for (const c of cs) {
            const t = tagOf(c);
            if (t === "tc") {
              const ps: DocxParagraph[] = [];
              cellParagraphs(childrenOf(c), ps);
              cells.push(makeCell(ps));
            } else if (t === "sdt") {
              const kids = childrenOf(c);
              const content = childrenOf(find(kids, "sdtContent") ?? {});
              // Komórka z tekstem zastępczym zostaje (zachowujemy układ kolumn), ale pusta.
              if (find(childrenOf(find(kids, "sdtPr") ?? {}), "showingPlcHdr")) {
                for (const tc of content) {
                  if (tagOf(tc) === "tc") cells.push(makeCell([]));
                }
              } else {
                visitCells(content);
              }
            }
          }
        };
        visitCells(childrenOf(n));
        rows.push(cells);
      } else if (tag === "sdt") visitRows(childrenOf(find(childrenOf(n), "sdtContent") ?? {}));
    }
  };
  visitRows(childrenOf(tbl));
  return rows;
}

function bodyBlocks(nodes: Node[], out: DocxBlock[]): void {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === "p") out.push({ kind: "paragraph", paragraph: readParagraph(node) });
    else if (tag === "tbl") for (const cells of tableRows(node)) out.push({ kind: "row", cells });
    else if (tag === "sdt") {
      const kids = childrenOf(node);
      if (!find(childrenOf(find(kids, "sdtPr") ?? {}), "showingPlcHdr")) bodyBlocks(childrenOf(find(kids, "sdtContent") ?? {}), out);
    }
  }
}

export function readDocx(data: Uint8Array): DocxDocument {
  const pkg = openOoxml(data, "dokumentem .docx");
  const raw = pkg.part("word/document.xml");
  if (raw === undefined) throw new OoxmlReadError("W pliku brakuje części word/document.xml – to nie jest dokument Worda (.docx).");

  const root = xml.parse(raw) as Node[];
  const documentNode = find(root, "document");
  const body = documentNode ? find(childrenOf(documentNode), "body") : undefined;
  if (!body) throw new OoxmlReadError("Dokument nie ma treści (brak elementu body).");

  const blocks: DocxBlock[] = [];
  bodyBlocks(childrenOf(body), blocks);

  const line = (p: DocxParagraph) => (p.checked === null ? p.text : `${p.checked ? "[x]" : "[ ]"} ${p.text}`);
  const text = blocks
    .map((b) => (b.kind === "paragraph" ? line(b.paragraph) : b.cells.map((c) => c.paragraphs.map(line).join("\n")).join(" | ")))
    .filter((t) => t.trim() !== "")
    .join("\n");
  return { blocks, text };
}
