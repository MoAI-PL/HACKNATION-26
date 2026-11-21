"use client";
// Szybka notatka w 10 sekund (Z41, wyróżnik ①). Skrót N albo przycisk „Notatka” w nagłówku otwiera okno z jednym polem.
// Asystent proponuje pracownika, wskaźnik, Sytuację – Działanie – Rezultat i najbliższy opis zachowania (<PropozycjaAI>).
// Przełożony zapisuje jednym przyciskiem albo poprawia listami wyboru. Bez AI notatka zapisuje się jako tekst do przypięcia.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChoiceCardGroup } from "@/components/ui/choice-cards";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PropozycjaAI } from "@/components/asystent/PropozycjaAI";
import { useShortcutEvent } from "@/components/layout/useShortcut";
import { SHORTCUT_EVENTS } from "@/lib/ui/shortcuts";
import { selectClass } from "@/lib/obserwacje/stale";
import type { QuickNoteErrors, QuickNoteProposal } from "@/lib/ai/funkcje/szybka-notatka";
import {
  proposeQuickNoteAction,
  quickNoteContextAction,
  rejectQuickNoteProposalAction,
  saveQuickNoteAction,
  type QuickNoteContext,
} from "@/lib/obserwacje/szybka-notatka";
import { cn } from "@/lib/utils";

const MAX_NOTE = 1000;

type Step = "pisanie" | "ladowanie" | "propozycja" | "zapisano";

interface Draft {
  employeeId: string;
  indicatorId: string;
  behaviorLevel: string;
  situation: string;
  action: string;
  outcome: string;
}

const EMPTY_DRAFT: Draft = { employeeId: "", indicatorId: "", behaviorLevel: "", situation: "", action: "", outcome: "" };

function draftFrom(p: QuickNoteProposal): Draft {
  return {
    employeeId: p.employeeId ?? "",
    indicatorId: p.indicatorId ?? "",
    behaviorLevel: p.behaviorLevel ? String(p.behaviorLevel) : "",
    situation: p.situation,
    action: p.action,
    outcome: p.outcome,
  };
}

export function SzybkaNotatka() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("pisanie");
  const [ctx, setCtx] = React.useState<QuickNoteContext | null>(null);
  const [note, setNote] = React.useState("");
  const [proposal, setProposal] = React.useState<QuickNoteProposal | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = React.useState<QuickNoteErrors>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<{ employeeId: string; employeeName: string; pinned: boolean } | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const request = React.useRef(0);
  const saveRef = React.useRef<HTMLButtonElement>(null);

  const reset = () => {
    setStep("pisanie");
    setNote("");
    setProposal(null);
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setMessage(null);
    setSaved(null);
  };

  const openNote = React.useCallback(() => {
    setOpen(true);
    if (!ctx) {
      quickNoteContextAction()
        .then(setCtx)
        .catch(() => setMessage("Nie udało się wczytać listy pracowników. Zamknij okno i spróbuj ponownie."));
    }
  }, [ctx]);

  // Skrót N i przycisk w nagłówku wysyłają to samo zdarzenie; preventDefault = „obsłużone”.
  useShortcutEvent(SHORTCUT_EVENTS.quickNote, (e) => {
    e.preventDefault();
    openNote();
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      request.current++; // odpowiedź asystenta po zamknięciu okna jest ignorowana
      if (step === "zapisano") reset();
    }
  };

  const ask = async () => {
    const text = note.trim();
    if (!text) {
      setErrors({ originalText: "Wpisz notatkę – wystarczy jedno zdanie." });
      return;
    }
    setErrors({});
    setMessage(null);
    setStep("ladowanie");
    const id = ++request.current;
    try {
      const r = await proposeQuickNoteAction(text);
      if (id !== request.current) return;
      if (!r.ok) {
        setErrors({ originalText: r.message });
        setStep("pisanie");
        return;
      }
      setProposal(r.proposal);
      setDraft(draftFrom(r.proposal));
      setAttempt((a) => a + 1);
      setStep("propozycja");
    } catch {
      if (id !== request.current) return;
      manual("Asystent AI jest chwilowo niedostępny. Zapisz notatkę – przypniesz ją do wskaźnika później w dzienniku.");
    }
  };

  /** Ścieżka bez AI: te same pola, wypełniane ręcznie. */
  const manual = (notice?: string) => {
    setProposal({
      mode: "BEZ_AI",
      employeeId: draft.employeeId || null,
      indicatorId: null,
      competency: null,
      behaviorLevel: null,
      situation: "",
      action: "",
      outcome: "",
      notice,
      durationMs: 0,
    });
    setDraft((d) => ({ ...EMPTY_DRAFT, employeeId: d.employeeId }));
    setStep("propozycja");
  };

  const save = async () => {
    if (!proposal) return;
    setSaving(true);
    setMessage(null);
    try {
      const fromAi = proposal.mode === "AI";
      const r = await saveQuickNoteAction({
        employeeId: draft.employeeId,
        originalText: note.trim(),
        indicatorId: draft.indicatorId || null,
        behaviorLevel: draft.behaviorLevel ? Number(draft.behaviorLevel) : null,
        situation: draft.situation,
        action: draft.action,
        outcome: draft.outcome,
        fromAi,
        proposal: fromAi ? proposal : undefined,
      });
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        setAttempt((a) => a + 1); // propozycja wraca do edycji
        return;
      }
      setSaved({ employeeId: r.employeeId, employeeName: r.employeeName, pinned: r.pinned });
      setStep("zapisano");
      router.refresh();
    } catch {
      setMessage("Nie udało się zapisać notatki. Spróbuj ponownie – Twój tekst jest nadal w oknie.");
      setAttempt((a) => a + 1);
    } finally {
      setSaving(false);
    }
  };

  // Po pojawieniu się propozycji fokus na „Zapisz” – Enter kończy notatkę (cel: 10 sekund).
  React.useEffect(() => {
    if (step !== "propozycja") return;
    // W <PropozycjaAI> przycisk „Zapisz notatkę” to przycisk w wariancie AI; w trybie bez AI – nasz przycisk.
    requestAnimationFrame(() =>
      (saveRef.current ?? document.querySelector<HTMLButtonElement>('[role="dialog"] button[data-variant="ai"]'))?.focus(),
    );
  }, [step, attempt]);

  const competencies = ctx?.competencies ?? [];
  const indicator = competencies.flatMap((c) => c.indicators).find((i) => i.id === draft.indicatorId);
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v, ...(k === "indicatorId" ? { behaviorLevel: "" } : {}) }));

  const fields = (
    <div className="flex flex-col gap-4">
      <blockquote className="rounded-md border-l-4 border-primary/40 bg-muted px-3 py-2 text-sm whitespace-pre-line">{note.trim()}</blockquote>

      <Field label="Pracownik" required error={errors.employeeId}>
        <select className={selectClass} value={draft.employeeId} onChange={(e) => set("employeeId")(e.target.value)}>
          <option value="">— wybierz osobę —</option>
          {ctx?.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Wskaźnik z modelu kompetencji"
        hint={proposal?.mode === "AI" && proposal.justification ? `Dlaczego: ${proposal.justification}` : "Bez wskaźnika notatka czeka w dzienniku na przypięcie."}
        error={errors.indicatorId}
      >
        <select className={selectClass} value={draft.indicatorId} onChange={(e) => set("indicatorId")(e.target.value)}>
          <option value="">— bez wskaźnika (przypnę później) —</option>
          {competencies.map((c) => (
            <optgroup key={c.code} label={c.name}>
              {c.indicators.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      {indicator && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Najbliższy opis zachowania</p>
          <ChoiceCardGroup
            label={`Najbliższy opis zachowania: ${indicator.name}`}
            columns={1}
            value={draft.behaviorLevel || "0"}
            onValueChange={set("behaviorLevel")}
            options={[
              ...indicator.levels.map((desc, i) => ({ value: String(i + 1), label: desc })).reverse(),
              { value: "0", label: "Nie wskazuję poziomu" },
            ]}
          />
          {errors.behaviorLevel && (
            <p role="alert" className="text-sm font-medium text-danger">
              {errors.behaviorLevel}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3">
        <Field label="Sytuacja" hint="Kiedy i w jakich okolicznościach?">
          <Textarea className="min-h-16" value={draft.situation} onChange={(e) => set("situation")(e.target.value)} />
        </Field>
        <Field label="Działanie" hint="Co konkretnie zrobiła ta osoba?">
          <Textarea className="min-h-16" value={draft.action} onChange={(e) => set("action")(e.target.value)} />
        </Field>
        <Field label="Rezultat" hint="Jaki był skutek?" error={errors.sdr}>
          <Textarea className="min-h-16" value={draft.outcome} onChange={(e) => set("outcome")(e.target.value)} />
        </Field>
      </div>

      {proposal?.mode === "AI" && proposal.sentText && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {proposal.privacy ?? "Imiona i nazwiska nie trafiły do modelu."} Asystent dostał: „{proposal.sentText}”
          </span>
        </p>
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Szybka notatka"
      description={step === "pisanie" ? "Napisz jednym zdaniem, co zauważyłeś. Asystent przypnie notatkę do pracownika i wskaźnika." : undefined}
      className="w-[min(44rem,calc(100vw-2rem))]"
    >
      {message && (
        <Notice tone="error" title={message} />
      )}

      {step === "pisanie" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <Field
            label="Notatka"
            hint="Np. „Kasia świetnie poprowadziła dziś spotkanie z DSI, mimo że strony się kłóciły”. Ctrl + Enter – dalej."
            error={errors.originalText}
          >
            <Textarea
              autoFocus
              maxLength={MAX_NOTE}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void ask();
                }
              }}
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!note.trim()) return setErrors({ originalText: "Wpisz notatkę – wystarczy jedno zdanie." });
                manual();
              }}
            >
              Zapisz bez AI
            </Button>
            <Button type="submit">Dalej</Button>
          </div>
        </form>
      )}

      {step === "ladowanie" && (
        <PropozycjaAI
          state="ladowanie"
          title="Przypinanie notatki"
          onInsert={() => undefined}
          onReject={() => undefined}
          onDecision={() => undefined}
          onCancel={() => {
            request.current++;
            setStep("pisanie");
          }}
        />
      )}

      {step === "propozycja" && proposal?.mode === "AI" && (
        <PropozycjaAI
          key={attempt}
          state="gotowa"
          title="Notatka przypięta do wskaźnika"
          insertLabel={saving ? "Zapisywanie…" : "Zapisz notatkę"}
          onInsert={() => void save()}
          onReject={() => manual("Propozycja odrzucona – uzupełnij pola sam albo zapisz notatkę bez przypięcia.")}
          // „Zapisz” trafia do AuditLog po zapisie na serwerze (saveQuickNoteAction – z ostateczną wersją i id notatki),
          // „Odrzuć” – od razu tutaj.
          onDecision={(d) => {
            if (d.decision === "ODRZUC") void rejectQuickNoteProposalAction(proposal);
          }}
        >
          {fields}
        </PropozycjaAI>
      )}

      {step === "propozycja" && proposal?.mode === "BEZ_AI" && (
        <div className="flex flex-col gap-4">
          {proposal.notice && <Notice tone="info" title={proposal.notice} />}
          {fields}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("pisanie")}>
              Wróć do notatki
            </Button>
            <Button ref={saveRef} onClick={() => void save()} disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz notatkę"}
            </Button>
          </div>
        </div>
      )}

      {step === "zapisano" && saved && (
        <div className="flex flex-col gap-4" role="status">
          <p className="flex items-start gap-2 text-foreground">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <span>
              Notatka o osobie <strong>{saved.employeeName}</strong> jest w dzienniku
              {saved.pinned ? " i przypięta do wskaźnika." : ". Przypniesz ją do wskaźnika w dzienniku obserwacji."}
            </span>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href={`/obserwacje?osoba=${encodeURIComponent(saved.employeeId)}`}
              className={cn(buttonVariants({ variant: "outline" }), "no-underline")}
              onClick={() => onOpenChange(false)}
            >
              Otwórz dziennik
            </Link>
            <Button autoFocus onClick={reset}>
              Kolejna notatka
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

