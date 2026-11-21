"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { InfoTip } from "@/components/ui/info-tip";
import { Notice } from "@/components/ui/notice";
import { WizardFooter } from "@/components/ui/wizard";
import { WynikOceny } from "@/components/ocena/WynikOceny";
import type { SummaryData } from "@/lib/ocena/dane-podsumowania";
import { partThreeAvailable, summaryIssues, type SummaryForm, type SummaryIssue } from "@/lib/ocena/podsumowanie";
import type { PeriodicScoreResult } from "@/lib/domain/types";
import type { AutosaveState } from "@/lib/ui/status";
import { completeEvaluation, saveSummaryDraft } from "@/app/(przelozony)/ocena/okresowa/[id]/podsumowanie/actions";

const AUTOSAVE_DELAY_MS = 800;

const FIELD_OF: Record<keyof SummaryForm, SummaryIssue["field"]> = {
  justification: "justification",
  developmentPlan: "developmentPlan",
  promotionRequest: "promotion",
  promotionJustification: "promotion",
  requestedGrade: "promotion",
  evaluatedAt: "evaluatedAt",
};

/** Formularz podsumowania (etap „Do oceny”): uzasadnienie, wnioski do IPRZ, część III, sporządzenie oceny. */
export function PodsumowanieOceny({ data, result }: { data: SummaryData; result: PeriodicScoreResult }) {
  const router = useRouter();
  const [form, setForm] = React.useState<SummaryForm>(() => ({ ...data.form, evaluatedAt: data.form.evaluatedAt ?? data.today }));
  const [autosave, setAutosave] = React.useState<AutosaveState>({ status: "idle" });
  const [issues, setIssues] = React.useState<SummaryIssue[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const update = (patch: Partial<SummaryForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    // Poprawiane pole przestaje być oznaczone jako brak.
    const touched = new Set(Object.keys(patch).map((k) => FIELD_OF[k as keyof SummaryForm]));
    setIssues((list) => list?.filter((i) => !touched.has(i.field)) ?? null);
  };

  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setAutosave({ status: "saving" });
      try {
        const r = await saveSummaryDraft(data.evaluationId, form);
        setAutosave(r.ok ? { status: "saved", at: new Date(r.savedAt) } : { status: "error", message: r.error });
      } catch {
        setAutosave({ status: "error", message: "Brak połączenia – zmiany zapiszą się po jego odzyskaniu." });
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [form, data.evaluationId]);

  const partThree = partThreeAvailable(data.employee.isCivilServant, result);
  const fieldError = (field: SummaryIssue["field"]) =>
    issues?.filter((i) => i.field === field).map((i) => i.text).join(" ") || undefined;

  const submit = async () => {
    const local = summaryIssues(form, { result, isCivilServant: data.employee.isCivilServant, today: data.today, periodStart: data.periodStart });
    setIssues(local);
    if (local.length) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await completeEvaluation(data.evaluationId, form);
      if (r.ok) {
        router.refresh();
        return;
      }
      setError(r.error);
      if (r.issues) setIssues(r.issues);
    } catch {
      setError("Nie udało się sporządzić oceny. Sprawdź połączenie i spróbuj ponownie – wpisane treści są zapisane.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <WynikOceny criteria={data.criteria} result={result} previous={data.previous} />

      <Card>
        <CardHeader>
          <CardTitle>Uzasadnienie i rozwój</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field
            label={result.justificationRequired ? "Uzasadnienie oceny" : "Uzasadnienie oceny (nieobowiązkowe)"}
            hint={
              result.justificationRequired
                ? "Ocena negatywna wymaga uzasadnienia. Opisz zachowania i ich skutki, a nie cechy osoby."
                : "Przy ocenie pozytywnej możesz je dodać – opisz zachowania, a nie cechy osoby."
            }
            required={result.justificationRequired}
            error={fieldError("justification")}
            aside={<InfoTip legalBasis="§ 11 ust. 3 i 4">Uzasadnienie jest obowiązkowe przy ocenie negatywnej, przy pozytywnej – dobrowolne.</InfoTip>}
          >
            <Textarea value={form.justification} onChange={(e) => update({ justification: e.target.value })} rows={5} />
          </Field>

          <Field
            label="Wnioski do indywidualnego programu rozwoju zawodowego (IPRZ)"
            hint="Co pracownik ma rozwijać i jak: szkolenia, zadania rozwojowe, wsparcie przełożonego."
            required
            error={fieldError("developmentPlan")}
            aside={<InfoTip legalBasis="§ 11 ust. 1 pkt 5">Wnioski do IPRZ wpisuje się do arkusza przy każdej ocenie.</InfoTip>}
          >
            <Textarea value={form.developmentPlan} onChange={(e) => update({ developmentPlan: e.target.value })} rows={4} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Część III – wniosek o kolejny stopień służbowy
            <InfoTip legalBasis="§ 11 ust. 5, art. 89 ustawy">
              Przy ocenie pozytywnej urzędnika służby cywilnej oceniający może złożyć umotywowany wniosek o przyznanie kolejnego stopnia służbowego.
            </InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!data.employee.isCivilServant ? (
            <p className="text-sm text-muted-foreground">Nie dotyczy – oceniany jest pracownikiem służby cywilnej, a nie urzędnikiem.</p>
          ) : !partThree ? (
            <p className="text-sm text-muted-foreground">Nie dotyczy – wniosek można złożyć tylko przy ocenie pozytywnej.</p>
          ) : (
            <>
              <label className="flex min-h-6 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary"
                  checked={form.promotionRequest}
                  onChange={(e) => update({ promotionRequest: e.target.checked })}
                />
                <span>
                  Wnioskuję o przyznanie kolejnego stopnia służbowego
                  {data.employee.serviceGrade ? <span className="block text-sm text-muted-foreground">Obecny stopień: {data.employee.serviceGrade}.</span> : null}
                </span>
              </label>
              {form.promotionRequest && (
                <>
                  <Field label="Stopień służbowy, o który wnioskujesz" required className="max-w-xs">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={form.requestedGrade ?? ""}
                      onChange={(e) => update({ requestedGrade: e.target.value ? Number(e.target.value) : null })}
                    />
                  </Field>
                  <Field label="Uzasadnienie wniosku" required error={fieldError("promotion")}>
                    <Textarea value={form.promotionJustification} onChange={(e) => update({ promotionJustification: e.target.value })} rows={3} />
                  </Field>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Field label="Data sporządzenia oceny na piśmie" required error={fieldError("evaluatedAt")} className="max-w-xs">
        <Input type="date" value={form.evaluatedAt ?? ""} max={data.today} onChange={(e) => update({ evaluatedAt: e.target.value || undefined })} />
      </Field>

      {issues && issues.length > 0 && (
        <Notice tone="warning" title="Zanim sporządzisz ocenę, uzupełnij:">
          <ul className="list-disc pl-5">
            {issues.map((i, k) => (
              <li key={k}>
                {i.text}
                {i.legalBasis && <span className="text-muted-foreground"> ({i.legalBasis})</span>}
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {error && !issues?.length && (
        <Notice tone="error" title="Nie sporządzono oceny">
          {error}
        </Notice>
      )}

      <WizardFooter
        back={
          <Button asChild variant="outline">
            <Link href={`/ocena/okresowa/${data.evaluationId}/ocena`}>Wróć do ocen cząstkowych</Link>
          </Button>
        }
        autosave={autosave}
        primary={
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Sporządzanie…" : "Sporządź ocenę"}
          </Button>
        }
      />
    </div>
  );
}
