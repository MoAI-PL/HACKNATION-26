"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { SHORTCUTS, SHORTCUT_EVENTS, globalShortcutFor } from "@/lib/ui/shortcuts";
import { useShortcutEvent } from "./useShortcut";

/**
 * Globalne skróty klawiaturowe (N, /, ?) i okno z listą skrótów.
 * Montowany raz w AppShell. Skrót wysyła zdarzenie – funkcje (Z41, Z22) nasłuchują przez useShortcutEvent.
 */
export function GlobalShortcuts() {
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const event = globalShortcutFor(e);
      if (!event) return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent(event));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useShortcutEvent(SHORTCUT_EVENTS.help, () => setHelpOpen(true));

  return (
    <Dialog
      open={helpOpen}
      onOpenChange={setHelpOpen}
      title="Skróty klawiaturowe"
      description="Skróty jednoklawiszowe nie działają, gdy piszesz w polu tekstowym."
    >
      <table className="w-full text-sm">
        <caption className="sr-only">Lista skrótów klawiaturowych</caption>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th scope="col" className="py-2 font-medium">Klawisz</th>
            <th scope="col" className="py-2 font-medium">Działanie</th>
            <th scope="col" className="py-2 font-medium">Gdzie</th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.description} className="border-b last:border-0">
              <td className="py-2 pr-3">
                <span className="flex flex-wrap gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {k}
                    </kbd>
                  ))}
                </span>
              </td>
              <td className="py-2 pr-3">{s.description}</td>
              <td className="py-2 text-muted-foreground">{s.scope}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
