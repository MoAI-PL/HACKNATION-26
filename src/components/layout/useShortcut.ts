"use client";

import * as React from "react";
import { matchesShortcut, type ShortcutEvent } from "@/lib/ui/shortcuts";

/**
 * Skrót jednoklawiszowy na ekranie, np. useShortcut("ArrowRight", nastepnyWskaznik) albo useShortcut("3", wybierz3).
 * Nie działa podczas pisania w polu ani z Ctrl/Cmd/Alt.
 */
export function useShortcut(key: string, handler: (event: KeyboardEvent) => void, enabled = true) {
  const ref = React.useRef(handler);
  React.useEffect(() => {
    ref.current = handler;
  });
  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (matchesShortcut(e, key)) {
        e.preventDefault();
        ref.current(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, enabled]);
}

/** Nasłuch globalnego skrótu, np. useShortcutEvent(SHORTCUT_EVENTS.quickNote, () => setOtwarte(true)). */
export function useShortcutEvent(event: ShortcutEvent, handler: () => void) {
  const ref = React.useRef(handler);
  React.useEffect(() => {
    ref.current = handler;
  });
  React.useEffect(() => {
    const listener = () => ref.current();
    window.addEventListener(event, listener);
    return () => window.removeEventListener(event, listener);
  }, [event]);
}

/** Wywołanie globalnej akcji z przycisku (np. „Notatka (N)” w nagłówku) – to samo, co skrót. */
export function dispatchShortcut(event: ShortcutEvent) {
  window.dispatchEvent(new CustomEvent(event));
}
