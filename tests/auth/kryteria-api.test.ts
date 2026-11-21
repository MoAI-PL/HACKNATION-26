// API analizy OSP (Z23): autoryzacja (Z04), plik OSP albo pracownik z bazy, tryb bez AI.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, findFirstMock } = vi.hoisted(() => ({ authMock: vi.fn(), findFirstMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: { employee: { findFirst: findFirstMock } } }));

import { POST } from "@/app/api/asystent/kryteria/route";

const ctx = { params: Promise.resolve({}) };
const URL_ = "http://localhost/api/asystent/kryteria";
const zalogowany = (role: string, id = `u-${role}`) => authMock.mockResolvedValue({ user: { id, role, name: "Test" } });

function postFile(bytes: Uint8Array<ArrayBuffer> | null, fields: Record<string, string> = {}) {
  const form = new FormData();
  if (bytes) form.set("plik", new File([new Uint8Array(bytes)], "osp.docx"));
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request(URL_, { method: "POST", body: form });
}
const postJson = (body: unknown) => new Request(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const radca = () => new Uint8Array(readFileSync("materialy/OSP/OSP_radca_DSI_WWI.docx")) as Uint8Array<ArrayBuffer>;

const positionRow = {
  title: "starszy specjalista",
  purpose: "Prowadzenie spraw dotyczących zarządzania kryzysowego.",
  dominantTasks: ["Bierze udział w reagowaniu na incydenty i sytuacje kryzysowe w cyberprzestrzeni.", "Dokonuje oceny obiektów infrastruktury krytycznej."],
  otherTasks: [],
  subordinates: "BRAK",
  authorizations: null,
  requiredCompetencies: ["myślenie analityczne"],
};

beforeEach(() => {
  authMock.mockReset();
  findFirstMock.mockReset();
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
});

describe("POST /api/asystent/kryteria – dostęp", () => {
  it("bez sesji → 401", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(postFile(radca()), ctx)).status).toBe(401);
  });

  it.each(["OCENIANY", "KIERUJACY_KOMORKA"])("%s → 403", async (role) => {
    zalogowany(role);
    expect((await POST(postFile(radca()), ctx)).status).toBe(403);
    expect(findFirstMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/asystent/kryteria – plik OSP", () => {
  it("OSP radcy → arkusz C i propozycje z cytatami (bez AI)", async () => {
    zalogowany("PRZELOZONY");
    const res = await POST(postFile(radca()), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.arkusz).toMatchObject({ sheet: "C", wybrany: "C" });
    expect(body.stanowisko.tytul).toBe("radca");
    expect(body.propozycja.mode).toBe("BEZ_AI");
    expect(body.propozycja.proposals.length).toBeGreaterThan(0);
    for (const p of body.propozycja.proposals) expect(p.quote.text.length).toBeGreaterThan(10);
  });

  it("arkusz zmieniony przez przełożonego → propozycje dla wybranego arkusza", async () => {
    zalogowany("PRZELOZONY");
    const body = await (await POST(postFile(radca(), { arkusz: "B" }), ctx)).json();
    expect(body.arkusz).toMatchObject({ sheet: "C", wybrany: "B" });
    expect(body.propozycja.sheet).toBe("B");
  });

  it("niepoprawny arkusz → 400", async () => {
    zalogowany("HR");
    const res = await POST(postFile(radca(), { arkusz: "A" }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).blad).toMatch(/B albo C/);
  });

  it("brak pliku → 400", async () => {
    zalogowany("PRZELOZONY");
    const res = await POST(postFile(null), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).blad).toMatch(/Dołącz plik OSP/);
  });

  it("plik, który nie jest OSP → 422 z listą problemów", async () => {
    zalogowany("PRZELOZONY");
    const res = await POST(postFile(new TextEncoder().encode("to nie jest docx")), ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.problemy[0]).toMatch(/nie jest dokumentem \.docx/);
  });
});

describe("POST /api/asystent/kryteria – pracownik z bazy", () => {
  it("przełożony: szukamy tylko wśród jego podwładnych", async () => {
    zalogowany("PRZELOZONY", "ewa");
    findFirstMock.mockResolvedValue({ position: positionRow });
    const res = await POST(postJson({ pracownikId: "p1" }), ctx);
    expect(res.status).toBe(200);
    expect(findFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", supervisorId: "ewa" } }));
    const body = await res.json();
    expect(body.propozycja.proposals.map((p: { competency: string }) => p.competency)).toEqual(expect.arrayContaining(["KRYZYS", "ANALITYCZNE"]));
  });

  it("HR: bez ograniczenia do podwładnych", async () => {
    zalogowany("HR");
    findFirstMock.mockResolvedValue({ position: positionRow });
    await POST(postJson({ pracownikId: "p1" }), ctx);
    expect(findFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1" } }));
  });

  it("cudzy albo nieistniejący pracownik → 404", async () => {
    zalogowany("PRZELOZONY");
    findFirstMock.mockResolvedValue(null);
    expect((await POST(postJson({ pracownikId: "obcy" }), ctx)).status).toBe(404);
  });

  it("pracownik bez OSP → 409 z podpowiedzią", async () => {
    zalogowany("PRZELOZONY");
    findFirstMock.mockResolvedValue({ position: null });
    const res = await POST(postJson({ pracownikId: "p1" }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).blad).toMatch(/Dodaj OSP/);
  });

  it("brak pracownika w zapytaniu → 400", async () => {
    zalogowany("PRZELOZONY");
    expect((await POST(postJson({}), ctx)).status).toBe(400);
  });
});
