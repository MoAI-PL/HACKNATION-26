"use client";

import Link from "next/link";
import { NotebookPen, MessageCircleQuestion, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHORTCUT_EVENTS } from "@/lib/ui/shortcuts";
import { ASSISTANT_HREF } from "@/lib/ui/nav";
import { dispatchShortcut } from "./useShortcut";

/** Przyciski w nagłówku: te same akcje, co skróty N, / i ? (dla myszy i czytników ekranu). */
export function HeaderActions({ quickNote, assistant }: { quickNote: boolean; assistant: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {quickNote && (
        <Button variant="outline" onClick={() => dispatchShortcut(SHORTCUT_EVENTS.quickNote)}>
          <NotebookPen aria-hidden />
          Notatka
          <kbd className="ml-1 hidden rounded border bg-muted px-1 font-mono text-xs text-muted-foreground lg:inline">
            N
          </kbd>
        </Button>
      )}
      {assistant && (
        <Button variant="ghost" asChild>
          <Link href={ASSISTANT_HREF} className="no-underline">
            <MessageCircleQuestion aria-hidden />
            <span className="hidden md:inline">Zapytaj asystenta</span>
            <span className="md:hidden">Asystent</span>
            <kbd className="ml-1 hidden rounded border bg-muted px-1 font-mono text-xs text-muted-foreground lg:inline">
              /
            </kbd>
          </Link>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Skróty klawiaturowe"
        title="Skróty klawiaturowe (?)"
        onClick={() => dispatchShortcut(SHORTCUT_EVENTS.help)}
      >
        <Keyboard aria-hidden />
      </Button>
    </div>
  );
}
