// Ustawienia wyświetlania (dostępność): odczyt zapisanych ustawień, klasy na <html>, motyw i skrypt startowy.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPLAY,
  DISPLAY_INIT_SCRIPT,
  DISPLAY_STORAGE_KEY,
  applyDisplaySettings,
  displayClasses,
  isDark,
  parseDisplaySettings,
  type DisplaySettings,
} from "@/lib/ui/dostepnosc";

function fakeRoot(initial: string[] = []) {
  const set = new Set(initial);
  const classList = {
    add: (...c: string[]) => c.forEach((x) => set.add(x)),
    remove: (...c: string[]) => c.forEach((x) => set.delete(x)),
    contains: (c: string) => set.has(c),
  } as unknown as DOMTokenList;
  return { root: { classList }, classes: () => [...set].sort() };
}

/** Uruchamia skrypt z <head> w udawanej przeglądarce (localStorage, document, opcjonalnie window.matchMedia). */
function runInitScript(stored: unknown, systemDark?: boolean) {
  const { root, classes } = fakeRoot();
  const storage = { getItem: (k: string) => (k === DISPLAY_STORAGE_KEY ? JSON.stringify(stored) : null) };
  const win = systemDark === undefined ? undefined : { matchMedia: () => ({ matches: systemDark }) };
  new Function("localStorage", "document", "window", DISPLAY_INIT_SCRIPT)(storage, { documentElement: root }, win);
  return classes();
}

describe("ustawienia wyświetlania", () => {
  it("brak, uszkodzone albo obce wartości → ustawienia domyślne (jasny motyw)", () => {
    expect(parseDisplaySettings(null)).toEqual(DEFAULT_DISPLAY);
    expect(parseDisplaySettings("{nie json")).toEqual(DEFAULT_DISPLAY);
    expect(parseDisplaySettings(JSON.stringify({ textSize: 300, highContrast: "tak", theme: "fioletowy" }))).toEqual(DEFAULT_DISPLAY);
    expect(DEFAULT_DISPLAY.theme).toBe("jasny");
  });

  it("poprawne ustawienia są odczytywane; stare zapisy bez motywu dostają motyw jasny", () => {
    expect(parseDisplaySettings(JSON.stringify({ textSize: 150, highContrast: true, theme: "ciemny" }))).toEqual({ textSize: 150, highContrast: true, theme: "ciemny" });
    expect(parseDisplaySettings(JSON.stringify({ textSize: 125, highContrast: false }))).toEqual({ textSize: 125, highContrast: false, theme: "jasny" });
  });

  it("klasy na <html>: rozmiar tekstu, kontrast i tryb ciemny; domyślnie żadnych", () => {
    expect(displayClasses(DEFAULT_DISPLAY)).toEqual([]);
    expect(displayClasses({ textSize: 125, highContrast: true, theme: "jasny" })).toEqual(["tekst-125", "wysoki-kontrast"]);
    expect(displayClasses({ textSize: 100, highContrast: false, theme: "ciemny" })).toEqual(["dark"]);
  });

  it("„jak w systemie” – ciemno tylko, gdy system ma ciemny motyw", () => {
    const sys: DisplaySettings = { ...DEFAULT_DISPLAY, theme: "systemowy" };
    expect(isDark(sys, true)).toBe(true);
    expect(isDark(sys, false)).toBe(false);
    expect(isDark({ ...DEFAULT_DISPLAY, theme: "jasny" }, true)).toBe(false);
  });

  it("zmiana ustawień usuwa poprzednie klasy, a obce zostawia", () => {
    const { root, classes } = fakeRoot(["inna", "tekst-150", "wysoki-kontrast", "dark"]);
    applyDisplaySettings(root, { textSize: 125, highContrast: false, theme: "jasny" });
    expect(classes()).toEqual(["inna", "tekst-125"]);
  });

  it("skrypt startowy nakłada te same klasy co aplikacja i nie przerywa strony przy błędzie", () => {
    const cases: [DisplaySettings, boolean][] = [
      [DEFAULT_DISPLAY, false],
      [{ textSize: 125, highContrast: false, theme: "ciemny" }, false],
      [{ textSize: 150, highContrast: true, theme: "systemowy" }, true],
      [{ textSize: 100, highContrast: false, theme: "systemowy" }, false],
    ];
    for (const [s, systemDark] of cases) expect(runInitScript(s, systemDark)).toEqual(displayClasses(s, systemDark).sort());
    // Bez window.matchMedia (stara przeglądarka) – „jak w systemie” zostaje jasny, strona działa.
    expect(runInitScript({ theme: "systemowy" })).toEqual([]);
    const { root } = fakeRoot();
    const broken = { getItem: () => { throw new Error("zablokowany localStorage"); } };
    expect(() => new Function("localStorage", "document", "window", DISPLAY_INIT_SCRIPT)(broken, { documentElement: root }, undefined)).not.toThrow();
  });
});
