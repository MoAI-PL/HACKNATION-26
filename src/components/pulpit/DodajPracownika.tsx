"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { ChoiceCardGroup } from "@/components/ui/choice-cards";
import { Notice } from "@/components/ui/notice";
import { SUBORDINATE_LABELS } from "@/lib/domain/slownik";
import { SUBORDINATE_OPTIONS, type SubordinateOption } from "@/lib/domain/types";
import { todayIso } from "@/lib/domain/daty";
import { addMonths, addDays } from "@/lib/rules/kalendarz";
import { ospFileProblem, sheetExplanation } from "@/lib/dashboard/nowy-pracownik";
import { addEmployeeAction, previewOspAction, type AddEmployeeState } from "@/lib/dashboard/actions";
import type { OspPreview } from "@/lib/dashboard/osp-plik";
import { employeeHref } from "@/lib/dashboard/pulpit";

// Szybkie dodanie pracownika z pulpitu (Z11) – jury może wprowadzić własne fikcyjne dane w mniej niż minutę.
// Plik OSP (opcjonalny) wypełnia stanowisko, komórkę i liczbę podległych; parser i wybór arkusza – Z06.

const INITIAL: AddEmployeeState = { status: "idle" };

type OspState =
  | { status: "none" }
  | { status: "loading"; fileName: string }
  | { status: "ok"; preview: OspPreview }
  | { status: "error"; problems: string[] };

export function DodajPracownika() {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = React.useActionState(addEmployeeAction, INITIAL);
  const [type, setType] = React.useState<"OKRESOWA" | "PIERWSZA">("OKRESOWA");
  const [subordinates, setSubordinates] = React.useState<SubordinateOption | undefined>("BRAK");
  const [positionTitle, setPositionTitle] = React.useState("");
  const [orgUnit, setOrgUnit] = React.useState("");
  const [start, setStart] = React.useState(todayIso());
  const [osp, setOsp] = React.useState<OspState>({ status: "none" });
  const [formKey, setFormKey] = React.useState(0);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const fileId = React.useId();
  // Sukces pokazujemy, dopóki użytkownik nie zacznie kolejnego wpisu (wtedy zapamiętujemy, że ten wynik już widział).
  const [seenOkId, setSeenOkId] = React.useState<string | null>(null);
  const success = state.status === "ok" && state.employeeId !== seenOkId ? state : null;
  const err = state.status === "error" ? state.fields ?? {} : {};

  const nextEntry = () => {
    if (state.status === "ok") setSeenOkId(state.employeeId);
    setFormKey((k) => k + 1);
    setType("OKRESOWA");
    setSubordinates("BRAK");
    setPositionTitle("");
    setOrgUnit("");
    setStart(todayIso());
    setOsp({ status: "none" });
  };

  const reset = (next: boolean) => {
    if (next && success) nextEntry();
    setOpen(next);
  };

  const clearOsp = () => {
    if (fileRef.current) fileRef.current.value = "";
    setOsp({ status: "none" });
  };

  const onOspChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return clearOsp();
    const problem = ospFileProblem(file);
    if (problem) {
      if (fileRef.current) fileRef.current.value = "";
      return setOsp({ status: "error", problems: [problem] });
    }
    setOsp({ status: "loading", fileName: file.name });
    const fd = new FormData();
    fd.set("osp", file);
    try {
      const r = await previewOspAction(fd);
      if (r.status === "error") {
        if (fileRef.current) fileRef.current.value = "";
        return setOsp(r);
      }
      setOsp(r);
      setPositionTitle(r.preview.title);
      setOrgUnit(r.preview.orgUnit ?? "");
      setSubordinates(r.preview.subordinates);
    } catch {
      if (fileRef.current) fileRef.current.value = "";
      setOsp({ status: "error", problems: ["Nie udało się wysłać pliku. Spróbuj ponownie albo wpisz dane ręcznie."] });
    }
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
        description="Wczytaj opis stanowiska pracy (OSP) albo wpisz dane ręcznie. Arkusz i terminy system ustali sam."
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

        <form key={formKey} action={formAction} className={success ? "hidden" : "flex flex-col gap-4"} noValidate>
          {state.status === "error" && !state.fields && <Notice tone="error" title={state.message} />}

          {/* Plik OSP – opcjonalny skrót: wypełnia stanowisko, komórkę i liczbę podległych. */}
          <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/50 p-4">
            <label htmlFor={fileId} className="text-sm font-medium">
              Opis stanowiska pracy (OSP) <span className="font-normal text-muted-foreground">– opcjonalnie, plik .docx</span>
            </label>
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              name="osp"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onOspChange}
              aria-describedby={`${fileId}-stan`}
              className="text-sm file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-card file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted"
            />
            <div id={`${fileId}-stan`} aria-live="polite">
              {osp.status === "loading" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Czytam {osp.fileName}…
                </p>
              )}
              {osp.status === "ok" && (
                <div className="flex flex-col gap-2 rounded-md border bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium">
                      <FileText className="size-4 text-primary" aria-hidden />
                      Wczytano: {osp.preview.title}
                      {osp.preview.symbol ? ` (${osp.preview.symbol})` : ""}
                    </p>
                    <Button type="button" variant="ghost" size="sm" onClick={clearOsp}>
                      <X aria-hidden />
                      Usuń plik
                    </Button>
                  </div>
                  <p>{osp.preview.sheet.explanation.text}</p>
                  <p className="text-xs text-muted-foreground">
                    Podstawa: {osp.preview.sheet.explanation.legalBasis}. Zadania z OSP ({osp.preview.dominantTasksCount} dominujących) zapiszą się
                    przy stanowisku – przydadzą się przy wyborze kryteriów.
                  </p>
                  {osp.preview.warnings.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-warning">
                      {osp.preview.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {(osp.status === "error" || err.osp) && (
                <div role="alert" className="text-sm font-medium text-danger">
                  {osp.status === "error" ? (
                    <ul className="list-disc pl-5">
                      {osp.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  ) : (
                    err.osp
                  )}
                  <p className="mt-1 font-normal text-muted-foreground">Możesz też wpisać dane ręcznie poniżej.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Imię" required error={err.firstName}>
              <Input name="firstName" autoComplete="off" />
            </Field>
            <Field label="Nazwisko" required error={err.lastName}>
              <Input name="lastName" autoComplete="off" />
            </Field>
            <Field label="Stanowisko" required error={err.positionTitle}>
              <Input
                name="positionTitle"
                placeholder="np. starszy specjalista"
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
              />
            </Field>
            <Field label="Komórka organizacyjna" hint="Opcjonalnie" error={err.orgUnit}>
              <Input name="orgUnit" placeholder="np. Wydział Analiz" value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)} />
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
            <legend className="mb-1 text-sm font-medium">
              Liczba podległych pracowników {osp.status === "ok" ? "(z OSP)" : "(jak w OSP)"}
            </legend>
            <ChoiceCardGroup
              label="Liczba podległych pracowników"
              columns={1}
              value={subordinates}
              onValueChange={setSubordinates}
              options={SUBORDINATE_OPTIONS.map((o) => ({ value: o, label: SUBORDINATE_LABELS[o] }))}
            />
            <input type="hidden" name="subordinates" value={subordinates ?? ""} />
            {err.subordinates && (
              <p className="text-sm font-medium text-danger" role="alert">
                {err.subordinates}
              </p>
            )}
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
            <Button type="submit" disabled={pending || osp.status === "loading"}>
              {pending ? "Zapisywanie…" : "Dodaj pracownika"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
