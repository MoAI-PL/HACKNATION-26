import { describe, expect, it } from "vitest";
import { decideAccess } from "@/lib/auth/access";

const sesja = (role: string) => ({ user: { id: "u1", name: "Ewa", email: "ewa@demo.test", role } });

describe("decyzja o dostępie po stronie serwera", () => {
  it("brak sesji lub niepełna sesja → 401", () => {
    expect(decideAccess(null, ["HR"])).toMatchObject({ ok: false, status: 401 });
    expect(decideAccess({ user: null }, [])).toMatchObject({ ok: false, status: 401 });
    expect(decideAccess({ user: { id: "u1" } }, [])).toMatchObject({ ok: false, status: 401 });
    expect(decideAccess(sesja("ADMIN"), [])).toMatchObject({ ok: false, status: 401 });
  });

  it("zła rola → 403 z komunikatem po polsku", () => {
    const d = decideAccess(sesja("OCENIANY"), ["HR", "PRZELOZONY"]);
    expect(d).toMatchObject({ ok: false, status: 403 });
    if (!d.ok) expect(d.message).toMatch(/rola/i);
  });

  it("właściwa rola albo pusta lista ról → dostęp", () => {
    expect(decideAccess(sesja("HR"), ["HR"])).toMatchObject({ ok: true, user: { id: "u1", role: "HR" } });
    expect(decideAccess(sesja("OCENIANY"), [])).toMatchObject({ ok: true });
  });
});
