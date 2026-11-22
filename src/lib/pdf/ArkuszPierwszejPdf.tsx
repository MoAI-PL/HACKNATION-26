// Dokument PDF arkusza pierwszej oceny w służbie cywilnej (Z17) – układ wzoru z załącznika nr 2 do rozporządzenia
// (materialy/pierwsza-ocena/Arkusz_pierwszej_oceny.docx). Czcionka, style i drobne elementy – wspólne z arkuszami B/C (Z16).
// Strona 1: część ogólna, rozmowa wstępna i oceniająca; strona 2: oceny elementów, wynik, uzasadnienie, wnioski i podpisy.

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ExamResult } from "@/lib/domain/types";
import { LabelRow, PageNumber, Signatures, V, date, fn, registerFonts, s } from "./ArkuszOkresowyPdf";
import type { SheetPerson } from "./arkusz";
import type { FirstSheetData } from "./arkusz-pierwszej";
import {
  KOLUMNY_PIERWSZEJ,
  NAGLOWEK_ELEMENTOW,
  POTWIERDZENIE_OCENIAJACEJ,
  POTWIERDZENIE_WSTEPNEJ,
  PRZYPISY_PIERWSZEJ,
  TYTUL_PIERWSZEJ,
  ZAPOZNANIE_PIERWSZA,
} from "./teksty-pierwszej";

// Arkusz pierwszej oceny ma więcej pól na stronie niż B/C – nieco gęstszy układ, żeby każda strona wzoru zmieściła się na A4.
const local = StyleSheet.create({
  page: { ...s.page, fontSize: 7.6, paddingTop: 20, paddingBottom: 28 },
  title: { ...s.title, lineHeight: 1.4, marginBottom: 4 },
  part: { ...s.part, lineHeight: 1.4 },
  gap: { marginTop: 8 },
});
const page = local.page;

const range = (r: { from: string; to: string } | null) => (r ? `od ${date(r.from)} – do ${date(r.to)}` : null);
const fullName = (p: SheetPerson) => `${p.firstName} ${p.lastName}`.trim() || null;

function Footnotes({ numbers }: { numbers: number[] }) {
  return (
    <View style={s.footnotes}>
      {numbers.map((n) => (
        <Text key={n} style={s.footnote}>
          {n}) {PRZYPISY_PIERWSZEJ[n]}
        </Text>
      ))}
    </View>
  );
}

function PersonTable({ title, p, extra }: { title: string; p: SheetPerson; extra?: { label: string; value: string | null } }) {
  return (
    <View style={s.table} wrap={false}>
      <Text style={s.head} minPresenceAhead={40}>{title}</Text>
      <LabelRow label="Imię" value={p.firstName} />
      <LabelRow label="Nazwisko" value={p.lastName} />
      <LabelRow label="Komórka organizacyjna" value={p.orgUnit} />
      <LabelRow label="Stanowisko pracy" value={p.position} last={!extra} />
      {extra && <LabelRow label={extra.label} value={extra.value} last />}
    </View>
  );
}

/** Pole wyboru „X” jak we wzorze: etykieta i kratka. */
function Choices({ title, options }: { title: string; options: { label: string; checked: boolean }[] }) {
  return (
    <View style={s.table} wrap={false}>
      <Text style={s.head}>{title}</Text>
      <View style={s.rowLast}>
        {options.map((o, i) => (
          <View key={o.label} style={[i < options.length - 1 ? s.cell : s.cellLast, { flex: 1, flexDirection: "row", justifyContent: "space-between" }]}>
            <Text style={s.bold}>{o.label}</Text>
            <Text style={[s.mark, { width: 16, borderWidth: 0.75, borderColor: "#000000" }]}>{o.checked ? "X" : " "}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PageOne({ data }: { data: FirstSheetData }) {
  return (
    <>
      <Text style={s.annex}>Załącznik nr 2</Text>
      <Text style={local.title}>{TYTUL_PIERWSZEJ}</Text>
      <Text style={local.part}>CZĘŚĆ OGÓLNA</Text>
      <View style={s.table}>
        <LabelRow label="NAZWA URZĘDU" value={data.office} last />
      </View>
      <PersonTable
        title="DANE OCENIANEGO"
        p={data.employee}
        extra={{ label: `Data nawiązania stosunku pracy${fn(1)} (dd.mm.rrrr)`, value: date(data.employee.employmentStart) }}
      />
      <PersonTable title="DANE BEZPOŚREDNIEGO PRZEŁOŻONEGO" p={data.evaluator} />
      <PersonTable title="DANE KIERUJĄCEGO KOMÓRKĄ ORGANIZACYJNĄ" p={data.unitHead} />

      <View style={s.table} wrap={false}>
        <Text style={s.head}>ROZMOWA WSTĘPNA</Text>
        <LabelRow label="Data przeprowadzenia rozmowy wstępnej (dd.mm.rrrr)" value={date(data.initialConversation)} />
        <LabelRow
          label="Termin wyznaczony na złożenie sprawozdania dotyczącego zadań realizowanych przez ocenianego w trakcie przepracowanego okresu"
          value={range(data.reportDue)}
        />
        <LabelRow label="Okres, w którym powinna zostać dokonana pierwsza ocena w służbie cywilnej" value={range(data.window)} last />
      </View>
      <View wrap={false}>
        <Text>{POTWIERDZENIE_WSTEPNEJ}</Text>
        <Signatures compact
          items={[{ caption: "miejscowość" }, { caption: "data (dd.mm.rrrr)", value: date(data.initialConversation) }, { caption: "podpis bezpośredniego przełożonego" }]}
        />
        <Signatures compact items={[{ caption: "miejscowość" }, { caption: "data (dd.mm.rrrr)", value: date(data.initialConversation) }, { caption: "podpis ocenianego" }]} />
      </View>

      <View style={s.table} wrap={false}>
        <Text style={s.head}>ROZMOWA OCENIAJĄCA</Text>
        <LabelRow label="Data przeprowadzenia rozmowy oceniającej (dd.mm.rrrr)" value={date(data.interviewDate)} last />
      </View>
      <View wrap={false}>
        <Text>
          {POTWIERDZENIE_OCENIAJACEJ}
          {fn(2)}.
        </Text>
        <Signatures compact
          items={[
            { caption: "miejscowość" },
            { caption: "data (dd.mm.rrrr)", value: date(data.interviewDate) },
            { caption: "imię i nazwisko lub pieczątka bezpośredniego przełożonego", value: fullName(data.evaluator) },
            { caption: "podpis bezpośredniego przełożonego" },
          ]}
        />
        <Signatures compact
          items={[
            { caption: "miejscowość" },
            { caption: "data (dd.mm.rrrr)", value: date(data.interviewDate) },
            { caption: "imię i nazwisko lub pieczątka ocenianego", value: fullName(data.employee) },
            { caption: "podpis ocenianego" },
          ]}
        />
      </View>
      <Footnotes numbers={[1, 2]} />
    </>
  );
}

const EXAM_OPTIONS: { value: ExamResult; label: string }[] = [
  { value: "ZDANY", label: "TAK" },
  { value: "NIEZDANY", label: "NIE" },
  { value: "NIE_DOTYCZY", label: `NIE DOTYCZY${fn(5)}` },
];

function PageTwo({ data }: { data: FirstSheetData }) {
  const ev = data.evaluation;
  const elements = ev?.elements ?? [
    "Rzetelność",
    "Wykorzystywanie wiedzy i doskonalenie zawodowe",
    "Organizacja pracy i orientacja na osiąganie celów",
    "Komunikacja",
    "Współpraca",
  ].map((name) => ({ name, points: null }));
  return (
    <>
      <Text style={local.part}>{NAGLOWEK_ELEMENTOW}</Text>
      <View style={s.table} wrap={false}>
        <View style={s.row}>
          <Text style={[s.cell, s.bold, { width: "46%" }]}>ELEMENTY OCENY{fn(3)}</Text>
          <Text style={[s.cellLast, s.bold, s.center, { width: "54%" }]}>OCENA CZĄSTKOWA (należy wstawić znak „X” w odpowiednie pole)</Text>
        </View>
        <View style={s.row}>
          <Text style={[s.cell, { width: "46%" }]} />
          {KOLUMNY_PIERWSZEJ.map((c, i) => (
            <Text key={c.points} style={[i < 2 ? s.cell : s.cellLast, s.center, s.small, { width: "18%" }]}>
              {c.label}
              {"\n"}
              {c.unit}
            </Text>
          ))}
        </View>
        {elements.map((el) => (
          <View key={el.name} style={s.row}>
            <Text style={[s.cell, { width: "46%" }]}>{el.name}</Text>
            {KOLUMNY_PIERWSZEJ.map((c, i) => (
              <Text key={c.points} style={[i < 2 ? s.cell : s.cellLast, s.mark, { width: "18%" }]}>
                {el.points === c.points ? "X" : ""}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.rowLast}>
          <Text style={[s.cell, s.bold, { width: "46%" }]}>OCENA ŁĄCZNA{fn(4)}</Text>
          <View style={[s.cellLast, { width: "54%" }]}>
            <V>{ev?.average != null ? `${ev.average.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} pkt` : null}</V>
          </View>
        </View>
      </View>

      <Text style={local.part}>PIERWSZA OCENA W SŁUŻBIE CYWILNEJ</Text>
      <Choices
        title="OCENIANY ZALICZYŁ EGZAMIN ZE SŁUŻBY PRZYGOTOWAWCZEJ (należy wstawić znak „X” w odpowiednie pole)"
        options={EXAM_OPTIONS.map((o) => ({ label: o.label, checked: ev?.exam === o.value }))}
      />
      <Choices
        title="SPRAWOZDANIE ZOSTAŁO ZŁOŻONE W WYZNACZONYM TERMINIE (należy wstawić znak „X” w odpowiednie pole)"
        options={[
          { label: "TAK", checked: !!ev && ev.reportOnTime },
          { label: "NIE", checked: !!ev && !ev.reportOnTime },
        ]}
      />
      <Choices
        title="PIERWSZA OCENA W SŁUŻBIE CYWILNEJ (należy wstawić znak „X” w odpowiednie pole)"
        options={[
          { label: `POZYTYWNA${fn(6)}`, checked: ev?.result === "POZYTYWNA" },
          { label: "NEGATYWNA", checked: ev?.result === "NEGATYWNA" },
        ]}
      />
      <View style={s.table} wrap={false}>
        <Text style={s.head}>UZASADNIENIE PRZYZNANEJ OCENY{fn(7)}</Text>
        <View style={s.block}>
          <V>{ev ? ev.justification || "—" : null}</V>
        </View>
      </View>
      <View style={s.table} wrap={false}>
        <Text style={s.head}>WNIOSKI DOTYCZĄCE ROZWOJU ZAWODOWEGO OCENIANEGO{fn(8)}</Text>
        <View style={s.block}>
          <V>{ev ? ev.developmentPlan || "—" : null}</V>
        </View>
      </View>

      <View wrap={false}>
        <Text style={s.bold}>POTWIERDZENIE DOKONANIA PIERWSZEJ OCENY W SŁUŻBIE CYWILNEJ</Text>
        <Signatures compact
          items={[
            { caption: "miejscowość" },
            { caption: "data (dd.mm.rrrr)", value: date(ev?.evaluatedAt) },
            { caption: "imię i nazwisko lub pieczątka bezpośredniego przełożonego", value: fullName(data.evaluator) },
            { caption: "podpis bezpośredniego przełożonego" },
          ]}
        />
        <Signatures compact
          items={[
            { caption: "miejscowość" },
            { caption: "data (dd.mm.rrrr)", value: date(ev?.evaluatedAt) },
            { caption: "imię i nazwisko lub pieczątka kierującego komórką organizacyjną", value: fullName(data.unitHead) },
            { caption: "podpis kierującego komórką organizacyjną" },
          ]}
        />
      </View>
      <View wrap={false} style={local.gap}>
        <Text>{ZAPOZNANIE_PIERWSZA}</Text>
        <Signatures compact
          items={[
            { caption: "miejscowość" },
            { caption: "data (dd.mm.rrrr)", value: date(ev?.acknowledgedAt) },
            { caption: "imię i nazwisko lub pieczątka ocenianego", value: fullName(data.employee) },
            { caption: "podpis ocenianego" },
          ]}
        />
      </View>
      <Footnotes numbers={[3, 4, 5, 6, 7, 8]} />
    </>
  );
}

export function ArkuszPierwszejPdf({ data }: { data: FirstSheetData }) {
  return (
    <Document title={`Arkusz pierwszej oceny – ${data.employee.firstName} ${data.employee.lastName}`} author="Kompas Kompetencji" language="pl">
      <Page size="A4" style={page}>
        <PageOne data={data} />
        <PageNumber />
      </Page>
      <Page size="A4" style={page}>
        <PageTwo data={data} />
        <PageNumber />
      </Page>
    </Document>
  );
}

export async function renderFirstSheetPdf(data: FirstSheetData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ArkuszPierwszejPdf data={data} />);
}
