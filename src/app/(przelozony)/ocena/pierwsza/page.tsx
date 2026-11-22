import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeadlineBadge, EvaluationStatusBadge } from "@/components/ui/status-badge";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { listFirstEvaluations } from "@/lib/pierwsza-ocena/dane";
import type { FirstEvalStage } from "@/lib/pierwsza-ocena/przebieg";
import { daysBetween, formatDatePl, formatDateShortPl } from "@/lib/rules/kalendarz";
import { deadlineUrgency } from "@/lib/rules/terminy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pierwsza ocena – Kompas Kompetencji" };

const ACTION_LABEL: Record<FirstEvalStage, string> = {
  ROZMOWA_WSTEPNA: "Zapisz rozmowę wstępną",
  SPRAWOZDANIE: "Odnotuj sprawozdanie",
  OCENA: "Oceń elementy",
  ZAPOZNANIE: "Potwierdź zapoznanie",
  ZAKONCZONA: "Zobacz ocenę",
};

export default async function PierwszaOcenaPage() {
  const user = await requirePageRole("PRZELOZONY");
  const items = await listFirstEvaluations(user.id);
  const today = todayIso();

  return (
    <>
      <PageHeader
        title="Pierwsza ocena"
        description="Nowi pracownicy służby cywilnej: rozmowa wstępna w 21 dni, sprawozdanie po 8 miesiącach, ocena pięciu elementów i wynik według § 10."
      />
      {items.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nie masz otwartych pierwszych ocen"
          description="Pierwsza ocena pojawi się tutaj, gdy HR doda osobę, która po raz pierwszy podejmuje pracę w służbie cywilnej."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((i) => (
            <li key={i.evaluationId}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{i.employeeName}</span>
                    <span className="text-sm text-muted-foreground">{i.positionTitle ?? "bez opisu stanowiska"}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <EvaluationStatusBadge type="PIERWSZA" status={i.status} />
                      {i.next && (
                        <DeadlineBadge
                          daysLeft={daysBetween(today, i.next.deadline.date)}
                          urgency={deadlineUrgency(i.next.deadline, today)}
                          label={`${i.next.label} ${i.next.deadline.date.slice(0, 4) === today.slice(0, 4) ? formatDateShortPl(i.next.deadline.date) : formatDatePl(i.next.deadline.date)}`}
                        />
                      )}
                    </span>
                  </div>
                  <Button asChild variant={i.stage === "SPRAWOZDANIE" ? "outline" : "default"}>
                    <Link href={`/ocena/pierwsza/${i.evaluationId}`}>{ACTION_LABEL[i.stage]}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
