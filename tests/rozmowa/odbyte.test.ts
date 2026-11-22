// Odbyte rozmowy na ściądze: tylko rozmowy pracowników tego przełożonego, od najnowszej, daty jako ISO.
import { describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { conversation: { findMany: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { listPastConversations } from "@/lib/rozmowa/repo";

describe("odbyte rozmowy", () => {
  it("zapytanie ograniczone do pracownika przełożonego, wynik z datą ISO", async () => {
    prismaMock.conversation.findMany.mockResolvedValue([
      { id: "c2", type: "OCENIAJACA", date: new Date("2026-11-21T00:00:00Z"), notes: "Omówiono cele." },
      { id: "c1", type: "ROZPOCZYNAJACA", date: new Date("2024-12-15T00:00:00Z"), notes: null },
    ]);
    expect(await listPastConversations("ewa", "kasia")).toEqual([
      { id: "c2", type: "OCENIAJACA", date: "2026-11-21", notes: "Omówiono cele." },
      { id: "c1", type: "ROZPOCZYNAJACA", date: "2024-12-15", notes: null },
    ]);
    expect(prismaMock.conversation.findMany.mock.calls[0][0]).toMatchObject({
      where: { employeeId: "kasia", employee: { supervisorId: "ewa" } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
    });
  });
});
