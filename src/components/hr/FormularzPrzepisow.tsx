"use client";
// Panel HR (Z19): formularz parametrów przepisów. Walidacja na serwerze (zod, src/lib/konfiguracja/pola.ts),
// błąd przy polu z dozwolonym zakresem, wpisane wartości nie przepadają.

import * as React from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { resetRulesAction, saveRulesAction, type FormState } from "@/lib/konfiguracja/actions";
import type { RuleUnit } from "@/lib/konfiguracja/pola";

export interface RuleFieldView {
  path: string;
  label: string;
  unit: RuleUnit;
  unitWord: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  fileValue: number;
  basis?: string;
}

export interface RuleGroupView {
  id: string;
  title: string;
  description: string;
  assumption?: boolean;
  fields: RuleFieldView[];
}

const INITIAL: FormState = { status: "idle" };

function Message({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Notice tone={state.status === "ok" ? "success" : "error"} title={state.status === "ok" ? "Gotowe" : "Nie zapisano"}>{state.message}</Notice>;
}

export function FormularzPrzepisow({ groups, overridden }: { groups: RuleGroupView[]; overridden: boolean }) {
  const [state, formAction, pending] = React.useActionState(saveRulesAction, INITIAL);
  const [resetState, resetAction, resetting] = React.useActionState(resetRulesAction, INITIAL);
  const last = resetState.status !== "idle" && (state.status === "idle" || resetting) ? resetState : state;

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <Message state={last} />
      </div>

      <form action={formAction} className="flex flex-col gap-6" noValidate>
        {groups.map((g) => (
          <Card key={g.id}>
            <CardHeader>
              <CardTitle as="h2" className="flex flex-wrap items-center gap-2 text-lg">
                {g.title}
                {g.assumption && <StatusBadge tone="info">Założenie, nie przepis</StatusBadge>}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{g.description}</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                {g.fields.map((f) => {
                  const typed = state.status === "error" ? state.values?.[f.path] : undefined;
                  const changed = f.value !== f.fileValue;
                  return (
                    <Field
                      key={f.path}
                      label={f.unitWord ? `${f.label} (${f.unitWord})` : f.label}
                      error={state.status === "error" ? state.errors?.[f.path] : undefined}
                      hint={
                        <>
                          {f.basis && <>Podstawa: {f.basis}. </>}
                          {changed ? `W pliku przepisów: ${f.fileValue}${f.unitWord ? ` ${f.unitWord}` : ""}.` : null}
                        </>
                      }
                      aside={changed ? <StatusBadge tone="warning">zmienione</StatusBadge> : undefined}
                    >
                      <Input
                        // Nowy klucz po zapisie albo błędzie – pole pokazuje aktualną albo wpisaną wartość.
                        key={`${f.value}-${typed ?? ""}`}
                        name={f.path}
                        type="number"
                        inputMode="decimal"
                        min={f.min}
                        max={f.max}
                        step={f.step ?? 1}
                        defaultValue={typed ?? f.value}
                        className="w-32"
                      />
                    </Field>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Field label="Powód zmiany" hint="Trafi do dziennika decyzji razem z poprzednią i nową wartością, np. „nowelizacja ustawy z …”.">
              <Textarea name="powod" maxLength={500} className="min-h-16" />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending}>
                <Save aria-hidden />
                {pending ? "Zapisywanie…" : "Zapisz parametry"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {overridden && (
        <form action={resetAction}>
          <Button type="submit" variant="outline" disabled={resetting}>
            <RotateCcw aria-hidden />
            {resetting ? "Przywracanie…" : "Przywróć wszystkie wartości z pliku przepisów"}
          </Button>
        </form>
      )}
    </div>
  );
}
