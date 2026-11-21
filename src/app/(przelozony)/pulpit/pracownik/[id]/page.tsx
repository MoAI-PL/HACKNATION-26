import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, NotebookPen } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineBadge, EvaluationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { ABSENCE_KIND_LABELS, EVALUATION_TYPE_LABELS, LEVEL_LABELS, RESULT_LABELS } from "@/lib/domain/slownik";
import { DEADLINE_KIND_LABELS, deadlineUrgency, daysUntil } from "@/lib/rules/terminy";
import { formatDatePl, formatRangePl, inclusiveDays } from "@/lib/rules/kalendarz";
import { plural } from "@/lib/rules/tekst";
import { loadSubordinate } from "@/lib/dashboard/dane";
import { currentEvaluation, evaluationLink, fullName, openDeadlines } from "@/lib/dashboard/pulpit";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pracownik – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Karta pracownika na pulpicie (Z11): etap oceny i terminy z wyjaśnieniem i podstawą prawną.
// Dostęp tylko dla bezpośredniego przełożonego – inaczej 404 (bez ujawniania, czy pracownik istnieje).
export default async function PracownikPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("PRZELOZONY");
  const { id } = await params;
  const employee = await loadSubordinate(user.id, id);
  if (!employee) notFound();

  const today = todayIso();
  const current = currentEvaluation(employee);
  const deadlines = openDeadlines(employee);
  const history = employee.evaluations.filter((e) => e.status === "ZAKONCZONA").reverse();
  const action = evaluationLink(employee);

  return (
    <>
      <Link href="/pulpit" className="mb-4 inline-flex items-center gap-1.5 text-sm text-primary">
        <ArrowLeft className="size-4" aria-hidden />
        Wróć do pulpitu
      </Link>
      <PageHeader
        title={fullName(employee)}
        description={[employee.positionTitle, employee.orgUnit].filter(Boolean).join(" · ") || undefined}
        badge={current && <EvaluationStatusBadge type={current.type} status={current.status} />}
        action={
          action && (
            <Button asChild>
              <Link href={action.href} className="no-underline">
                {action.label}
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Terminy</CardTitle>
            {current && (
              <p className="text-sm text-muted-foreground">
                {EVALUATION_TYPE_LABELS[current.type]}
                {current.type === "OKRESOWA" ? `, arkusz ${current.sheet}` : ""}
                {current.isReevaluation ? " – ponowna ocena po ocenie negatywnej" : ""}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Brak terminów do pilnowania."
                description={
                  current?.status === "CZEKA_NA_ZAPOZNANIE"
                    ? "Ocena jest sporządzona – teraz pracownik zapoznaje się z nią."
                    : "Nowe terminy pojawią się, gdy rozpocznie się kolejna ocena."
                }
              />
            ) : (
              <ul className="flex flex-col gap-4">
                {deadlines.map((d) => (
                  <li key={d.kind} className="flex flex-col gap-2 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">{DEADLINE_KIND_LABELS[d.kind]}</h3>
                      <DeadlineBadge daysLeft={daysUntil(d, today)} urgency={deadlineUrgency(d, today)} />
                    </div>
                    <p className="text-lg">
                      {d.earliest ? `od ${formatDatePl(d.earliest)} do ${formatDatePl(d.date)}` : `do ${formatDatePl(d.date)}`}
                    </p>
                    <p className="text-sm">{d.explanation.text}</p>
                    {d.extensions.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {d.extensions.map((x) => (
                          <li key={x.reason}>
                            <StatusBadge tone="info">
                              +{x.days} {plural(x.days, ["dzień", "dni", "dni"])}: {x.reason}
                            </StatusBadge>
                          </li>
                        ))}
                      </ul>
                    )}
                    {d.explanation.legalBasis && (
                      <p className="text-xs text-muted-foreground">Podstawa: {d.explanation.legalBasis}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Dziennik obserwacji</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="flex items-center gap-2 text-sm">
                <NotebookPen className="size-4 text-primary" aria-hidden />
                {employee.observationsCount === 0
                  ? "Brak obserwacji. Notatki z całego okresu dają lepszą ocenę niż pamięć."
                  : `${employee.observationsCount} ${plural(employee.observationsCount, ["obserwacja", "obserwacje", "obserwacji"])}${
                      employee.lastObservationDate ? `, ostatnia ${formatDatePl(employee.lastObservationDate)}` : ""
                    }.`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Poprzednie oceny</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">To pierwsza ocena tej osoby w systemie.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-2">
                      <span>{h.evaluatedAt ? formatDatePl(h.evaluatedAt) : "—"}</span>
                      {h.result && (
                        <StatusBadge tone={h.result === "POZYTYWNA" ? "success" : "danger"}>{RESULT_LABELS[h.result]}</StatusBadge>
                      )}
                      {h.level && <span className="text-muted-foreground">{LEVEL_LABELS[h.level]}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {employee.absences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Nieobecności</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {employee.absences.map((a) => (
                    <li key={`${a.from}-${a.to}`}>
                      {ABSENCE_KIND_LABELS[a.kind]}: {formatRangePl(a.from, a.to)} ({inclusiveDays(a.from, a.to)}{" "}
                      {plural(inclusiveDays(a.from, a.to), ["dzień", "dni", "dni"])})
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
