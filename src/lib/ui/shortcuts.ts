// Skróty klawiaturowe (Z10, sekcja 4.1 pkt 7). Czysta logika – testy w tests/ui/shortcuts.test.ts.
//
// Globalne skróty wysyłają zdarzenia w oknie, a funkcje nasłuchują ich u siebie:
//   N → SHORTCUT_EVENTS.quickNote (szybka notatka, Z41)
//   / → SHORTCUT_EVENTS.assistant (asystent formalny, Z22)
//   ? → SHORTCUT_EVENTS.help (lista skrótów)
// Skróty lokalne (← → poprzedni/następny wskaźnik, 1–5 wybór zachowania) obsługuje ekran oceny (Z14) przez useShortcut.

export const SHORTCUT_EVENTS = {
  quickNote: "kompas:szybka-notatka",
  assistant: "kompas:asystent",
  help: "kompas:skroty",
} as const;

export type ShortcutEvent = (typeof SHORTCUT_EVENTS)[keyof typeof SHORTCUT_EVENTS];

export interface ShortcutInfo {
  keys: string[];
  description: string;
  /** Gdzie działa: wszędzie albo na konkretnym ekranie. */
  scope: string;
}

/** Lista do okna pomocy („?”) i do docs/UX.md. */
export const SHORTCUTS: ShortcutInfo[] = [
  { keys: ["N"], description: "Szybka notatka o pracowniku", scope: "wszędzie" },
  { keys: ["/"], description: "Asystent formalny", scope: "wszędzie" },
  { keys: ["?"], description: "Lista skrótów klawiaturowych", scope: "wszędzie" },
  { keys: ["←", "→"], description: "Poprzedni / następny wskaźnik", scope: "ocena wskaźników" },
  { keys: ["1", "2", "3", "4", "5"], description: "Wybór opisu zachowania", scope: "ocena wskaźników" },
  { keys: ["0"], description: "Brak okazji do obserwacji", scope: "ocena wskaźników" },
  { keys: ["Esc"], description: "Zamknięcie okna", scope: "okna i panele" },
];

/** Minimalny kształt zdarzenia – pozwala testować bez przeglądarki. */
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  target?: unknown;
}

interface ElementLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** true, gdy użytkownik pisze w polu – wtedy skróty jednoliterowe nie działają. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as ElementLike;
  if (el.isContentEditable) return true;
  if (el.tagName && TYPING_TAGS.has(el.tagName.toUpperCase())) return true;
  const role = el.getAttribute?.("role");
  return role === "textbox" || role === "combobox";
}

/**
 * Czy zdarzenie pasuje do skrótu jednoklawiszowego.
 * Ignoruje skróty z Ctrl/Cmd/Alt (nie przejmujemy skrótów przeglądarki) i pisanie w polach.
 */
export function matchesShortcut(event: KeyLike, key: string): boolean {
  if (event.defaultPrevented || event.isComposing) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (isTypingTarget(event.target)) return false;
  return event.key.toLowerCase() === key.toLowerCase();
}

/** Zdarzenie globalnego skrótu dla danego klawisza albo null. */
export function globalShortcutFor(event: KeyLike): ShortcutEvent | null {
  if (matchesShortcut(event, "n")) return SHORTCUT_EVENTS.quickNote;
  if (matchesShortcut(event, "/")) return SHORTCUT_EVENTS.assistant;
  if (matchesShortcut(event, "?")) return SHORTCUT_EVENTS.help;
  return null;
}
