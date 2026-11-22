// Dziennik decyzji (Z35): filtry, etykiety, CSV (Excel, polskie znaki, ochrona przed formułami), dostęp tylko dla HR.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, findManyMock } = vi.hoisted(() => ({ authMock: vi.fn(), findManyMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: { auditLog: { findMany: findManyMock } } }));

import { GET as csvRoute } from "@/app/(hr)/hr/dziennik/csv/route";
import { actionLabel, auditCsv, auditQuery, auditWhere, csvField, parseAuditFilters, type AuditRow } from "@/lib/audit/dziennik";

const wpis = (zmiany: Partial<AuditRow> = {}): AuditRow => ({
  createdAt: new Date("2026-11-21T13:32:00Z"),
  userName: "Ewa Kowalczyk",
  userRole: "PRZELOZONY",
  action: "AI_WSTAW",
  entity: "Evaluation",
  entityId: "ev1",
  aiProposal: { funkcja: "KRYTERIA_DODATKOWE_Z_OSP", propozycja: ["ANALITYCZNE"] },
  humanDecision: { decyzja: "WSTAW" },
  oldValue: null,
  newValue: null,
  reason: null,
  ...zmiany,
});

describe("filtry", () => {
  it("domyślnie decyzje bez logowań; niepoprawne wartości są pomijane", () => {
    expect(parseAuditFilters({})).toEqual({ rodzaj: "decyzje", od: undefined, do: undefined });
    expect(parseAuditFilters({ rodzaj: "cos", od: "2026-02-30", do: "2026-11-21" })).toEqual({ rodzaj: "decyzje", od: undefined, do: "2026-11-21" });
  });

  it("warunki zapytania: rodzaj i zakres dat włącznie", () => {
    expect(auditWhere({ rodzaj: "decyzje" })).toEqual({ action: { not: "LOGOWANIE" } });
    expect(auditWhere({ rodzaj: "ai" })).toEqual({ action: { in: ["AI_WSTAW", "AI_ODRZUC"] } });
    expect(auditWhere({ rodzaj: "wszystkie", od: "2026-11-01", do: "2026-11-21" })).toEqual({
      createdAt: { gte: new Date("2026-11-01T00:00:00Z"), lt: new Date("2026-11-22T00:00:00Z") },
    });
  });

  it("adres eksportu z tymi samymi filtrami", () => {
    expect(auditQuery({ rodzaj: "decyzje" })).toBe("");
    expect(auditQuery({ rodzaj: "ai", od: "2026-11-01" })).toBe("?rodzaj=ai&od=2026-11-01");
  });
});

describe("CSV", () => {
  it("BOM, średnik, CRLF, nagłówek i data w czasie polskim", () => {
    const csv = auditCsv([wpis()]);
    expect(csv.startsWith("﻿Data i godzina;Kto;Rola;Działanie;")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const linia = csv.split("\r\n")[1]!;
    expect(linia).toContain("21.11.2026 14:32;Ewa Kowalczyk;PRZELOZONY;Przyjęto propozycję AI;AI_WSTAW;Evaluation;ev1;");
    expect(linia).toContain('"{""funkcja"":""KRYTERIA_DODATKOWE_Z_OSP""');
  });

  it("pola ze średnikiem, cudzysłowem i nową linią są w cudzysłowach", () => {
    expect(csvField("zwykły tekst")).toBe("zwykły tekst");
    expect(csvField('opinia; „cytat” i "x"')).toBe('"opinia; „cytat” i ""x"""');
    expect(csvField("linia 1\nlinia 2")).toBe('"linia 1\nlinia 2"');
  });

  it("ochrona przed formułami w arkuszu (CSV injection)", () => {
    expect(csvField("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvField("+48 600")).toBe("'+48 600");
    expect(csvField("-5")).toBe("'-5");
  });

  it("etykiety działań, nieznane kody bez zmian", () => {
    expect(actionLabel("ZMIANA_SUGESTII")).toBe("Ocena cząstkowa inna niż sugestia");
    expect(actionLabel("NOWY_KOD")).toBe("NOWY_KOD");
  });
});

describe("GET /hr/dziennik/csv", () => {
  beforeEach(() => {
    authMock.mockReset();
    findManyMock.mockReset().mockResolvedValue([]);
  });
  const ctx = { params: Promise.resolve({}) };
  const req = (q = "") => new Request(`http://localhost/hr/dziennik/csv${q}`);

  it("bez sesji 401, przełożony 403 – bez zapytania do bazy", async () => {
    authMock.mockResolvedValue(null);
    expect((await csvRoute(req(), ctx)).status).toBe(401);
    authMock.mockResolvedValue({ user: { id: "ewa", role: "PRZELOZONY", name: "Ewa" } });
    expect((await csvRoute(req(), ctx)).status).toBe(403);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("HR: plik CSV z filtrami z adresu", async () => {
    authMock.mockResolvedValue({ user: { id: "hr", role: "HR", name: "HR" } });
    findManyMock.mockResolvedValue([
      { ...wpis(), user: { name: "Ewa Kowalczyk", role: "PRZELOZONY" }, id: "a1", userId: "ewa" },
    ]);
    const res = await csvRoute(req("?rodzaj=ai"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="dziennik-decyzji-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(findManyMock.mock.calls[0][0].where).toEqual({ action: { in: ["AI_WSTAW", "AI_ODRZUC"] } });
    expect(await res.text()).toContain("Przyjęto propozycję AI");
  });
});
