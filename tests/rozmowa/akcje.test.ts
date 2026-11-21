// Akcje asystenta rozmowy (Z24): tylko przełożony, tylko własni podwładni, decyzje AI w dzienniku decyzji.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: { employee: { findFirst: vi.fn() }, auditLog: { create: vi.fn() } },
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { logConversationAiDecisionAction, polishConversationAction } from "@/lib/rozmowa/actions";

const zalogowany = (role: string, id = "ewa") => authMock.mockResolvedValue({ user: { id, role, name: "Ewa" } });

beforeEach(() => {
  authMock.mockReset();
  prismaMock.employee.findFirst.mockReset();
  prismaMock.auditLog.create.mockReset();
});

describe("zapis decyzji „Wstaw / Odrzuć”", () => {
  it("przełożona: wpis AI_WSTAW z propozycją i treścią po edycji", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.employee.findFirst.mockResolvedValue({ id: "kasia" });
    expect(await logConversationAiDecisionAction("kasia", { kind: "OCENIAJACA", decision: "WSTAW", proposal: "P", final: "P2" })).toEqual({ ok: true });
    expect(prismaMock.employee.findFirst).toHaveBeenCalledWith({ where: { id: "kasia", supervisorId: "ewa" }, select: { id: true } });
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: "ewa",
      action: "AI_WSTAW",
      entity: "Employee",
      entityId: "kasia",
      aiProposal: { funkcja: "ASYSTENT_ROZMOWY", rozmowa: "OCENIAJACA", propozycja: "P" },
      humanDecision: { decyzja: "WSTAW", wstawiono: "P2" },
    });
  });

  it("cudzy pracownik albo nieznany rodzaj rozmowy – bez wpisu", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.employee.findFirst.mockResolvedValue(null);
    expect(await logConversationAiDecisionAction("obcy", { kind: "OCENIAJACA", decision: "ODRZUC", proposal: "P" })).toEqual({ ok: false });
    prismaMock.employee.findFirst.mockResolvedValue({ id: "kasia" });
    expect(await logConversationAiDecisionAction("kasia", { kind: "INNA", decision: "ODRZUC", proposal: "P" })).toEqual({ ok: false });
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("spreparowane dane z przeglądarki (zła decyzja, ogromna treść) – odrzucone bez wpisu", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.employee.findFirst.mockResolvedValue({ id: "kasia" });
    expect(await logConversationAiDecisionAction("kasia", { kind: "OCENIAJACA", decision: "USUN", proposal: "P" })).toEqual({ ok: false });
    expect(await logConversationAiDecisionAction("kasia", { kind: "OCENIAJACA", decision: "WSTAW", proposal: "x".repeat(10_001) })).toEqual({ ok: false });
    expect(await logConversationAiDecisionAction("kasia", null)).toEqual({ ok: false });
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it.each(["HR", "OCENIANY", "KIERUJACY_KOMORKA"])("rola %s – 403", async (role) => {
    zalogowany(role);
    await expect(logConversationAiDecisionAction("kasia", { kind: "OCENIAJACA", decision: "WSTAW", proposal: "P" })).rejects.toMatchObject({ status: 403 });
    await expect(polishConversationAction("kasia", "OCENIAJACA")).rejects.toMatchObject({ status: 403 });
  });
});

describe("redakcja przez AI", () => {
  it("nieznany rodzaj rozmowy – komunikat bez pytania bazy", async () => {
    zalogowany("PRZELOZONY");
    expect(await polishConversationAction("kasia", "INNA")).toEqual({ ok: false, reason: "Nieznany rodzaj rozmowy." });
    expect(prismaMock.employee.findFirst).not.toHaveBeenCalled();
  });

  it("pracownik spoza podwładnych – komunikat", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.employee.findFirst.mockResolvedValue(null);
    expect(await polishConversationAction("obcy", "OCENIAJACA")).toEqual({ ok: false, reason: "Nie znaleziono pracownika wśród Twoich podwładnych." });
  });

  it("bez sesji – 401", async () => {
    authMock.mockResolvedValue(null);
    await expect(polishConversationAction("kasia", "OCENIAJACA")).rejects.toMatchObject({ status: 401 });
  });

  it("limit: najwyżej 10 próśb na minutę na przełożonego", async () => {
    zalogowany("PRZELOZONY", "limit-test");
    prismaMock.employee.findFirst.mockResolvedValue(null);
    for (let i = 0; i < 10; i++) await polishConversationAction("obcy", "OCENIAJACA");
    expect(await polishConversationAction("obcy", "OCENIAJACA")).toEqual({ ok: false, reason: "Zbyt wiele próśb do asystenta w krótkim czasie. Spróbuj ponownie za minutę." });
  });
});
