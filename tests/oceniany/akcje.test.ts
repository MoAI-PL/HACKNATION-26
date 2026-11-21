// Akcja ocenianego (Z46): potwierdzenie zapoznania się – tylko rola OCENIANY, tylko własna ocena, tylko etap „czeka na zapoznanie”.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock, applyMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  applyMock: vi.fn(),
  prismaMock: {
    evaluation: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn("tx")),
  },
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/ocena/zapoznanie", () => ({ applyAcknowledgment: applyMock }));

import { acknowledgeOwnEvaluation } from "@/lib/oceniany/actions";

const zalogowany = (role: string, id = "jan") => authMock.mockResolvedValue({ user: { id, role, name: "Jan" } });
const ocena = (zmiany: Record<string, unknown> = {}) => ({
  id: "e1",
  employeeId: "p1",
  evaluatorId: "ewa",
  sheet: "A",
  result: "POZYTYWNA",
  status: "CZEKA_NA_ZAPOZNANIE",
  evaluatedAt: new Date("2020-01-02T00:00:00Z"),
  ...zmiany,
});

beforeEach(() => {
  authMock.mockReset();
  applyMock.mockReset();
  prismaMock.evaluation.findFirst.mockReset();
});

describe("potwierdzenie zapoznania się przez ocenianego", () => {
  it("zapisuje zapoznanie dla własnej oceny i oznacza, że potwierdził oceniany", async () => {
    zalogowany("OCENIANY");
    prismaMock.evaluation.findFirst.mockResolvedValue(ocena());
    await expect(acknowledgeOwnEvaluation("e1")).resolves.toEqual({ ok: true });
    expect(prismaMock.evaluation.findFirst.mock.calls[0]![0].where).toEqual({ id: "e1", employee: { user: { id: "jan" } } });
    expect(applyMock).toHaveBeenCalledWith("tx", expect.objectContaining({ id: "e1" }), expect.any(String), "jan", "OCENIANY");
  });

  it("cudza ocena wygląda jak nieistniejąca", async () => {
    zalogowany("OCENIANY");
    prismaMock.evaluation.findFirst.mockResolvedValue(null);
    await expect(acknowledgeOwnEvaluation("obca")).resolves.toEqual({ ok: false, error: "Nie znaleziono oceny." });
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("ocena jeszcze niesporządzona nie może zostać potwierdzona", async () => {
    zalogowany("OCENIANY");
    prismaMock.evaluation.findFirst.mockResolvedValue(ocena({ status: "W_OCENIE", evaluatedAt: null }));
    const r = await acknowledgeOwnEvaluation("e1");
    expect(r.ok).toBe(false);
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("inna rola nie może potwierdzić za ocenianego", async () => {
    zalogowany("PRZELOZONY", "ewa");
    await expect(acknowledgeOwnEvaluation("e1")).rejects.toThrow();
    expect(prismaMock.evaluation.findFirst).not.toHaveBeenCalled();
  });

  it("bez logowania – odmowa", async () => {
    authMock.mockResolvedValue(null);
    await expect(acknowledgeOwnEvaluation("e1")).rejects.toThrow();
    expect(applyMock).not.toHaveBeenCalled();
  });
});
