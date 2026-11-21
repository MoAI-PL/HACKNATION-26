import { beforeAll, describe, expect, it, vi } from "vitest";
import { authorizeCredentials, type UserRecord } from "@/lib/auth/credentials";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

let ewa: UserRecord;
const find = vi.fn(async (email: string) => (email === ewa.email ? ewa : null));

beforeAll(async () => {
  // Niski koszt bcrypt tylko w testach – szybciej.
  ewa = { id: "u1", email: "ewa@demo.test", name: "Ewa", role: "PRZELOZONY", passwordHash: await hashPassword("tajne-haslo", 4) };
});

describe("hasła", () => {
  it("hash bcrypt nie zawiera hasła i weryfikuje się poprawnie", async () => {
    const h = await hashPassword("abc123", 4);
    expect(h).not.toContain("abc123");
    expect(h).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword("abc123", h)).toBe(true);
    expect(await verifyPassword("abc124", h)).toBe(false);
  });
});

describe("logowanie e-mailem i hasłem", () => {
  it("poprawne dane zwracają użytkownika bez hasha", async () => {
    const u = await authorizeCredentials({ email: "ewa@demo.test", password: "tajne-haslo" }, find);
    expect(u).toEqual({ id: "u1", email: "ewa@demo.test", name: "Ewa", role: "PRZELOZONY" });
    expect(u).not.toHaveProperty("passwordHash");
  });

  it("e-mail bez względu na wielkość liter i spacje", async () => {
    const u = await authorizeCredentials({ email: "  EWA@demo.TEST ", password: "tajne-haslo" }, find);
    expect(u?.id).toBe("u1");
  });

  it("złe hasło, nieznany e-mail i błędne dane dają null", async () => {
    expect(await authorizeCredentials({ email: "ewa@demo.test", password: "zle" }, find)).toBeNull();
    expect(await authorizeCredentials({ email: "nikt@demo.test", password: "tajne-haslo" }, find)).toBeNull();
    expect(await authorizeCredentials({ email: "to-nie-email", password: "x" }, find)).toBeNull();
    expect(await authorizeCredentials({ email: "ewa@demo.test", password: "" }, find)).toBeNull();
    expect(await authorizeCredentials(undefined, find)).toBeNull();
  });

  it("konto z rolą spoza kontraktu nie loguje się", async () => {
    const dziwny = { ...ewa, role: "ADMIN" } as unknown as UserRecord;
    expect(await authorizeCredentials({ email: ewa.email, password: "tajne-haslo" }, async () => dziwny)).toBeNull();
  });
});
