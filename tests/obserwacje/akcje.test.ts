// Akcje serwerowe dziennika: autoryzacja, zapis tylko dla własnych podwładnych, walidacja przed bazą.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  prismaMock: {
    employee: { count: vi.fn(), findMany: vi.fn() },
    observation: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: vi.fn() }));

import { deleteObservationAction, saveObservationAction } from "@/lib/obserwacje/actions";
import { listObservations } from "@/lib/obserwacje/repo";

const zalogowany = (role: string, id = "ewa") => authMock.mockResolvedValue({ user: { id, role, name: "Ewa" } });
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const poprawne = { employeeId: "kasia", date: "2026-01-15", indicatorId: "WSPOLPRACA.2", behaviorLevel: "4", situation: "S", action: "D", outcome: "R" };

async function redirectUrl(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as { url: string }).url;
  }
  throw new Error("Oczekiwano przekierowania.");
}

beforeEach(() => {
  authMock.mockReset();
  for (const m of [...Object.values(prismaMock.employee), ...Object.values(prismaMock.observation)]) m.mockReset();
  redirectMock.mockClear();
});

describe("zapis obserwacji", () => {
  it("bez sesji – błąd autoryzacji, nic nie trafia do bazy", async () => {
    authMock.mockResolvedValue(null);
    await expect(saveObservationAction(undefined, form(poprawne))).rejects.toMatchObject({ status: 401 });
    expect(prismaMock.observation.create).not.toHaveBeenCalled();
  });

  it.each(["HR", "OCENIANY", "KIERUJACY_KOMORKA"])("rola %s – 403", async (role) => {
    zalogowany(role);
    await expect(saveObservationAction(undefined, form(poprawne))).rejects.toMatchObject({ status: 403 });
    expect(prismaMock.observation.create).not.toHaveBeenCalled();
  });

  it("przełożona zapisuje obserwację podwładnej i wraca do jej dziennika", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.employee.count.mockResolvedValue(1);
    prismaMock.observation.create.mockResolvedValue({ id: "o1" });
    const url = await redirectUrl(saveObservationAction(undefined, form(poprawne)));
    expect(url).toBe("/obserwacje?osoba=kasia&zapisano=nowa");
    expect(prismaMock.employee.count).toHaveBeenCalledWith({ where: { id: "kasia", supervisorId: "ewa" } });
    const data = prismaMock.observation.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ employeeId: "kasia", authorId: "ewa", competency: "WSPOLPRACA", indicatorId: "WSPOLPRACA.2", behaviorLevel: 4, source: "RECZNA" });
    expect(data.date.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("cudzy pracownik – komunikat przy polu, bez zapisu", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.employee.count.mockResolvedValue(0);
    const state = await saveObservationAction(undefined, form(poprawne));
    expect(state?.errors?.employeeId).toMatch(/tylko swoich pracowników/);
    expect(prismaMock.observation.create).not.toHaveBeenCalled();
  });

  it("niepoprawny formularz – błędy przy polach, baza nietknięta", async () => {
    zalogowany("PRZELOZONY");
    const state = await saveObservationAction(undefined, form({ ...poprawne, situation: "", action: "", outcome: "" }));
    expect(state?.message).toMatch(/Popraw zaznaczone pola/);
    expect(state?.errors?.sdr).toBeDefined();
    expect(prismaMock.employee.count).not.toHaveBeenCalled();
  });

  it("po błędzie zwraca wpisane wartości, żeby nic nie przepadło", async () => {
    zalogowany("PRZELOZONY");
    const state = await saveObservationAction(undefined, form({ ...poprawne, date: "2099-01-01" }));
    expect(state?.errors?.date).toMatch(/z przyszłości/);
    expect(state?.values).toMatchObject({ date: "2099-01-01", situation: "S", indicatorId: "WSPOLPRACA.2", behaviorLevel: "4" });
    expect(state?.attempt).toEqual(expect.any(Number));
  });

  it("edycja: zmiana tylko w obrębie podwładnych przełożonej", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.employee.count.mockResolvedValue(1);
    prismaMock.observation.updateMany.mockResolvedValue({ count: 1 });
    const url = await redirectUrl(saveObservationAction(undefined, form({ ...poprawne, id: "o1" })));
    expect(url).toBe("/obserwacje?osoba=kasia&zapisano=zmiana");
    expect(prismaMock.observation.updateMany.mock.calls[0][0].where).toEqual({ id: "o1", employee: { supervisorId: "ewa" } });
  });

  it("edycja cudzej albo usuniętej obserwacji – komunikat", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.employee.count.mockResolvedValue(1);
    prismaMock.observation.updateMany.mockResolvedValue({ count: 0 });
    const state = await saveObservationAction(undefined, form({ ...poprawne, id: "obca" }));
    expect(state?.message).toMatch(/Tej obserwacji już nie ma/);
  });
});

describe("usuwanie obserwacji", () => {
  it("tylko w obrębie podwładnych, potem powrót z komunikatem", async () => {
    zalogowany("PRZELOZONY");
    prismaMock.observation.deleteMany.mockResolvedValue({ count: 1 });
    const url = await redirectUrl(deleteObservationAction(form({ id: "o1", employeeId: "kasia" })));
    expect(url).toBe("/obserwacje?osoba=kasia&zapisano=usunieto");
    expect(prismaMock.observation.deleteMany).toHaveBeenCalledWith({ where: { id: "o1", employee: { supervisorId: "ewa" } } });
  });

  it("oceniany nie może usuwać", async () => {
    zalogowany("OCENIANY");
    await expect(deleteObservationAction(form({ id: "o1" }))).rejects.toMatchObject({ status: 403 });
    expect(prismaMock.observation.deleteMany).not.toHaveBeenCalled();
  });
});

describe("odczyt dziennika", () => {
  it("zapytanie zawsze ograniczone do podwładnych, z filtrami", async () => {
    prismaMock.observation.findMany.mockResolvedValue([
      {
        id: "o1",
        employeeId: "kasia",
        date: new Date("2026-01-15T00:00:00.000Z"),
        competency: "WSPOLPRACA",
        indicatorId: "WSPOLPRACA.2",
        behaviorLevel: 4,
        situation: "S",
        action: "D",
        outcome: "R",
        originalText: null,
        source: "RECZNA",
        employee: { firstName: "Katarzyna", lastName: "Wójcik" },
      },
    ]);
    const list = await listObservations("ewa", { competency: "WSPOLPRACA", from: "2026-01-01" });
    expect(prismaMock.observation.findMany.mock.calls[0][0].where).toEqual({
      employee: { supervisorId: "ewa" },
      competency: "WSPOLPRACA",
      date: { gte: new Date("2026-01-01T00:00:00.000Z") },
    });
    expect(list[0]).toMatchObject({ employeeName: "Katarzyna Wójcik", date: "2026-01-15", behaviorLevel: 4 });
  });
});
