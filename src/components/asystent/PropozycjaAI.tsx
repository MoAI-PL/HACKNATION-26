"use client";

import * as React from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Wspólny wzorzec propozycji AI (Z10, sekcja 4.2). Każda funkcja AI w aplikacji używa TEGO komponentu.
// - fioletowa ramka, ikona ✦ i etykieta „Propozycja AI”;
// - treść edytowalna przed wstawieniem;
// - zawsze „Wstaw” (główny) i „Odrzuć”, przy funkcjach opartych na źródłach – lista źródeł;
// - ładowanie: szkielet + „Asystent przygotowuje propozycję…” + Anuluj;
// - brak modelu: spokojny komunikat, nic nie blokuje pracy.
// Każde „Wstaw” i „Odrzuć” wywołuje onDecision – funkcja zapisuje je w AuditLog razem z treścią propozycji.

export type ProposalState = "ladowanie" | "gotowa" | "niedostepna";

export interface ProposalSource {
  /** Nazwa dokumentu, np. „Rozporządzenie o ocenach okresowych”. */
  document: string;
  /** Jednostka redakcyjna, np. „§ 5 ust. 2”. */
  unit?: string;
  quote?: string;
  href?: string;
}

export interface ProposalDecision {
  decision: "WSTAW" | "ODRZUC";
  /** Treść zaproponowana przez AI. */
  proposal: string;
  /** Treść po edycji przez człowieka (przy „Wstaw”). */
  final?: string;
}

export interface PropozycjaAIProps {
  state: ProposalState;
  /** Co to za propozycja, np. „Kryteria dodatkowe dla stanowiska”. */
  title?: string;
  /** Tekst propozycji (edytowalny). Dla propozycji strukturalnych (Z23, Z41) użyj children. */
  proposal?: string;
  /** Własna treść propozycji zamiast pola tekstowego, np. lista kryteriów z cytatami. */
  children?: React.ReactNode;
  /** Czy tekst można edytować przed wstawieniem (domyślnie tak). */
  editable?: boolean;
  sources?: ProposalSource[];
  insertLabel?: string;
  onInsert: (text: string) => void;
  onReject: () => void;
  /**
   * Zapis decyzji do AuditLog (sekcja 4.2) – obowiązkowy. Najprościej: wspólna akcja `logAiDecision`
   * z `@/lib/audit/decyzje-ai` (użytkownik z sesji), albo akcja ekranu, która sprawdza dostęp do obiektu.
   */
  onDecision: (decision: ProposalDecision) => void;
  /** Anulowanie w trakcie ładowania. */
  onCancel?: () => void;
  /** Ponowienie, gdy asystent był niedostępny. */
  onRetry?: () => void;
  className?: string;
}

export function PropozycjaAI({
  state,
  title,
  proposal = "",
  children,
  editable = true,
  sources,
  insertLabel = "Wstaw",
  onInsert,
  onReject,
  onDecision,
  onCancel,
  onRetry,
  className,
}: PropozycjaAIProps) {
  const [text, setText] = React.useState(proposal);
  const [decided, setDecided] = React.useState<ProposalDecision["decision"] | null>(null);
  const textId = React.useId();

  // Nowa propozycja od asystenta zastępuje poprzednią treść i decyzję.
  React.useEffect(() => {
    setText(proposal);
    setDecided(null);
  }, [proposal]);

  const insert = () => {
    onDecision({ decision: "WSTAW", proposal, final: text });
    setDecided("WSTAW");
    onInsert(text);
  };
  const reject = () => {
    onDecision({ decision: "ODRZUC", proposal });
    setDecided("ODRZUC");
    onReject();
  };

  return (
    <section
      aria-label={title ? `Propozycja AI: ${title}` : "Propozycja AI"}
      aria-busy={state === "ladowanie"}
      className={cn("rounded-xl border-2 border-ai-border/60 bg-ai-soft p-4", className)}
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ai px-2.5 py-0.5 text-xs font-semibold text-ai-foreground">
          <Sparkles className="size-3.5" aria-hidden />
          Propozycja AI
        </span>
        {title && <span className="text-sm font-medium text-foreground">{title}</span>}
      </header>

      <div aria-live="polite">
        {state === "ladowanie" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Asystent przygotowuje propozycję…</p>
            <Skeleton className="h-4 w-11/12 bg-ai/10" />
            <Skeleton className="h-4 w-9/12 bg-ai/10" />
            <Skeleton className="h-4 w-10/12 bg-ai/10" />
            {onCancel && (
              <div>
                <Button variant="ghost" onClick={onCancel}>
                  Anuluj
                </Button>
              </div>
            )}
          </div>
        )}

        {state === "niedostepna" && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-foreground">
              Asystent jest chwilowo niedostępny. Możesz wypełnić pole samodzielnie.
            </p>
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                Spróbuj ponownie
              </Button>
            )}
          </div>
        )}

        {state === "gotowa" && decided && (
          <p className="text-sm text-muted-foreground">
            {decided === "WSTAW" ? "Propozycja została wstawiona." : "Propozycja została odrzucona."}
          </p>
        )}

        {state === "gotowa" && !decided && (
          <div className="flex flex-col gap-3">
            {children ??
              (editable ? (
                <>
                  <label htmlFor={textId} className="sr-only">
                    Treść propozycji – możesz ją poprawić przed wstawieniem
                  </label>
                  <textarea
                    id={textId}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-24 max-h-[28rem] w-full rounded-md border border-input bg-card px-3 py-2 text-base leading-relaxed [field-sizing:content]"
                  />
                </>
              ) : (
                <p className="whitespace-pre-line text-foreground">{proposal}</p>
              ))}

            {sources && sources.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <BookOpen className="size-4 text-primary" aria-hidden />
                  Źródła
                </p>
                <ul className="flex flex-col gap-2 text-sm">
                  {sources.map((s, i) => (
                    <li key={i}>
                      <span className="font-medium">
                        {s.document}
                        {s.unit ? `, ${s.unit}` : ""}
                      </span>
                      {s.quote && <span className="block text-muted-foreground italic">„{s.quote}”</span>}
                      {s.href && (
                        <a href={s.href} target="_blank" rel="noreferrer" className="text-primary underline">
                          Otwórz źródło
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="ai" onClick={insert}>
                {insertLabel}
              </Button>
              <Button variant="outline" onClick={reject}>
                Odrzuć
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              To tylko propozycja. Decyzję podejmujesz Ty – możesz ją poprawić albo odrzucić.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
