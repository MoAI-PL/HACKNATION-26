"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dlaczego } from "@/components/ui/dlaczego";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import type { IsoDate } from "@/lib/domain/types";
import { acknowledgeEvaluation } from "@/app/(przelozony)/ocena/okresowa/[id]/podsumowanie/actions";

/** Potwierdzenie, że oceniany zapoznał się z oceną (§ 12 ust. 1) – zamyka ocenę i otwiera kolejny okres. */
export function ZapoznanieZOcena({ evaluationId, evaluatedAt, today }: { evaluationId: string; evaluatedAt: IsoDate; today: IsoDate }) {
  const router = useRouter();
  const [date, setDate] = React.useState<IsoDate>(today);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await acknowledgeEvaluation(evaluationId, date);
      if (r.ok) router.refresh();
      else setError(r.error);
    } catch {
      setError("Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Zapoznanie ocenianego z oceną
          <Dlaczego id="ZAPOZNANIE" />
          <Dlaczego id="SPRZECIW" label="Termin na sprzeciw" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          Zapoznaj ocenianego z oceną niezwłocznie. Oryginał arkusza trafia do akt osobowych, a kopię przekazujesz ocenianemu (§ 12). Od dnia
          zapoznania się biegnie 7 dni na sprzeciw (art. 83 ustawy).
        </p>
        <Field label="Data zapoznania się z oceną" required error={error ?? undefined} className="max-w-xs">
          <Input type="date" value={date} min={evaluatedAt} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div>
          <Button onClick={confirm} disabled={busy || !date}>
            {busy ? "Zapisywanie…" : "Potwierdź zapoznanie się z oceną"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
