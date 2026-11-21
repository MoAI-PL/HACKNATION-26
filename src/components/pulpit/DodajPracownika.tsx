"use client";

import * as React from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { ChoiceCardGroup } from "@/components/ui/choice-cards";
import { Notice } from "@/components/ui/notice";
import { SUBORDINATE_LABELS } from "@/lib/domain/slownik";
import { SUBORDINATE_OPTIONS, type SubordinateOption } from "@/lib/domain/types";
import { todayIso } from "@/lib/domain/daty";
import { addMonths, addDays } from "@/lib/rules/kalendarz";
import { sheetExplanation } from "@/lib/dashboard/nowy-pracownik";
import { addEmployeeAction, type AddEmployeeState } from "@/lib/dashboard/actions";
import { employeeHref } from "@/lib/dashboard/pulpit";

// Szybkie dodanie pracownika z pulpitu (Z11) – jury może wprowadzić własne fikcyjne dane w mniej niż minutę.

const INITIAL: AddEmployeeState = { status: "idle" };

export function DodajPracownika() {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState(addEmployeeAction, INITIAL);
  const [type, setType] = React.useState<"OKRESOWA" | "PIERWSZA">("OKRESOWA");
  const [subordinates, setSubordinates] = React.useState<SubordinateOption | undefined>("BRAK");
  const [start, setStart] = React.useState(todayIso());
  const [formKey, setFormKey] = React.useState(0);
  // Sukces pokazujemy, dopóki użytkownik nie zacznie kolejnego wpisu (wtedy zapamiętujemy, że ten wynik już widział).
  const [seenOkId, setSeenOkId] = React.useState<string | null>(null);
  const success = state.status === "ok" && state.employeeId !== seenOkId ? state : null;
  const err = state.status === "error" ? state.fields ?? {} : {};

  const nextEntry = () => {
    if (state.status === "ok") setSeenOkId(state.employeeId);
    setFormKey((k) => k + 1);
    setType("OKRESOWA");
    setSubordinates("BRAK");
    setStart(todayIso());
  };

  const reset = (next: boolean) => {
    if (next && success) nextEntry();
    setOpen(next);
  };

  return (
    <>
      <Button onClick={() => reset(true)}>
        <UserPlus aria-hidden />
        Dodaj pracownika
      </Button>
      <Dialog
        open={open}
        onOpenChange={reset}
        title="Dodaj pracownika"
        description="Wystarczą podstawowe dane. Arkusz i terminy system ustali sam."
      >
        {success ? (
          <div className="flex flex-col gap-4">
            <Notice tone="success" title={`Dodano: ${success.name}.`}>
              Terminy są już policzone – zobaczysz je na pulpicie i na karcie pracownika.
            </Notice>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={nextEntry}>
                Dodaj kolejną osobę
              </Button>
              <Button asChild>
                <Link href={employeeHref(success.employeeId)} className="no-underline" onClick={() => setOpen(false)}>
                  Otwórz kartę pracownika
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        <form
          key={formKey}
          action={formAction}
          className={success ? "hidden" : "flex flex-col gap-4"}
          noValidate
        >
          {state.status === "error" && !state.fields && <Notice tone="error" title={state.message} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Imię" required error={err.firstName}>
              <Input name="firstName" autoComplete="off" />
            </Field>
            <Field label="Nazwisko" required error={err.lastName}>
              <Input name="lastName" autoComplete="off" />
            </Field>
            <Field label="Stanowisko" required error={err.positionTitle}>
              <Input name="positionTitle" placeholder="np. starszy specjalista" />
            </Field>
            <Field label="Komórka organizacyjna" hint="Opcjonalnie" error={err.orgUnit}>
              <Input name="orgUnit" placeholder="np. Wydział Analiz" />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Rodzaj oceny</legend>
            <ChoiceCardGroup
              label="Rodzaj oceny"
              value={type}
              onValueChange={setType}
              options={[
                { value: "OKRESOWA", label: "Ocena okresowa", description: "Osoba pracuje na czas nieokreślony." },
                { value: "PIERWSZA", label: "Pierwsza ocena", description: "Nowa osoba w służbie cywilnej, umowa na czas określony." },
              ]}
            />
            <input type="hidden" name="evaluationType" value={type} />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Liczba podległych pracowników (jak w OSP)</legend>
            <ChoiceCardGroup
              label="Liczba podległych pracowników"
              columns={1}
              value={subordinates}
              onValueChange={setSubordinates}
              options={SUBORDINATE_OPTIONS.map((o) => ({ value: o, label: SUBORDINATE_LABELS[o] }))}
            />
            <input type="hidden" name="subordinates" value={subordinates ?? ""} />
            {err.subordinates && <p className="text-sm font-medium text-danger" role="alert">{err.subordinates}</p>}
            {type === "OKRESOWA" && subordinates && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {sheetExplanation(subordinates)}
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data nawiązania stosunku pracy" required error={err.employmentStart}>
              <Input type="date" name="employmentStart" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            {type === "OKRESOWA" ? (
              <>
                <Field label="Zatrudnienie na czas nieokreślony od" error={err.permanentFrom} hint="Albo podaj datę ostatniej oceny.">
                  <Input type="date" name="permanentFrom" />
                </Field>
                <Field label="Data ostatniej oceny okresowej" hint="Jeśli osoba była już oceniana." error={err.lastEvaluationAt}>
                  <Input type="date" name="lastEvaluationAt" />
                </Field>
              </>
            ) : (
              <Field label="Koniec umowy" required error={err.contractEnd} hint="Zwykle 12 miesięcy od zatrudnienia.">
                <Input type="date" name="contractEnd" defaultValue={start ? addDays(addMonths(start, 12), -1) : undefined} key={start} />
              </Field>
            )}
          </div>

          <label className="flex min-h-6 items-center gap-2 text-sm">
            <input type="checkbox" name="isCivilServant" className="size-4 accent-[var(--primary)]" />
            Urzędnik służby cywilnej (mianowany)
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Zapisywanie…" : "Dodaj pracownika"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
