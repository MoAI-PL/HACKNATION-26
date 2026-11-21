// Budowa bazy wiedzy asystenta formalnego (Z21): PDF-y z materialy/ → data/wiedza/fragmenty.json.
// Uruchomienie: npm run wiedza
//
// Podział:
//  - rozporządzenia: każdy ustęp (§ N ust. M) osobno; załącznik nr 1 – każde kryterium / element oceny osobno;
//    wzory arkuszy – części arkusza i pouczenie;
//  - poradniki KPRM: rozdziały ze spisu treści, długie rozdziały cięte na kawałki ok. 1200 znaków;
//  - FAQ zespołu: data/wiedza/faq.json;
//  - model kompetencji: data/model-kompetencji.json (jeśli już istnieje – Z05).
// Fragmenty mają metadane: dokument, jednostka redakcyjna / rozdział, strona, data aktu, publikator.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { KnowledgeBase, KnowledgeDocument, KnowledgeFragment } from "../src/lib/ai/rag/types";
import type { CompetencyModel } from "../src/lib/domain/types";

const OUT = "data/wiedza/fragmenty.json";
const MAX_CHUNK = 1200;

type DocMeta = Pick<KnowledgeFragment, "document" | "documentTitle" | "documentShort" | "actDate" | "publication" | "sourceFile">;

interface Line {
  text: string;
  page: number;
}

// ---------------------------------------------------------------------------
// PDF → linie
// ---------------------------------------------------------------------------

async function readPdfLines(file: string): Promise<Line[]> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: true, verbosity: 0 }).promise;
  const out: Line[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    let line = "";
    let lastY: number | null = null;
    const push = () => {
      const t = normalizeLine(line);
      if (t) out.push({ text: t, page: p });
      line = "";
    };
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) push();
      line += item.str;
      lastY = y;
      if (item.hasEOL) {
        push();
        lastY = null;
      }
    }
    push();
  }
  return out;
}

function normalizeLine(s: string): string {
  return s
    .replace(/[-]/g, "•") // punktory z czcionek symbolicznych
    .replace(/\s+/g, " ")
    .trim();
}

/** Linie techniczne: nagłówek Dziennika Ustaw, numer strony, odnośnik przypisu. */
function isNoise(t: string): boolean {
  return /^Dziennik Ustaw – \d+ – Poz\. \d+$/.test(t) || /^\d{1,3}$/.test(t) || /^\d{1,2}\)$/.test(t);
}

/** Skleja linie w tekst: przeniesienia wyrazów, listy w nowych liniach. */
function joinLines(lines: string[]): string {
  let out = "";
  for (const l of lines) {
    if (!out) {
      out = l;
      continue;
    }
    const isListItem = /^(\d+\)|[a-z]\)|−|•|–\s)/.test(l);
    if (/[a-ząćęłńóśźż]-$/.test(out) && /^[a-ząćęłńóśźż]/.test(l)) out = out.slice(0, -1) + l;
    else out += (isListItem ? "\n" : " ") + l;
  }
  return out.replace(/ +\./g, ".").trim();
}

/** Tnie długi tekst na kawałki ≤ MAX_CHUNK, preferując granice zdań. */
function splitLong(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > MAX_CHUNK) {
    const window = rest.slice(0, MAX_CHUNK);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf(".\n"), window.lastIndexOf(";\n"));
    if (cut < MAX_CHUNK * 0.5) cut = window.lastIndexOf(" ");
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

// ---------------------------------------------------------------------------
// Akty prawne (rozporządzenia)
// ---------------------------------------------------------------------------

interface ActSource {
  meta: DocMeta;
  /** Nazwy załączników będących wzorami formularzy. */
  formAnnexes: Record<number, string>;
  /** Tytuł załącznika nr 1 (wykaz kryteriów / opisy elementów). */
  annex1Title: string;
}

function parseAct(lines: Line[], src: ActSource): KnowledgeFragment[] {
  const frags: KnowledgeFragment[] = [];
  const { meta } = src;
  const add = (id: string, unit: string, page: number, text: string) => {
    splitLong(text).forEach((t, i, all) =>
      frags.push({ ...meta, id: all.length > 1 ? `${id}:${i + 1}` : id, unit, page, text: t }),
    );
  };

  const annexStart = lines.findIndex((l) => l.text === "Załączniki");
  const body = lines.slice(0, annexStart).filter((l) => !isNoise(l.text));
  const annexes = lines.slice(annexStart).filter((l) => !isNoise(l.text));

  // --- treść: tytuł, § i ustępy -------------------------------------------
  let par: string | null = null;
  let ust = 0;
  let buf: string[] = [];
  let bufPage = 1;
  let ended = false;
  const flush = () => {
    if (!buf.length) return;
    if (par === null) add(`${meta.document}:tytul`, "tytuł i podstawa prawna", bufPage, joinLines(buf));
    else if (ust === 0) add(`${meta.document}:§${par}`, `§ ${par}`, bufPage, joinLines(buf));
    else add(`${meta.document}:§${par}:ust.${ust}`, `§ ${par} ust. ${ust}`, bufPage, joinLines(buf));
    buf = [];
  };
  for (const l of body) {
    if (ended) break;
    if (/^Prezes Rady Ministrów/.test(l.text)) {
      ended = true;
      continue;
    }
    const p = /^§ (\d+[a-z]?)\.\s*(.*)$/.exec(l.text);
    if (p) {
      flush();
      par = p[1]!;
      ust = 0;
      bufPage = l.page;
      let rest = p[2]!;
      const u = /^1\.\s+(.*)$/.exec(rest);
      if (u) {
        ust = 1;
        rest = u[1]!;
      }
      buf.push(rest);
      continue;
    }
    // Kolejny ustęp: tylko w § podzielonym na ustępy i tylko z następnym numerem (chroni przed listami „1)”, „2)”).
    const u = /^(\d+)\.\s+(.*)$/.exec(l.text);
    if (u && ust > 0 && Number(u[1]) === ust + 1) {
      flush();
      ust = Number(u[1]);
      bufPage = l.page;
      buf.push(u[2]!);
      continue;
    }
    buf.push(l.text);
  }
  flush();

  // --- załączniki -----------------------------------------------------------
  const boiler = (t: string) =>
    /^(Załączniki|do rozporządzenia|Prezesa Rady Ministrów|z dnia.*|\(poz\. …\)|Załączniki do rozporządzenia Prezesa Rady Ministrów|WZÓR)$/.test(t) ||
    /^z dnia .*\(poz\. \d+\)$/.test(t);
  let annex = 0;
  const byAnnex = new Map<number, Line[]>();
  for (const l of annexes) {
    const a = /^Załącznik nr (\d+)$/.exec(l.text);
    if (a) {
      annex = Number(a[1]);
      continue;
    }
    if (annex === 0 || boiler(l.text)) continue;
    if (!byAnnex.has(annex)) byAnnex.set(annex, []);
    byAnnex.get(annex)!.push(l);
  }

  // Załącznik nr 1: każde kryterium / element oceny osobno
  const a1 = (byAnnex.get(1) ?? []).filter(
    (l) => !/^(KRYTERIUM OPIS|ELEMENT OCENY OPIS)$/i.test(l.text) && l.text.toLowerCase() !== src.annex1Title.toLowerCase(),
  );
  let name: string[] = [];
  let desc: string[] = [];
  let num = 0;
  let page = 1;
  const flushCrit = () => {
    if (!num) return;
    const nazwa = name.join(" ").replace(/\s*\/\s*/g, "/");
    const ladna = nazwa.charAt(0) + nazwa.slice(1).toLowerCase();
    add(
      `${meta.document}:zal1:${num}`,
      `Załącznik nr 1 – ${ladna}`,
      page,
      `${src.annex1Title} – ${nazwa}. Opis (wskaźniki behawioralne):\n${joinLines(desc)}`,
    );
  };
  for (const l of a1) {
    const m = /^(\d+)\.\s+([^−]+?)(?:\s+(−\s.*))?$/.exec(l.text);
    if (m && Number(m[1]) === num + 1 && m[2] === m[2]!.toUpperCase()) {
      flushCrit();
      num = Number(m[1]);
      page = l.page;
      name = [m[2]!.trim()];
      desc = m[3] ? [m[3]] : [];
      continue;
    }
    if (!desc.length && l.text === l.text.toUpperCase() && !l.text.startsWith("−")) name.push(l.text);
    else desc.push(l.text);
  }
  flushCrit();

  // Załączniki-wzory: części arkusza, pouczenie
  for (const [nr, title] of Object.entries(src.formAnnexes)) {
    const al = byAnnex.get(Number(nr)) ?? [];
    let part = "początek";
    let pbuf: string[] = [];
    let ppage = al[0]?.page ?? 1;
    let k = 0;
    const flushPart = () => {
      if (pbuf.length) add(`${meta.document}:zal${nr}:${++k}`, `Załącznik nr ${nr} – ${title}, ${part}`, ppage, joinLines(pbuf));
      pbuf = [];
    };
    for (const l of al) {
      const czesc = /^C ?Z ?Ę ?Ś ?Ć ?(I ?I ?I|I ?I|I|I ?V)\b/.exec(l.text);
      if (czesc || l.text === "Pouczenie") {
        flushPart();
        part = czesc ? `część ${czesc[1]!.replace(/ /g, "")}` : "pouczenie";
        ppage = l.page;
        pbuf.push(l.text.replace(/C Z Ę Ś Ć/, "CZĘŚĆ").replace(/I I I/, "III").replace(/I I/, "II"));
        continue;
      }
      pbuf.push(l.text);
    }
    flushPart();
  }
  return frags;
}

// ---------------------------------------------------------------------------
// Poradniki KPRM
// ---------------------------------------------------------------------------

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-ząćęłńóśźż0-9]+/g, " ").trim();
}

function parseGuide(lines: Line[], meta: DocMeta): KnowledgeFragment[] {
  // Spis treści: linie z kropkami prowadzącymi; tytuł może zajmować kilka linii
  const tocPages = new Set(lines.filter((l) => /\.{5,}\s*\d+$/.test(l.text)).map((l) => l.page));
  const toc = new Map<string, string>();
  let pending = "";
  for (const l of lines.filter((x) => tocPages.has(x.page))) {
    const full = pending ? `${pending} ${l.text}` : l.text;
    if (/\.{5,}\s*\d+$/.test(full)) {
      const m = /^(\d+(?:\.\d+)*)\.\s+(.+?)\s*\.{5,}\s*\d+$/.exec(full);
      if (m) toc.set(m[1]!, m[2]!.trim());
      pending = "";
    } else if (/^\d+(?:\.\d+)*\.\s/.test(l.text) || pending) pending = full;
  }

  const frags: KnowledgeFragment[] = [];
  let section = "wprowadzenie";
  let buf: string[] = [];
  let bufPage = 0;
  let k = 0;
  const flush = () => {
    if (!buf.length) return;
    for (const t of splitLong(joinLines(buf))) {
      if (t.length < 40) continue;
      frags.push({ ...meta, id: `${meta.document}:s${bufPage}:${++k}`, unit: section, page: bufPage, text: t });
    }
    buf = [];
  };
  for (const l of lines) {
    if (l.page === 1 || tocPages.has(l.page) || isNoise(l.text)) continue;
    const h = /^(\d+(?:\.\d+)*)\.\s+(.+)$/.exec(l.text);
    const tocTitle = h ? toc.get(h[1]!) : undefined;
    if (h && tocTitle && normTitle(tocTitle).startsWith(normTitle(h[2]!).slice(0, 20))) {
      flush();
      section = `rozdz. ${h[1]}. ${tocTitle}`;
      bufPage = l.page;
      continue;
    }
    if (!buf.length) bufPage = l.page;
    // nowa strona = naturalna granica fragmentu, jeśli bufor jest już spory
    if (buf.length && l.page !== bufPage && buf.join(" ").length > MAX_CHUNK * 0.6) {
      flush();
      bufPage = l.page;
    }
    buf.push(l.text);
  }
  flush();
  return frags;
}

// ---------------------------------------------------------------------------
// FAQ i model kompetencji
// ---------------------------------------------------------------------------

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  basis: string;
}

function faqFragments(): KnowledgeFragment[] {
  const faq = JSON.parse(readFileSync("data/wiedza/faq.json", "utf8")) as FaqEntry[];
  return faq.map((f) => ({
    id: `FAQ:${f.id}`,
    document: "FAQ" as KnowledgeDocument,
    documentTitle: "Najczęstsze pytania – opracowanie zespołu na podstawie przepisów i poradników KPRM",
    documentShort: "FAQ",
    unit: f.question,
    sourceFile: "data/wiedza/faq.json",
    text: `${f.question}\n${f.answer}\nPodstawa: ${f.basis}`,
  }));
}

function competencyModelFragments(): KnowledgeFragment[] {
  const file = "data/model-kompetencji.json";
  if (!existsSync(file)) {
    console.log("  (pominięto model kompetencji – brak data/model-kompetencji.json, powstanie w Z05)");
    return [];
  }
  const model = JSON.parse(readFileSync(file, "utf8")) as CompetencyModel;
  const labels = ["znacznie poniżej oczekiwań", "poniżej oczekiwań", "na poziomie oczekiwań", "powyżej oczekiwań", "znacznie powyżej oczekiwań"];
  return model.competencies.flatMap((c) =>
    c.indicators.map((ind) => ({
      id: `MODEL_KOMPETENCJI:${ind.id}`,
      document: "MODEL_KOMPETENCJI" as KnowledgeDocument,
      documentTitle: "Model kompetencji – opisy zachowań dla wskaźników behawioralnych (materiały MC)",
      documentShort: "model kompetencji",
      unit: `${c.name} – ${ind.name}`,
      sourceFile: "materialy/Model_kompetencji.xlsx",
      text: `${c.name}. Wskaźnik: ${ind.name}.\n${([1, 2, 3, 4, 5] as const).map((lvl) => `${labels[lvl - 1]}: ${ind.levels[lvl]}`).join("\n")}`,
    })),
  );
}

// ---------------------------------------------------------------------------

const ACTS: (ActSource & { file: string })[] = [
  {
    file: "materialy/ocena-okresowa/Rozporzadzenie_oceny_okresowe_2016_wariant-a.pdf",
    meta: {
      document: "ROZP_OKRESOWE",
      documentTitle:
        "Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej",
      documentShort: "rozporządzenie o ocenach okresowych",
      actDate: "2016-04-04",
      publication: "Dz.U. 2016 poz. 470",
      sourceFile: "materialy/ocena-okresowa/Rozporzadzenie_oceny_okresowe_2016_wariant-a.pdf",
    },
    annex1Title: "Wykaz kryteriów oceny",
    formAnnexes: { 2: "wzór arkusza A", 3: "wzór arkusza B", 4: "wzór arkusza C" },
  },
  {
    file: "materialy/pierwsza-ocena/Rozporzadzenie_pierwsza_ocena_2015.pdf",
    meta: {
      document: "ROZP_PIERWSZA",
      documentTitle:
        "Rozporządzenie Prezesa Rady Ministrów z dnia 23 lipca 2015 r. w sprawie szczegółowych warunków i sposobu dokonywania pierwszej oceny w służbie cywilnej",
      documentShort: "rozporządzenie o pierwszej ocenie",
      actDate: "2015-07-23",
      publication: "Dz.U. 2015 poz. 1144",
      sourceFile: "materialy/pierwsza-ocena/Rozporzadzenie_pierwsza_ocena_2015.pdf",
    },
    annex1Title: "Opisy elementów oceny",
    formAnnexes: { 2: "wzór arkusza pierwszej oceny", 3: "wzór formularza sprawozdania" },
  },
];

const GUIDES: { file: string; meta: DocMeta }[] = [
  {
    file: "materialy/ocena-okresowa/Poradnik_oceny_okresowe.pdf",
    meta: {
      document: "PORADNIK_OKRESOWE",
      documentTitle: "Oceny okresowe w służbie cywilnej – poradnik, Kancelaria Prezesa Rady Ministrów, Departament Służby Cywilnej, wrzesień 2016",
      documentShort: "poradnik KPRM o ocenach okresowych",
      actDate: "2016-09",
      sourceFile: "materialy/ocena-okresowa/Poradnik_oceny_okresowe.pdf",
    },
  },
  {
    file: "materialy/pierwsza-ocena/Poradnik_pierwsza_ocena_2016.pdf",
    meta: {
      document: "PORADNIK_PIERWSZA",
      documentTitle: "Pierwsza ocena w służbie cywilnej – poradnik, Kancelaria Prezesa Rady Ministrów, Departament Służby Cywilnej, wrzesień 2016",
      documentShort: "poradnik KPRM o pierwszej ocenie",
      actDate: "2016-09",
      sourceFile: "materialy/pierwsza-ocena/Poradnik_pierwsza_ocena_2016.pdf",
    },
  },
];

async function main() {
  const fragments: KnowledgeFragment[] = [];
  for (const a of ACTS) {
    const f = parseAct(await readPdfLines(a.file), a);
    console.log(`  ${a.meta.documentShort}: ${f.length} fragmentów`);
    fragments.push(...f);
  }
  for (const g of GUIDES) {
    const f = parseGuide(await readPdfLines(g.file), g.meta);
    console.log(`  ${g.meta.documentShort}: ${f.length} fragmentów`);
    fragments.push(...f);
  }
  const faq = faqFragments();
  console.log(`  FAQ: ${faq.length} fragmentów`);
  fragments.push(...faq, ...competencyModelFragments());

  const ids = new Set<string>();
  for (const f of fragments) {
    if (ids.has(f.id)) throw new Error(`Powtórzony identyfikator fragmentu: ${f.id}`);
    ids.add(f.id);
  }

  const kb: KnowledgeBase = { generatedAt: new Date().toISOString(), fragments };
  mkdirSync("data/wiedza", { recursive: true });
  writeFileSync(OUT, JSON.stringify(kb, null, 1) + "\n");
  console.log(`Zapisano ${fragments.length} fragmentów do ${OUT}`);
}

main().catch((e) => {
  console.error("Import bazy wiedzy nie powiódł się:", e);
  process.exit(1);
});
