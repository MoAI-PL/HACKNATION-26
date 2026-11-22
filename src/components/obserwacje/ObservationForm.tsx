"use client";
// Formularz obserwacji: osoba, data, wskaźnik (opcjonalnie), najbliższy opis zachowania i Sytuacja – Działanie – Rezultat.
// Poziom zachowania wybiera się kartami z opisami zachowań, bez liczb (zasada z oceny wskaźników).

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChoiceCardGroup } from "@/components/ui/choice-cards";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { deleteObservationAction, saveObservationAction } from "@/lib/obserwacje/actions";
import type { ObservationView } from "@/lib/obserwacje/dziennik";
import { MAX_SDR_LENGTH, selectClass } from "@/lib/obserwacje/stale";
import { cn } from "@/lib/utils";

export interface IndicatorOption {
  id: string;
  name: string;
  /** Opisy zachowań dla poziomów 1–5. */
  levels: [string, string, string, string, string];
}

export interface CompetencyOption {
  code: string;
  name: string;
  indicators: IndicatorOption[];
}

const LEVEL_NAMES = ["Znacznie poniżej oczekiwań", "Poniżej oczekiwań", "Na poziomie oczekiwań", "Powyżej oczekiwań", "Znacznie powyżej oczekiwań"];

export function ObservationForm({
  people,
  competencies,
  today,
  initial,
  defaultEmployeeId,
  cancelHref,
}: {
  people: { id: string; name: string }[];
  competencies: CompetencyOption[];
  today: string;
  /** Edycja istniejącej obserwacji. */
  initial?: ObservationView;
  defaultEmployeeId?: string;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveObservationAction, undefined);
  const [indicatorId, setIndicatorId] = React.useState(initial?.indicatorId ?? "");
  const [level, setLevel] = React.useState<string>(initial?.behaviorLevel ? String(initial.behaviorLevel) : "");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const errors = state?.errors ?? {};
  // Po nieudanym zapisie React czyści formularz – wracamy do wartości wpisanych przez użytkownika.
  const v = state?.values;

  const indicator = React.useMemo(() => competencies.flatMap((c) => c.indicators).find((i) => i.id === indicatorId), [competencies, indicatorId]);

  const levelOptions = indicator
    ? [
        ...indicator.levels.map((description, i) => ({ value: String(i + 1), label: LEVEL_NAMES[i]!, description })),
        { value: "", label: "Bez poziomu", description: "Opiszę zdarzenie, poziom wybiorę przy ocenie." },
      ]
    : [];

  return (
    <>
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6" noValidate>
        {initial && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="behaviorLevel" value={indicator ? level : ""} />

        {state?.message && (
          <Notice tone="error" title={state.message} aria-live="assertive" />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pracownik" required error={errors.employeeId}>
            <select name="employeeId" defaultValue={v?.employeeId ?? initial?.employeeId ?? defaultEmployeeId ?? ""} className={selectClass} required>
              <option value="" disabled>
                Wybierz osobę
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data zdarzenia" required hint="Dzień, w którym zaobserwowano zachowanie." error={errors.date}>
            <Input type="date" name="date" defaultValue={v?.date ?? initial?.date ?? today} max={today} required />
          </Field>
        </div>

        <Field
          label="Wskaźnik z modelu kompetencji"
          hint="Możesz przypiąć notatkę później. Bez wskaźnika nie trafi do oceny konkretnego kryterium."
          error={errors.indicatorId}
        >
          <select
            name="indicatorId"
            value={indicatorId}
            onChange={(e) => {
              setIndicatorId(e.target.value);
              setLevel("");
            }}
            className={selectClass}
          >
            <option value="">Przypnę później</option>
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
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Który opis zachowania jest najbliższy temu, co było widać? (opcjonalnie)</legend>
            <ChoiceCardGroup label={`Opis zachowania: ${indicator.name}`} options={levelOptions} value={level} onValueChange={setLevel} columns={3} />
            {errors.behaviorLevel && (
              <p role="alert" className="text-sm text-danger">
                {errors.behaviorLevel}
              </p>
            )}
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 text-sm font-medium">Sytuacja – Działanie – Rezultat</legend>
          {errors.sdr && <Notice tone="warning" title={errors.sdr} />}
          <Field label="Sytuacja" hint="Co się działo? Kontekst, zadanie, termin." error={errors.situation}>
            <Textarea name="situation" defaultValue={v?.situation ?? initial?.situation ?? ""} maxLength={MAX_SDR_LENGTH} />
          </Field>
          <Field label="Działanie" hint="Co konkretnie zrobiła ta osoba? Opisz zachowanie, nie cechę charakteru." error={errors.action}>
            <Textarea name="action" defaultValue={v?.action ?? initial?.action ?? ""} maxLength={MAX_SDR_LENGTH} />
          </Field>
          <Field label="Rezultat" hint="Jaki był skutek? Dla zespołu, sprawy, odbiorcy." error={errors.outcome}>
            <Textarea name="outcome" defaultValue={v?.outcome ?? initial?.outcome ?? ""} maxLength={MAX_SDR_LENGTH} />
          </Field>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            {initial && (
              <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                Usuń obserwację
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={cancelHref} className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
              Anuluj
            </Link>
            <Button type="submit" className="h-10" disabled={pending}>
              {pending ? "Zapisywanie…" : initial ? "Zapisz zmiany" : "Zapisz obserwację"}
            </Button>
          </div>
        </div>
      </form>

      {initial && (
        <Dialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Usunąć tę obserwację?"
          description="Obserwacja zniknie z dziennika i nie będzie widoczna przy ocenie. Tej operacji nie można cofnąć."
          footer={
            <form action={deleteObservationAction} className="flex gap-2">
              <input type="hidden" name="id" value={initial.id} />
              <input type="hidden" name="employeeId" value={initial.employeeId} />
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
                Zostaw
              </Button>
              <Button type="submit" variant="destructive">
                Usuń
              </Button>
            </form>
          }
        />
      )}
    </>
  );
}
