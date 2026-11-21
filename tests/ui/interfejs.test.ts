import { describe, expect, it } from "vitest";
import { globalShortcutFor, isTypingTarget, matchesShortcut, SHORTCUT_EVENTS } from "@/lib/ui/shortcuts";
import { autosaveText, deadlineText, urgencyFromDaysLeft, URGENCY_TONE, wizardStepLabel } from "@/lib/ui/status";
import { ASSISTANT_HREF, isActivePath, isScreenReady, navForRole, plannedNavForRole, roleHasAssistant, roleHasQuickNote } from "@/lib/ui/nav";
import { ROLES } from "@/lib/domain/types";

const pole = (tagName: string) => ({ tagName, getAttribute: () => null });

describe("skróty klawiaturowe", () => {
  it("N, / i ? wysyłają zdarzenia globalne", () => {
    expect(globalShortcutFor({ key: "n" })).toBe(SHORTCUT_EVENTS.quickNote);
    expect(globalShortcutFor({ key: "N" })).toBe(SHORTCUT_EVENTS.quickNote);
    expect(globalShortcutFor({ key: "/" })).toBe(SHORTCUT_EVENTS.assistant);
    expect(globalShortcutFor({ key: "?" })).toBe(SHORTCUT_EVENTS.help);
    expect(globalShortcutFor({ key: "x" })).toBeNull();
  });

  it("nie działają podczas pisania w polu", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(globalShortcutFor({ key: "n", target: pole(tag) })).toBeNull();
    }
    expect(isTypingTarget({ isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", getAttribute: (a: string) => (a === "role" ? "textbox" : null) })).toBe(true);
    expect(isTypingTarget(pole("BUTTON"))).toBe(false);
  });

  it("nie przejmują skrótów przeglądarki z Ctrl/Cmd/Alt", () => {
    expect(matchesShortcut({ key: "n", ctrlKey: true }, "n")).toBe(false);
    expect(matchesShortcut({ key: "n", metaKey: true }, "n")).toBe(false);
    expect(matchesShortcut({ key: "n", altKey: true }, "n")).toBe(false);
    expect(matchesShortcut({ key: "3" }, "3")).toBe(true);
  });
});

describe("terminy i statusy", () => {
  it("pilność według progów 7 i 30 dni", () => {
    expect(urgencyFromDaysLeft(-1)).toBe("PO_TERMINIE");
    expect(urgencyFromDaysLeft(0)).toBe("PILNE");
    expect(urgencyFromDaysLeft(7)).toBe("PILNE");
    expect(urgencyFromDaysLeft(8)).toBe("WKROTCE");
    expect(urgencyFromDaysLeft(30)).toBe("WKROTCE");
    expect(urgencyFromDaysLeft(31)).toBe("W_TERMINIE");
  });

  it("kolory: czerwony po terminie i do 7 dni, pomarańczowy do 30, zielony w terminie", () => {
    expect(URGENCY_TONE).toEqual({ PO_TERMINIE: "danger", PILNE: "danger", WKROTCE: "warning", W_TERMINIE: "success" });
  });

  it("tekst odznaki z poprawną odmianą", () => {
    expect(deadlineText(-1)).toBe("Po terminie (1 dzień)");
    expect(deadlineText(-3)).toBe("Po terminie (3 dni)");
    expect(deadlineText(0)).toBe("Termin dziś");
    expect(deadlineText(1)).toBe("Termin jutro");
    expect(deadlineText(5)).toBe("Zostało 5 dni");
  });

  it("autozapis i etykieta kroku kreatora", () => {
    expect(autosaveText({ status: "saved", at: new Date("2026-11-21T13:32:00Z") })).toBe("Zapisano 14:32");
    expect(autosaveText({ status: "saving" })).toBe("Zapisywanie…");
    expect(wizardStepLabel(3, 6, "Ocena wskaźników")).toBe("Krok 3 z 6: Ocena wskaźników");
  });
});

describe("nawigacja", () => {
  it("każda rola ma menu", () => {
    for (const r of ROLES) expect(navForRole(r).length).toBeGreaterThan(0);
  });

  it("docelowe menu przełożonego ma ścieżki z grafiki MC", () => {
    const etykiety = plannedNavForRole("PRZELOZONY").map((i) => i.label);
    expect(etykiety).toEqual(
      expect.arrayContaining(["Pierwsza ocena", "Ocena okresowa", "Asystent formalny", "Asystent rozmowy"]),
    );
  });

  it("menu ukrywa ekrany w budowie (bez martwych linków)", () => {
    expect(navForRole("PRZELOZONY").every((i) => !i.pending)).toBe(true);
    expect(navForRole("PRZELOZONY").map((i) => i.href)).toEqual(["/pulpit", "/ocena/okresowa", "/obserwacje", ASSISTANT_HREF]);
  });

  it("adresy menu leżą w obszarach ról z Z04", async () => {
    const { canAccessPath } = await import("@/lib/auth/role");
    for (const r of ROLES) for (const i of plannedNavForRole(r)) expect(canAccessPath(r, i.href), `${r} ${i.href}`).toBe(true);
  });

  it("oceniany nie widzi ekranów przełożonego, asystenta ani szybkiej notatki", () => {
    expect(navForRole("OCENIANY").map((i) => i.href)).toEqual(["/moje-oceny"]);
    expect(roleHasAssistant("OCENIANY")).toBe(false);
    // Asystent formalny we wspólnej grupie (wspolne) – także dla HR i kierującego (role.ts: obszar /asystent).
    expect(navForRole("HR").map((i) => i.href)).toEqual(["/hr", ASSISTANT_HREF]);
    expect(navForRole("KIERUJACY_KOMORKA").map((i) => i.href)).toEqual(["/kierujacy", ASSISTANT_HREF]);
    expect(roleHasAssistant("HR")).toBe(true);
    expect(roleHasQuickNote("OCENIANY", true)).toBe(false);
    expect(roleHasQuickNote("PRZELOZONY", true)).toBe(true);
    expect(roleHasQuickNote("PRZELOZONY", false)).toBe(false);
  });

  it("gotowość ekranu wynika z menu (także podstrony), ekrany z pending nie są gotowe", () => {
    expect(isScreenReady("/pulpit")).toBe(true);
    expect(isScreenReady(`${ASSISTANT_HREF}/historia`)).toBe(true);
    for (const item of plannedNavForRole("PRZELOZONY").filter((i) => i.pending)) {
      expect(isScreenReady(`${item.href}/123`)).toBe(false);
    }
    expect(isScreenReady("/nie-ma-takiego")).toBe(false);
  });

  it("aktywna pozycja obejmuje podstrony, ale nie podobne adresy", () => {
    expect(isActivePath("/ocena-okresowa/123", "/ocena-okresowa")).toBe(true);
    expect(isActivePath("/pulpit", "/pulpit")).toBe(true);
    expect(isActivePath("/pulpit-hr", "/pulpit")).toBe(false);
  });
});
