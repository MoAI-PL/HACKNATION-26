import Link from "next/link";
import { FileText } from "lucide-react";
import { DeadlineBadge, EvaluationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EVALUATION_TYPE_LABELS } from "@/lib/domain/slownik";
import { DEADLINE_KIND_LABELS } from "@/lib/rules/terminy";
import { formatDatePl } from "@/lib/rules/kalendarz";
import type { HrRow } from "@/lib/hr/panel";
import { addReminderAction } from "@/lib/hr/actions";

// Tabela ocen w panelu HR (Z18): etap, termin z kolorem i tekstem, wydłużenia z powodem, ostrzeżenia, akcje.

export function HrEvaluationsTable({ rows, reminderFor }: { rows: HrRow[]; reminderFor: (row: HrRow) => boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card" role="region" aria-label="Tabela ocen" tabIndex={0}>
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">Oceny w urzędzie: pracownik, etap, najbliższy termin i działania komórki kadr</caption>
        <thead className="bg-muted/60 text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Pracownik</th>
            <th scope="col" className="px-3 py-2 font-medium">Etap</th>
            <th scope="col" className="px-3 py-2 font-medium">Najbliższy termin</th>
            <th scope="col" className="px-3 py-2 font-medium">Oceniający</th>
            <th scope="col" className="px-3 py-2 font-medium">
              <span className="sr-only">Działania</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.evaluationId} className="border-t align-top">
              <th scope="row" className="px-3 py-3 text-left font-normal">
                <span className="font-medium">{r.employeeName}</span>
                <span className="block text-muted-foreground">
                  {EVALUATION_TYPE_LABELS[r.type]}
                  {r.type === "OKRESOWA" && ` · arkusz ${r.sheet}`}
                </span>
                {r.orgUnit && <span className="block text-xs text-muted-foreground">{r.orgUnit}</span>}
              </th>
              <td className="px-3 py-3">
                <EvaluationStatusBadge type={r.type} status={r.status} className="whitespace-normal" />
              </td>
              <td className="px-3 py-3">
                {r.deadline && r.urgency && r.daysLeft !== null ? (
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{DEADLINE_KIND_LABELS[r.deadline.kind]}</span>
                    <span>{formatDatePl(r.deadline.date)}</span>
                    <DeadlineBadge daysLeft={r.daysLeft} urgency={r.urgency} className="self-start" />
                    {r.extensionText && (
                      <span className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Wydłużony: </span>
                        {r.extensionText}
                      </span>
                    )}
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Dlaczego ten termin?</summary>
                      <p className="mt-1">{r.deadline.explanation.text}</p>
                      {r.deadline.explanation.legalBasis && <p className="mt-1">Podstawa: {r.deadline.explanation.legalBasis}</p>}
                    </details>
                  </div>
                ) : (
                  <span className="text-muted-foreground">{r.status === "ZAKONCZONA" ? "Ocena zakończona" : "Czeka na zapoznanie się ocenianego"}</span>
                )}
                {r.warnings.map((w) => (
                  <StatusBadge key={w} tone="danger" className="mt-2 whitespace-normal">
                    {w}
                  </StatusBadge>
                ))}
              </td>
              <td className="px-3 py-3">{r.evaluatorName}</td>
              <td className="px-3 py-3">
                <div className="flex flex-col items-start gap-2">
                  {reminderFor(r) && (
                    <form action={addReminderAction}>
                      <input type="hidden" name="evaluationId" value={r.evaluationId} />
                      <Button type="submit" variant="outline" size="sm" className="h-8" aria-label={`Dodaj przypomnienie dla oceniającego: ${r.employeeName}`}>
                        Dodaj przypomnienie
                      </Button>
                    </form>
                  )}
                  {r.extensionText && r.type === "OKRESOWA" && (
                    <Link href={`/hr/zawiadomienie/${r.evaluationId}`} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
                      <FileText className="size-4" aria-hidden /> Zawiadomienie o zmianie terminu
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
