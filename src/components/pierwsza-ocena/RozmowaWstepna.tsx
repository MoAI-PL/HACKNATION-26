"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type { Deadline, IsoDate } from "@/lib/domain/types";
import { formatDatePl } from "@/lib/rules/kalendarz";
import { initialConversationIssues, lateConversationWarning, type FirstEvalPerson, type FormIssue } from "@/lib/pierwsza-ocena/przebieg";
import { saveInitialConversation } from "@/app/(przelozony)/ocena/pierwsza/actions";

/** Krok 1: rozmowa wstępna w 21 dni (§ 3) i wyznaczenie terminu sprawozdania (§ 4 ust. 1). */
export function RozmowaWstepna({
  evaluationId,
  person,
  today,
  deadline,
  proposal,
}: {
  evaluationId: string;
  person: FirstEvalPerson;
  today: IsoDate;
  deadline: Deadline;
  proposal: { dueFrom: IsoDate; dueTo: IsoDate; explanation: string; legalBasis?: string };
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({ date: today, dueFrom: proposal.dueFrom, dueTo: proposal.dueTo, notes: "" });
  const [issues, setIssues] = React.useState<FormIssue[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setIssues([]);
    setError(null);
  };
  const issue = (field: string) => issues.find((i) => i.field === field)?.text;
  const late = form.date ? lateConversationWarning(form.date, person.employmentStart) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local = initialConversationIssues(form, person, today);
    if (local.length) {
      setIssues(local);
      return;
    }
    setBusy(true);
    try {
      const r = await saveInitialConversation(evaluationId, form);
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
        <CardTitle>Rozmowa wstępna</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Notice tone="info" title={`Termin rozmowy: ${formatDatePl(deadline.date)}`} legalBasis={deadline.explanation.legalBasis}>
            {deadline.explanation.text} Omów obowiązki, oczekiwania i elementy, które będą oceniane: rzetelność, wykorzystywanie wiedzy, organizację
            pracy, komunikację i współpracę.
          </Notice>

          <Field label="Data rozmowy wstępnej" required error={issue("date")} className="max-w-xs">
            <Input type="date" value={form.date} min={person.employmentStart} max={today} onChange={set("date")} />
          </Field>
          {late && <Notice tone="warning" title="Rozmowa po terminie">{late}</Notice>}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 font-semibold">Termin złożenia sprawozdania</legend>
            <p className="text-sm text-muted-foreground">
              {proposal.explanation} System proponuje {formatDatePl(proposal.dueFrom)} – {formatDatePl(proposal.dueTo)}; możesz to zmienić.
              {proposal.legalBasis && <span> ({proposal.legalBasis})</span>}
            </p>
            <div className="flex flex-wrap gap-4">
              <Field label="Od" required error={issue("dueFrom")} className="max-w-xs">
                <Input type="date" value={form.dueFrom} onChange={set("dueFrom")} />
              </Field>
              <Field label="Do" required error={issue("dueTo")} className="max-w-xs">
                <Input type="date" value={form.dueTo} min={form.dueFrom} onChange={set("dueTo")} />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">
              Sprawozdanie obejmuje co najmniej 7 miesięcy pracy: zadania, problemy i sposób ich rozwiązania, nowe umiejętności i wiedzę oraz wnioski
              usprawniające (§ 6).
            </p>
          </fieldset>

          <Field label="Notatka z rozmowy" hint="Co ustaliliście – opcjonalnie.">
            <Textarea value={form.notes} onChange={set("notes")} rows={3} />
          </Field>

          {error && (
            <Notice tone="error" title={error}>
              {issues.length > 0 && (
                <ul className="list-disc pl-5">
                  {issues.map((i, k) => (
                    <li key={k}>{i.text}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Zapisywanie…" : "Zapisz rozmowę wstępną"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
