// Dziennik decyzji (Z35): wpis AuditLog zwykłym językiem – dla HR na ekranie, zamiast surowego JSON.
// Eksport CSV zostaje z pełnymi danymi (JSON), bo służy do dalszej obróbki.
//
// Zasada: znane rodzaje wpisów opisujemy wprost („Arkusz C · rozmowa 15.12.2024”), nieznane – ogólnie
// („klucz: wartość”), z kodami zamienionymi na nazwy ze słownika. Identyfikatory techniczne pomijamy.

import {
  COMPETENCY_NAMES,
  CONVERSATION_TYPE_LABELS,
  CRITERION_KIND_LABELS,
  EXAM_EXEMPTION_LABELS,
  EXAM_RESULT_LABELS,
  LEVEL_LABELS,
  RESULT_LABELS,
  ROLE_LABELS,
} from "@/lib/domain/slownik";
import { describeChange } from "@/lib/konfiguracja/pola";
import type { AuditRow } from "./dziennik";

/** Linia opisu: zwykły tekst albo nagłówek z listą (każdy element w osobnej linijce, np. oceny kryteriów). */
export type DescLine = string | { label: string; items: string[] };

export interface AuditDescription {
  /** Propozycja AI (pusta, gdy wpis nie dotyczy AI). */
  ai: DescLine[];
  /** Decyzja człowieka albo zmiana. */
  decision: DescLine[];
}

const AI_FUNCTIONS: Record<string, string> = {
  KRYTERIA_DODATKOWE_Z_OSP: "Kryteria dodatkowe z opisu stanowiska",
  ASYSTENT_ROZMOWY: "Asystent rozmowy",
  SZYBKA_NOTATKA: "Szybka notatka",
  ASYSTENT_JEZYKA: "Asystent języka",
  SZKIC_UZASADNIENIA: "Szkic uzasadnienia",
};

const KEY_LABELS: Record<string, string> = {
  data: "Data",
  plik: "Plik",
  arkusz: "Arkusz",
  sheet: "Arkusz",
  kryterium: "Kryterium",
  element: "Element",
  sprawozdanieOd: "Sprawozdanie od",
  sprawozdanieDo: "Sprawozdanie do",
  sprawozdanie: "Sprawozdanie",
  sprawozdanieWTerminie: "Sprawozdanie w terminie",
  egzamin: "Egzamin",
  zwolnienie: "Zwolnienie z egzaminu",
  wskaznik: "Wskaźnik",
  poziom: "Poziom",
  sytuacja: "Sytuacja",
  dzialanie: "Działanie",
  rezultat: "Rezultat",
  firstName: "Imię",
  lastName: "Nazwisko",
  evaluationType: "Rodzaj oceny",
  employmentStart: "Zatrudnienie od",
  ospFile: "Opis stanowiska",
  potwierdzil: "Potwierdził",
  wniosekOStopien: "Wniosek o stopień",
  terminOceny: "Termin oceny",
  dataRozmowy: "Rozmowa",
  pole: "Pole",
  oryginal: "Było",
  propozycja: "Propozycja",
  rozmowa: "Rozmowa",
};

// Klucze techniczne (identyfikatory, czasy działania), które nic nie mówią osobie z HR.
const HIDDEN_KEY = /(^id$|Id$|^pracownik$|^model$|^durationMs$|^tryb$|^funkcja$|^symulacja$)/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** „2024-12-15” → „15.12.2024”. */
export function plDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

function plDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(d)
    .replace(",", "");
}

/** Skrót długiego tekstu na ekran (pełna treść jest w CSV). */
export function shorten(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t;
}

/** Kod wskaźnika „KOMUNIKACJA.3” → „Komunikacja, wskaźnik 3”. */
function indicatorName(code: string): string | null {
  const m = /^([A-Z_]+)\.(\d+)$/.exec(code);
  if (!m || !(m[1]! in COMPETENCY_NAMES)) return null;
  return `${COMPETENCY_NAMES[m[1] as keyof typeof COMPETENCY_NAMES]}, wskaźnik ${m[2]}`;
}

/** Pojedyncza wartość: kody → nazwy ze słownika, daty po polsku, tak/nie. */
export function plainValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "tak" : "nie";
  if (typeof v === "number") return String(Math.round(v * 100) / 100).replace(".", ",");
  if (typeof v === "string") {
    if (ISO_DATE.test(v)) return plDate(v);
    if (ISO_DATETIME.test(v)) return plDateTime(v);
    const dict: Record<string, string>[] = [COMPETENCY_NAMES, LEVEL_LABELS, RESULT_LABELS, CRITERION_KIND_LABELS, EXAM_EXEMPTION_LABELS];
    for (const d of dict) if (v in d) return d[v]!;
    if (v in ROLE_LABELS) return ROLE_LABELS[v as keyof typeof ROLE_LABELS].toLocaleLowerCase("pl");
    if (v in EXAM_RESULT_LABELS) return EXAM_RESULT_LABELS[v as keyof typeof EXAM_RESULT_LABELS].toLocaleLowerCase("pl");
    if (v === "PIERWSZA") return "pierwsza ocena";
    if (v === "OKRESOWA") return "ocena okresowa";
    return indicatorName(v) ?? shorten(v);
  }
  if (Array.isArray(v)) return v.map(plainValue).join(", ");
  if (isObject(v)) return plainFields(v).join(" · ");
  return String(v);
}

/** Obiekt → „Etykieta: wartość” dla każdego pola (bez pól technicznych). */
export function plainFields(obj: Record<string, unknown>): string[] {
  return Object.entries(obj)
    .filter(([k, v]) => !HIDDEN_KEY.test(k) && v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${KEY_LABELS[k] ?? k}: ${plainValue(v)}`);
}

const plainLines = (v: unknown): string[] => (v === null || v === undefined ? [] : isObject(v) ? plainFields(v) : [plainValue(v)]);

const comp = (code: unknown) => (typeof code === "string" ? (COMPETENCY_NAMES[code as keyof typeof COMPETENCY_NAMES] ?? code) : "—");
const pts = (n: unknown) => `${plainValue(n)} pkt`;

/** Lista kryteriów: kody albo {kryterium, rodzaj} → nazwy, dodatkowe oznaczone. */
function criteriaItems(list: unknown): string[] {
  if (!Array.isArray(list)) return [plainValue(list)];
  return list.map((c) => (isObject(c) ? `${comp(c.kryterium)}${c.rodzaj === "DODATKOWE" ? " (dodatkowe)" : ""}` : comp(c)));
}

function scoreItems(list: unknown): string[] {
  if (!Array.isArray(list)) return [plainValue(list)];
  return list.map((o) => (isObject(o) ? `${comp(o.kryterium ?? o.element)} – ${pts(o.punkty)}` : plainValue(o)));
}

// ---------------------------------------------------------------------------
// Propozycje AI
// ---------------------------------------------------------------------------

function describeAiProposal(raw: unknown): DescLine[] {
  if (!isObject(raw)) return plainLines(raw);
  const fn = typeof raw.funkcja === "string" ? raw.funkcja : "";
  const name = AI_FUNCTIONS[fn] ?? (fn ? fn.toLocaleLowerCase("pl").replace(/_/g, " ") : "Propozycja AI");
  const head = `${name}${raw.tryb === "BEZ_AI" ? " (bez AI – z reguł)" : ""}`;
  const p = raw.propozycja;
  let body: string[];
  if (fn === "KRYTERIA_DODATKOWE_Z_OSP" && Array.isArray(p)) {
    body = p.map((c) => (isObject(c) ? `${comp(c.kryterium)}${typeof c.cytat === "string" ? ` – ${shorten(c.cytat, 110)}` : ""}` : plainValue(c)));
  } else if (fn === "ASYSTENT_ROZMOWY") {
    const kind = typeof raw.rozmowa === "string" ? (CONVERSATION_TYPE_LABELS[raw.rozmowa as keyof typeof CONVERSATION_TYPE_LABELS] ?? raw.rozmowa) : null;
    body = [...(kind ? [kind] : []), ...(typeof p === "string" ? [shorten(p)] : plainLines(p))];
  } else if (typeof p === "string") {
    body = [shorten(p)];
  } else {
    body = plainLines(p);
  }
  return [head, ...body];
}

function describeAiDecision(raw: unknown, action: string): DescLine[] {
  const rejected = action === "AI_ODRZUC";
  if (!isObject(raw)) return rejected ? ["Odrzucono"] : raw ? ["Przyjęto", ...plainLines(raw)] : ["Przyjęto"];
  // Wspólny format {decyzja, wstawiono}; szybka notatka zapisuje od razu treść notatki po edycji.
  if ("decyzja" in raw) {
    if (raw.decyzja === "ODRZUC") return ["Odrzucono"];
    const w = raw.wstawiono;
    if (w === null || w === undefined) return ["Przyjęto bez zmian"];
    if (Array.isArray(w)) return [{ label: "Przyjęto", items: w.map((x) => (typeof x === "string" ? comp(x) : plainValue(x))) }];
    return ["Przyjęto po poprawkach:", typeof w === "string" ? shorten(w) : plainValue(w)];
  }
  return [rejected ? "Odrzucono" : "Przyjęto", ...plainFields(raw)];
}

// ---------------------------------------------------------------------------
// Pozostałe działania
// ---------------------------------------------------------------------------

function describeChangeRow(action: string, oldV: unknown, newV: unknown): DescLine[] {
  const o = isObject(oldV) ? oldV : {};
  const n = isObject(newV) ? newV : {};
  switch (action) {
    case "USTALENIE_KRYTERIOW":
      return [
        ...(n.arkusz ? [`Arkusz ${n.arkusz}`] : []),
        ...(n.kryteria ? [{ label: "Kryteria", items: criteriaItems(n.kryteria) }] : []),
        ...(n.dataRozmowy ? [`Rozmowa: ${plainValue(n.dataRozmowy)}`] : []),
        ...(n.terminOceny ? [`Termin oceny: ${plainValue(n.terminOceny)}`] : []),
      ];
    case "SPORZADZENIE_OCENY": {
      const avg = n.srednia ?? n.ocenaLaczna;
      const verdict = [
        typeof n.wynik === "string" ? (RESULT_LABELS[n.wynik as keyof typeof RESULT_LABELS] ?? n.wynik) : null,
        typeof n.poziom === "string" ? `(${LEVEL_LABELS[n.poziom as keyof typeof LEVEL_LABELS] ?? n.poziom})` : null,
      ]
        .filter(Boolean)
        .join(" ");
      const result = [verdict, avg !== undefined && avg !== null ? `średnia ${plainValue(avg)}` : null].filter(Boolean);
      const rest = Object.fromEntries(Object.entries(n).filter(([k]) => !["wynik", "poziom", "srednia", "ocenaLaczna", "oceny", "rodzaj"].includes(k)));
      return [
        ...(n.rodzaj === "PIERWSZA" ? ["Pierwsza ocena"] : []),
        ...(result.length ? [`Wynik: ${result.join(", ")}`] : []),
        ...(n.oceny ? [{ label: "Oceny", items: scoreItems(n.oceny) }] : []),
        ...plainFields(rest),
      ];
    }
    case "ZMIANA_SUGESTII":
      return [`${comp(n.kryterium ?? o.kryterium)}: sugestia ${pts(o.sugestia)} → ocena ${pts(n.ocena)}`];
    case "ZMIANA_ARKUSZA":
      return [`Arkusz ${plainValue(o.arkusz)} → ${plainValue(n.arkusz)}`];
    case "EDYCJA_PRZEPISOW":
    case "EDYCJA_MODELU":
      return describeChange(action, oldV, newV);
    case "PRZYPOMNIENIE_WYSLANE":
      return [`Wysłano ${typeof n.sentAt === "string" ? plDateTime(n.sentAt) : ""}${n.symulacja ? " (symulacja – bez prawdziwego e-maila)" : ""}`.trim()];
    case "RESET_DEMO":
      return ["Dane demo przywrócone do stanu początkowego"];
    case "LOGOWANIE":
      return [];
    default: {
      const before = plainLines(oldV);
      const after = plainLines(newV);
      return before.length ? [`Było: ${before.join(" · ")}`, `Jest: ${after.join(" · ")}`] : after;
    }
  }
}

/** Wpis dziennika → opis dla człowieka. */
export function describeAudit(r: Pick<AuditRow, "action" | "aiProposal" | "humanDecision" | "oldValue" | "newValue">): AuditDescription {
  if (r.action === "AI_WSTAW" || r.action === "AI_ODRZUC") {
    return { ai: describeAiProposal(r.aiProposal), decision: describeAiDecision(r.humanDecision, r.action) };
  }
  return { ai: [], decision: describeChangeRow(r.action, r.oldValue, r.newValue) };
}

/** Powód wpisany przez człowieka albo dane demo – kody kompetencji zamieniamy na nazwy („KLIENT” → „Orientacja na klienta/interesanta”). */
export function plainReason(reason: string | null): string {
  if (!reason) return "—";
  return reason.replace(/\b[A-Z][A-Z_]{3,}\b/g, (code) => COMPETENCY_NAMES[code as keyof typeof COMPETENCY_NAMES] ?? code);
}
