// Reset danych demo (Z44): tylko HR, tylko przy DEMO_MODE=true, wpis w dzienniku zdarzeń.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, seedMock, auditMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  seedMock: vi.fn(),
  auditMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: { auditLog: { create: auditMock } } }));
vi.mock("@/lib/demo/dane-demo", () => ({ seedDemoData: seedMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { resetDemoAction } from "@/lib/demo/actions";
import { DemoResetDisabledError, resetDemoData } from "@/lib/demo/reset";

const zalogowany = (role: string) => authMock.mockResolvedValue({ user: { id: `u-${role}`, role, name: "Test" } });
async function redirectUrl(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { url: string }).url;
  }
  throw new Error("Oczekiwano przekierowania.");
}

let demoBefore: string | undefined;
beforeEach(() => {
  demoBefore = process.env.DEMO_MODE;
  process.env.DEMO_MODE = "true";
  authMock.mockReset();
  seedMock.mockReset().mockResolvedValue({ today: "2026-11-21", employees: 6, evaluations: 11, observations: 32 });
  auditMock.mockReset();
});
afterEach(() => {
  if (demoBefore === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = demoBefore;
});

describe("resetDemoData", () => {
  it("tryb demo: dane od nowa i wpis RESET_DEMO po resecie", async () => {
    const prisma = { auditLog: { create: auditMock } } as never;
    const r = await resetDemoData(prisma, "hr1");
    expect(seedMock).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ employees: 6, observations: 32, durationMs: expect.any(Number) });
    expect(auditMock.mock.calls[0][0].data).toMatchObject({ userId: "hr1", action: "RESET_DEMO" });
    expect(seedMock.mock.invocationCallOrder[0]).toBeLessThan(auditMock.mock.invocationCallOrder[0]);
  });

  it("poza trybem demo: błąd i żadnych zmian w bazie", async () => {
    await expect(resetDemoData({} as never, "hr1", { DEMO_MODE: "false" })).rejects.toBeInstanceOf(DemoResetDisabledError);
    expect(seedMock).not.toHaveBeenCalled();
  });
});

describe("resetDemoAction", () => {
  it("HR w trybie demo → reset i komunikat", async () => {
    zalogowany("HR");
    expect(await redirectUrl(resetDemoAction())).toBe("/hr?komunikat=reset");
    expect(seedMock).toHaveBeenCalledOnce();
  });

  it("HR poza trybem demo → komunikat, że reset jest wyłączony", async () => {
    zalogowany("HR");
    process.env.DEMO_MODE = "false";
    expect(await redirectUrl(resetDemoAction())).toBe("/hr?komunikat=reset-wylaczony");
    expect(seedMock).not.toHaveBeenCalled();
  });

  it.each(["PRZELOZONY", "OCENIANY", "KIERUJACY_KOMORKA"])("rola %s → 403, bez resetu", async (role) => {
    zalogowany(role);
    await expect(resetDemoAction()).rejects.toMatchObject({ status: 403 });
    expect(seedMock).not.toHaveBeenCalled();
  });

  it("bez sesji → 401", async () => {
    authMock.mockResolvedValue(null);
    await expect(resetDemoAction()).rejects.toMatchObject({ status: 401 });
  });
});
