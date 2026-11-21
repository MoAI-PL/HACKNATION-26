"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { SHORTCUTS, SHORTCUT_EVENTS, globalShortcutFor } from "@/lib/ui/shortcuts";
import { ASSISTANT_HREF } from "@/lib/ui/nav";
import { dispatchShortcut, useShortcutEvent } from "./useShortcut";

/**
 * Globalne skróty klawiaturowe (N, /, ?) i okno z listą skrótów. Montowany raz w AppShell.
 * - N: zdarzenie dla szybkiej notatki (Z41) – tylko gdy funkcja jest włączona;
 * - /: zdarzenie dla asystenta; jeśli żaden ekran go nie przejmie, przejście na stronę asystenta (Z22);
 * - ?: okno z listą skrótów.
 */
export function GlobalShortcuts({ quickNote, assistant }: { quickNote: boolean; assistant: boolean }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const event = globalShortcutFor(e);
      if (!event) return;
      // Przy otwartym oknie (np. „Dodaj pracownika”) skróty globalne nie mogą przenosić na inną stronę.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (event === SHORTCUT_EVENTS.quickNote && !quickNote) return;
      if (event === SHORTCUT_EVENTS.assistant && !assistant) return;
      e.preventDefault();
      const handled = dispatchShortcut(event);
      if (!handled && event === SHORTCUT_EVENTS.assistant) router.push(ASSISTANT_HREF);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickNote, assistant, router]);

  useShortcutEvent(SHORTCUT_EVENTS.help, () => setHelpOpen(true));

  const visible = SHORTCUTS.filter(
    (s) => (quickNote || s.keys[0] !== "N") && (assistant || s.keys[0] !== "/"),
  );

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
          {visible.map((s) => (
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
