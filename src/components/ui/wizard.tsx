"use client";

import * as React from "react";
import { AlertCircle, Check, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { autosaveText, wizardStepLabel, type AutosaveState } from "@/lib/ui/status";

// Kreator (Z10, sekcja 4.1 pkt 3): pasek postępu z nazwą i numerem kroku, znacznik autozapisu.
// Zasada: zmiany zapisują się same; nigdy „Utracisz niezapisane dane”.

export function WizardProgress({
  steps,
  current,
  onStepClick,
  className,
}: {
  /** Nazwy kroków, np. ["Opis stanowiska", "Arkusz", "Kryteria", …]. */
  steps: string[];
  /** Numer bieżącego kroku (od 1). */
  current: number;
  /** Powrót do ukończonego kroku – gdy podany, ukończone kroki są przyciskami. */
  onStepClick?: (step: number) => void;
  className?: string;
}) {
  const total = steps.length;
  const label = wizardStepLabel(current, total, steps[current - 1] ?? "");

  return (
    <nav aria-label="Postęp kreatora" className={cn("flex flex-col gap-3", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {/* Kroki jako odcinki jednej osi: kolumny z szerokości w rem (zawijają się przy wąskim ekranie i większym tekście). */}
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-x-2 gap-y-3 text-sm">
        {steps.map((name, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const content = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-input text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </span>
              <span className={cn("min-w-0 truncate leading-snug", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {name}
                {done && <span className="sr-only"> (ukończony)</span>}
              </span>
            </>
          );
          return (
            <li key={name} aria-current={active ? "step" : undefined} className="flex min-w-0 flex-col gap-2" title={name}>
              <span aria-hidden className={cn("h-1 rounded-full", done || active ? "bg-primary" : "bg-muted")} />
              {done && onStepClick ? (
                <button
                  type="button"
                  onClick={() => onStepClick(n)}
                  className="flex min-h-6 min-w-0 items-center gap-2 rounded-md text-left hover:underline"
                >
                  {content}
                </button>
              ) : (
                <span className="flex min-h-6 min-w-0 items-center gap-2">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Znacznik „Zapisano 14:32” – ogłaszany czytnikom ekranu bez przerywania pracy. */
export function AutosaveIndicator({ state, className }: { state: AutosaveState; className?: string }) {
  const Icon =
    state.status === "saving" ? Loader2 : state.status === "error" ? AlertCircle : CheckCircle2;
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        state.status === "error" ? "text-danger" : "text-muted-foreground",
        className,
      )}
    >
      <Icon className={cn("size-4", state.status === "saving" && "animate-spin")} aria-hidden />
      <span aria-hidden>{autosaveText(state)}</span>
      {/* Czytnik ekranu słyszy tylko wynik zapisu, a nie „Zapisywanie…” po każdej zmianie. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state.status === "saving" ? "" : autosaveText(state)}
      </span>
    </p>
  );
}

/** Dół kroku kreatora: po lewej „Wstecz”, po prawej jedna główna akcja („Dalej: wybór kryteriów”). */
export function WizardFooter({
  back,
  primary,
  autosave,
  className,
}: {
  back?: React.ReactNode;
  primary: React.ReactNode;
  autosave?: AutosaveState;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t pt-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {back}
        {autosave && <AutosaveIndicator state={autosave} />}
      </div>
      <div className="flex items-center gap-2">{primary}</div>
    </div>
  );
}
