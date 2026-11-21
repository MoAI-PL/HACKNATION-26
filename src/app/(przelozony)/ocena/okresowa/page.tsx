import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DeadlineBadge, EvaluationStatusBadge } from "@/components/ui/status-badge";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import type { EvaluationStatus } from "@/lib/domain/types";
import { listPeriodicEvaluations } from "@/lib/ocena/dane-kreatora";
import { daysBetween, formatDateShortPl } from "@/lib/rules/kalendarz";
import { deadlineUrgency } from "@/lib/rules/terminy";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<EvaluationStatus, string> = {
  DO_ROZPOCZECIA: "Ustal kryteria",
  W_OKRESIE_OCENY: "Zobacz część I",
  W_OCENIE: "Oceń",
  CZEKA_NA_ZAPOZNANIE: "Potwierdź zapoznanie",
  ZAKONCZONA: "Zobacz ocenę",
};

function actionHref(id: string, status: EvaluationStatus): string {
  if (status === "W_OCENIE") return `/ocena/okresowa/${id}/ocena`;
  if (status === "CZEKA_NA_ZAPOZNANIE" || status === "ZAKONCZONA") return `/ocena/okresowa/${id}/podsumowanie`;
  return `/ocena/okresowa/${id}`;
}

export default async function OcenaOkresowaPage() {
  const user = await requirePageRole("PRZELOZONY");
  const items = await listPeriodicEvaluations(user.id);
  const today = todayIso();
  const toStart = items.filter((i) => i.status === "DO_ROZPOCZECIA");

  return (
    <>
      <PageHeader
        title="Ocena okresowa"
        description="Ustal kryteria i termin oceny na rozmowie rozpoczynającej, a po okresie oceny – sporządź ocenę."
        action={
          toStart[0] ? (
            <Button asChild>
              <Link href={`/ocena/okresowa/${toStart[0].evaluationId}`}>Ustal kryteria: {toStart[0].employeeName}</Link>
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nie masz otwartych ocen okresowych"
          description="Ocena pojawi się tutaj, gdy HR doda pracownika zatrudnionego na czas nieokreślony albo minie termin kolejnej oceny."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((i) => {
            const date = i.status === "DO_ROZPOCZECIA" ? i.conversationDue : i.dueDate;
            const what = i.status === "DO_ROZPOCZECIA" ? "rozmowa do" : "ocena do";
            const deadline = date ? { kind: "OCENA_OKRESOWA" as const, date, extensions: [], explanation: { text: "" } } : null;
            return (
              <li key={i.evaluationId}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">{i.employeeName}</span>
                      <span className="text-sm text-muted-foreground">
                        {i.positionTitle ?? "bez opisu stanowiska"}
                        {i.isReevaluation ? " · ponowna ocena po ocenie negatywnej" : ""}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <EvaluationStatusBadge type="OKRESOWA" status={i.status} />
                        {deadline && (
                          <DeadlineBadge
                            daysLeft={daysBetween(today, deadline.date)}
                            urgency={deadlineUrgency(deadline, today)}
                            label={`${what} ${formatDateShortPl(deadline.date)}`}
                          />
                        )}
                      </span>
                    </div>
                    <Button asChild variant={i.status === "W_OKRESIE_OCENY" ? "outline" : "default"}>
                      <Link href={actionHref(i.evaluationId, i.status)}>{ACTION_LABEL[i.status]}</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
