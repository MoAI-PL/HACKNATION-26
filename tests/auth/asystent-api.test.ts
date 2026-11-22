// Dostęp do API asystenta formalnego: 401 bez sesji, 403 dla ocenianego, 200 dla przełożonego, HR i kierującego.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));

import { GET, POST } from "@/app/api/asystent/formalny/route";

const ctx = { params: Promise.resolve({}) };
const post = (pytanie: string) =>
  new Request("http://localhost/api/asystent/formalny", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pytanie }),
  });
const zalogowany = (role: string) => authMock.mockResolvedValue({ user: { id: `u-${role}`, role, name: "Test" } });

beforeEach(() => {
  authMock.mockReset();
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
});

describe("POST /api/asystent/formalny", () => {
  it("bez sesji → 401", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(post("sprzeciw"), ctx)).status).toBe(401);
  });

  it("oceniany → 403 z komunikatem po polsku", async () => {
    zalogowany("OCENIANY");
    const res = await POST(post("sprzeciw"), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/rola/);
  });

  it.each(["PRZELOZONY", "HR", "KIERUJACY_KOMORKA"])("%s → 200 i odpowiedź ze źródłami", async (role) => {
    zalogowany(role);
    const res = await POST(post("W jakim terminie można złożyć sprzeciw?"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.refused).toBe(false);
    expect(body.sources.length).toBeGreaterThan(0);
  });

  it("za krótkie pytanie → 400", async () => {
    zalogowany("PRZELOZONY");
    expect((await POST(post("a"), ctx)).status).toBe(400);
  });
});

describe("GET /api/asystent/formalny", () => {
  it("bez sesji → 401, przełożony → podpowiedzi dla kroku", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/asystent/formalny"), ctx)).status).toBe(401);
    zalogowany("PRZELOZONY");
    const res = await GET(new Request("http://localhost/api/asystent/formalny?krok=OCENA"), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.podpowiedzi).toHaveLength(3);
    expect(body.aiDostepne).toBe(false);
  });
});
