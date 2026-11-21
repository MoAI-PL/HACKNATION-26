"use client";

import * as React from "react";
import { RadioGroup } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Wybór kartami zamiast list rozwijanych (Z10, sekcja 4.1 pkt 7).
// Pojedynczy wybór: karty zachowań przy wskaźniku (Z14), wybór arkusza B/C (Z12).
// Wielokrotny wybór: kryteria dodatkowe, maks. 3 (Z12).
// Obsługa klawiaturą: Tab do grupy, strzałki między kartami (pojedynczy), Spacja zaznacza.

export interface ChoiceOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Dodatkowy znacznik w rogu, np. „Sugestia” albo numer skrótu. */
  hint?: React.ReactNode;
  disabled?: boolean;
}

const cardBase =
  "group relative flex h-full w-full flex-col gap-1 rounded-lg border-2 border-input bg-card p-4 text-left transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50";
const cardChecked = "border-primary bg-secondary";

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute top-3 right-3 flex size-5 items-center justify-center rounded-full border-2",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

const GRID: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  6: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

export function ChoiceCardGroup<V extends string>({
  label,
  options,
  value,
  onValueChange,
  columns = 2,
  className,
}: {
  /** Nazwa grupy dla czytników ekranu, np. „Poziom zachowania: Komunikacja 1”. */
  label: string;
  options: ChoiceOption<V>[];
  value: V | undefined;
  onValueChange: (value: V) => void;
  columns?: keyof typeof GRID;
  className?: string;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value ?? ""}
      onValueChange={(v) => onValueChange(v as V)}
      className={cn("grid gap-3", GRID[columns], className)}
    >
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <RadioGroup.Item
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className={cn(cardBase, "pr-10", checked && cardChecked)}
          >
            <CheckMark checked={checked} />
            {o.hint && <span className="text-xs font-medium text-muted-foreground">{o.hint}</span>}
            <span className="font-medium">{o.label}</span>
            {o.description && <span className="text-sm text-muted-foreground">{o.description}</span>}
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}

export function ChoiceCardMulti<V extends string>({
  label,
  options,
  values,
  onValuesChange,
  max,
  maxReachedText,
  columns = 2,
  className,
}: {
  label: string;
  options: ChoiceOption<V>[];
  values: V[];
  onValuesChange: (values: V[]) => void;
  /** Maksymalna liczba wyborów (np. 3 kryteria dodatkowe – § 5 ust. 2). */
  max?: number;
  /** Komunikat przy osiągniętym limicie, z powodem. */
  maxReachedText?: string;
  columns?: keyof typeof GRID;
  className?: string;
}) {
  const full = max !== undefined && values.length >= max;
  const toggle = (v: V) =>
    onValuesChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      <legend className="sr-only">{label}</legend>
      {max !== undefined && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Wybrano {values.length} z {max}.
          {full && maxReachedText ? ` ${maxReachedText}` : ""}
        </p>
      )}
      <div className={cn("grid gap-3", GRID[columns])}>
        {options.map((o) => {
          const checked = values.includes(o.value);
          const disabled = o.disabled || (full && !checked);
          return (
            <label
              key={o.value}
              className={cn(
                cardBase,
                "cursor-pointer pr-10 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                checked && cardChecked,
                disabled && "cursor-not-allowed opacity-50 hover:border-input",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(o.value)}
              />
              <CheckMark checked={checked} />
              {o.hint && <span className="text-xs font-medium text-muted-foreground">{o.hint}</span>}
              <span className="font-medium">{o.label}</span>
              {o.description && <span className="text-sm text-muted-foreground">{o.description}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
