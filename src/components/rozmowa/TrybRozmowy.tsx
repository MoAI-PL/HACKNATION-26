"use client";
// Tryb rozmowy: jeden punkt na ekranie, duża czcionka, zegar, odhaczanie i notatki w trakcie rozmowy.
// Szkic (krok, odhaczone punkty, notatki, czas) zostaje w tej przeglądarce do zapisu – odświeżenie strony nic nie gubi.
// Klawiatura: → / PageDown – dalej, ← / PageUp – wstecz (poza polem notatki).

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookmarkPlus, Check, Copy, Pause, Play, Square } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { saveQuickNoteAction } from "@/lib/obserwacje/szybka-notatka";
import type { ConversationKind } from "@/lib/rozmowa/przygotowanie";
import { saveConversationAction, type SaveConversationResult } from "@/lib/rozmowa/tryb-akcje";
import {
  formatClock,
  MAX_CONVERSATION_NOTES_LENGTH,
  MAX_STEP_NOTE_LENGTH,
  missingRequired,
  SECTION_LABELS,
  summarizeConversation,
  type ConversationStep,
} from "@/lib/rozmowa/tryb";
import { cn } from "@/lib/utils";

interface Draft {
  index: number;
  done: string[];
  notes: Record<string, string>;
  elapsed: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readText(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(key, JSON.stringify(draft));
    else window.localStorage.removeItem(key);
  } catch {
    // tryb prywatny albo zablokowany magazyn – rozmowa działa dalej, tylko bez szkicu
  }
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

type Phase = "start" | "rozmowa" | "koniec";
type JournalState = "zapisywanie" | "zapisano" | string;

export interface TrybRozmowyProps {
  employeeId: string;
  kind: ConversationKind;
  title: string;
  steps: ConversationStep[];
  /** Ściąga z asystenta rozmowy – powrót. */
  prepHref: string;
}

export function TrybRozmowy({ employeeId, kind, title, steps, prepHref }: TrybRozmowyProps) {
  const draftKey = `kompas:tryb-rozmowy:${employeeId}:${kind}`;
  // Notatki przygotowane na ekranie ściągi – pokazujemy je w kroku otwarcia.
  const prepNotesKey = `kompas:rozmowa:${employeeId}:${kind}`;

  const [phase, setPhase] = React.useState<Phase>("start");
  const [index, setIndex] = React.useState(0);
  const [done, setDone] = React.useState<Set<string>>(new Set());
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [elapsed, setElapsed] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [restored, setRestored] = React.useState<Draft | null>(null);
  const [prepNotes, setPrepNotes] = React.useState("");
  const [journal, setJournal] = React.useState<Record<string, JournalState>>({});
  const [summary, setSummary] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<SaveConversationResult | null>(null);
  const [copied, setCopied] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const step = steps[index]!;
  const missing = missingRequired(steps, done);
  const requiredCount = steps.filter((s) => s.required).length;
  const hasContent = done.size > 0 || Object.values(notes).some((n) => n.trim());
  const saved = result?.ok === true;

  // Szkic i notatki ze ściągi czytamy dopiero w przeglądarce (bez rozjazdu z renderowaniem na serwerze).
  React.useEffect(() => {
    const d = readJson<Draft>(draftKey);
    if (d && (d.done?.length || Object.values(d.notes ?? {}).some((n) => n.trim()))) setRestored(d);
    setPrepNotes(readText(prepNotesKey).trim());
  }, [draftKey, prepNotesKey]);

  // Zapis szkicu przy każdej zmianie w trakcie rozmowy.
  React.useEffect(() => {
    if (phase === "start" || saved) return;
    writeDraft(draftKey, { index, done: [...done], notes, elapsed });
  }, [draftKey, phase, index, done, notes, elapsed, saved]);

  // Zegar rozmowy.
  React.useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  // Ostrzeżenie przed zamknięciem karty z niezapisanym przebiegiem.
  React.useEffect(() => {
    if (phase === "start" || saved || !hasContent) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, saved, hasContent]);

  const goTo = React.useCallback(
    (i: number) => {
      setIndex(Math.min(steps.length - 1, Math.max(0, i)));
      setPhase("rozmowa");
    },
    [steps.length],
  );

  const finish = React.useCallback(() => {
    setRunning(false);
    setSummary(summarizeConversation({ kind, steps, done, notes, durationSeconds: elapsed }));
    setResult(null);
    setPhase("koniec");
  }, [kind, steps, done, notes, elapsed]);

  // Nowy krok – fokus na tytule, żeby czytnik ekranu odczytał punkt rozmowy.
  React.useEffect(() => {
    if (phase === "rozmowa") headingRef.current?.focus();
  }, [index, phase]);

  React.useEffect(() => {
    if (phase !== "rozmowa") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        if (index < steps.length - 1) goTo(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, index, steps.length, goTo]);

  const start = (from: Draft | null) => {
    if (from) {
      setIndex(Math.min(steps.length - 1, Math.max(0, from.index ?? 0)));
      setDone(new Set((from.done ?? []).filter((id) => steps.some((s) => s.id === id))));
      setNotes(from.notes ?? {});
      setElapsed(from.elapsed ?? 0);
    } else {
      writeDraft(draftKey, null);
      setIndex(0);
      setDone(new Set());
      setNotes({});
      setElapsed(0);
    }
    setRestored(null);
    setRunning(true);
    setPhase("rozmowa");
  };

  const toggleDone = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setNote = (id: string, value: string) => {
    setNotes((prev) => ({ ...prev, [id]: value.slice(0, MAX_STEP_NOTE_LENGTH) }));
    setJournal((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveToJournal = async (s: ConversationStep) => {
    const text = (notes[s.id] ?? "").trim();
    if (!text) return;
    setJournal((prev) => ({ ...prev, [s.id]: "zapisywanie" }));
    const r = await saveQuickNoteAction({ employeeId, originalText: `${s.title}: ${text}`.slice(0, MAX_STEP_NOTE_LENGTH) });
    setJournal((prev) => ({ ...prev, [s.id]: r.ok ? "zapisano" : (r.message ?? "Nie udało się zapisać notatki.") }));
  };

  const save = async () => {
    setSaving(true);
    const r = await saveConversationAction(employeeId, { kind, notes: summary });
    setSaving(false);
    setResult(r);
    if (r.ok) writeDraft(draftKey, null);
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  if (phase === "start") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Tryb rozmowy</p>
          <h1 className="text-3xl">{title}</h1>
          <p className="text-lg text-muted-foreground">
            {steps.length} punktów na ekranie, po jednym. {requiredCount} z nich to zakres rozmowy z przepisu – odhacz je, gdy je omówisz. Notatki
            zapiszesz na końcu jako przebieg rozmowy, a wybrane – od razu w dzienniku obserwacji.
          </p>
        </header>
        {restored && (
          <Notice
            tone="info"
            title="Masz niezapisaną rozmowę w tej przeglądarce"
            action={
              <>
                <Button className="h-10" onClick={() => start(restored)}>
                  <Play aria-hidden /> Wznów rozmowę
                </Button>
                <Button variant="outline" className="h-10" onClick={() => start(null)}>
                  Zacznij od nowa
                </Button>
              </>
            }
          >
            Odhaczone punkty: {restored.done?.length ?? 0}, czas: {formatClock(restored.elapsed ?? 0)}.
          </Notice>
        )}
        {!restored && (
          <div className="flex flex-wrap gap-2">
            <Button className="h-12 px-6 text-base" onClick={() => start(null)}>
              <Play aria-hidden /> Rozpocznij rozmowę
            </Button>
            <Link href={prepHref} className={cn(buttonVariants({ variant: "outline" }), "h-12 px-6 text-base")}>
              Wróć do ściągi
            </Link>
          </div>
        )}
        <p className="text-sm text-muted-foreground">Klawiatura: → dalej, ← wstecz (poza polem notatki).</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Koniec – podsumowanie i zapis
  // ---------------------------------------------------------------------------
  if (phase === "koniec") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Tryb rozmowy · czas {formatClock(elapsed)}</p>
          <h1 className="text-3xl">Podsumowanie rozmowy</h1>
          <p className="text-muted-foreground">{title}</p>
        </header>

        {missing.length > 0 && !saved && (
          <Notice tone="warning" title={`Nie omówiono ${missing.length} z ${requiredCount} punktów zakresu rozmowy`} legalBasis={missing[0]!.hint}>
            <ul className="mt-1 flex flex-col gap-1">
              {missing.map((s) => (
                <li key={s.id}>
                  <button type="button" className="text-left underline underline-offset-2" onClick={() => goTo(steps.indexOf(s))}>
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2">Możesz wrócić do rozmowy albo zapisać przebieg z informacją, czego nie omówiono.</p>
          </Notice>
        )}

        {!saved && (
          <Field
            label="Przebieg rozmowy"
            hint="Tekst powstał z odhaczonych punktów i notatek. Popraw go, jeśli trzeba – zapisze się w historii rozmów z pracownikiem."
          >
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value.slice(0, MAX_CONVERSATION_NOTES_LENGTH))}
              className="min-h-72 text-base"
            />
          </Field>
        )}

        {result && !result.ok && (
          <Notice
            tone="warning"
            title="Przebieg rozmowy nie został zapisany"
            action={
              <>
                <Button variant="outline" className="h-10" onClick={copySummary}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Skopiowano" : "Kopiuj notatki"}
                </Button>
                {result.href && (
                  <Link href={result.href} className={cn(buttonVariants(), "h-10")}>
                    {kind === "WSTEPNA" ? "Przejdź do pierwszej oceny" : "Przejdź do kreatora oceny"}
                  </Link>
                )}
              </>
            }
          >
            {result.reason}
          </Notice>
        )}

        {saved ? (
          <Notice
            tone="success"
            title={result?.ok && result.appended ? "Dopisano notatki do zapisu tej rozmowy" : "Zapisano przebieg rozmowy"}
            action={
              <>
                <Link href={prepHref} className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                  Wróć do ściągi
                </Link>
                <Link href={`/pulpit/pracownik/${encodeURIComponent(employeeId)}`} className={cn(buttonVariants(), "h-10")}>
                  Karta pracownika
                </Link>
              </>
            }
          >
            Notatki z kroków zapisane w dzienniku obserwacji czekają na przypięcie do wskaźnika w sekcji „Nieprzypięte do wskaźnika”.
          </Notice>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button className="h-12 px-6 text-base" onClick={save} disabled={saving || !summary.trim()}>
              {saving ? "Zapisywanie…" : "Zapisz przebieg rozmowy"}
            </Button>
            <Button
              variant="outline"
              className="h-12 px-6 text-base"
              onClick={() => {
                setRunning(true);
                setPhase("rozmowa");
              }}
            >
              <ArrowLeft aria-hidden /> Wróć do rozmowy
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Rozmowa – jeden punkt na ekranie
  // ---------------------------------------------------------------------------
  const isLast = index === steps.length - 1;
  const journalState = journal[step.id];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-normal text-muted-foreground">{title}</h1>
          <p className="text-sm">
            Punkt {index + 1} z {steps.length}
            <span className="text-muted-foreground"> · zakres z przepisu: {requiredCount - missing.length}/{requiredCount}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl tabular-nums" aria-label={`Czas rozmowy ${formatClock(elapsed)}`} role="timer">
            {formatClock(elapsed)}
          </span>
          <Button variant="outline" className="h-10" onClick={() => setRunning((r) => !r)} aria-pressed={!running}>
            {running ? <Pause aria-hidden /> : <Play aria-hidden />} {running ? "Pauza" : "Wznów"}
          </Button>
          <Button variant="outline" className="h-10" onClick={finish}>
            <Square aria-hidden /> Zakończ
          </Button>
        </div>
      </div>

      <nav aria-label="Punkty rozmowy" className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(i)}
            aria-current={i === index ? "step" : undefined}
            aria-label={`${i + 1}. ${SECTION_LABELS[s.section]}: ${s.title}${done.has(s.id) ? " – omówione" : s.required ? " – obowiązkowy" : ""}`}
            title={s.title}
            className={cn(
              "h-3 w-8 rounded-full border transition-colors",
              done.has(s.id) ? "border-success bg-success" : s.required ? "border-warning bg-warning-soft" : "border-border bg-muted",
              i === index && "ring-2 ring-ring ring-offset-2",
            )}
          />
        ))}
      </nav>

      <section aria-labelledby="punkt-rozmowy" className="flex flex-col gap-5 rounded-xl border bg-card p-6 md:p-8">
        <p className="text-sm font-medium text-muted-foreground">
          {SECTION_LABELS[step.section]}
          {step.required && <span className="ml-2 rounded-md bg-warning-soft px-2 py-0.5 text-warning">punkt obowiązkowy</span>}
        </p>
        <h2 id="punkt-rozmowy" ref={headingRef} tabIndex={-1} className="text-2xl leading-snug outline-none md:text-3xl">
          {step.title}
        </h2>
        {step.lines.length > 0 && (
          <ul className="flex list-disc flex-col gap-2 pl-6 text-lg">
            {step.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {step.hint && <p className="text-sm text-muted-foreground">{step.hint}</p>}

        {step.section === "OTWARCIE" && prepNotes && (
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">Twoje notatki przygotowane przed rozmową</summary>
            <p className="mt-2 whitespace-pre-wrap text-base">{prepNotes}</p>
          </details>
        )}

        <label className="flex cursor-pointer items-center gap-3 self-start rounded-lg border px-4 py-3 text-lg">
          <input type="checkbox" className="size-5 accent-success" checked={done.has(step.id)} onChange={() => toggleDone(step.id)} />
          Omówione
        </label>

        <Field
          label="Notatka do tego punktu"
          hint="Fakty, ustalenia, terminy. Trafi do przebiegu rozmowy; możesz ją też od razu zapisać w dzienniku obserwacji."
        >
          <Textarea value={notes[step.id] ?? ""} onChange={(e) => setNote(step.id, e.target.value)} className="min-h-28 text-base" />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-10"
            onClick={() => saveToJournal(step)}
            disabled={!(notes[step.id] ?? "").trim() || journalState === "zapisywanie" || journalState === "zapisano"}
          >
            <BookmarkPlus aria-hidden /> {journalState === "zapisano" ? "Zapisano w dzienniku" : "Zapisz w dzienniku obserwacji"}
          </Button>
          {journalState && journalState !== "zapisywanie" && journalState !== "zapisano" && (
            <p role="alert" className="text-sm text-danger">
              {journalState}
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" className="h-12 px-6 text-base" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ArrowLeft aria-hidden /> Wstecz
        </Button>
        {isLast ? (
          <Button className="h-12 px-6 text-base" onClick={finish}>
            Zakończ rozmowę <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button className="h-12 px-6 text-base" onClick={() => goTo(index + 1)}>
            Dalej <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
