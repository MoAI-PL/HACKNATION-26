"use client";

import * as React from "react";
import { Accessibility, Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DISPLAY,
  DISPLAY_STORAGE_KEY,
  TEXT_SIZES,
  THEMES,
  applyDisplaySettings,
  parseDisplaySettings,
  type DisplaySettings,
} from "@/lib/ui/dostepnosc";

const THEME_ICONS = { jasny: Sun, ciemny: Moon, systemowy: Monitor } as const;

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function readStored(): DisplaySettings {
  try {
    return parseDisplaySettings(window.localStorage.getItem(DISPLAY_STORAGE_KEY));
  } catch {
    return DEFAULT_DISPLAY;
  }
}

/**
 * Przycisk „Dostępność” z panelem: wielkość tekstu (A / A+ / A++) i wysoki kontrast.
 * Panel na <details> – otwieranie klawiaturą (Enter/Spacja) i czytnikiem ekranu działa natywnie; Escape zamyka.
 */
export function UstawieniaWyswietlania({ className }: { className?: string }) {
  const [settings, setSettings] = React.useState<DisplaySettings>(DEFAULT_DISPLAY);
  const [status, setStatus] = React.useState("");
  const ref = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => setSettings(readStored()), []);

  // „Jak w systemie”: zmiana motywu systemu w trakcie pracy przełącza stronę od razu.
  React.useEffect(() => {
    if (settings.theme !== "systemowy") return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => applyDisplaySettings(document.documentElement, settings, mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings]);

  // Zamknięcie panelu klawiszem Escape (fokus wraca na przycisk) i kliknięciem poza nim.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const update = (next: DisplaySettings, message: string) => {
    setSettings(next);
    applyDisplaySettings(document.documentElement, next, systemPrefersDark());
    try {
      window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Prywatne okno albo zablokowany localStorage – ustawienie działa do odświeżenia strony.
    }
    setStatus(message);
  };

  const isDefault =
    settings.textSize === DEFAULT_DISPLAY.textSize && settings.highContrast === DEFAULT_DISPLAY.highContrast && settings.theme === DEFAULT_DISPLAY.theme;

  return (
    <details ref={ref} className={cn("relative", className)}>
      <summary
        className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden"
        title="Ustawienia wyświetlania: wielkość tekstu i kontrast"
      >
        <Accessibility className="size-4" aria-hidden />
        <span>Dostępność</span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 flex w-72 flex-col gap-4 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Wielkość tekstu</legend>
          <div className="flex gap-2">
            {TEXT_SIZES.map((s) => {
              const active = settings.textSize === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ ...settings, textSize: s.value }, `Wielkość tekstu: ${s.label.toLowerCase()} (${s.value}%).`)}
                  className={cn(
                    "flex h-10 min-w-12 flex-1 items-center justify-center rounded-lg border font-semibold",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                  )}
                >
                  {/* Nazwa dostępna zaczyna się od widocznego napisu (WCAG 2.5.3), opis dla czytnika ekranu po nim. */}
                  <span style={{ fontSize: `${0.8 + (s.value - 100) / 200}rem` }}>{s.short}</span>
                  <span className="sr-only">
                    {" "}
                    – {s.label.toLowerCase()} tekst, {s.value}%
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Motyw</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const active = settings.theme === t.value;
              const Icon = THEME_ICONS[t.value];
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ ...settings, theme: t.value }, `Motyw: ${t.label.toLowerCase()}.`)}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-xs font-medium leading-tight",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          role="switch"
          aria-checked={settings.highContrast}
          onClick={() =>
            update({ ...settings, highContrast: !settings.highContrast }, settings.highContrast ? "Wysoki kontrast wyłączony." : "Wysoki kontrast włączony.")
          }
          className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2 text-left text-sm font-medium hover:bg-muted"
        >
          <span>Wysoki kontrast</span>
          <span
            aria-hidden
            className={cn(
              "flex size-6 items-center justify-center rounded border-2",
              settings.highContrast ? "border-primary bg-primary text-primary-foreground" : "border-input",
            )}
          >
            {settings.highContrast && <Check className="size-4" />}
          </span>
        </button>

        <div className="flex items-center justify-between gap-2 text-sm">
          <a href="/deklaracja-dostepnosci">Deklaracja dostępności</a>
          {!isDefault && (
            <button type="button" className="font-medium text-primary underline underline-offset-4" onClick={() => update(DEFAULT_DISPLAY, "Przywrócono ustawienia domyślne.")}>
              Przywróć domyślne
            </button>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </details>
  );
}
