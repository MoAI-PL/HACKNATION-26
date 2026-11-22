import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dlaczego } from "@/components/ui/dlaczego";
import { CRITERION_KIND_LABELS, LEVEL_LABELS, RESULT_LABELS } from "@/lib/domain/slownik";
import type { PeriodicScoreResult } from "@/lib/domain/types";
import { formatPoints } from "@/lib/rules/tekst";
import { formatDatePl } from "@/lib/rules/kalendarz";
import type { PreviousSummary } from "@/lib/ocena/dane-podsumowania";
import type { ScoredCriterion } from "@/lib/ocena/podsumowanie";
import { cn } from "@/lib/utils";

// Wynik oceny okresowej: oceny cząstkowe, średnia, poziom ogólny, wynik z wyjaśnieniem (§ 11 ust. 1 pkt 1–4)
// i dane poprzedniej oceny. Ten sam widok przed sporządzeniem oceny i po nim.

export function WynikOceny({
  criteria,
  result,
  previous,
}: {
  criteria: (ScoredCriterion & { name: string; overrideReason?: string })[];
  result: PeriodicScoreResult;
  previous: PreviousSummary | null;
}) {
  const positive = result.result === "POZYTYWNA";
  const Icon = positive ? CheckCircle2 : XCircle;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Wynik oceny
          <Dlaczego id="WYNIK_OCENY" label="Kiedy ocena jest negatywna?" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div
          role="status"
          className={cn(
            "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-4",
            positive ? "border-success/40 bg-success-soft" : "border-danger/40 bg-danger-soft",
          )}
        >
          <span className={cn("flex items-center gap-2 text-lg font-semibold", positive ? "text-success" : "text-danger")}>
            <Icon className="size-5" aria-hidden />
            {RESULT_LABELS[result.result].replace(/^./, (c) => c.toUpperCase())}
          </span>
          <span>
            Średnia: <strong>{formatPoints(result.average)} pkt</strong>
          </span>
          <span>
            Poziom ogólny: <strong>{LEVEL_LABELS[result.overallLevel]}</strong>
          </span>
        </div>

        <ul className="flex flex-col gap-1 text-sm">
          {result.explanations.map((e, k) => (
            <li key={k}>
              {e.text}
              {e.legalBasis && <span className="text-muted-foreground"> ({e.legalBasis})</span>}
            </li>
          ))}
        </ul>

        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-semibold">
            <span className="flex flex-wrap items-center gap-2">
              Oceny cząstkowe
              <Dlaczego id="SKALA_OCEN" label="Skala punktów" />
            </span>
          </caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-1.5 pr-3 font-medium">Kryterium</th>
              <th scope="col" className="py-1.5 pr-3 font-medium">Rodzaj</th>
              <th scope="col" className="py-1.5 font-medium">Punkty</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.competency} className="border-b align-top last:border-0">
                <td className="py-1.5 pr-3">
                  {c.name}
                  {c.overrideReason && <span className="block text-xs text-muted-foreground">Inaczej niż sugestia: {c.overrideReason}</span>}
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">{CRITERION_KIND_LABELS[c.kind]}</td>
                <td className={cn("py-1.5 font-medium", c.score === 1 && "text-danger")}>{c.score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-sm">
          <span className="font-medium">Poprzednia ocena: </span>
          {previous
            ? `${RESULT_LABELS[previous.result]}${previous.level ? `, ${LEVEL_LABELS[previous.level]}` : ""}, sporządzona ${formatDatePl(previous.date)}`
            : "brak – to pierwsza ocena okresowa"}
        </p>
      </CardContent>
    </Card>
  );
}
