// Ustawienia wyświetlania (dostępność): wielkość tekstu, wysoki kontrast i motyw (jasny, ciemny, jak w systemie).
// Zapisywane w przeglądarce (localStorage) – bez konta i bez bazy, działają też na ekranie logowania.
// Klasy na <html> nakłada skrypt w <head> (src/app/layout.tsx) jeszcze przed pierwszym malowaniem strony,
// więc po odświeżeniu nie ma mignięcia domyślnego wyglądu. Style klas: src/app/globals.css.

export const DISPLAY_STORAGE_KEY = "kompas:wyswietlanie";

export const TEXT_SIZES = [
  { value: 100, label: "Standardowy", short: "A" },
  { value: 125, label: "Większy", short: "A+" },
  { value: 150, label: "Największy", short: "A++" },
] as const;

export type TextSize = (typeof TEXT_SIZES)[number]["value"];

export const THEMES = [
  { value: "jasny", label: "Jasny" },
  { value: "ciemny", label: "Ciemny" },
  { value: "systemowy", label: "Jak w systemie" },
] as const;

export type Theme = (typeof THEMES)[number]["value"];

export interface DisplaySettings {
  textSize: TextSize;
  highContrast: boolean;
  theme: Theme;
}

/** Domyślnie jasny motyw – ciemny tylko na życzenie (albo „jak w systemie”). */
export const DEFAULT_DISPLAY: DisplaySettings = { textSize: 100, highContrast: false, theme: "jasny" };

/** Klasa na <html> dla wielkości tekstu (Tailwind liczy w rem, więc powiększa się cały układ). */
export const TEXT_SIZE_CLASS: Record<TextSize, string | null> = { 100: null, 125: "tekst-125", 150: "tekst-150" };
export const HIGH_CONTRAST_CLASS = "wysoki-kontrast";
/** Klasa trybu ciemnego – ta sama, której używają warianty dark: z shadcn/ui. */
export const DARK_CLASS = "dark";

const ALL_CLASSES = [HIGH_CONTRAST_CLASS, DARK_CLASS, ...Object.values(TEXT_SIZE_CLASS).filter((c): c is string => !!c)];

/** Odczyt zapisanych ustawień – uszkodzone albo obce wartości dają ustawienia domyślne. */
export function parseDisplaySettings(raw: string | null | undefined): DisplaySettings {
  if (!raw) return DEFAULT_DISPLAY;
  try {
    const v = JSON.parse(raw) as Partial<DisplaySettings>;
    const textSize = TEXT_SIZES.find((s) => s.value === v.textSize)?.value ?? DEFAULT_DISPLAY.textSize;
    const theme = THEMES.find((t) => t.value === v.theme)?.value ?? DEFAULT_DISPLAY.theme;
    return { textSize, highContrast: v.highContrast === true, theme };
  } catch {
    return DEFAULT_DISPLAY;
  }
}

/** Czy wyświetlać ciemno – „jak w systemie” zależy od ustawienia systemu (prefers-color-scheme). */
export function isDark(s: DisplaySettings, systemPrefersDark: boolean): boolean {
  return s.theme === "ciemny" || (s.theme === "systemowy" && systemPrefersDark);
}

/** Klasy, które mają być na <html> przy danych ustawieniach. */
export function displayClasses(s: DisplaySettings, systemPrefersDark = false): string[] {
  const size = TEXT_SIZE_CLASS[s.textSize];
  return [...(size ? [size] : []), ...(s.highContrast ? [HIGH_CONTRAST_CLASS] : []), ...(isDark(s, systemPrefersDark) ? [DARK_CLASS] : [])];
}

/** Nakłada ustawienia na element <html> (usuwa poprzednie klasy ustawień). */
export function applyDisplaySettings(root: { classList: DOMTokenList }, s: DisplaySettings, systemPrefersDark = false): void {
  root.classList.remove(...ALL_CLASSES);
  root.classList.add(...displayClasses(s, systemPrefersDark));
}

/**
 * Skrypt do <head>: te same reguły co parseDisplaySettings/displayClasses, bez importów (działa przed hydratacją).
 * Błąd (np. zablokowany localStorage) nie może zatrzymać strony – stąd try/catch.
 */
export const DISPLAY_INIT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(DISPLAY_STORAGE_KEY)})||"{}");var c=document.documentElement.classList;if(s.textSize===125)c.add("tekst-125");if(s.textSize===150)c.add("tekst-150");if(s.highContrast===true)c.add("${HIGH_CONTRAST_CLASS}");var sys=false;try{sys=window.matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}if(s.theme==="ciemny"||(s.theme==="systemowy"&&sys))c.add("${DARK_CLASS}");}catch(e){}})();`;
