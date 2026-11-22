"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceCardGroup } from "@/components/ui/choice-cards";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { EXAM_EXEMPTION_LABELS, EXAM_RESULT_LABELS } from "@/lib/domain/slownik";
import { EXAM_EXEMPTIONS, EXAM_RESULTS, type Deadline, type ExamExemption, type ExamResult, type IsoDate } from "@/lib/domain/types";
import { formatDatePl } from "@/lib/rules/kalendarz";
import {
  REPORT_ACCEPT,
  reportFileProblem,
  reportOnTime, type FormIssue, type ReportContext, type ReportMode } from "@/lib/pierwsza-ocena/przebieg";
import { saveReport } from "@/app/(przelozony)/ocena/pierwsza/actions";

const EXAM_HINTS: Record<ExamResult, string> = {
  ZDANY: "Oceniany zdał egzamin ze służby przygotowawczej.",
  NIEZDANY: "Oceniany nie zdał egzaminu – ocena będzie negatywna.",
  NIE_DOTYCZY: "Wskaż powód (§ 10 ust. 3).",
};

/** Krok 2: sprawozdanie (wpisane albo z pliku, data złożenia) i egzamin ze służby przygotowawczej. */
export function SprawozdanieIEgzamin({
  evaluationId,
  context,
  deadline,
  today,
  initial,
  editing,
}: {
  evaluationId: string;
  context: ReportContext;
  deadline: Deadline;
  today: IsoDate;
  initial: { submittedAt?: IsoDate; content?: string; fileName?: string; exam?: ExamResult; examExemption?: ExamExemption; recorded: boolean };
  /** true = poprawka już zapisanego etapu (ocena jest „Do oceny”). */
  editing?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<ReportMode | undefined>(initial.recorded ? (initial.submittedAt ? "ZLOZONE" : "NIE_ZLOZONE") : undefined);
  const [submittedAt, setSubmittedAt] = React.useState<string>(initial.submittedAt ?? (today >= context.dueFrom ? today : ""));
  const [content, setContent] = React.useState(initial.content ?? "");
  const [file, setFile] = React.useState<File | null>(null);
  const [exam, setExam] = React.useState<ExamResult | undefined>(initial.exam);
  const [exemption, setExemption] = React.useState<ExamExemption | undefined>(initial.examExemption);
  const [issues, setIssues] = React.useState<FormIssue[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const issue = (f: string) => issues.find((i) => i.field === f)?.text;
  const clear = () => {
    setIssues([]);
    setError(null);
  };

  const late = mode === "ZLOZONE" && /^\d{4}-\d{2}-\d{2}$/.test(submittedAt) && submittedAt >= context.dueFrom && !reportOnTime(submittedAt as IsoDate, context);
  const deadlinePassed = today > deadline.date;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
    const fd = new FormData();
    if (mode) fd.set("mode", mode);
    fd.set("submittedAt", submittedAt);
    fd.set("content", content);
    if (file) fd.set("file", file);
    else if (initial.fileName) fd.set("keepFileName", initial.fileName);
    if (exam) fd.set("exam", exam);
    if (exemption) fd.set("examExemption", exemption);
    if (!mode) {
      setIssues([{ field: "mode", text: "Wskaż, czy oceniany złożył sprawozdanie." }]);
      return;
    }
    setBusy(true);
    try {
      const r = await saveReport(evaluationId, fd);
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
        <CardTitle>{editing ? "Popraw sprawozdanie lub egzamin" : "Sprawozdanie i egzamin"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Notice
            tone={deadlinePassed && !initial.recorded ? "warning" : "info"}
            title={`Termin sprawozdania: ${formatDatePl(context.dueFrom)} – ${formatDatePl(deadline.date)}`}
            legalBasis={deadline.explanation.legalBasis}
          >
            {deadline.explanation.text}
          </Notice>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 font-semibold">Czy oceniany złożył sprawozdanie?</legend>
            <ChoiceCardGroup<ReportMode>
              label="Sprawozdanie"
              value={mode}
              onValueChange={(v) => {
                setMode(v);
                clear();
              }}
              options={[
                { value: "ZLOZONE", label: "Tak, złożył", description: "Wpisz datę złożenia i treść albo wgraj plik." },
                {
                  value: "NIE_ZLOZONE",
                  label: "Nie złożył",
                  description: deadlinePassed ? "Brak sprawozdania w terminie oznacza ocenę negatywną (§ 10 ust. 1 pkt 2)." : `Możliwe dopiero po ${formatDatePl(deadline.date)}.`,
                  disabled: !deadlinePassed,
                },
              ]}
            />
            {issue("mode") && <p className="text-sm text-destructive">{issue("mode")}</p>}
          </fieldset>

          {mode === "ZLOZONE" && (
            <div className="flex flex-col gap-4">
              <Field label="Data złożenia sprawozdania" required error={issue("submittedAt")} className="max-w-xs">
                <Input
                  type="date"
                  value={submittedAt}
                  min={context.dueFrom}
                  max={today}
                  onChange={(e) => {
                    setSubmittedAt(e.target.value);
                    clear();
                  }}
                />
              </Field>
              {late && (
                <Notice tone="warning" title="Sprawozdanie złożone po terminie" legalBasis="§ 10 ust. 1 pkt 2">
                  Termin minął {formatDatePl(deadline.date)}. Ocena pierwsza będzie negatywna.
                </Notice>
              )}
              <Field
                label="Wgraj plik ze sprawozdaniem"
                hint={initial.fileName ? `Zapisany plik: ${initial.fileName}. Wgraj nowy, żeby go zastąpić.` : "Word (.docx) albo tekst (.txt), do 5 MB."}
                error={issue("file")}
              >
                <Input
                  type="file"
                  accept={REPORT_ACCEPT}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    clear();
                    const p = f ? reportFileProblem(f) : null;
                    if (p) {
                      setIssues([{ field: "file", text: p }]);
                      setFile(null);
                      e.target.value = "";
                    } else setFile(f);
                  }}
                />
              </Field>
              <Field
                label="…albo wpisz treść sprawozdania"
                hint="Zadania, problemy i sposób ich rozwiązania, nowe umiejętności i wiedza, wnioski usprawniające (§ 6). Treść z wgranego pliku zastąpi to pole."
                error={issue("content")}
              >
                <Textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    clear();
                  }}
                  rows={6}
                />
              </Field>
            </div>
          )}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 font-semibold">Czy oceniany zdał egzamin ze służby przygotowawczej?</legend>
            <ChoiceCardGroup<ExamResult>
              label="Egzamin ze służby przygotowawczej"
              columns={3}
              value={exam}
              onValueChange={(v) => {
                setExam(v);
                if (v !== "NIE_DOTYCZY") setExemption(undefined);
                clear();
              }}
              options={EXAM_RESULTS.map((r) => ({ value: r, label: EXAM_RESULT_LABELS[r], description: EXAM_HINTS[r] }))}
            />
            {issue("exam") && <p className="text-sm text-destructive">{issue("exam")}</p>}
            {exam === "NIE_DOTYCZY" && (
              <>
                <ChoiceCardGroup<ExamExemption>
                  label="Dlaczego egzamin nie dotyczy ocenianego"
                  columns={3}
                  value={exemption}
                  onValueChange={(v) => {
                    setExemption(v);
                    clear();
                  }}
                  options={EXAM_EXEMPTIONS.map((x) => ({ value: x, label: EXAM_EXEMPTION_LABELS[x] }))}
                />
                {issue("examExemption") && <p className="text-sm text-destructive">{issue("examExemption")}</p>}
              </>
            )}
          </fieldset>

          {error && (
            <Notice tone="error" title={error}>
              {issues.length > 1 && (
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
              {busy ? "Zapisywanie…" : editing ? "Zapisz poprawkę" : "Zapisz i przejdź do oceny elementów"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
