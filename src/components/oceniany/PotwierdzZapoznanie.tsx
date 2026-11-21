"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acknowledgeOwnEvaluation } from "@/lib/oceniany/actions";

/** Potwierdzenie przez ocenianego, że zapoznał się z oceną (§ 12 ust. 1). Data = dzisiaj. */
export function PotwierdzZapoznanie({ evaluationId }: { evaluationId: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await acknowledgeOwnEvaluation(evaluationId);
      if (r.ok) router.refresh();
      else setError(r.error);
    } catch {
      setError("Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-warning/40">
      <CardHeader>
        <CardTitle>Potwierdź zapoznanie się z oceną</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">
          Potwierdzenie oznacza tylko, że ocena została Ci przedstawiona – nie że się z nią zgadzasz. Od dzisiejszego dnia biegnie 7 dni na
          wniesienie sprzeciwu do kierownika urzędu (art. 83 ustawy o służbie cywilnej).
        </p>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div>
          <Button onClick={confirm} disabled={busy}>
            {busy ? "Zapisywanie…" : "Zapoznałem(-am) się z oceną"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
