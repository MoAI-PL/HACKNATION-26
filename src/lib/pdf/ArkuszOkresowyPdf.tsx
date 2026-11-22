// Dokument PDF arkusza oceny okresowej B / C (Z16); czcionka, style i drobne elementy używa też arkusz pierwszej oceny (Z17) – @react-pdf/renderer (MIT), czcionka Noto Sans (OFL-1.1) z polskimi znakami.
// Układ odwzorowuje wzory z materialy/ocena-okresowa/ (załączniki nr 3 i 4 do rozporządzenia): część I, część II z pouczeniem,
// część III tylko przy wniosku o stopień; każda część od nowej strony, przypisy pod częścią.

import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDatePl } from "@/lib/rules/kalendarz";
import { RESULT_LABELS } from "@/lib/domain/slownik";
import {
  OVERALL_ROWS,
  PARTIAL_COLUMNS,
  formatAverage,
  levelLabel,
  type SheetCriterion,
  type SheetData,
} from "./arkusz";
import {
  NAGLOWEK,
  POTWIERDZENIE_CZESCI_I,
  POUCZENIE,
  PRZYPISY_CZESCI,
  WSTEP_CZESCI_III,
  ZAPOZNANIE_Z_OCENA,
  przypisy,
} from "./teksty-arkusza";

// ---------------------------------------------------------------------------
// Czcionka (pliki w repozytorium – działa także na Vercelu, zob. outputFileTracingIncludes w next.config.ts)
// ---------------------------------------------------------------------------

const FONT_DIR = path.join(process.cwd(), "src", "lib", "pdf", "czcionki");
let fontsReady = false;

export function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: path.join(FONT_DIR, "NotoSans-Regular.ttf") },
      { src: path.join(FONT_DIR, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Bez dzielenia wyrazów – domyślne reguły są angielskie i psułyby polskie słowa.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

// ---------------------------------------------------------------------------
// Style
// ---------------------------------------------------------------------------

const BORDER = "#000000";
export const s = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 8, paddingTop: 26, paddingBottom: 34, paddingHorizontal: 36, lineHeight: 1.25 },
  annex: { textAlign: "right", fontSize: 8 },
  title: { textAlign: "center", fontSize: 12, fontWeight: 700, marginTop: 2, marginBottom: 2 },
  subtitle: { textAlign: "center", fontSize: 9, fontWeight: 700, marginBottom: 6 },
  part: { textAlign: "center", fontSize: 10.5, fontWeight: 700, marginBottom: 5 },
  table: { borderWidth: 0.75, borderColor: BORDER, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.75, borderColor: BORDER },
  rowLast: { flexDirection: "row" },
  head: { backgroundColor: "#e7e7e7", fontWeight: 700, padding: 3, borderBottomWidth: 0.75, borderColor: BORDER },
  label: { width: "32%", padding: 3, borderRightWidth: 0.75, borderColor: BORDER, backgroundColor: "#f3f3f3" },
  value: { flex: 1, padding: 3 },
  cell: { padding: 3, borderRightWidth: 0.75, borderColor: BORDER },
  cellLast: { padding: 3 },
  center: { textAlign: "center" },
  bold: { fontWeight: 700 },
  small: { fontSize: 7 },
  empty: { color: "#555555" },
  mark: { textAlign: "center", fontWeight: 700, fontSize: 10 },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 4 },
  signature: { width: "30%", alignItems: "center" },
  line: { borderBottomWidth: 0.5, borderColor: BORDER, width: "100%", height: 14, justifyContent: "flex-end" },
  caption: { fontSize: 7, marginTop: 2, textAlign: "center" },
  block: { minHeight: 40, padding: 3 },
  footnotes: { marginTop: 6, borderTopWidth: 0.5, borderColor: BORDER, paddingTop: 3 },
  footnote: { fontSize: 6.2, marginBottom: 1, lineHeight: 1.2 },
  pageNumber: { position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 7, color: "#555555" },
});

// ---------------------------------------------------------------------------
// Drobne elementy
// ---------------------------------------------------------------------------

const SUP = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
/** Znacznik przypisu „)” jak we wzorze, np. ⁴⁾. */
export const fn = (n: number) => `${String(n).split("").map((d) => SUP[Number(d)]).join("")}⁾`;

const DOTS = "……………………………";
export const date = (d: string | null | undefined) => (d ? formatDatePl(d) : null);

/** Wartość albo wykropkowane pole do uzupełnienia ręcznie. */
export function V({ children }: { children: string | number | null | undefined }) {
  return children === null || children === undefined || children === "" ? <Text style={s.empty}>{DOTS}</Text> : <Text>{String(children)}</Text>;
}

export function LabelRow({ label, value, last }: { label: string; value: string | number | null | undefined; last?: boolean }) {
  return (
    <View style={last ? s.rowLast : s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.value}>
        <V>{value}</V>
      </View>
    </View>
  );
}

export function Signatures({ items, compact }: { items: { caption: string; value?: string | null }[]; compact?: boolean }) {
  return (
    <View style={compact ? [s.signatures, { marginTop: 4, marginBottom: 1 }] : s.signatures} wrap={false}>
      {items.map((it) => (
        <View key={it.caption} style={s.signature}>
          <View style={s.line}>{it.value ? <Text style={s.center}>{it.value}</Text> : null}</View>
          <Text style={s.caption}>{it.caption}</Text>
        </View>
      ))}
    </View>
  );
}

function Footnotes({ sheet, numbers }: { sheet: "B" | "C"; numbers: readonly number[] }) {
  const all = przypisy(sheet);
  return (
    <View style={s.footnotes}>
      {numbers.map((n) => (
        <Text key={n} style={s.footnote}>
          {n}) {all[n]}
        </Text>
      ))}
    </View>
  );
}

function PersonTable({ title, p, note }: { title: string; p: SheetData["employee"]; note?: string }) {
  return (
    <View style={s.table} wrap={false}>
      <Text style={s.head} minPresenceAhead={40}>{title}</Text>
      <LabelRow label="Imię" value={p.firstName} />
      <LabelRow label="Nazwisko" value={p.lastName} />
      <LabelRow label="Komórka organizacyjna" value={p.orgUnit} />
      <LabelRow label={`Stanowisko pracy${note ?? ""}`} value={p.position} last />
    </View>
  );
}

function Header({ data }: { data: SheetData }) {
  const h = NAGLOWEK[data.sheet];
  return (
    <>
      <Text style={s.annex}>{h.zalacznik}</Text>
      <Text style={s.title}>{h.tytul}</Text>
      <Text style={s.subtitle}>OCENA OKRESOWA URZĘDNIKA SŁUŻBY CYWILNEJ LUB PRACOWNIKA SŁUŻBY CYWILNEJ{fn(1)}</Text>
    </>
  );
}

// ---------------------------------------------------------------------------
// Część I
// ---------------------------------------------------------------------------

/** Komórka kryterium dodatkowego w części I: nazwa, „—” w pierwszym wierszu, gdy nie wybrano żadnego, inaczej pusto. */
export function additionalCell(additional: SheetCriterion[], row: number): string {
  if (additional[row]) return additional[row].name;
  return additional.length === 0 && row === 0 ? "—" : "";
}

function PartI({ data }: { data: SheetData }) {
  const mandatory = data.criteria.filter((c) => c.kind === "OBOWIAZKOWE");
  const additional = data.criteria.filter((c) => c.kind === "DODATKOWE");
  const rows = Math.max(mandatory.length, 3);
  return (
    <>
      <Text style={s.part}>CZĘŚĆ I</Text>
      <View style={s.table}>
        <LabelRow label="NAZWA URZĘDU" value={data.office} last />
      </View>
      <PersonTable title="DANE OCENIANEGO" p={data.employee} note={fn(2)} />
      <PersonTable title="DANE OCENIAJĄCEGO" p={data.evaluator} />

      <View style={s.table} wrap={false}>
        <Text style={s.head} minPresenceAhead={40}>KRYTERIA OCENY I TERMIN SPORZĄDZENIA OCENY</Text>
        <View style={s.row}>
          <Text style={[s.cell, s.bold, { width: "50%" }]}>Kryteria obowiązkowe</Text>
          <Text style={[s.cellLast, s.bold, { width: "50%" }]}>Kryteria dodatkowe wybrane przez oceniającego (nie więcej niż 3){fn(3)}</Text>
        </View>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={s.row}>
            <Text style={[s.cell, { width: "50%" }]}>{mandatory[i]?.name ?? ""}</Text>
            {/* Kryteria są już ustalone, więc nieużyty wiersz zostaje pusty jak we wzorze (bez kropek „do uzupełnienia”). */}
            <Text style={[s.cellLast, { width: "50%" }]}>{additionalCell(additional, i)}</Text>
          </View>
        ))}
        <View style={s.rowLast}>
          <Text style={[s.label, { width: "50%" }]}>Termin sporządzenia oceny (dd.mm.rrrr)</Text>
          <View style={s.value}>
            <V>{date(data.dueDate)}</V>
          </View>
        </View>
      </View>

      <View wrap={false}>
        <Text style={s.bold}>Potwierdzamy:</Text>
        <Text>– {POTWIERDZENIE_CZESCI_I[0]}{fn(4)},</Text>
        <Text>– {POTWIERDZENIE_CZESCI_I[1]}</Text>
        <Signatures
          items={[
            { caption: "miejscowość" },
            { caption: "data (dd.mm.rrrr)", value: date(data.criteriaSetAt) },
            { caption: "podpis oceniającego" },
          ]}
        />
        <Signatures
          items={[
            { caption: "miejscowość" },
            { caption: "data (dd.mm.rrrr)", value: date(data.criteriaSetAt) },
            { caption: "podpis ocenianego" },
          ]}
        />
      </View>
      <Footnotes sheet={data.sheet} numbers={PRZYPISY_CZESCI.I} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Część II
// ---------------------------------------------------------------------------

function ScoresTable({ title, note, criteria }: { title: string; note: string; criteria: SheetCriterion[] }) {
  const rows = criteria.length > 0 ? criteria : [{ name: "—", kind: "DODATKOWE" as const, points: null }];
  return (
    <View style={s.table} wrap={false}>
      <View style={s.row}>
        <Text style={[s.cell, s.bold, { width: "40%" }]}>{title}</Text>
        <Text style={[s.cellLast, s.bold, s.center, { width: "60%" }]}>OCENA CZĄSTKOWA{note}</Text>
      </View>
      <View style={s.row}>
        <Text style={[s.cell, { width: "40%" }]} />
        {PARTIAL_COLUMNS.map((c, i) => (
          <Text key={c.points} style={[i < 4 ? s.cell : s.cellLast, s.center, s.small, { width: "12%" }]}>
            {c.label}
            {"\n"}
            {c.points} pkt
          </Text>
        ))}
      </View>
      {rows.map((c, r) => (
        <View key={c.name} style={r === rows.length - 1 ? s.rowLast : s.row}>
          <Text style={[s.cell, { width: "40%" }]}>{c.name}</Text>
          {PARTIAL_COLUMNS.map((col, i) => (
            <Text key={col.points} style={[i < 4 ? s.cell : s.cellLast, s.mark, { width: "12%" }]}>
              {c.points === col.points ? "X" : ""}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function PartII({ data }: { data: SheetData }) {
  const p = data.partII!;
  const mandatory = data.criteria.filter((c) => c.kind === "OBOWIAZKOWE");
  const additional = data.criteria.filter((c) => c.kind === "DODATKOWE");
  return (
    <>
      <Text style={s.part}>CZĘŚĆ II</Text>
      <View style={s.table}>
        <LabelRow label={`DATA PRZEPROWADZENIA ROZMOWY OCENIAJĄCEJ${fn(5)} (dd.mm.rrrr)`} value={date(p.interviewDate)} last />
      </View>
      <View style={s.table}>
        <Text style={s.head} minPresenceAhead={40}>OKRES, W KTÓRYM OCENIANY PODLEGAŁ OCENIE</Text>
        <LabelRow label={`OD${fn(6)} (dd.mm.rrrr)`} value={date(p.periodStart)} />
        <LabelRow label={`DO${fn(7)} (dd.mm.rrrr)`} value={date(p.periodEnd)} last />
      </View>

      <ScoresTable title="KRYTERIA OBOWIĄZKOWE" note={fn(8)} criteria={mandatory} />
      <ScoresTable title={`KRYTERIA DODATKOWE WYBRANE PRZEZ OCENIAJĄCEGO${fn(9)}`} note={fn(8)} criteria={additional} />

      <View style={s.table} wrap={false}>
        <LabelRow label="Średnia arytmetyczna z ocen cząstkowych przyznanych za poszczególne kryteria oceny:" value={formatAverage(p.average)} last />
      </View>

      <View style={s.table} wrap={false}>
        <Text style={s.head} minPresenceAhead={40}>PRZYZNANIE OCENY (należy wstawić znak „X” w odpowiednie pole)</Text>
        <View style={s.row}>
          <Text style={[s.cell, s.bold, { width: "40%" }]}>Liczba punktów stanowiąca średnią arytmetyczną ze wszystkich ocen cząstkowych</Text>
          <Text style={[s.cell, s.bold, { width: "45%" }]}>Ogólny poziom spełnienia kryteriów oceny</Text>
          <Text style={[s.cellLast, s.bold, s.center, { width: "15%" }]}>X</Text>
        </View>
        {OVERALL_ROWS.map((r, i) => (
          <View key={r.level} style={i === OVERALL_ROWS.length - 1 ? s.rowLast : s.row}>
            <Text style={[s.cell, { width: "40%" }]}>{r.range}</Text>
            <Text style={[s.cell, { width: "45%" }]}>{levelLabel(r.level)}</Text>
            <Text style={[s.cellLast, s.mark, { width: "15%" }]}>{p.overallLevel === r.level ? "X" : ""}</Text>
          </View>
        ))}
      </View>

      <View style={s.table} wrap={false}>
        <Text style={s.head} minPresenceAhead={40}>OCENA OKRESOWA W SŁUŻBIE CYWILNEJ</Text>
        <View style={s.rowLast}>
          <Text style={[s.cell, { width: "35%" }]}>POZYTYWNA{fn(10)}</Text>
          <Text style={[s.cell, s.mark, { width: "15%" }]}>{p.result === "POZYTYWNA" ? "X" : ""}</Text>
          <Text style={[s.cell, { width: "35%" }]}>NEGATYWNA{fn(11)}</Text>
          <Text style={[s.cellLast, s.mark, { width: "15%" }]}>{p.result === "NEGATYWNA" ? "X" : ""}</Text>
        </View>
      </View>

      <View style={s.table}>
        <Text style={s.head} minPresenceAhead={40}>UZASADNIENIE PRZYZNANEJ OCENY OKRESOWEJ{fn(12)}</Text>
        <View style={s.block}>
          <V>{p.justification}</V>
        </View>
      </View>
      <View style={s.table}>
        <Text style={s.head} minPresenceAhead={40}>WNIOSKI DOTYCZĄCE INDYWIDUALNEGO PROGRAMU ROZWOJU ZAWODOWEGO{fn(13)}</Text>
        <View style={s.block}>
          <V>{p.developmentPlan}</V>
        </View>
      </View>

      <View style={s.table} wrap={false}>
        <Text style={s.head} minPresenceAhead={40}>DANE DOTYCZĄCE POPRZEDNIEJ OCENY OKRESOWEJ URZĘDNIKA SŁUŻBY CYWILNEJ</Text>
        <LabelRow label={`Ocena${fn(14)}`} value={p.previous ? RESULT_LABELS[p.previous.result].replace("ocena ", "") : null} />
        <LabelRow label={`Poziom${fn(15)}`} value={p.previous ? levelLabel(p.previous.level) : null} />
        <LabelRow label="Data sporządzenia (dd.mm.rrrr)" value={p.previous ? date(p.previous.date) : null} last />
      </View>

      <View style={s.table} wrap={false}>
        <Text style={s.head} minPresenceAhead={40}>CZY DO OCENY OKRESOWEJ DOŁĄCZONO WNIOSEK O PRZYZNANIE KOLEJNEGO STOPNIA SŁUŻBOWEGO?{fn(16)}</Text>
        <View style={s.rowLast}>
          <Text style={[s.cell, { width: "20%" }]}>TAK</Text>
          <Text style={[s.cell, s.mark, { width: "10%" }]}>{p.promotion === "TAK" ? "X" : ""}</Text>
          <Text style={[s.cell, { width: "20%" }]}>NIE</Text>
          <Text style={[s.cell, s.mark, { width: "10%" }]}>{p.promotion === "NIE" ? "X" : ""}</Text>
          <Text style={[s.cell, { width: "30%" }]}>NIE DOTYCZY (oceniany jest pracownikiem służby cywilnej)</Text>
          <Text style={[s.cellLast, s.mark, { width: "10%" }]}>{p.promotion === "NIE_DOTYCZY" ? "X" : ""}</Text>
        </View>
      </View>

      <PersonTable title="DANE OCENIAJĄCEGO" p={data.evaluator} />
      <Signatures items={[{ caption: "miejscowość" }, { caption: "data (dd.mm.rrrr)", value: date(p.periodEnd) }, { caption: "podpis oceniającego" }]} />

      <View wrap={false}>
        <Text>{ZAPOZNANIE_Z_OCENA}</Text>
        <Signatures
          items={[
            { caption: "miejscowość" },
            { caption: "data (dd.mm.rrrr)", value: date(p.acknowledgedAt) },
            { caption: "imię i nazwisko lub pieczątka ocenianego", value: `${data.employee.firstName} ${data.employee.lastName}` },
            { caption: "podpis ocenianego" },
          ]}
        />
      </View>

      <View wrap={false} style={{ marginTop: 6 }}>
        <Text style={s.bold}>Pouczenie</Text>
        <Text>
          {POUCZENIE}
          {fn(17)}.
        </Text>
      </View>
      <Footnotes sheet={data.sheet} numbers={PRZYPISY_CZESCI.II} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Część III
// ---------------------------------------------------------------------------

function PartIII({ data }: { data: SheetData }) {
  const p = data.partIII!;
  return (
    <>
      <Text style={s.part}>CZĘŚĆ III{fn(18)}</Text>
      <Text style={{ marginBottom: 8 }}>{WSTEP_CZESCI_III}</Text>
      <View style={s.table} wrap={false}>
        <Text style={s.head} minPresenceAhead={40}>DANE URZĘDNIKA SŁUŻBY CYWILNEJ</Text>
        <LabelRow label="Imię" value={data.employee.firstName} />
        <LabelRow label="Nazwisko" value={data.employee.lastName} />
        <LabelRow label="Rok mianowania (rrrr)" value={p.appointmentYear} />
        <LabelRow label="Posiadany stopień służbowy" value={p.serviceGrade} />
        <LabelRow label="Data przyznania stopnia służbowego (dd.mm.rrrr)" value={date(p.serviceGradeDate)} last />
      </View>
      <View style={s.table}>
        <Text style={s.head} minPresenceAhead={40}>WNIOSEK O PRZYZNANIE URZĘDNIKOWI SŁUŻBY CYWILNEJ KOLEJNEGO STOPNIA SŁUŻBOWEGO</Text>
        <View style={s.block}>
          <Text>
            W związku z uzyskaniem przez Panią/Pana {data.employee.firstName} {data.employee.lastName} pozytywnej oceny okresowej, na podstawie art. 89
            ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej wnioskuję o przyznanie {p.requestedGrade ?? "……….…"} stopnia służbowego.
          </Text>
          <Text style={[s.bold, { marginTop: 6 }]}>Umotywowanie wniosku</Text>
          <V>{p.justification}</V>
        </View>
      </View>
      <Signatures
        items={[
          { caption: "miejscowość" },
          { caption: "data (dd.mm.rrrr)", value: date(data.partII?.periodEnd) },
          { caption: "imię i nazwisko lub pieczątka oceniającego", value: `${data.evaluator.firstName} ${data.evaluator.lastName}`.trim() || null },
          { caption: "podpis oceniającego" },
        ]}
      />
      <Footnotes sheet={data.sheet} numbers={PRZYPISY_CZESCI.III} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Dokument
// ---------------------------------------------------------------------------

export function PageNumber() {
  return <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `strona ${pageNumber} z ${totalPages}`} fixed />;
}

export function ArkuszOkresowyPdf({ data }: { data: SheetData }) {
  const name = `${data.employee.firstName} ${data.employee.lastName}`;
  return (
    <Document
      title={`Arkusz ${data.sheet} – ocena okresowa – ${name}${data.variant === "CZESC_I" ? " (część I)" : ""}`}
      author="Kompas Kompetencji"
      language="pl"
    >
      <Page size="A4" style={s.page}>
        <Header data={data} />
        <PartI data={data} />
        <PageNumber />
      </Page>
      {data.partII && (
        <Page size="A4" style={s.page}>
          <PartII data={data} />
          <PageNumber />
        </Page>
      )}
      {data.partIII && (
        <Page size="A4" style={s.page}>
          <PartIII data={data} />
          <PageNumber />
        </Page>
      )}
    </Document>
  );
}

/** Gotowy plik PDF arkusza. */
export async function renderSheetPdf(data: SheetData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ArkuszOkresowyPdf data={data} />);
}
