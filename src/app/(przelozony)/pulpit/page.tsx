import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CalendarDays, ChevronRight, FileText, MessagesSquare, NotebookPen, UserStar, Users, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineBadge, EvaluationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { Button } from "@/components/ui/button";
import { DodajPracownika } from "@/components/pulpit/DodajPracownika";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { EVALUATION_TYPE_LABELS } from "@/lib/domain/slownik";
import { DEADLINE_KIND_LABELS } from "@/lib/rules/terminy";
import { daysBetween, formatDatePl, weekdayName } from "@/lib/rules/kalendarz";
import { plural } from "@/lib/rules/tekst";
import { loadSubordinates } from "@/lib/dashboard/dane";
import { buildDashboardTodo, employeeHref, employeeRow, formatDay, pathEntries, sortRows, type PathKey } from "@/lib/dashboard/pulpit";

export const metadata: Metadata = { title: "Pulpit – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Pulpit przełożonego (Z11): „co mam dziś zrobić”, a pod spodem lista ludzi (sekcja 4.1 pkt 1).
export default async function PulpitPage() {
  const user = await requirePageRole("PRZELOZONY");
  const today = todayIso();
  const employees = await loadSubordinates(user.id);
  const todo = buildDashboardTodo(employees, today);
  const rows = sortRows(employees.map((e) => employeeRow(e, today)));
  const paths = pathEntries(employees);
  const firstName = (user.name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Dzień dobry, ${firstName}` : "Pulpit"}
        description={`Dziś jest ${weekdayName(today)}, ${formatDatePl(today)}. Najpilniejsze sprawy są na górze.`}
        action={<DodajPracownika />}
      />

      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Do zrobienia</CardTitle>
              <InfoTip label="Skąd te terminy?" legalBasis="art. 81 ustawy o służbie cywilnej, § 7 rozporządzenia, art. 111–115 KC">
                Terminy wylicza system z dat zatrudnienia, poprzednich ocen i nieobecności. Koniec terminu w sobotę lub
                święto przesuwa się na następny dzień roboczy.
              </InfoTip>
            </div>
            <CardDescription>Najbliższe terminy, posortowane od najpilniejszego.</CardDescription>
          </CardHeader>
          <CardContent>
            {todo.length === 0 ? (
              <EmptyState
                icon={CalendarCheck2}
                title="Nie masz teraz żadnych pilnych spraw."
                description="Gdy zbliży się termin rozmowy lub oceny któregoś z podwładnych, zobaczysz go tutaj."
              />
            ) : (
              <ol className="flex flex-col divide-y">
                {todo.map((item) => (
                  <li key={`${item.employeeId}-${item.deadline.kind}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="font-medium">{item.title}</span>
                      <DeadlineBadge
                        className="self-start"
                        variant="solid"
                        size="md"
                        daysLeft={daysBetween(today, item.deadline.date)}
                        urgency={item.urgency}
                      />
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={item.href} className="no-underline">
                        {item.actionLabel}
                        <span className="sr-only">: {item.title}</span>
                      </Link>
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {paths.length > 0 && (
          <nav aria-labelledby="sciezki" className="flex flex-col gap-3">
            <h2 id="sciezki" className="text-xl">
              Ścieżki oceny
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {paths.map((p) => {
                const Icon = PATH_ICONS[p.key];
                return (
                  <li key={p.key}>
                    <Link
                      href={p.href}
                      className="group flex h-full items-center gap-3 rounded-xl border bg-card p-4 text-foreground no-underline shadow-xs transition-colors hover:border-primary/50"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">{p.title}</span>
                        <span className="text-sm text-muted-foreground">{p.summary}</span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <section aria-labelledby="podwladni" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="podwladni" className="text-xl">
              Twoi pracownicy
            </h2>
            <span className="text-sm text-muted-foreground">
              {rows.length} {plural(rows.length, ["osoba", "osoby", "osób"])}
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nie masz jeszcze pracowników na liście."
              description="Dodaj pierwszą osobę – wystarczy imię, nazwisko i stanowisko. System sam dobierze arkusz i policzy terminy."
              action={<DodajPracownika />}
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={employeeHref(r.id)}
                    className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 text-foreground no-underline shadow-xs transition-colors hover:border-primary/50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {[r.positionTitle, r.orgUnit].filter(Boolean).join(" · ") || "Stanowisko nieuzupełnione"}
                        </span>
                      </div>
                      {r.evaluation && <EvaluationStatusBadge type={r.evaluation.type} status={r.evaluation.status} />}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {r.evaluation ? (
                        <span className="text-muted-foreground">
                          {EVALUATION_TYPE_LABELS[r.evaluation.type]}
                          {r.evaluation.type === "OKRESOWA" ? `, arkusz ${r.evaluation.sheet}` : ""}
                          {r.evaluation.isReevaluation ? " (ponowna po ocenie negatywnej)" : ""}
                        </span>
                      ) : (
                        <StatusBadge>Brak otwartej oceny</StatusBadge>
                      )}
                    </div>

                    {r.next ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span>
                          {DEADLINE_KIND_LABELS[r.next.deadline.kind]}: do {formatDay(r.next.deadline.date, today)}
                        </span>
                        <DeadlineBadge daysLeft={r.next.daysLeft} urgency={r.next.urgency} />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Brak terminów do pilnowania.</span>
                    )}

                    <span className="mt-auto flex items-center gap-1.5 text-sm text-muted-foreground">
                      <NotebookPen className="size-4" aria-hidden />
                      {r.observationsCount === 0
                        ? "Brak obserwacji w dzienniku"
                        : `${r.observationsCount} ${plural(r.observationsCount, ["obserwacja", "obserwacje", "obserwacji"])}${
                            r.lastObservationDate ? `, ostatnia ${formatDay(r.lastObservationDate, today)}` : ""
                          }`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

const PATH_ICONS: Record<PathKey, LucideIcon> = {
  OKRESOWA: CalendarDays,
  PIERWSZA: UserStar,
  ASYSTENT_FORMALNY: FileText,
  ASYSTENT_ROZMOWY: MessagesSquare,
};
