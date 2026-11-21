import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/domain/types";
import { canAccessPath, isPublicPath, isRole, ROLE_HOME, rolesForPath, safeRedirectFor } from "@/lib/auth/role";

describe("role i dostęp do ekranów", () => {
  it("każda rola ma ekran startowy, do którego ma dostęp", () => {
    for (const role of ROLES) {
      expect(canAccessPath(role, ROLE_HOME[role]), role).toBe(true);
    }
  });

  it("każda rola widzi tylko swoje ekrany startowe", () => {
    for (const role of ROLES) {
      for (const other of ROLES) {
        if (other === role) continue;
        expect(canAccessPath(role, ROLE_HOME[other]), `${role} → ${ROLE_HOME[other]}`).toBe(false);
      }
    }
  });

  it("dopasowuje podścieżki, ale nie podobne prefiksy", () => {
    expect(rolesForPath("/hr/terminy")).toEqual(["HR"]);
    expect(rolesForPath("/hrabia")).toBeNull();
    expect(canAccessPath("OCENIANY", "/hr/terminy")).toBe(false);
    expect(canAccessPath("PRZELOZONY", "/ocena/abc/krok-3")).toBe(true);
  });

  it("logowanie jest publiczne", () => {
    expect(isPublicPath("/logowanie")).toBe(true);
    expect(isPublicPath("/pulpit")).toBe(false);
  });

  it("isRole odrzuca wartości spoza kontraktu", () => {
    expect(isRole("HR")).toBe(true);
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  describe("bezpieczny adres po zalogowaniu", () => {
    it("przyjmuje wewnętrzną ścieżkę dostępną dla roli", () => {
      expect(safeRedirectFor("PRZELOZONY", "/ocena/123?krok=2")).toBe("/ocena/123?krok=2");
    });
    it("odrzuca adresy zewnętrzne i protokołowe", () => {
      expect(safeRedirectFor("HR", "https://zly.example")).toBe("/hr");
      expect(safeRedirectFor("HR", "//zly.example")).toBe("/hr");
      expect(safeRedirectFor("HR", "/\\zly.example")).toBe("/hr");
    });
    it("odrzuca ścieżkę innej roli i ekran logowania", () => {
      expect(safeRedirectFor("OCENIANY", "/hr")).toBe("/moje-oceny");
      expect(safeRedirectFor("HR", "/logowanie")).toBe("/hr");
      expect(safeRedirectFor("HR", null)).toBe("/hr");
    });
  });
});
