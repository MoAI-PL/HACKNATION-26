"use client";
// Redakcja przez AI i własne notatki do rozmowy (Z24). Propozycja w <PropozycjaAI>, „Wstaw” dopisuje ją do notatek.

import * as React from "react";
import { Sparkles } from "lucide-react";
import { PropozycjaAI, type ProposalState } from "@/components/asystent/PropozycjaAI";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { logConversationAiDecisionAction, polishConversationAction } from "@/lib/rozmowa/actions";

export function RozmowaAI({ employeeId, kind }: { employeeId: string; kind: string }) {
  const [state, setState] = React.useState<ProposalState | null>(null);
  const [proposal, setProposal] = React.useState("");
  const [reason, setReason] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const cancelled = React.useRef(false);

  const ask = async () => {
    cancelled.current = false;
    setReason(null);
    setState("ladowanie");
    const r = await polishConversationAction(employeeId, kind);
    if (cancelled.current) return;
    if (r.ok && r.text) {
      setProposal(r.text);
      setState("gotowa");
    } else {
      setReason(r.reason ?? null);
      setState("niedostepna");
    }
  };

  return (
    <section aria-labelledby="notatki-rozmowy" className="flex flex-col gap-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h2 id="notatki-rozmowy" className="text-xl">
          Moje notatki do rozmowy
        </h2>
        {state === null && (
          <Button variant="outline" className="h-10" onClick={ask}>
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
            onInsert={(text) => setNotes((n) => (n.trim() ? `${n.trim()}\n\n${text}` : text))}
            onReject={() => undefined}
            onDecision={(d) => void logConversationAiDecisionAction(employeeId, { kind, ...d })}
            onCancel={() => {
              cancelled.current = true;
              setState(null);
            }}
            onRetry={ask}
          />
          {state === "niedostepna" && reason && <p className="mt-2 text-sm text-muted-foreground">{reason}</p>}
        </div>
      )}
      <Field label="Notatki" hint="Twoje punkty do rozmowy. Widoczne tylko na tym ekranie i na wydruku – nie zapisujemy ich w systemie.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-40 print:border-0" />
      </Field>
    </section>
  );
}
