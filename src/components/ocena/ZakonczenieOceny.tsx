"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lightbulb, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceCardGroup } from "@/components/ui/choice-cards";
import { Field, Textarea } from "@/components/ui/field";
import { InfoTip } from "@/components/ui/info-tip";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { WizardFooter, WizardProgress } from "@/components/ui/wizard";
import { useShortcut } from "@/components/layout/useShortcut";
import { IndicatorNotes } from "@/components/obserwacje/ObservationCard";
import { CRITERION_KIND_LABELS, LEVEL_LABELS, NO_OBSERVATION_LABEL, BEHAVIOR_LEVEL_TO_LEVEL } from "@/lib/domain/slownik";
import type { BehaviorLevel, Explanation, IndicatorRatingValue, LevelSuggestion } from "@/lib/domain/types";
import { noteCountsByIndicator, observationsForIndicator } from "@/lib/obserwacje/dziennik";
import type { AssessmentData, CriterionData } from "@/lib/ocena/dane-oceny";
import {
  assessmentIssues,
  criterionProgress,
  decisionOptions,
  firstUnratedIndex,
  suggestionFor,
} from "@/lib/ocena/zakonczenie-oceny";
import type { AutosaveState } from "@/lib/ui/status";
import { evaluatorMirror, type MirrorSignal } from "@/lib/rules/lustro";
import { saveDecision, saveRating, saveStep } from "@/app/(przelozony)/ocena/okresowa/[id]/ocena/actions";

const BEHAVIOR_LEVELS: BehaviorLevel[] = [1, 2, 3, 4, 5];
const NONE = "BRAK";
type CardValue = "1" | "2" | "3" | "4" | "5" | typeof NONE;

const toCard = (v: IndicatorRatingValue | undefined): CardValue | undefined =>
  v === undefined ? undefined : v === "BRAK_OBSERWACJI" ? NONE : (String(v) as CardValue);
const fromCard = (v: CardValue): IndicatorRatingValue => (v === NONE ? "BRAK_OBSERWACJI" : (Number(v) as BehaviorLevel));

export function ZakonczenieOceny({ data }: { data: AssessmentData }) {
  const [criteria, setCriteria] = React.useState<CriterionData[]>(data.criteria);
  const [step, setStep] = React.useState(Math.min(data.resumeCriterion, data.criteria.length)); // indeks kryterium; length = przegląd
  const [autosave, setAutosave] = React.useState<AutosaveState>({ status: "idle" });
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const noteCounts = React.useMemo(() => noteCountsByIndicator(data.observations, data.employee.id), [data.observations, data.employee.id]);

  const steps = [...criteria.map((c) => c.name), "Przegląd ocen"];
  const review = step === criteria.length;

  const goTo = (n: number) => {
    const target = Math.max(0, Math.min(n, criteria.length));
    setStep(target);
    void saveStep(data.evaluationId, target);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const updateCriterion = (i: number, patch: Partial<CriterionData>) =>
    setCriteria((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const rate = async (i: number, indicatorId: string, value: IndicatorRatingValue | null) => {
    const c = criteria[i]!;
    const ratings = { ...c.ratings };
    if (value === null) delete ratings[indicatorId];
    else ratings[indicatorId] = value;
    // Zmiana oceny wskaźnika kasuje decyzję kryterium – trzeba ją potwierdzić z nową sugestią.
    updateCriterion(i, { ratings, score: null, suggestedScore: null, overrideReason: undefined });
    setAutosave({ status: "saving" });
    try {
      const r = await saveRating(data.evaluationId, { competency: c.competency, indicatorId, value });
      setAutosave(r.ok ? { status: "saved", at: new Date(r.savedAt) } : { status: "error", message: r.error });
    } catch {
      setAutosave({ status: "error", message: "Brak połączenia – wybór nie został zapisany. Spróbuj ponownie." });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <WizardProgress steps={steps} current={step + 1} onStepClick={(n) => goTo(n - 1)} />

      {review ? (
        <Przeglad data={data} criteria={criteria} noteCounts={noteCounts} headingRef={headingRef} onGoTo={goTo} />
      ) : (
        <KryteriumKrok
          key={criteria[step]!.competency}
          criterion={criteria[step]!}
          index={step}
          data={data}
          noteCounts={noteCounts}
          headingRef={headingRef}
          autosave={autosave}
          onRate={(indicatorId, value) => rate(step, indicatorId, value)}
          onDecided={(patch) => {
            updateCriterion(step, patch);
            goTo(step + 1);
          }}
          back={
            step > 0 ? (
              <Button variant="outline" onClick={() => goTo(step - 1)}>
                Wstecz
              </Button>
            ) : undefined
          }
          nextName={steps[step + 1]!}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Jedno kryterium: wskaźniki kartami zachowań, notatki, sugestia i decyzja
// ---------------------------------------------------------------------------

function KryteriumKrok({
  criterion: c,
  index,
  data,
  noteCounts,
  headingRef,
  autosave,
  onRate,
  onDecided,
  back,
  nextName,
}: {
  criterion: CriterionData;
  index: number;
  data: AssessmentData;
  noteCounts: Map<string, number>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  autosave: AutosaveState;
  onRate: (indicatorId: string, value: IndicatorRatingValue | null) => void;
  onDecided: (patch: Partial<CriterionData>) => void;
  back?: React.ReactNode;
  nextName: string;
}) {
  const [current, setCurrent] = React.useState(() => firstUnratedIndex(c));
  const indicator = c.indicators[current]!;
  const suggestion = suggestionFor(c, noteCounts);
  const options = decisionOptions();
  const [points, setPoints] = React.useState<number | null>(c.score ?? suggestion.suggestedPoints);
  const [reason, setReason] = React.useState(c.overrideReason ?? "");
  const [errors, setErrors] = React.useState<Explanation[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Nowa sugestia (po zmianie oceny wskaźnika) staje się domyślną decyzją, dopóki przełożony nie zdecyduje inaczej.
  const lastSuggestion = React.useRef(suggestion.suggestedPoints);
  React.useEffect(() => {
    if (lastSuggestion.current !== suggestion.suggestedPoints) {
      lastSuggestion.current = suggestion.suggestedPoints;
      if (c.score === null) setPoints(suggestion.suggestedPoints);
    }
  }, [suggestion.suggestedPoints, c.score]);

  const choose = (v: IndicatorRatingValue) => onRate(indicator.id, v);
  useShortcut("1", () => choose(1));
  useShortcut("2", () => choose(2));
  useShortcut("3", () => choose(3));
  useShortcut("4", () => choose(4));
  useShortcut("5", () => choose(5));
  useShortcut("0", () => choose("BRAK_OBSERWACJI"));
  useShortcut("ArrowLeft", () => setCurrent((k) => Math.max(0, k - 1)));
  useShortcut("ArrowRight", () => setCurrent((k) => Math.min(c.indicators.length - 1, k + 1)));

  const differs = suggestion.suggestedPoints !== null && points !== null && points !== suggestion.suggestedPoints;
  const progress = criterionProgress(c);
  const notes = observationsForIndicator(data.observations, data.employee.id, indicator.id);
  const indicatorWarnings = suggestion.warnings.filter((w) => w.indicatorId === indicator.id);

  const decide = async () => {
    if (points === null) {
      setErrors([{ text: "Wybierz ocenę cząstkową kryterium." }]);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const r = await saveDecision(data.evaluationId, { competency: c.competency, points, justification: reason }, index + 1);
      if (r.ok) {
        onDecided({ score: points, suggestedScore: suggestion.suggestedPoints, overrideReason: differs ? reason.trim() : undefined });
      } else {
        setErrors(r.errors ?? [{ text: r.error }]);
      }
    } catch {
      setErrors([{ text: "Nie udało się zapisać decyzji. Sprawdź połączenie i spróbuj ponownie." }]);
    } finally {
      setSaving(false);
    }
  };

  const cardOptions = [
    ...BEHAVIOR_LEVELS.map((l) => ({
      value: String(l) as CardValue,
      label: indicator.levels[l],
      hint: `Klawisz ${l}`,
    })),
    { value: NONE as CardValue, label: "Brak okazji do obserwacji", hint: "Klawisz 0", description: "Wskaźnik nie wejdzie do sugestii." },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="flex flex-wrap items-center gap-2 text-xl font-semibold outline-none">
          {c.name}
          <StatusBadge tone="neutral">{CRITERION_KIND_LABELS[c.kind]}</StatusBadge>
          {data.guidance.length > 0 && (
            <InfoTip label="Jak oceniać?" legalBasis="model kompetencji MC">
              <ul className="list-disc pl-4">
                {data.guidance.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </InfoTip>
          )}
        </h2>
        {c.reason && <p className="text-sm text-muted-foreground">Kryterium dodatkowe, bo: {c.reason}</p>}
        <p className="text-sm text-muted-foreground">
          Oceniono {progress.rated} z {progress.total} wskaźników. Wybieraj opis zachowania, który najlepiej pasuje do całego okresu oceny – klawisze 1–5, 0 = brak okazji
          do obserwacji, ← → = poprzedni / następny wskaźnik.
        </p>
      </div>

      <nav aria-label="Wskaźniki kryterium">
        <ol className="flex flex-wrap gap-2">
          {c.indicators.map((ind, k) => {
            const v = c.ratings[ind.id];
            return (
              <li key={ind.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(k)}
                  aria-current={k === current ? "step" : undefined}
                  className={
                    "flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm " +
                    (k === current ? "border-primary bg-secondary font-medium" : "bg-card hover:border-primary/50")
                  }
                >
                  <span aria-hidden>{k + 1}.</span>
                  <span className="max-w-56 truncate">{ind.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {v === undefined ? "– do oceny" : v === "BRAK_OBSERWACJI" ? "– brak obserwacji" : "– ocenione"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="wskaznik-tytul" className="flex min-w-0 flex-col gap-3">
          <h3 id="wskaznik-tytul" className="font-semibold">
            Wskaźnik {current + 1} z {c.indicators.length}: {indicator.name}
          </h3>
          <ChoiceCardGroup
            label={`Zachowanie: ${indicator.name}`}
            options={cardOptions}
            value={toCard(c.ratings[indicator.id])}
            onValueChange={(v) => choose(fromCard(v))}
            columns={1}
          />
          {indicatorWarnings.map((w) => (
            <Notice key={w.code} tone="warning" title={w.message} legalBasis={w.legalBasis} />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCurrent((k) => Math.max(0, k - 1))} disabled={current === 0}>
              <ChevronLeft aria-hidden />
              Poprzedni wskaźnik
            </Button>
            <Button variant="outline" onClick={() => setCurrent((k) => Math.min(c.indicators.length - 1, k + 1))} disabled={current === c.indicators.length - 1}>
              Następny wskaźnik
              <ChevronRight aria-hidden />
            </Button>
            {c.ratings[indicator.id] !== undefined && (
              <Button variant="ghost" onClick={() => onRate(indicator.id, null)}>
                Cofnij wybór
              </Button>
            )}
          </div>
        </section>

        <aside aria-labelledby="notatki-tytul" className="flex min-w-0 flex-col gap-3">
          <h3 id="notatki-tytul" className="flex items-center gap-2 font-semibold">
            <NotebookPen className="size-4 text-primary" aria-hidden />
            Notatki z dziennika ({notes.length})
          </h3>
          <IndicatorNotes observations={notes} emptyText="Brak notatek przy tym wskaźniku. Ocena bez przykładu jest mniej wiarygodna." />
        </aside>
      </div>

      <PanelSugestii suggestion={suggestion} />

      <section aria-labelledby="decyzja-tytul" className="flex flex-col gap-3">
        <h3 id="decyzja-tytul" className="font-semibold">
          Twoja decyzja: ocena cząstkowa „{c.name}”
        </h3>
        <ChoiceCardGroup
          label={`Ocena cząstkowa: ${c.name}`}
          columns={5}
          value={points === null ? undefined : String(points)}
          onValueChange={(v) => {
            setPoints(Number(v));
            setErrors([]);
          }}
          options={options.map((o) => ({
            value: String(o.points),
            label: LEVEL_LABELS[o.level],
            description: `${o.points} pkt`,
            hint: o.points === suggestion.suggestedPoints ? "Sugestia" : undefined,
          }))}
        />
        {differs && (
          <Field
            label="Dlaczego wybierasz inaczej niż sugestia?"
            hint="Jedno zdanie – trafi do dziennika decyzji razem z sugestią."
            required
          >
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors([]);
              }}
              rows={2}
            />
          </Field>
        )}
        {errors.length > 0 && (
          <Notice tone="error" title="Nie zapisano decyzji">
            <ul className="list-disc pl-5">
              {errors.map((e, k) => (
                <li key={k}>{e.text}</li>
              ))}
            </ul>
          </Notice>
        )}
      </section>

      <WizardFooter
        back={back}
        autosave={autosave}
        primary={
          <Button onClick={decide} disabled={saving}>
            {saving ? "Zapisywanie…" : `Zatwierdź i dalej: ${nextName}`}
          </Button>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// „Dlaczego ten poziom?”
// ---------------------------------------------------------------------------

function PanelSugestii({ suggestion: s }: { suggestion: LevelSuggestion }) {
  const general = s.warnings.filter((w) => !w.indicatorId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Lightbulb className="size-4 text-primary" aria-hidden />
          {s.suggestedPoints !== null && s.suggestedLevel
            ? `Sugestia systemu: ${LEVEL_LABELS[s.suggestedLevel]} (${s.suggestedPoints} pkt)`
            : "Sugestia systemu: brak podstaw – oceń co najmniej jeden wskaźnik"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Sugestia to średnia z zaobserwowanych wskaźników. Ostateczną ocenę wybierasz Ty.
        </p>
        {general.map((w) => (
          <Notice key={w.code} tone={w.severity === "OSTRZEZENIE" ? "warning" : "info"} title={w.message} legalBasis={w.legalBasis} />
        ))}
        <details className="rounded-lg border bg-background p-3">
          <summary className="cursor-pointer font-medium text-primary">Dlaczego ten poziom?</summary>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            {s.explanations.map((e, k) => (
              <p key={k}>
                {e.text}
                {e.legalBasis && <span className="text-muted-foreground"> ({e.legalBasis})</span>}
              </p>
            ))}
            <table className="w-full text-left">
              <caption className="sr-only">Wskaźniki i wybrane zachowania</caption>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="py-1 pr-2 font-medium">Wskaźnik</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Wybór</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Punkty</th>
                  <th scope="col" className="py-1 font-medium">Notatka</th>
                </tr>
              </thead>
              <tbody>
                {s.indicators.map((i) => (
                  <tr key={i.indicatorId} className="border-b last:border-0">
                    <td className="py-1 pr-2">{i.name}</td>
                    <td className="py-1 pr-2">
                      {i.value === null ? "nieoceniony" : i.value === "BRAK_OBSERWACJI" ? NO_OBSERVATION_LABEL : LEVEL_LABELS[BEHAVIOR_LEVEL_TO_LEVEL[i.value]]}
                    </td>
                    <td className="py-1 pr-2">{i.points ?? "—"}</td>
                    <td className="py-1">{i.hasNote ? "tak" : "brak"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted-foreground">
              Rozkład: {BEHAVIOR_LEVELS.map((l) => `${LEVEL_LABELS[BEHAVIOR_LEVEL_TO_LEVEL[l]]} – ${s.distribution[l]}`).join(", ")}, {NO_OBSERVATION_LABEL} –{" "}
              {s.distribution.BRAK_OBSERWACJI}.
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Przegląd ocen cząstkowych
// ---------------------------------------------------------------------------

function Przeglad({
  data,
  criteria,
  noteCounts,
  headingRef,
  onGoTo,
}: {
  data: AssessmentData;
  criteria: CriterionData[];
  noteCounts: Map<string, number>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onGoTo: (step: number) => void;
}) {
  const evaluationId = data.evaluationId;
  const issues = assessmentIssues(criteria);
  const signals = React.useMemo(() => {
    const indicators = criteria.flatMap((c) =>
      c.indicators.flatMap((i) => {
        const v = c.ratings[i.id];
        return typeof v === "number" ? [{ name: i.name, level: v, hasNote: (noteCounts.get(i.id) ?? 0) > 0 }] : [];
      }),
    );
    const scores = criteria.map((c) => c.score);
    const current = scores.every((s) => s !== null) && scores.length ? (scores as number[]).reduce((a, b) => a + b, 0) / scores.length : null;
    return evaluatorMirror({
      noteDates: data.observations.filter((o) => o.employeeId === data.employee.id).map((o) => o.date),
      reference: data.today,
      periodStart: data.periodStart,
      indicators,
      supervisorAverages: current === null ? [] : [...data.mirror.supervisorAverages, current],
      unitAverages: data.mirror.unitAverages,
    });
  }, [criteria, noteCounts, data]);
  return (
    <div className="flex flex-col gap-4">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
        Przegląd ocen cząstkowych
      </h2>
      <Lustro signals={signals} />
      <Card>
        <CardContent className="overflow-x-auto py-4">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Oceny cząstkowe kryteriów</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Kryterium</th>
                <th scope="col" className="py-2 pr-3 font-medium">Sugestia</th>
                <th scope="col" className="py-2 pr-3 font-medium">Ocena cząstkowa</th>
                <th scope="col" className="py-2 font-medium">
                  <span className="sr-only">Akcja</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c, k) => {
                const s = suggestionFor(c, noteCounts);
                return (
                  <tr key={c.competency} className="border-b align-top last:border-0">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{CRITERION_KIND_LABELS[c.kind]}</span>
                    </td>
                    <td className="py-2 pr-3">{s.suggestedPoints !== null ? `${s.suggestedPoints} pkt` : "—"}</td>
                    <td className="py-2 pr-3">
                      {c.score !== null ? (
                        <>
                          <span className="font-medium">{c.score} pkt</span>
                          {c.overrideReason && <span className="block text-xs text-muted-foreground">Inaczej niż sugestia: {c.overrideReason}</span>}
                        </>
                      ) : (
                        <StatusBadge tone="warning">bez decyzji</StatusBadge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button variant="link" onClick={() => onGoTo(k)}>
                        {c.score !== null ? "Zmień" : "Oceń"}
                        <span className="sr-only"> – {c.name}</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {issues.length > 0 ? (
        <Notice
          tone="warning"
          title="Zanim przejdziesz do podsumowania, uzupełnij:"
          action={<Button onClick={() => onGoTo(criteria.findIndex((c) => c.score === null))}>Przejdź do pierwszego brakującego kryterium</Button>}
        >
          <ul className="list-disc pl-5">
            {issues.map((i) => (
              <li key={i.competency}>{i.text}</li>
            ))}
          </ul>
        </Notice>
      ) : (
        <Notice
          tone="success"
          title="Wszystkie oceny cząstkowe są gotowe"
          action={
            <Button asChild>
              <Link href={`/ocena/okresowa/${evaluationId}/podsumowanie`}>Dalej: podsumowanie i wynik</Link>
            </Button>
          }
        >
          Kolejny krok to podsumowanie: średnia, poziom ogólny, wynik oceny, uzasadnienie i wnioski do IPRZ.
        </Notice>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lustro oceniającego (Z36) – sygnały informacyjne, nigdy nie blokują
// ---------------------------------------------------------------------------

function Lustro({ signals }: { signals: MirrorSignal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Lustro oceniającego
          <InfoTip legalBasis="dobre praktyki oceniania (poradnik KPRM)">
            Sygnały typowych błędów oceniania: efekt świeżości, efekt aureoli, łagodność lub surowość na tle komórki i ocena skrajna bez
            przykładu. To tylko podpowiedź – nie blokuje zamknięcia oceny.
          </InfoTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nie widać typowych błędów oceniania. Możesz przejść dalej.</p>
        ) : (
          signals.map((s) => (
            <Notice key={s.code} tone="info" title={s.title}>
              {s.text}
            </Notice>
          ))
        )}
      </CardContent>
    </Card>
  );
}
