import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/domain/types";
import { DEMO_ACCOUNTS, findDemoAccount, isDemoMode } from "@/lib/auth/demo";

describe("konta demo", () => {
  it("jest konto dla każdej roli, z unikalnym e-mailem zapisanym małymi literami", () => {
    expect(new Set(DEMO_ACCOUNTS.map((a) => a.role))).toEqual(new Set(ROLES));
    const emails = DEMO_ACCOUNTS.map((a) => a.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const e of emails) expect(e).toBe(e.toLowerCase());
  });

  it("persona demo: przełożona Ewa Kowalczyk", () => {
    expect(DEMO_ACCOUNTS.find((a) => a.role === "PRZELOZONY")?.name).toBe("Ewa Kowalczyk");
  });

  it("DEMO_MODE włącza tylko wartość true", () => {
    expect(isDemoMode("true")).toBe(true);
    expect(isDemoMode(" TRUE ")).toBe(true);
    expect(isDemoMode("false")).toBe(false);
    expect(isDemoMode("1")).toBe(false);
    expect(isDemoMode(undefined)).toBe(false);
  });

  it("wyszukiwanie konta po e-mailu", () => {
    expect(findDemoAccount(" HR@demo.kompas.test")?.role).toBe("HR");
    expect(findDemoAccount("obcy@x.pl")).toBeUndefined();
  });
});
