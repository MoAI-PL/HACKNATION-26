// Akcje pierwszej oceny: rola i dostęp, zmiana etapu odporna na podwójne kliknięcie, kryteria pięciu elementów,
// sprawozdanie bez wyniku egzaminu (egzamin bywa później).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayIso, toDbDate } from "@/lib/domain/daty";
import { addDays, addMonths } from "@/lib/rules/kalendarz";
import { proposedReportWindow } from "@/lib/pierwsza-ocena/przebieg";

const { authMock, prismaMock, tx } = vi.hoisted(() => {
  const tx = {
    evaluation: { updateMany: vi.fn() },
    evaluationCriterion: { createMany: vi.fn() },
    conversation: { create: vi.fn() },
    firstEvalReport: { upsert: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    authMock: vi.fn(),
    tx,
    prismaMock: {
      evaluation: { findFirst: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveInitialConversation, saveReport } from "@/app/(przelozony)/ocena/pierwsza/actions";

const today = todayIso();
const zalogowany = (role: string, id = "ewa") => authMock.mockResolvedValue({ user: { id, role, name: "Ewa" } });

function evaluation(over: { status?: string; start?: string; report?: { dueFrom: string; dueTo: string } | null } = {}) {
  const start = over.start ?? addDays(today, -10);
  return {
    id: "ev1",
    employeeId: "ola",
    type: "PIERWSZA",
    status: over.status ?? "DO_ROZPOCZECIA",
    evaluatedAt: null,
    employee: { id: "ola", employmentStart: toDbDate(start), contractEnd: toDbDate(addDays(addMonths(start, 12), -1)), absences: [] },
    report: over.report ? { dueFrom: toDbDate(over.report.dueFrom), dueTo: toDbDate(over.report.dueTo), submittedAt: null } : null,
  };
}

beforeEach(() => {
  authMock.mockReset();
  prismaMock.evaluation.findFirst.mockReset();
  prismaMock.$transaction.mockClear();
  for (const group of Object.values(tx)) for (const fn of Object.values(group)) (fn as ReturnType<typeof vi.fn>).mockReset();
  tx.evaluation.updateMany.mockResolvedValue({ count: 1 });
});

describe("rozmowa wstępna", () => {
  const start = addDays(today, -10);
  const window = proposedReportWindow({ employmentStart: start, contractEnd: addDays(addMonths(start, 12), -1) });
  const form = { date: addDays(today, -2), dueFrom: window.dueFrom, dueTo: window.dueTo, notes: "Omówiono obowiązki." };

  it("zapis: etap tylko z „do rozpoczęcia”, pięć elementów jako kryteria, rozmowa, termin sprawozdania, dziennik", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.evaluation.findFirst.mockResolvedValue(evaluation());
    expect(await saveInitialConversation("ev1", form)).toEqual({ ok: true });
    expect(tx.evaluation.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "ev1", status: "DO_ROZPOCZECIA" }, data: { status: "W_OKRESIE_OCENY" } });
    const criteria = tx.evaluationCriterion.createMany.mock.calls[0][0];
    expect(criteria.skipDuplicates).toBe(true);
    expect(criteria.data.map((c: { competency: string }) => c.competency)).toEqual(["RZETELNOSC", "WIEDZA", "ORGANIZACJA", "KOMUNIKACJA", "WSPOLPRACA"]);
    expect(criteria.data.every((c: { evaluationId: string; kind: string }) => c.evaluationId === "ev1" && c.kind === "OBOWIAZKOWE")).toBe(true);
    expect(tx.conversation.create.mock.calls[0][0].data).toMatchObject({ type: "WSTEPNA", evaluationId: "ev1", notes: "Omówiono obowiązki." });
    expect(tx.firstEvalReport.upsert).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "ROZMOWA_WSTEPNA", entityId: "ev1" });
  });

  it("podwójne kliknięcie (etap już zmieniony) – bez drugiego zapisu", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.evaluation.findFirst.mockResolvedValue(evaluation());
    tx.evaluation.updateMany.mockResolvedValue({ count: 0 });
    expect(await saveInitialConversation("ev1", form)).toMatchObject({ ok: false });
    expect(tx.conversation.create).not.toHaveBeenCalled();
    expect(tx.evaluationCriterion.createMany).not.toHaveBeenCalled();
  });

  it("cudza ocena, zapisana rozmowa albo termin sprawozdania przed upływem 8 miesięcy – odmowa", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.evaluation.findFirst.mockResolvedValue(null);
    expect(await saveInitialConversation("obca", form)).toMatchObject({ ok: false });
    prismaMock.evaluation.findFirst.mockResolvedValue(evaluation({ status: "W_OKRESIE_OCENY" }));
    expect(await saveInitialConversation("ev1", form)).toMatchObject({ ok: false, error: expect.stringMatching(/już zapisana/) });
    prismaMock.evaluation.findFirst.mockResolvedValue(evaluation());
    const r = await saveInitialConversation("ev1", { ...form, dueFrom: addDays(start, 30) });
    expect(r).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ field: "dueFrom" })]) });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("inna rola niż przełożony – wyjątek dostępu, bez odczytu oceny", async () => {
    zalogowany("HR");
    await expect(saveInitialConversation("ev1", form)).rejects.toThrow();
    expect(prismaMock.evaluation.findFirst).not.toHaveBeenCalled();
  });
});

describe("sprawozdanie i egzamin", () => {
  const start = addDays(addMonths(today, -9), -5);
  const window = proposedReportWindow({ employmentStart: start, contractEnd: addDays(addMonths(start, 12), -1) });
  const fd = (over: Record<string, string> = {}) => {
    const f = new FormData();
    const values = { mode: "ZLOZONE", submittedAt: window.dueFrom, content: "Zadania i wnioski z pierwszego okresu.", ...over };
    for (const [k, v] of Object.entries(values)) f.set(k, v);
    return f;
  };

  it("bez wyniku egzaminu sprawozdanie się zapisuje – egzamin pusty, kryteria dołożone dla starszych ocen", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.evaluation.findFirst.mockResolvedValue(evaluation({ status: "W_OKRESIE_OCENY", start, report: { dueFrom: window.dueFrom, dueTo: window.dueTo } }));
    expect(await saveReport("ev1", fd())).toEqual({ ok: true });
    expect(tx.evaluation.updateMany.mock.calls[0][0].data).toMatchObject({ status: "W_OCENIE", examResult: null, examExemption: null });
    expect(tx.evaluationCriterion.createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true });
    expect(tx.auditLog.create.mock.calls[0][0].data.newValue).toMatchObject({ egzamin: "jeszcze się nie odbył" });
  });

  it("„nie dotyczy” bez powodu – odmowa; zdany – zapis wyniku", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.evaluation.findFirst.mockResolvedValue(evaluation({ status: "W_OKRESIE_OCENY", start, report: { dueFrom: window.dueFrom, dueTo: window.dueTo } }));
    expect(await saveReport("ev1", fd({ exam: "NIE_DOTYCZY" }))).toMatchObject({ ok: false });
    expect(await saveReport("ev1", fd({ exam: "ZDANY" }))).toEqual({ ok: true });
    expect(tx.evaluation.updateMany.mock.calls[0][0].data).toMatchObject({ examResult: "ZDANY" });
  });

  it("przed rozmową wstępną – odmowa", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.evaluation.findFirst.mockResolvedValue(evaluation({ status: "DO_ROZPOCZECIA" }));
    expect(await saveReport("ev1", fd())).toMatchObject({ ok: false });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
