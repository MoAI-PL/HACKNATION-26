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

/**
 * Nasłuch globalnego skrótu, np. useShortcutEvent(SHORTCUT_EVENTS.quickNote, (e) => { e.preventDefault(); setOtwarte(true); }).
 * preventDefault() oznacza „obsłużone” – wtedy AppShell nie wykonuje akcji domyślnej
 * (dla „/” akcją domyślną jest przejście na stronę asystenta; panel boczny może ją przejąć).
 */
export function useShortcutEvent(event: ShortcutEvent, handler: (e: Event) => void) {
  const ref = React.useRef(handler);
  React.useEffect(() => {
    ref.current = handler;
  });
  React.useEffect(() => {
    const listener = (e: Event) => ref.current(e);
    window.addEventListener(event, listener);
    return () => window.removeEventListener(event, listener);
  }, [event]);
}

/**
 * Wywołanie globalnej akcji z przycisku albo skrótu.
 * Zwraca true, gdy któryś ekran ją obsłużył (wywołał preventDefault).
 */
export function dispatchShortcut(event: ShortcutEvent): boolean {
  return !window.dispatchEvent(new CustomEvent(event, { cancelable: true }));
}
