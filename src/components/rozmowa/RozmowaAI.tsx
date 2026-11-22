"use client";
// Redakcja przez AI i własne notatki do rozmowy. Propozycja w <PropozycjaAI>, „Wstaw” dopisuje ją do notatek.
// Notatki nie trafiają do systemu – zostają w tej przeglądarce (szkic na wypadek przełączenia zakładki) i na wydruku.

import * as React from "react";
import { Sparkles } from "lucide-react";
import { PropozycjaAI, type ProposalState } from "@/components/asystent/PropozycjaAI";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { logConversationAiDecisionAction, polishConversationAction } from "@/lib/rozmowa/actions";

function readDraft(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, value: string) {
  try {
    if (value.trim()) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // tryb prywatny albo zablokowany magazyn – notatki działają dalej, tylko bez szkicu
  }
}

export function RozmowaAI({ employeeId, kind }: { employeeId: string; kind: string }) {
  const draftKey = `kompas:rozmowa:${employeeId}:${kind}`;
  const [state, setState] = React.useState<ProposalState | null>(null);
  const [proposal, setProposal] = React.useState("");
  const [reason, setReason] = React.useState<string | null>(null);
  const [checks, setChecks] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");
  const cancelled = React.useRef(false);

  // Szkic czytamy dopiero w przeglądarce (bez rozjazdu z renderowaniem na serwerze).
  React.useEffect(() => setNotes(readDraft(draftKey)), [draftKey]);
  const updateNotes = (value: string) => {
    setNotes(value);
    writeDraft(draftKey, value);
  };

  const ask = async () => {
    cancelled.current = false;
    setReason(null);
    setChecks([]);
    setState("ladowanie");
    const r = await polishConversationAction(employeeId, kind);
    if (cancelled.current) return;
    if (r.ok && r.text) {
      setProposal(r.text);
      setChecks([r.notice, r.privacy].filter((x): x is string => Boolean(x)));
      setState("gotowa");
    } else {
      setReason(r.reason ?? null);
      setState("niedostepna");
    }
  };

  return (
    <section aria-labelledby="notatki-rozmowy" className="flex flex-col gap-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="notatki-rozmowy" className="text-xl">
          Moje notatki do rozmowy
        </h2>
        {state === null && (
          <Button variant="outline" className="h-10 print:hidden" onClick={ask}>
            <Sparkles aria-hidden /> Zredaguj otwarcie i informację zwrotną z AI
          </Button>
        )}
      </div>
      {state !== null && (
        <div className="print:hidden">
          <PropozycjaAI
            state={state}
            title="Otwarcie rozmowy i informacja zwrotna"
            proposal={proposal}
            insertLabel="Wstaw do notatek"
            onInsert={(text) => updateNotes(notes.trim() ? `${notes.trim()}\n\n${text}` : text)}
            onReject={() => undefined}
            onDecision={(d) => void logConversationAiDecisionAction(employeeId, { kind, ...d })}
            onCancel={() => {
              cancelled.current = true;
              setState(null);
            }}
            onRetry={ask}
          />
          {state === "niedostepna" && reason && <p className="mt-2 text-sm text-muted-foreground">{reason}</p>}
          {state === "gotowa" && checks.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              {checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="print:hidden">
        <Field label="Notatki" hint="Twoje punkty do rozmowy. Szkic zostaje tylko w tej przeglądarce i trafia na wydruk – nie zapisujemy go w systemie.">
          <Textarea value={notes} onChange={(e) => updateNotes(e.target.value)} className="min-h-40" />
        </Field>
      </div>
      {/* Na wydruku pełna treść notatek zamiast pola tekstowego, które ucina długi tekst. */}
      <div className="hidden whitespace-pre-wrap print:block">{notes.trim() || "………………………………………………………………………………………………………………"}</div>
    </section>
  );
}
