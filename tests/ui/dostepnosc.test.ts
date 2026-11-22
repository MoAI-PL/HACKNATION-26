// Ustawienia wyświetlania (dostępność): odczyt zapisanych ustawień, klasy na <html> i skrypt startowy.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPLAY,
  DISPLAY_INIT_SCRIPT,
  DISPLAY_STORAGE_KEY,
  applyDisplaySettings,
  displayClasses,
  parseDisplaySettings,
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

describe("ustawienia wyświetlania", () => {
  it("brak, uszkodzone albo obce wartości → ustawienia domyślne", () => {
    expect(parseDisplaySettings(null)).toEqual(DEFAULT_DISPLAY);
    expect(parseDisplaySettings("{nie json")).toEqual(DEFAULT_DISPLAY);
    expect(parseDisplaySettings(JSON.stringify({ textSize: 300, highContrast: "tak" }))).toEqual(DEFAULT_DISPLAY);
  });

  it("poprawne ustawienia są odczytywane", () => {
    expect(parseDisplaySettings(JSON.stringify({ textSize: 150, highContrast: true }))).toEqual({ textSize: 150, highContrast: true });
  });

  it("klasy na <html>: rozmiar tekstu i kontrast; domyślnie żadnych", () => {
    expect(displayClasses(DEFAULT_DISPLAY)).toEqual([]);
    expect(displayClasses({ textSize: 125, highContrast: true })).toEqual(["tekst-125", "wysoki-kontrast"]);
  });

  it("zmiana ustawień usuwa poprzednie klasy, a obce zostawia", () => {
    const { root, classes } = fakeRoot(["inna", "tekst-150", "wysoki-kontrast"]);
    applyDisplaySettings(root, { textSize: 125, highContrast: false });
    expect(classes()).toEqual(["inna", "tekst-125"]);
  });

  it("skrypt startowy nakłada te same klasy co aplikacja i nie przerywa strony przy błędzie", () => {
    for (const s of [DEFAULT_DISPLAY, { textSize: 125, highContrast: false }, { textSize: 150, highContrast: true }] as const) {
      const { root, classes } = fakeRoot();
      const storage = { getItem: (k: string) => (k === DISPLAY_STORAGE_KEY ? JSON.stringify(s) : null) };
      new Function("localStorage", "document", DISPLAY_INIT_SCRIPT)(storage, { documentElement: root });
      expect(classes()).toEqual(displayClasses(s).sort());
    }
    const broken = { getItem: () => { throw new Error("zablokowany localStorage"); } };
    expect(() => new Function("localStorage", "document", DISPLAY_INIT_SCRIPT)(broken, { documentElement: fakeRoot().root })).not.toThrow();
  });
});
