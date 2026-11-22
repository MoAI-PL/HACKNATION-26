// Dziennik decyzji (Z35): wpisy AuditLog – propozycje AI obok decyzji człowieka – z filtrami i eksportem CSV.
// Czysta logika (etykiety, filtry, CSV); zapytanie do bazy jest w trasie i na stronie panelu HR.

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { isIsoDate, toDbDate } from "@/lib/domain/daty";
import { addDays } from "@/lib/rules/kalendarz";

/** Nazwy działań w dzienniku (AuditLog.action) zwykłym językiem. Nieznane kody pokazujemy bez zmian. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  AI_WSTAW: "Propozycja AI wstawiona",
  AI_ODRZUC: "Propozycja AI odrzucona",
  ZMIANA_SUGESTII: "Ocena cząstkowa inna niż sugestia",
  ZMIANA_ARKUSZA: "Zmiana arkusza wskazanego przez OSP",
  USTALENIE_KRYTERIOW: "Ustalenie kryteriów (część I)",
  SPORZADZENIE_OCENY: "Sporządzenie oceny",
  ZAPOZNANIE_Z_OCENA: "Zapoznanie ocenianego z oceną",
  IMPORT_OSP: "Wczytanie opisu stanowiska",
  DODANIE_PRACOWNIKA: "Dodanie pracownika",
  PRZYPOMNIENIE_WYSLANE: "Wysłane przypomnienie",
  EDYCJA_PRZEPISOW: "Zmiana parametrów przepisów",
  EDYCJA_MODELU: "Zmiana opisów zachowań w modelu kompetencji",
  RESET_DEMO: "Reset danych demo",
  LOGOWANIE: "Logowanie",
};

export function actionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const AUDIT_KINDS = ["decyzje", "ai", "logowania", "wszystkie"] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export const AUDIT_KIND_LABELS: Record<AuditKind, string> = {
  decyzje: "Decyzje (bez logowań)",
  ai: "Tylko propozycje AI",
  logowania: "Logowania",
  wszystkie: "Wszystkie wpisy",
};

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && isIsoDate(v) ? v : undefined));

/** Filtry z adresu (?rodzaj=ai&od=2026-11-01&do=2026-11-21). Niepoprawne wartości pomijamy. */
export const auditFilterSchema = z.object({
  rodzaj: z.enum(AUDIT_KINDS).catch("decyzje").default("decyzje"),
  od: optionalDate,
  do: optionalDate,
});
/** Filtry dziennika: rodzaj wpisów i opcjonalny zakres dat (włącznie). */
export interface AuditFilters {
  rodzaj: AuditKind;
  od?: string;
  do?: string;
}

export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return auditFilterSchema.parse({ rodzaj: first(params.rodzaj), od: first(params.od), do: first(params.do) });
}

/** Filtry → warunek zapytania (daty włącznie, w strefie UTC jak kolumny @db.Date). */
export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.rodzaj === "decyzje") where.action = { not: "LOGOWANIE" };
  if (f.rodzaj === "ai") where.action = { in: ["AI_WSTAW", "AI_ODRZUC"] };
  if (f.rodzaj === "logowania") where.action = "LOGOWANIE";
  if (f.od || f.do) {
    where.createdAt = {
      ...(f.od ? { gte: toDbDate(f.od) } : {}),
      ...(f.do ? { lt: toDbDate(addDays(f.do, 1)) } : {}),
    };
  }
  return where;
}

/** Adres z filtrami, np. do przycisku eksportu. */
export function auditQuery(f: AuditFilters): string {
  const p = new URLSearchParams();
  if (f.rodzaj !== "decyzje") p.set("rodzaj", f.rodzaj);
  if (f.od) p.set("od", f.od);
  if (f.do) p.set("do", f.do);
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// Wiersze i CSV
// ---------------------------------------------------------------------------

export interface AuditRow {
  createdAt: Date;
  userName: string | null;
  userRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  aiProposal: unknown;
  humanDecision: unknown;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
}

/** Wartość JSON w jednej linii do tabeli i CSV (puste = ""). */
export function compactJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Data i godzina w strefie Europe/Warsaw: „21.11.2026 14:32”. */
export function formatDateTimePl(d: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(",", "");
}

export const CSV_COLUMNS = [
  "Data i godzina",
  "Kto",
  "Rola",
  "Działanie",
  "Kod działania",
  "Obiekt",
  "Id obiektu",
  "Propozycja AI",
  "Decyzja człowieka",
  "Stara wartość",
  "Nowa wartość",
  "Powód",
] as const;

/** Pole CSV: średnik jako separator (Excel w polskich ustawieniach), cudzysłowy podwajane, znaki nowej linii zachowane. */
export function csvField(value: string): string {
  // Ochrona przed formułami w arkuszu (CSV injection): komórka zaczynająca się od = + - @ dostaje apostrof.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Pełny plik CSV z BOM (polskie znaki w Excelu) i końcami linii CRLF (RFC 4180). */
export function auditCsv(rows: readonly AuditRow[]): string {
  const lines = [CSV_COLUMNS.map(csvField).join(";")];
  for (const r of rows) {
    lines.push(
      [
        formatDateTimePl(r.createdAt),
        r.userName ?? "",
        r.userRole ?? "",
        actionLabel(r.action),
        r.action,
        r.entity,
        r.entityId ?? "",
        compactJson(r.aiProposal),
        compactJson(r.humanDecision),
        compactJson(r.oldValue),
        compactJson(r.newValue),
        r.reason ?? "",
      ]
        .map(csvField)
        .join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
