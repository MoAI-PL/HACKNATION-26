"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { AutosaveIndicator } from "@/components/ui/wizard";
import { RESULT_LABELS, LEVEL_LABELS } from "@/lib/domain/slownik";
import type { FirstEvalScoreResult, IsoDate } from "@/lib/domain/types";
import type { AutosaveState } from "@/lib/ui/status";
import { levelForFirstEvalPoints } from "@/lib/rules/punktacja";
import { formatDatePl } from "@/lib/rules/kalendarz";
import { completionIssues, type FirstEvalPerson, type FormIssue } from "@/lib/pierwsza-ocena/przebieg";
import { acknowledgeFirstEval, completeFirstEval, saveCompletionDraft } from "@/app/(przelozony)/ocena/pierwsza/actions";

export interface ElementRow {
  competency: string;
  name: string;
  score: number | null;
  suggestedScore: number | null;
  overrideReason?: string;
}

const fmt = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });

/** Wynik według § 10: oceny elementów, ocena łączna, warunki oceny pozytywnej z podstawą prawną. */
export function WynikPierwszej({ elements, result }: { elements: ElementRow[]; result: FirstEvalScoreResult }) {
  const positive = result.result === "POZYTYWNA";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          Wynik: {RESULT_LABELS[result.result]}
          <StatusBadge tone={positive ? "success" : "danger"} variant="solid">
            ocena łączna {fmt(result.average)} pkt
          </StatusBadge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Oceny cząstkowe elementów pierwszej oceny</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-medium">Element</th>
                <th scope="col" className="py-1 pr-2 font-medium">Ocena</th>
                <th scope="col" className="py-1 font-medium">Sugestia systemu</th>
              </tr>
            </thead>
            <tbody>
              {elements.map((e) => (
                <tr key={e.competency} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{e.name}</td>
                  <td className="py-1.5 pr-2 font-medium">
                    {e.score !== null ? `${e.score} pkt – ${LEVEL_LABELS[levelForFirstEvalPoints(e.score)]}` : "brak"}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {e.suggestedScore === null ? "—" : `${e.suggestedScore} pkt`}
                    {e.overrideReason && <span className="block text-xs">Inaczej niż sugestia: {e.overrideReason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="rounded-lg border bg-background p-3" open={!positive}>
          <summary className="cursor-pointer font-medium text-primary">Dlaczego taki wynik?</summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {result.explanations.map((x, k) => (
              <li key={k}>
                {x.text}
                {x.legalBasis && <span className="text-muted-foreground"> ({x.legalBasis})</span>}
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

/** Krok 4: uzasadnienie (obowiązkowe przy negatywnej), wnioski rozwojowe (tylko przy pozytywnej), data sporządzenia. */
export function SporzadzeniePierwszej({
  evaluationId,
  result,
  person,
  today,
  reportSubmittedAt,
  initial,
}: {
  evaluationId: string;
  result: FirstEvalScoreResult;
  person: FirstEvalPerson;
  today: IsoDate;
  reportSubmittedAt?: IsoDate;
  initial: { evaluatedAt?: IsoDate; justification: string; developmentPlan: string };
}) {
  const router = useRouter();
  const positive = result.result === "POZYTYWNA";
  const [form, setForm] = React.useState({
    evaluatedAt: initial.evaluatedAt ?? "",
    justification: initial.justification,
    developmentPlan: positive ? initial.developmentPlan : "",
  });
  const [autosave, setAutosave] = React.useState<AutosaveState>({ status: "idle" });
  const [issues, setIssues] = React.useState<FormIssue[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const issue = (f: string) => issues.find((i) => i.field === f)?.text;

  const draft = async () => {
    setAutosave({ status: "saving" });
    try {
      const r = await saveCompletionDraft(evaluationId, form);
      setAutosave(r.ok ? { status: "saved", at: new Date(r.savedAt) } : { status: "error", message: r.error });
    } catch {
      setAutosave({ status: "error", message: "Brak połączenia – zmiany nie zostały zapisane." });
    }
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setIssues([]);
    setError(null);
  };

  const complete = async () => {
    const local = completionIssues(form, { ...person, result, reportSubmittedAt, today });
    if (local.length) {
      setIssues(local);
      setError("Uzupełnij brakujące elementy, zanim sporządzisz ocenę.");
      return;
    }
    setBusy(true);
    try {
      const r = await completeFirstEval(evaluationId, form);
      if (r.ok) router.refresh();
      else {
        setError(r.error);
        setIssues(r.issues ?? []);
      }
    } catch {
      setError("Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sporządzenie oceny</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field
          label={positive ? "Uzasadnienie (opcjonalne)" : "Uzasadnienie"}
          required={!positive}
          hint={positive ? "Przy ocenie pozytywnej uzasadnienie jest dobrowolne." : "Ocena negatywna wymaga uzasadnienia (§ 10 ust. 4). Odnieś się do niespełnionych warunków."}
          error={issue("justification")}
        >
          <Textarea value={form.justification} onChange={set("justification")} onBlur={draft} rows={4} />
        </Field>
        {positive ? (
          <Field
            label="Wnioski dotyczące rozwoju zawodowego (opcjonalne)"
            hint="Np. szkolenia, obszary do doskonalenia. Formułuje się je tylko przy ocenie pozytywnej (§ 10 ust. 6)."
            error={issue("developmentPlan")}
          >
            <Textarea value={form.developmentPlan} onChange={set("developmentPlan")} onBlur={draft} rows={3} />
          </Field>
        ) : (
          <p className="text-sm text-muted-foreground">Przy ocenie negatywnej nie formułuje się wniosków dotyczących rozwoju zawodowego (§ 10 ust. 6).</p>
        )}
        <Field label="Data sporządzenia oceny" required error={issue("evaluatedAt")} className="max-w-xs">
          <Input type="date" value={form.evaluatedAt} max={today} onChange={set("evaluatedAt")} />
        </Field>
        {error && (
          <Notice tone="error" title={error}>
            {issues.length > 0 && (
              <ul className="list-disc pl-5">
                {issues.map((i, k) => (
                  <li key={k}>
                    {i.text}
                    {i.legalBasis && <span className="text-muted-foreground"> ({i.legalBasis})</span>}
                  </li>
                ))}
              </ul>
            )}
          </Notice>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <AutosaveIndicator state={autosave} />
          <Button onClick={complete} disabled={busy}>
            {busy ? "Zapisywanie…" : "Sporządź ocenę"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Zapoznanie ocenianego z pierwszą oceną – zamyka ścieżkę. */
export function ZapoznaniePierwszej({ evaluationId, evaluatedAt, today }: { evaluationId: string; evaluatedAt: IsoDate; today: IsoDate }) {
  const router = useRouter();
  const [date, setDate] = React.useState<string>(today);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await acknowledgeFirstEval(evaluationId, date);
      if (r.ok) router.refresh();
      else setError(r.error);
    } catch {
      setError("Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Zapoznanie ocenianego z oceną</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          Ocena sporządzona {formatDatePl(evaluatedAt)}. Arkusz podpisują bezpośredni przełożony, kierujący komórką i oceniany. Odnotuj dzień, w którym
          oceniany zapoznał się z oceną.
        </p>
        <Field label="Data zapoznania się z oceną" required error={error ?? undefined} className="max-w-xs">
          <Input type="date" value={date} min={evaluatedAt} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div>
          <Button onClick={confirm} disabled={busy || !date}>
            {busy ? "Zapisywanie…" : "Potwierdź zapoznanie się z oceną"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
