// Bezpośrednie wywołania API bez uprawnień: 401 bez sesji, 403 przy złej roli.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, findManyMock } = vi.hoisted(() => ({ authMock: vi.fn(), findManyMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: { employee: { findMany: findManyMock } } }));

import { GET as pracownicy } from "@/app/api/v1/pracownicy/route";
import { GET as me } from "@/app/api/v1/me/route";

const ctx = { params: Promise.resolve({}) };
const req = () => new Request("http://localhost/api/v1/pracownicy");
const zalogowany = (role: string, id = "u1") => authMock.mockResolvedValue({ user: { id, role, name: "Test" } });

beforeEach(() => {
  authMock.mockReset();
  findManyMock.mockReset().mockResolvedValue([]);
});

describe("GET /api/v1/pracownicy", () => {
  it("bez sesji → 401", async () => {
    authMock.mockResolvedValue(null);
    const res = await pracownicy(req(), ctx);
    expect(res.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it.each(["OCENIANY", "KIERUJACY_KOMORKA"])("rola %s → 403 i brak zapytania do bazy", async (role) => {
    zalogowany(role);
    const res = await pracownicy(req(), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBeTruthy();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("przełożony widzi tylko swoich podwładnych", async () => {
    zalogowany("PRZELOZONY", "ewa");
    const res = await pracownicy(req(), ctx);
    expect(res.status).toBe(200);
    expect(findManyMock.mock.calls[0][0].where).toEqual({ supervisorId: "ewa" });
  });

  it("HR widzi wszystkich", async () => {
    zalogowany("HR");
    const res = await pracownicy(req(), ctx);
    expect(res.status).toBe(200);
    expect(findManyMock.mock.calls[0][0].where).toEqual({});
  });
});

describe("GET /api/v1/me", () => {
  it("bez sesji → 401, z sesją → dane użytkownika", async () => {
    authMock.mockResolvedValue(null);
    expect((await me(req(), ctx)).status).toBe(401);
    zalogowany("OCENIANY");
    const res = await me(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "u1", role: "OCENIANY" });
  });
});
