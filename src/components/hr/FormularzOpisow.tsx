"use client";
// Panel HR: opisy zachowań jednego wskaźnika (5 poziomów) – te same teksty widzi przełożony na kartach zachowań.

import * as React from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { resetBehaviorAction, saveBehaviorAction, type FormState } from "@/lib/konfiguracja/actions";

export interface BehaviorLevelView {
  level: string;
  label: string;
  value: string;
  fileValue: string;
}

const INITIAL: FormState = { status: "idle" };

export function FormularzOpisow({ indicatorId, levels, overridden }: { indicatorId: string; levels: BehaviorLevelView[]; overridden: boolean }) {
  const [state, formAction, pending] = React.useActionState(saveBehaviorAction, INITIAL);
  const [resetState, resetAction, resetting] = React.useActionState(resetBehaviorAction, INITIAL);
  const last = resetState.status !== "idle" && (state.status === "idle" || resetting) ? resetState : state;

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite">
        {last.status !== "idle" && last.message && (
          <Notice tone={last.status === "ok" ? "success" : "error"} title={last.status === "ok" ? "Gotowe" : "Nie zapisano"}>
            {last.message}
          </Notice>
        )}
      </div>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="wskaznik" value={indicatorId} />
        {levels.map((l) => {
          const typed = state.status === "error" ? state.values?.[l.level] : undefined;
          const changed = l.value !== l.fileValue;
          return (
            <Field
              key={l.level}
              label={`Poziom ${l.level} – ${l.label}`}
              error={state.status === "error" ? state.errors?.[l.level] : undefined}
              hint={changed ? `W modelu kompetencji: „${l.fileValue}”` : undefined}
              aside={changed ? <StatusBadge tone="warning">zmieniony</StatusBadge> : undefined}
            >
              <Textarea key={`${l.value}-${typed ?? ""}`} name={`poziom-${l.level}`} defaultValue={typed ?? l.value} maxLength={600} required />
            </Field>
          );
        })}
        <Field label="Powód zmiany" hint="Trafi do dziennika decyzji razem z poprzednim i nowym opisem.">
          <Textarea name="powod" maxLength={500} className="min-h-16" />
        </Field>
        <div>
          <Button type="submit" disabled={pending}>
            <Save aria-hidden />
            {pending ? "Zapisywanie…" : "Zapisz opisy"}
          </Button>
        </div>
      </form>

      {overridden && (
        <form action={resetAction}>
          <input type="hidden" name="wskaznik" value={indicatorId} />
          <Button type="submit" variant="outline" disabled={resetting}>
            <RotateCcw aria-hidden />
            {resetting ? "Przywracanie…" : "Przywróć opisy z modelu kompetencji"}
          </Button>
        </form>
      )}
    </div>
  );
}
