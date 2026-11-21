"use client";

// Czat asystenta formalnego (Z22). Można go osadzić na osobnej stronie albo w panelu bocznym (Z10).
//   <AsystentFormalny krok="OCENA" />

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, BookOpen, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssistantAnswer } from "@/lib/ai/funkcje/asystent-formalny";
import { cn } from "@/lib/utils";

type Wpis = { id: number; pytanie: string } & ({ stan: "laduje" } | { stan: "blad"; blad: string } | { stan: "ok"; odp: AssistantAnswer });

interface Props {
  /** Krok ścieżki – decyduje o podpowiedziach pytań (np. "OSP", "KRYTERIA", "OCENA"). */
  krok?: string;
  className?: string;
}

export function AsystentFormalny({ krok, className }: Props) {
  const [pytanie, setPytanie] = useState("");
  const [wpisy, setWpisy] = useState<Wpis[]>([]);
  const [podpowiedzi, setPodpowiedzi] = useState<string[]>([]);
  const [aiDostepne, setAiDostepne] = useState<boolean | null>(null);
  const licznik = useRef(0);
  const koniec = useRef<HTMLDivElement>(null);
  const poleId = useId();
  const zajety = wpisy.some((w) => w.stan === "laduje");

  useEffect(() => {
    const q = krok ? `?krok=${encodeURIComponent(krok)}` : "";
    fetch(`/api/asystent/formalny${q}`)
      .then((r) => r.json())
      .then((d: { podpowiedzi: string[]; aiDostepne: boolean }) => {
        setPodpowiedzi(d.podpowiedzi);
        setAiDostepne(d.aiDostepne);
      })
      .catch(() => setAiDostepne(false));
  }, [krok]);

  useEffect(() => {
    koniec.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [wpisy]);

  async function zapytaj(tekst: string) {
    const q = tekst.trim();
    if (q.length < 3 || zajety) return;
    const id = ++licznik.current;
    setPytanie("");
    setWpisy((w) => [...w, { id, pytanie: q, stan: "laduje" }]);
    try {
      const res = await fetch("/api/asystent/formalny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pytanie: q, krok }),
      });
      const data = await res.json();
      setWpisy((w) =>
        w.map((x) =>
          x.id !== id ? x : res.ok ? { id, pytanie: q, stan: "ok", odp: data as AssistantAnswer } : { id, pytanie: q, stan: "blad", blad: data.blad ?? "Nie udało się uzyskać odpowiedzi." },
        ),
      );
    } catch {
      setWpisy((w) => w.map((x) => (x.id !== id ? x : { id, pytanie: q, stan: "blad", blad: "Brak połączenia z serwerem. Spróbuj ponownie." })));
    }
  }

  return (
    <section aria-label="Asystent formalny oceny" className={cn("flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground", className)}>
      <header className="flex items-start gap-3">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 className="font-semibold">Asystent formalny oceny</h2>
          <p className="text-sm text-muted-foreground">
            Odpowiada wyłącznie na podstawie rozporządzeń i poradników KPRM – zawsze ze wskazaniem źródła.
            {aiDostepne === false && " Model AI jest niedostępny – pokażę pasujące fragmenty przepisów."}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4" aria-live="polite">
        {wpisy.length === 0 && podpowiedzi.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Na przykład:</p>
            <ul className="flex flex-wrap gap-2">
              {podpowiedzi.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => zapytaj(p)}
                    className="rounded-full border bg-background px-3 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {wpisy.map((w) => (
          <div key={w.id} className="flex flex-col gap-2">
            <p className="self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{w.pytanie}</p>
            {w.stan === "laduje" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Szukam w przepisach…
              </p>
            )}
            {w.stan === "blad" && (
              <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                <AlertTriangle className="size-4 text-destructive" aria-hidden /> {w.blad}
              </p>
            )}
            {w.stan === "ok" && <Odpowiedz odp={w.odp} />}
          </div>
        ))}
        <div ref={koniec} />
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          zapytaj(pytanie);
        }}
      >
        <label htmlFor={poleId} className="sr-only">
          Pytanie do asystenta formalnego
        </label>
        <textarea
          id={poleId}
          value={pytanie}
          onChange={(e) => setPytanie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              zapytaj(pytanie);
            }
          }}
          rows={2}
          maxLength={500}
          placeholder="Zadaj pytanie o procedurę oceny, np. „Ile dni ma pracownik na sprzeciw?”"
          className="min-h-11 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <Button type="submit" disabled={zajety || pytanie.trim().length < 3} aria-label="Wyślij pytanie">
          <SendHorizontal aria-hidden />
        </Button>
      </form>
    </section>
  );
}

function Odpowiedz({ odp }: { odp: AssistantAnswer }) {
  if (odp.refused) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-2 text-sm">
        <p className="font-medium">{odp.answer}</p>
        <p className="mt-1 text-muted-foreground">Asystent odpowiada tylko na pytania o procedurę oceny, na które jest odpowiedź w przepisach i poradnikach.</p>
      </div>
    );
  }
  const ai = odp.mode === "AI";
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", ai ? "border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30" : "bg-muted/40")}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {ai ? (
          <>
            <Sparkles className="size-3.5 text-violet-600" aria-hidden /> Odpowiedź asystenta AI na podstawie źródeł
          </>
        ) : (
          <>
            <BookOpen className="size-3.5" aria-hidden /> Fragmenty źródeł (bez AI)
          </>
        )}
      </p>
      <p className="whitespace-pre-line">{odp.answer}</p>
      {odp.notice && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {odp.notice}
        </p>
      )}
      {odp.sources.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <p className="mb-1 text-xs font-medium">Źródła</p>
          <ol className="flex flex-col gap-1">
            {odp.sources.map((s, i) => (
              <li key={s.id}>
                <details className="group">
                  <summary className="cursor-pointer text-xs text-primary underline-offset-2 hover:underline">
                    [{i + 1}] {s.citation}
                  </summary>
                  <blockquote className="mt-1 border-l-2 pl-2 text-xs whitespace-pre-line text-muted-foreground">{s.quote}</blockquote>
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
