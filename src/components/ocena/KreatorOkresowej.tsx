"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceCardGroup, ChoiceCardMulti } from "@/components/ui/choice-cards";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Dlaczego } from "@/components/ui/dlaczego";
import { Notice } from "@/components/ui/notice";
import { WizardFooter, WizardProgress } from "@/components/ui/wizard";
import { PropozycjaAI, type ProposalState } from "@/components/asystent/PropozycjaAI";
import { CzescIArkusza } from "@/components/ocena/CzescIArkusza";
import { COMPETENCY_NAMES, SHEET_LABELS } from "@/lib/domain/slownik";
import type { CompetencyCode, PositionDescription, SheetSelection } from "@/lib/domain/types";
import type { CriteriaProposalResult } from "@/lib/ai/funkcje/kryteria-z-osp";
import type { AutosaveState } from "@/lib/ui/status";
import { availableAdditionalCriteria, mandatoryCriteria } from "@/lib/rules/kryteria";
import { rules } from "@/lib/domain/przepisy";
import { plural } from "@/lib/rules/tekst";
import { formatDatePl } from "@/lib/rules/kalendarz";
import {
  CHECKLIST_ITEMS,
  WIZARD_STEPS,
  completionIssues,
  criteriaForSheet,
  effectiveSheet,
  firstIssueStep,
  lateConversationWarning,
  type StepIssue,
  type WizardDraft,
} from "@/lib/ocena/kreator-okresowej";
import type { WizardData } from "@/lib/ocena/dane-kreatora";
import { completePartOne, logAiDecision, saveDraft, uploadOsp } from "@/app/(przelozony)/ocena/okresowa/actions";

const AUTOSAVE_DELAY_MS = 800;

const QUOTE_SOURCE_LABEL = {
  ZADANIE_DOMINUJACE: "zadanie dominujące",
  ZADANIE_POZOSTALE: "zadanie pozostałe",
  KOMPETENCJE_MIEKKIE: "kompetencje miękkie",
} as const;

type AiState = { status: "brak" } | { status: ProposalState; result?: CriteriaProposalResult };

export function KreatorOkresowej({ data }: { data: WizardData }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<WizardDraft>(() => ({
    ...data.draft,
    conversationDate: data.draft.conversationDate ?? data.today,
  }));
  const [position, setPosition] = React.useState<PositionDescription | null>(data.position);
  const [sheetFromOsp, setSheetFromOsp] = React.useState<SheetSelection | null>(data.sheetFromOsp);
  const [fileName, setFileName] = React.useState(data.positionFileName);
  const [autosave, setAutosave] = React.useState<AutosaveState>({ status: "idle" });
  const [issues, setIssues] = React.useState<StepIssue[] | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const step = draft.step;
  const sheet = effectiveSheet(draft, sheetFromOsp?.sheet ?? null);
  const update = React.useCallback((patch: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...patch })), []);

  // Autozapis (sekcja 4.1 pkt 3): zmiana kroku od razu, pisanie po krótkiej przerwie.
  const firstRender = React.useRef(true);
  const savedStep = React.useRef(draft.step);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const delay = draft.step !== savedStep.current ? 0 : AUTOSAVE_DELAY_MS;
    savedStep.current = draft.step;
    const t = setTimeout(async () => {
      setAutosave({ status: "saving" });
      try {
        const r = await saveDraft(data.evaluationId, draft);
        setAutosave(r.ok ? { status: "saved", at: new Date(r.savedAt) } : { status: "error", message: r.error });
      } catch {
        setAutosave({ status: "error", message: "Brak połączenia – zmiany zapiszą się po jego odzyskaniu." });
      }
    }, delay);
    return () => clearTimeout(t);
  }, [draft, data.evaluationId]);

  const goTo = (n: number) => {
    update({ step: n });
    setIssues(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = (label: string) => (
    <Button onClick={() => goTo(step + 1)}>{label}</Button>
  );
  const back = step > 1 ? (
    <Button variant="outline" onClick={() => goTo(step - 1)}>
      Wstecz
    </Button>
  ) : undefined;

  const submit = async () => {
    const local = completionIssues({ draft, sheetFromOsp: sheetFromOsp?.sheet ?? null, today: data.today });
    if (local.length) {
      setIssues(local);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await completePartOne(data.evaluationId, draft);
      if (r.ok) {
        router.refresh();
        return;
      }
      setSubmitError(r.error);
      if (r.issues) setIssues(r.issues);
    } catch {
      setSubmitError("Nie udało się zatwierdzić części I. Sprawdź połączenie i spróbuj ponownie – szkic jest zapisany.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <WizardProgress steps={[...WIZARD_STEPS]} current={step} onStepClick={goTo} />

      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
        {WIZARD_STEPS[step - 1]}
      </h2>

      {step === 1 && (
        <KrokOsp
          evaluationId={data.evaluationId}
          position={position}
          fileName={fileName}
          onUploaded={(p, s, f) => {
            setPosition(p);
            setSheetFromOsp(s);
            setFileName(f);
            // Nowy OSP może wskazać inny arkusz – wybór wraca do wskazania z OSP.
            update({ sheet: undefined, sheetChangeReason: "" });
          }}
        />
      )}

      {step === 2 && (
        <KrokArkusz
          sheetFromOsp={sheetFromOsp}
          draft={draft}
          onChange={(s) => update({ sheet: s === sheetFromOsp?.sheet ? undefined : s })}
          onReason={(sheetChangeReason) => update({ sheetChangeReason })}
        />
      )}

      {step === 3 && sheet && (
        <KrokKryteria evaluationId={data.evaluationId} employeeId={data.employee.id} sheet={sheet} draft={draft} update={update} />
      )}
      {step === 3 && !sheet && (
        <Notice tone="warning" title="Najpierw wybierz arkusz" action={<Button onClick={() => goTo(2)}>Przejdź do wyboru arkusza</Button>}>
          Kryteria obowiązkowe zależą od arkusza (§ 4).
        </Notice>
      )}

      {step === 4 && <KrokRozmowa data={data} draft={draft} update={update} />}

      {step === 5 && (
        <div className="flex flex-col gap-4">
          {sheet ? (
            <CzescIArkusza
              employeeName={data.employee.name}
              positionTitle={position?.title}
              sheet={sheet}
              criteria={criteriaForSheet(sheet, draft.additional)}
              dueDate={data.deadlines?.evaluation.date}
              dueExplanation={data.deadlines?.evaluation.explanation}
              conversationDate={draft.conversationDate}
              expectations={draft.expectations.trim() || undefined}
              goals={draft.checklist.cele ? draft.goals.trim() || undefined : undefined}
            />
          ) : (
            <Notice tone="warning" title="Brak arkusza">
              Wróć do kroku 2 i wybierz arkusz.
            </Notice>
          )}
          {!data.deadlines && (
            <Notice tone="warning" title="Nie da się wyznaczyć terminu oceny">
              W kartotece brakuje daty poprzedniej oceny albo zatrudnienia na czas nieokreślony. Poproś HR o uzupełnienie danych.
            </Notice>
          )}
          <label className="flex min-h-6 cursor-pointer items-start gap-3 rounded-lg border bg-card p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={draft.acknowledged}
              onChange={(e) => update({ acknowledged: e.target.checked })}
            />
            <span>
              <span className="font-medium">Oceniany zapoznał się z kryteriami i terminem oceny i podpisał część I arkusza.</span>
              <span className="block text-sm text-muted-foreground">
                Oryginał arkusza trafia do akt osobowych, a kopię części I przekazujesz ocenianemu (§ 6).
              </span>
            </span>
          </label>
          {issues && issues.length > 0 && <IssueList issues={issues} onGoTo={goTo} />}
          {submitError && !issues?.length && (
            <Notice tone="error" title="Nie zatwierdzono części I">
              {submitError}
            </Notice>
          )}
        </div>
      )}

      <WizardFooter
        back={back}
        autosave={autosave}
        primary={
          step === 1 ? next("Dalej: arkusz") :
          step === 2 ? next("Dalej: kryteria") :
          step === 3 ? next("Dalej: rozmowa rozpoczynająca") :
          step === 4 ? next("Dalej: część I arkusza") : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Zatwierdzanie…" : "Zatwierdź część I"}
            </Button>
          )
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Krok 1: opis stanowiska
// ---------------------------------------------------------------------------

function KrokOsp({
  evaluationId,
  position,
  fileName,
  onUploaded,
}: {
  evaluationId: string;
  position: PositionDescription | null;
  fileName?: string;
  onUploaded: (p: PositionDescription, s: SheetSelection, fileName: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ text: string; problems?: string[] } | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("plik", file);
    try {
      const r = await uploadOsp(evaluationId, form);
      if (r.ok) {
        onUploaded(r.position, r.sheetFromOsp, r.fileName);
        setWarnings(r.warnings);
      } else {
        setError({ text: r.error, problems: r.problems });
      }
    } catch {
      setError({ text: "Nie udało się wysłać pliku. Sprawdź połączenie i spróbuj ponownie." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const uploadButton = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        aria-label="Plik OSP (.docx)"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button variant={position ? "outline" : "default"} onClick={() => inputRef.current?.click()} disabled={busy}>
        <Upload aria-hidden />
        {busy ? "Wczytywanie…" : position ? "Wgraj nowszy OSP" : "Wgraj OSP (.docx)"}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Notice tone="error" title={error.text}>
          {error.problems && (
            <ul className="list-disc pl-5">
              {error.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      {warnings.length > 0 && (
        <Notice tone="warning" title="OSP wczytany z uwagami">
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      {!position ? (
        <EmptyState
          icon={FileText}
          title="Brak opisu stanowiska pracy"
          description="Wgraj OSP ocenianego w formacie Worda. System sam wybierze arkusz i podpowie kryteria dodatkowe."
          action={uploadButton}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{position.title}</CardTitle>
            <CardDescription>
              {[position.orgUnit, fileName && `plik: ${fileName.split("/").pop()}`].filter(Boolean).join(" · ") || "Opis stanowiska z kartoteki"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h3 className="mb-1 text-sm font-semibold">Cel istnienia stanowiska</h3>
              <p className="text-sm">{position.purpose}</p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Zadania dominujące</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {position.dominantTasks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
            {position.requiredCompetencies.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Kompetencje miękkie z OSP</h3>
                <p className="text-sm">{position.requiredCompetencies.join(", ")}</p>
              </div>
            )}
            <div>{uploadButton}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Krok 2: arkusz
// ---------------------------------------------------------------------------

function KrokArkusz({
  sheetFromOsp,
  draft,
  onChange,
  onReason,
}: {
  sheetFromOsp: SheetSelection | null;
  draft: WizardDraft;
  onChange: (s: "B" | "C") => void;
  onReason: (reason: string) => void;
}) {
  const selected = effectiveSheet(draft, sheetFromOsp?.sheet ?? null) ?? undefined;
  const changed = !!sheetFromOsp && !!selected && selected !== sheetFromOsp.sheet;
  const option = (s: "B" | "C") => ({
    value: s,
    label: SHEET_LABELS[s],
    hint: sheetFromOsp?.sheet === s ? "Wskazany przez OSP" : undefined,
    description: `Kryteria obowiązkowe: ${mandatoryCriteria(s).map((c) => COMPETENCY_NAMES[c].toLowerCase()).join(", ")}.`,
  });
  return (
    <div className="flex flex-col gap-4">
      {sheetFromOsp ? (
        <Notice tone="info" title={`Arkusz ${sheetFromOsp.sheet}`} legalBasis={sheetFromOsp.explanation.legalBasis}>
          {sheetFromOsp.explanation.text}
        </Notice>
      ) : (
        <Notice tone="warning" title="Brak OSP">
          Bez opisu stanowiska wybierz arkusz samodzielnie: B – gdy praca polega na bezpośrednim kierowaniu pracownikami, C – pozostałe stanowiska (§ 3).
        </Notice>
      )}
      <div>
        <Dlaczego id="ARKUSZ" label="Arkusz B czy C?" />
      </div>
      <ChoiceCardGroup label="Arkusz oceny" options={[option("B"), option("C")]} value={selected} onValueChange={onChange} />
      {changed && (
        <Field
          label={`Dlaczego zmieniasz arkusz ${sheetFromOsp!.sheet} na ${selected}?`}
          hint="Powód trafi do dziennika decyzji razem z wyborem wskazanym przez OSP."
          required
        >
          <Textarea value={draft.sheetChangeReason} onChange={(e) => onReason(e.target.value)} rows={2} />
        </Field>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Krok 3: kryteria
// ---------------------------------------------------------------------------

function KrokKryteria({
  evaluationId,
  employeeId,
  sheet,
  draft,
  update,
}: {
  evaluationId: string;
  employeeId: string;
  sheet: "B" | "C";
  draft: WizardDraft;
  update: (p: Partial<WizardDraft>) => void;
}) {
  const [ai, setAi] = React.useState<AiState>({ status: "brak" });
  const abortRef = React.useRef<AbortController | null>(null);
  const available = availableAdditionalCriteria(sheet);
  const values = draft.additional.map((a) => a.competency).filter((c) => available.includes(c));
  const reasonOf = (c: CompetencyCode) => draft.additional.find((a) => a.competency === c)?.reason ?? "";

  const setValues = (codes: CompetencyCode[]) =>
    update({ additional: codes.map((competency) => ({ competency, reason: reasonOf(competency) })) });
  const setReason = (c: CompetencyCode, reason: string) =>
    update({ additional: draft.additional.map((a) => (a.competency === c ? { ...a, reason } : a)) });

  const ask = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAi({ status: "ladowanie" });
    try {
      const res = await fetch("/api/asystent/kryteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pracownikId: employeeId, arkusz: sheet }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { propozycja: CriteriaProposalResult };
      setAi({ status: "gotowa", result: json.propozycja });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setAi({ status: "niedostepna" });
    }
  };

  // Limit z przepisów (§ 5 ust. 2) – panel HR (Z19) może go zmienić bez zmian w kodzie.
  const maxAdditional = rules.periodic.maxAdditionalCriteria;
  const result = ai.status === "gotowa" ? ai.result : undefined;
  const proposals = (result?.proposals ?? []).filter((p) => available.includes(p.competency)).slice(0, maxAdditional);
  const reasonFromProposal = (p: (typeof proposals)[number]) => `${p.justification} OSP: „${p.quote.text}”`;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="kryteria-obowiazkowe" className="flex flex-col gap-2">
        <h3 id="kryteria-obowiazkowe" className="flex items-center gap-2 font-semibold">
          Kryteria obowiązkowe – arkusz {sheet}
          <Dlaczego id="KRYTERIA_OBOWIAZKOWE" />
        </h3>
        <ul className="flex flex-wrap gap-2">
          {mandatoryCriteria(sheet).map((c) => (
            <li key={c} className="rounded-md border bg-card px-3 py-1.5 text-sm">
              {COMPETENCY_NAMES[c]}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="kryteria-dodatkowe" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="kryteria-dodatkowe" className="flex items-center gap-2 font-semibold">
            Kryteria dodatkowe (nieobowiązkowe, najwyżej {maxAdditional})
            <Dlaczego id="KRYTERIA_DODATKOWE" />
          </h3>
          {ai.status === "brak" && (
            <Button variant="outline" onClick={ask}>
              <Sparkles aria-hidden />
              Zaproponuj kryteria z OSP
            </Button>
          )}
        </div>

        {ai.status !== "brak" && (
          <PropozycjaAI
            state={ai.status}
            title="Kryteria dodatkowe na podstawie OSP"
            insertLabel="Wstaw do formularza"
            onCancel={() => {
              abortRef.current?.abort();
              setAi({ status: "brak" });
            }}
            onRetry={ask}
            onInsert={() =>
              update({ additional: proposals.map((p) => ({ competency: p.competency, reason: reasonFromProposal(p) })) })
            }
            onReject={() => undefined}
            onDecision={(d) =>
              void logAiDecision(evaluationId, {
                decision: d.decision,
                mode: result?.mode,
                proposal: proposals.map((p) => ({ kryterium: p.competency, uzasadnienie: p.justification, cytat: p.quote })),
                final: d.decision === "WSTAW" ? proposals.map((p) => p.competency) : undefined,
              })
            }
            sources={proposals.map((p) => ({
              document: "Opis stanowiska pracy",
              unit: p.quote.taskNumber ? `${QUOTE_SOURCE_LABEL[p.quote.source]} ${p.quote.taskNumber}` : QUOTE_SOURCE_LABEL[p.quote.source],
              quote: p.quote.text,
            }))}
          >
            {result?.notice && <p className="text-sm text-muted-foreground">{result.notice}</p>}
            {proposals.length === 0 ? (
              <p className="text-sm">Asystent nie znalazł w OSP podstaw do kryteriów dodatkowych. Możesz je wybrać samodzielnie albo pominąć.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {proposals.map((p) => (
                  <li key={p.competency}>
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-sm">{p.justification}</span>
                  </li>
                ))}
              </ol>
            )}
          </PropozycjaAI>
        )}

        <ChoiceCardMulti
          label="Kryteria dodatkowe"
          columns={3}
          max={maxAdditional}
          maxReachedText={`To maksimum – można wybrać najwyżej ${maxAdditional} ${plural(maxAdditional, ["kryterium dodatkowe", "kryteria dodatkowe", "kryteriów dodatkowych"])} (${rules.periodic.legalBasis.maxAdditionalCriteria}).`}
          options={available.map((c) => ({
            value: c,
            label: COMPETENCY_NAMES[c],
            hint: proposals.some((p) => p.competency === c) ? "Propozycja z OSP" : undefined,
          }))}
          values={values}
          onValuesChange={setValues}
        />

        {values.map((c) => (
          <Field
            key={c}
            label={`Dlaczego „${COMPETENCY_NAMES[c]}”?`}
            hint="Jedno zdanie o obowiązkach z OSP, które za tym przemawiają – np. cytat zadania."
            required
          >
            <Textarea value={reasonOf(c)} onChange={(e) => setReason(c, e.target.value)} rows={2} />
          </Field>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Krok 4: rozmowa rozpoczynająca
// ---------------------------------------------------------------------------

function KrokRozmowa({ data, draft, update }: { data: WizardData; draft: WizardDraft; update: (p: Partial<WizardDraft>) => void }) {
  const deadline = data.deadlines?.conversation;
  const late = deadline ? lateConversationWarning(draft.conversationDate, deadline) : null;
  return (
    <div className="flex flex-col gap-5">
      {deadline && (
        <Notice tone="info" title={`Rozmowę trzeba przeprowadzić do ${formatDatePl(deadline.date)}`} legalBasis={deadline.explanation.legalBasis}>
          {deadline.explanation.text}
        </Notice>
      )}
      {data.deadlines?.reevaluation && (
        <Notice tone="warning" title="Ocena po ocenie negatywnej" legalBasis="art. 81 ust. 9 ustawy">
          Kolejną ocenę sporządza się po upływie 6 miesięcy od zapoznania się z oceną negatywną. Warto omówić konkretny plan poprawy.
        </Notice>
      )}

      <Field
        label="Data rozmowy rozpoczynającej"
        hint="Od tego dnia biegnie okres podlegania ocenie."
        required
        className="max-w-xs"
        aside={<Dlaczego id="TERMIN_ROZMOWY_ROZPOCZYNAJACEJ" label="Do kiedy?" />}
      >
        <Input
          type="date"
          value={draft.conversationDate ?? ""}
          max={data.today}
          onChange={(e) => update({ conversationDate: e.target.value || undefined })}
        />
      </Field>
      {late && (
        <Notice tone="warning" title="Rozmowa po terminie" legalBasis={late.legalBasis}>
          {late.text}
        </Notice>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex items-center gap-2 font-semibold">
          Co omówiono w rozmowie
          <Dlaczego id="ROZMOWA_ROZPOCZYNAJACA" />
        </legend>
        {CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex min-h-6 cursor-pointer items-start gap-3 rounded-md p-1">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={!!draft.checklist[item.key]}
              onChange={(e) => update({ checklist: { ...draft.checklist, [item.key]: e.target.checked } })}
            />
            <span>
              {item.label}
              {!item.required && <span className="text-muted-foreground"> – nieobowiązkowe</span>}
              <span className="block text-xs text-muted-foreground">{item.legalBasis}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field label="Oczekiwania co do sposobu spełniania kryteriów" hint="Krótko i konkretnie – przydadzą się przy ocenie." required={!!draft.checklist.oczekiwania}>
        <Textarea value={draft.expectations} onChange={(e) => update({ expectations: e.target.value })} rows={4} />
      </Field>
      {draft.checklist.cele && (
        <Field label="Cele na okres oceny i sposób ich realizacji" required>
          <Textarea value={draft.goals} onChange={(e) => update({ goals: e.target.value })} rows={3} />
        </Field>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista braków przed zatwierdzeniem
// ---------------------------------------------------------------------------

function IssueList({ issues, onGoTo }: { issues: StepIssue[]; onGoTo: (step: number) => void }) {
  const first = firstIssueStep(issues);
  return (
    <Notice
      tone="warning"
      title="Zanim zatwierdzisz część I, uzupełnij:"
      action={first ? <Button variant="outline" onClick={() => onGoTo(first)}>Przejdź do kroku {first}: {WIZARD_STEPS[first - 1]}</Button> : undefined}
    >
      <ul className="list-disc pl-5">
        {issues.map((i, n) => (
          <li key={n}>
            {i.text}
            {i.legalBasis && <span className="text-muted-foreground"> ({i.legalBasis})</span>}
            <span className="text-muted-foreground"> – krok {i.step}</span>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
