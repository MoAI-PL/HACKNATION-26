// REST API v1 – oceny: dostęp według ról, filtry, eksport bez danych wewnętrznych, zgodność ze specyfikacją.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const { authMock, findManyMock, findFirstMock } = vi.hoisted(() => ({ authMock: vi.fn(), findManyMock: vi.fn(), findFirstMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: { evaluation: { findMany: findManyMock, findFirst: findFirstMock } } }));

import { GET as lista } from "@/app/api/v1/oceny/route";
import { GET as eksport } from "@/app/api/v1/oceny/[id]/route";
import { evaluationScope, toEvaluationExport, type EvaluationRow } from "@/lib/api/eksport-oceny";

const zalogowany = (role: string, id = "u1") => authMock.mockResolvedValue({ user: { id, role, name: "Test" } });
const ctx = (id = "") => ({ params: Promise.resolve({ id }) });
const req = (q = "") => new Request(`http://localhost/api/v1/oceny${q}`);
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const OCENA: EvaluationRow = {
  id: "ev1",
  employeeId: "e1",
  evaluatorId: "ewa",
  type: "OKRESOWA",
  sheet: "C",
  sheetOverridden: false,
  status: "ZAKONCZONA",
  periodStart: d("2024-12-14"),
  periodEnd: d("2026-11-20"),
  dueDate: d("2026-11-30"),
  criteriaSetAt: d("2024-12-14"),
  startChecklist: null,
  expectations: null,
  goals: null,
  isReevaluation: false,
  evaluatedAt: d("2026-11-20"),
  acknowledgedAt: d("2026-11-21"),
  result: "POZYTYWNA",
  overallLevel: "POWYZEJ",
  average: 6.6,
  justification: null,
  developmentPlan: "Szkolenie z negocjacji.",
  previousResult: "POZYTYWNA",
  previousLevel: "NA_POZIOMIE",
  previousDate: d("2024-11-30"),
  promotionRequest: true,
  promotionJustification: "Prowadzi najtrudniejsze sprawy.",
  requestedGrade: 3,
  examResult: null,
  examExemption: null,
  lastWizardStep: "ocena:7",
  wizardState: { tajne: "szkic kreatora" },
  createdAt: d("2024-12-01"),
  updatedAt: d("2026-11-21"),
  employee: {
    id: "e1",
    firstName: "Katarzyna",
    lastName: "Wójcik",
    isCivilServant: true,
    position: { title: "radca" },
    orgUnit: { name: "Wydział Prawny" },
  } as EvaluationRow["employee"],
  evaluator: { id: "ewa", name: "Ewa Kowalczyk" },
  criteria: [
    {
      id: "c1",
      evaluationId: "ev1",
      competency: "KOMUNIKACJA",
      kind: "OBOWIAZKOWE",
      selectionReason: null,
      score: 7,
      suggestedScore: 7,
      overrideReason: null,
      order: 0,
      ratings: [
        { id: "r1", criterionId: "c1", indicatorId: "KOMUNIKACJA.1", level: 4, note: null, updatedAt: d("2026-11-20") },
        { id: "r2", criterionId: "c1", indicatorId: "KOMUNIKACJA.2", level: null, note: null, updatedAt: d("2026-11-20") },
      ],
    },
  ],
  conversations: [{ type: "ROZPOCZYNAJACA", date: d("2024-12-14") }],
};

beforeEach(() => {
  authMock.mockReset();
  findManyMock.mockReset().mockResolvedValue([]);
  findFirstMock.mockReset().mockResolvedValue(null);
});

describe("zakres ocen według roli", () => {
  it("HR – wszystkie, przełożony – swoje, oceniany – własne sporządzone, kierujący – brak", () => {
    expect(evaluationScope({ id: "h", role: "HR" })).toEqual({});
    expect(evaluationScope({ id: "ewa", role: "PRZELOZONY" })).toEqual({ OR: [{ evaluatorId: "ewa" }, { employee: { supervisorId: "ewa" } }] });
    expect(evaluationScope({ id: "jan", role: "OCENIANY" })).toEqual({
      employee: { user: { id: "jan" } },
      status: { in: ["CZEKA_NA_ZAPOZNANIE", "ZAKONCZONA"] },
    });
    expect(evaluationScope({ id: "k", role: "KIERUJACY_KOMORKA" })).toBeNull();
  });
});

describe("GET /api/v1/oceny", () => {
  it("bez sesji → 401, kierujący → 403, bez zapytania do bazy", async () => {
    authMock.mockResolvedValue(null);
    expect((await lista(req(), ctx())).status).toBe(401);
    zalogowany("KIERUJACY_KOMORKA");
    expect((await lista(req(), ctx())).status).toBe(403);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("przełożony: zapytanie ograniczone do jego ocen, z filtrami", async () => {
    zalogowany("PRZELOZONY", "ewa");
    const res = await lista(req("?status=ZAKONCZONA&typ=OKRESOWA&pracownikId=e1"), ctx());
    expect(res.status).toBe(200);
    expect(findManyMock.mock.calls[0][0].where).toEqual({
      AND: [{ OR: [{ evaluatorId: "ewa" }, { employee: { supervisorId: "ewa" } }] }, { status: "ZAKONCZONA", type: "OKRESOWA", employeeId: "e1" }],
    });
  });

  it("niepoprawny filtr → 400", async () => {
    zalogowany("HR");
    const res = await lista(req("?status=COS"), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("status");
  });

  it("odpowiedź: daty RRRR-MM-DD i link do eksportu", async () => {
    zalogowany("HR");
    findManyMock.mockResolvedValue([
      { id: "ev1", type: "OKRESOWA", sheet: "C", status: "W_OCENIE", dueDate: d("2026-11-30"), evaluatedAt: null, result: null, employee: { id: "e1", firstName: "K", lastName: "W" } },
    ]);
    const body = await (await lista(req(), ctx())).json();
    expect(body.data[0]).toMatchObject({ id: "ev1", dueDate: "2026-11-30", evaluatedAt: null, links: { self: "/api/v1/oceny/ev1" } });
  });
});

describe("GET /api/v1/oceny/{id}", () => {
  it("ocena spoza zakresu → 404 (zapytanie z warunkiem dostępu)", async () => {
    zalogowany("PRZELOZONY", "ewa");
    const res = await eksport(req("/ev9"), ctx("ev9"));
    expect(res.status).toBe(404);
    expect(findFirstMock.mock.calls[0][0].where).toEqual({ AND: [{ id: "ev9" }, { OR: [{ evaluatorId: "ewa" }, { employee: { supervisorId: "ewa" } }] }] });
  });

  it("eksport: pełny arkusz bez danych wewnętrznych", async () => {
    zalogowany("HR");
    findFirstMock.mockResolvedValue(OCENA);
    const res = await eksport(req("/ev1"), ctx("ev1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.evaluation).toMatchObject({
      result: "POZYTYWNA",
      evaluatedAt: "2026-11-20",
      objectionDeadline: "2026-11-30", // 21.11 + 7 dni = sobota 28.11 → poniedziałek 30.11
      previous: { result: "POZYTYWNA", level: "NA_POZIOMIE", date: "2024-11-30" },
      promotion: { requestedGrade: 3 },
    });
    expect(body.criteria[0].indicators).toEqual([
      expect.objectContaining({ id: "KOMUNIKACJA.1", behaviorLevel: 4, observed: true }),
      expect.objectContaining({ id: "KOMUNIKACJA.2", behaviorLevel: null, observed: false }),
    ]);
    const text = JSON.stringify(body);
    expect(text).not.toContain("szkic kreatora");
    expect(text).not.toContain("lastWizardStep");
  });
});

describe("zgodność ze specyfikacją docs/openapi.yaml", () => {
  it("eksport ma wszystkie pola opisane w EvaluationExport", () => {
    const spec = readFileSync("docs/openapi.yaml", "utf8");
    const exp = toEvaluationExport(OCENA, new Date("2026-11-21T10:00:00Z"));
    for (const key of [...Object.keys(exp), ...Object.keys(exp.evaluation), ...Object.keys(exp.employee)]) {
      expect(spec, `brak pola ${key} w openapi.yaml`).toContain(`${key}:`);
    }
  });
});
