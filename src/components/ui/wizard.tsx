"use client";

import * as React from "react";
import { Progress } from "radix-ui";
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
  const percent = Math.round(((current - 1) / Math.max(total - 1, 1)) * 100);
  const label = wizardStepLabel(current, total, steps[current - 1] ?? "");

  return (
    <nav aria-label="Postęp kreatora" className={cn("flex flex-col gap-3", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <Progress.Root
        value={percent}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <Progress.Indicator
          className="h-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </Progress.Root>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
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
              <span className={cn(active ? "font-medium text-foreground" : "text-muted-foreground")}>
                {name}
                {done && <span className="sr-only"> (ukończony)</span>}
              </span>
            </>
          );
          return (
            <li key={name} aria-current={active ? "step" : undefined}>
              {done && onStepClick ? (
                <button
                  type="button"
                  onClick={() => onStepClick(n)}
                  className="flex min-h-6 items-center gap-2 rounded-md hover:underline"
                >
                  {content}
                </button>
              ) : (
                <span className="flex min-h-6 items-center gap-2">{content}</span>
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
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        state.status === "error" ? "text-danger" : "text-muted-foreground",
        className,
      )}
    >
      <Icon className={cn("size-4", state.status === "saving" && "animate-spin")} aria-hidden />
      {autosaveText(state)}
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
