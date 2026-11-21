"use client";
// Asystent języka (Z40, wyróżnik ④). Pod polem uzasadnienia, IPRZ i wniosku: gdy tekst opisuje osobę zamiast zachowania,
// pojawia się podpowiedź z reguł (od razu, bez AI), a na prośbę – propozycja przeformułowania od modelu z przyciskiem „Zastosuj”.
// Działa po przerwie w pisaniu (nie przy każdym znaku). Decyzje „Zastosuj” / „Odrzuć” trafiają do dziennika decyzji (Z10, Z35).

import * as React from "react";
import { Lightbulb, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropozycjaAI, type ProposalState } from "@/components/asystent/PropozycjaAI";
import { detectLanguageIssues, ISSUE_LABELS, type LanguageIssue } from "@/lib/ai/jezyk/reguly";
import type { RewriteField, RewriteResult } from "@/lib/ai/funkcje/asystent-jezyka";
import { rewriteLanguageAction } from "@/lib/ocena/asystent-jezyka-akcje";
import { logAiDecision } from "@/lib/audit/decyzje-ai";

/** Przerwa w pisaniu, po której sprawdzamy tekst. */
const PAUSE_MS = 900;

export function AsystentJezyka({
  evaluationId,
  field,
  value,
  onApply,
}: {
  evaluationId: string;
  field: RewriteField;
  value: string;
  onApply: (text: string) => void;
}) {
  const [checked, setChecked] = React.useState(value);
  const [dismissed, setDismissed] = React.useState<string | null>(null);
  const [ai, setAi] = React.useState<{ state: ProposalState; result?: RewriteResult; source?: string } | null>(null);
  const request = React.useRef(0);

  // Sprawdzenie dopiero po przerwie w pisaniu.
  React.useEffect(() => {
    const t = setTimeout(() => setChecked(value), PAUSE_MS);
    return () => clearTimeout(t);
  }, [value]);

  const issues = React.useMemo(() => detectLanguageIssues(checked), [checked]);
  const signature = issues.map((i) => `${i.kind}:${i.phrase.toLowerCase()}`).join("|");

  // Nowy tekst → stara propozycja AI przestaje pasować.
  React.useEffect(() => {
    if (ai && ai.source !== value && ai.state !== "ladowanie") setAi(null);
  }, [value, ai]);

  const ask = async () => {
    const id = ++request.current;
    const source = value;
    setAi({ state: "ladowanie", source });
    try {
      const r = await rewriteLanguageAction(evaluationId, field, source);
      if (id !== request.current) return;
      if (!r.ok || r.result.mode !== "AI" || !r.result.text) {
        setAi({ state: "niedostepna", result: r.ok ? r.result : undefined, source });
        return;
      }
      setAi({ state: "gotowa", result: r.result, source });
    } catch {
      if (id === request.current) setAi({ state: "niedostepna", source });
    }
  };

  if (ai) {
    return (
      <div className="flex flex-col gap-2">
        <PropozycjaAI
          state={ai.state}
          title="Ten sam tekst jako opis zachowań"
          proposal={ai.result?.text ?? ""}
          insertLabel="Zastosuj"
          onInsert={(text) => {
            onApply(text);
            setAi(null);
          }}
          onReject={() => setAi(null)}
          onCancel={() => {
            request.current++;
            setAi(null);
          }}
          onRetry={() => void ask()}
          onDecision={(d) =>
            void logAiDecision({
              funkcja: "ASYSTENT_JEZYKA",
              entity: "Evaluation",
              entityId: evaluationId,
              decision: d.decision,
              mode: ai.result?.mode,
              proposal: { pole: field, oryginal: ai.source, propozycja: d.proposal },
              final: d.final,
            })
          }
        />
        {ai.state === "gotowa" && ai.result && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {ai.result.placeholders.length > 0 && (
              <p>Uzupełnij fragmenty w nawiasach „[uzupełnij: …]” – asystent nie dopisuje faktów, których nie podałeś.</p>
            )}
            <p className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Imiona i nazwiska nie trafiły do modelu.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (issues.length === 0 || dismissed === signature) return null;

  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Lightbulb className="size-4 text-warning" aria-hidden />
        Asystent języka: opisz zachowanie, nie osobę
      </p>
      <ul className="flex flex-col gap-1.5">
        {issues.slice(0, 4).map((i) => (
          <IssueItem key={`${i.start}-${i.phrase}`} issue={i} />
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="ai" size="sm" className="h-8" onClick={() => void ask()}>
          <Sparkles aria-hidden />
          Przeformułuj z AI
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setDismissed(signature)}>
          Zostaw bez zmian
        </Button>
      </div>
    </div>
  );
}

function IssueItem({ issue }: { issue: LanguageIssue }) {
  return (
    <li className="text-foreground">
      <span className="font-medium">„{issue.phrase}”</span> – {ISSUE_LABELS[issue.kind]}{" "}
      <span className="text-muted-foreground">Spróbuj: {issue.hint}.</span>
    </li>
  );
}
