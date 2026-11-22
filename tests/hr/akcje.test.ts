// Akcje panelu HR: tylko rola HR, wysyłka jako symulacja z wpisem w dzienniku zdarzeń.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock, redirectMock } = vi.hoisted(() => {
  const prismaMock = {
    reminder: { updateMany: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    evaluation: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
  return {
    authMock: vi.fn(),
    prismaMock,
    redirectMock: vi.fn((url: string) => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { url });
    }),
  };
});
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { sendReminderAction } from "@/lib/hr/actions";

const zalogowany = (role: string) => authMock.mockResolvedValue({ user: { id: `u-${role}`, role, name: "Test" } });
const form = (id: string) => {
  const f = new FormData();
  f.set("id", id);
  return f;
};
async function redirectUrl(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return (e as { url: string }).url;
  }
  throw new Error("Oczekiwano przekierowania.");
}

beforeEach(() => {
  authMock.mockReset();
  prismaMock.reminder.updateMany.mockReset();
  prismaMock.auditLog.create.mockReset();
});

describe("wysyłka przypomnienia (symulacja)", () => {
  it("HR: znacznik „wysłano” tylko dla niewysłanego i wpis w dzienniku zdarzeń", async () => {
    zalogowany("HR");
    prismaMock.reminder.updateMany.mockResolvedValue({ count: 1 });
    expect(await redirectUrl(sendReminderAction(form("r1")))).toBe("/hr?komunikat=wyslano#przypomnienia");
    expect(prismaMock.reminder.updateMany.mock.calls[0][0].where).toEqual({ id: "r1", sentAt: null });
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({ userId: "u-HR", action: "PRZYPOMNIENIE_WYSLANE", entity: "Reminder", entityId: "r1" });
  });

  it("już wysłane – bez drugiego wpisu", async () => {
    zalogowany("HR");
    prismaMock.reminder.updateMany.mockResolvedValue({ count: 0 });
    expect(await redirectUrl(sendReminderAction(form("r1")))).toBe("/hr?komunikat=juz-wyslane#przypomnienia");
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it.each(["PRZELOZONY", "OCENIANY", "KIERUJACY_KOMORKA"])("rola %s – 403, baza nietknięta", async (role) => {
    zalogowany(role);
    await expect(sendReminderAction(form("r1"))).rejects.toMatchObject({ status: 403 });
    expect(prismaMock.reminder.updateMany).not.toHaveBeenCalled();
  });

  it("bez sesji – 401", async () => {
    authMock.mockResolvedValue(null);
    await expect(sendReminderAction(form("r1"))).rejects.toMatchObject({ status: 401 });
  });
});
