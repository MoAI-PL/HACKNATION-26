"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GLOSSARY } from "@/lib/domain/slownik";

// „ⓘ Dlaczego?” (komponent, przepisy w kontekście – treści) i dymki z wyjaśnieniem żargonu.
// Otwierane kliknięciem lub klawiszem Enter/Spacja, zamykane Esc – działa bez myszy i na tablecie
// (nie używamy samego najechania kursorem).

export interface InfoTipProps {
  /** Krótkie wyjaśnienie zwykłym językiem. */
  children: React.ReactNode;
  /** Podstawa prawna, np. „§ 5 ust. 2 rozporządzenia o ocenach okresowych”. */
  legalBasis?: string;
  /** Cytat z przepisu (baza wiedzy). */
  quote?: string;
  /** Link do źródła. */
  href?: string;
  /** Tekst przycisku; domyślnie „Dlaczego?”. */
  label?: string;
  /** Temat dla czytnika ekranu („Dlaczego? – kryteria dodatkowe”), gdy na stronie jest kilka przycisków „Dlaczego?”. */
  topic?: string;
  className?: string;
}

export function InfoTip({ children, legalBasis, quote, href, label = "Dlaczego?", topic, className }: InfoTipProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "inline-flex min-h-6 items-center gap-1 rounded-md px-1 text-sm text-primary hover:bg-secondary",
          className,
        )}
      >
        <Info className="size-4" aria-hidden />
        <span>{label}</span>
        {topic && <span className="sr-only"> – {topic}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={topic ? `${label} – ${topic}` : label}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-lg"
        >
          <div className="flex flex-col gap-2 pr-6">
            <div>{children}</div>
            {legalBasis && <p className="font-medium text-primary">{legalBasis}</p>}
            {quote && (
              <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
                {quote}
              </blockquote>
            )}
            {href && (
              <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                Zobacz źródło<span className="sr-only"> (otwiera się w nowej karcie)</span>
              </a>
            )}
          </div>
          <Popover.Close
            className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Zamknij wyjaśnienie"
          >
            <X className="size-4" aria-hidden />
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Termin z dymkiem wyjaśnienia ze słownika (GLOSSARY), np. <Term>OSP</Term>.
 * Gdy terminu nie ma w słowniku, wyświetla sam tekst.
 */
export function Term({ children, explanation }: { children: string; explanation?: string }) {
  const text = explanation ?? GLOSSARY[children];
  if (!text) return <>{children}</>;
  return (
    <Popover.Root>
      <Popover.Trigger className="cursor-help rounded-sm underline decoration-dotted decoration-1 underline-offset-4">
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={4}
          collisionPadding={12}
          className="z-50 max-w-xs rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
        >
          <span className="font-medium">{children}</span> – {text}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
