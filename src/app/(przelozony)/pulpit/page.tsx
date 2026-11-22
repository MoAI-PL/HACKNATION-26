import type { Metadata } from "next";
import Link from "next/link";
import { AlarmClock, CalendarCheck2, CalendarClock, CalendarDays, ChevronRight, ClipboardList, FileText, MessagesSquare, NotebookPen, UserStar, Users, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { URGENCY_TONE } from "@/lib/ui/status";
import { cn } from "@/lib/utils";
import { rules } from "@/lib/domain/przepisy";
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
import { NOTE_REMINDER_DAYS, NOTE_REMINDER_LIMIT, monthsAgoText, noteReminders } from "@/lib/dashboard/notatki";
import { buildDashboardTodo, employeeHref, employeeRow, formatDay, journalLinks, pathEntries, sortRows, type PathKey } from "@/lib/dashboard/pulpit";

export const metadata: Metadata = { title: "Pulpit – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

const MONTHS_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const URGENCY_BAR: Record<string, string> = {
  danger: "border-l-danger",
  warning: "border-l-warning-strong",
  success: "border-l-success",
  info: "border-l-info",
  neutral: "border-l-border",
};

// Pulpit przełożonego: „co mam dziś zrobić”, a pod spodem lista ludzi.
export default async function PulpitPage() {
  const user = await requirePageRole("PRZELOZONY");
  const today = todayIso();
  const employees = await loadSubordinates(user.id);
  const todo = buildDashboardTodo(employees, today);
  const rows = sortRows(employees.map((e) => employeeRow(e, today)));
  const paths = pathEntries(employees);
  const reminders = noteReminders(employees, today);
  // Podsumowanie na górze pulpitu – te same dane co lista „Do zrobienia” i karty pracowników.
  const urgent = todo.filter((t) => t.urgency === "PILNE" || t.urgency === "PO_TERMINIE").length;
  const soon = todo.filter((t) => t.urgency === "WKROTCE").length;
  const inProgress = rows.filter((r) => r.evaluation && r.evaluation.status !== "ZAKONCZONA").length;
  const notes = employees.reduce((sum, e) => sum + e.observationsCount, 0);
  const stats: { label: string; value: number; icon: LucideIcon; alert?: boolean }[] = [
    { label: `Pilne – do ${rules.deadlineUrgency.urgentDays} dni`, value: urgent, icon: AlarmClock, alert: urgent > 0 },
    { label: `Terminy w ciągu ${rules.deadlineUrgency.soonDays} dni`, value: soon, icon: CalendarClock },
    { label: "Oceny w toku", value: inProgress, icon: ClipboardList },
    { label: "Notatki w dzienniku", value: notes, icon: NotebookPen },
  ];
  const firstName = (user.name ?? "").split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Dzień dobry, ${firstName}` : "Pulpit"}
        description={`Dziś jest ${weekdayName(today)}, ${formatDatePl(today)}. Najpilniejsze sprawy są na górze.`}
        action={<DodajPracownika />}
      />

      <div className="flex flex-col gap-8">
        {/* Liczba kolumn z szerokości w rem – przy powiększonym tekście kafelki same przechodzą do nowego wiersza. */}
        <ul aria-label="Podsumowanie" className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3">
          {stats.map(({ label, value, icon: Icon, alert }) => (
            <li
              key={label}
              className={cn("flex items-center gap-3 rounded-xl border bg-card p-4 shadow-xs", alert && "border-l-4 border-l-danger")}
            >
              <span
                aria-hidden
                className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", alert ? "bg-danger-soft text-danger" : "bg-secondary text-primary")}
              >
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-2xl font-semibold tabular-nums">{value}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </span>
            </li>
          ))}
        </ul>

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
                description="Gdy zbliży się termin rozmowy lub oceny któregoś z Twoich pracowników, zobaczysz go tutaj."
              />
            ) : (
              <ol className="flex flex-col divide-y">
                {todo.map((item) => (
                  <li key={`${item.employeeId}-${item.deadline.kind}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    {/* Blok daty: dzień i miesiąc terminu; pasek z lewej w kolorze pilności (obok jest też tekst „Zostało …”). */}
                    <span
                      aria-hidden
                      className={cn("flex w-14 shrink-0 flex-col items-center rounded-lg border border-l-4 bg-card py-1 leading-tight", URGENCY_BAR[URGENCY_TONE[item.urgency]])}
                    >
                      <span className="text-xl font-semibold tabular-nums">{Number(item.deadline.date.slice(8, 10))}</span>
                      <span className="text-xs text-muted-foreground uppercase">{MONTHS_SHORT[Number(item.deadline.date.slice(5, 7)) - 1]}</span>
                    </span>
                    <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1.5">
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

        {reminders.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Regularne notatki</CardTitle>
                <InfoTip label="Dlaczego to przypomnienie?" legalBasis="§ 10 rozporządzenia w sprawie ocen okresowych">
                  Ocena obejmuje cały okres. Gdy notatki pochodzą tylko z ostatnich tygodni, łatwo ocenić świeże wrażenie zamiast
                  całego okresu (efekt świeżości). Przypominamy o osobach bez notatki od ponad {NOTE_REMINDER_DAYS} dni.
                </InfoTip>
              </div>
              <CardDescription>Osoby w okresie oceny, o których od dawna nie ma notatki w dzienniku obserwacji.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y">
                {reminders.slice(0, NOTE_REMINDER_LIMIT).map((r) => {
                  const links = journalLinks(r.employeeId);
                  return (
                    <li key={r.employeeId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
                        <span className="font-medium">
                          {r.employeeName} – bez notatki od {monthsAgoText(r.days)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {r.lastNote
                            ? `Ostatnia notatka: ${formatDatePl(r.lastNote)} (${r.days} ${plural(r.days, ["dzień", "dni", "dni"])} temu).`
                            : `Brak notatek od początku okresu oceny (${formatDatePl(r.periodStart)}).`}
                        </span>
                      </div>
                      {links && (
                        <Button variant="outline" asChild>
                          <Link href={links.add} className="no-underline">
                            <NotebookPen aria-hidden />
                            Dodaj notatkę
                            <span className="sr-only">: {r.employeeName}</span>
                          </Link>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {reminders.length > NOTE_REMINDER_LIMIT && (
                <p className="mt-2 text-sm text-muted-foreground">
                  I jeszcze {reminders.length - NOTE_REMINDER_LIMIT} {plural(reminders.length - NOTE_REMINDER_LIMIT, ["osoba", "osoby", "osób"])} – zobacz{" "}
                  <Link href="/obserwacje">dziennik obserwacji</Link>.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
            <ul className="grid gap-3 lg:grid-cols-2 [&>li]:min-w-0">
              {rows.map((r) => {
                const journal = journalLinks(r.id);
                const obsText =
                  r.observationsCount === 0
                    ? "Brak obserwacji w dzienniku"
                    : `${r.observationsCount} ${plural(r.observationsCount, ["obserwacja", "obserwacje", "obserwacji"])}${
                        r.lastObservationDate ? `, ostatnia ${formatDay(r.lastObservationDate, today)}` : ""
                      }`;
                return (
                  <li key={r.id}>
                    {/* Cała karta prowadzi do karty pracownika (link na nazwisku rozciągnięty na kartę),
                        a linia z obserwacjami – osobny link do dziennika (bez zagnieżdżania linków). */}
                    <div className="relative flex h-full flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/50">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={r.name} />
                          <div className="flex min-w-0 flex-col">
                          <Link
                            href={employeeHref(r.id)}
                            className="font-semibold text-foreground no-underline after:absolute after:inset-0 after:rounded-xl"
                          >
                            {r.name}
                          </Link>
                          <span className="text-sm text-muted-foreground">
                            {[r.positionTitle, r.orgUnit].filter(Boolean).join(" · ") || "Stanowisko nieuzupełnione"}
                          </span>
                          </div>
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
                        {journal ? (
                          <Link
                            href={r.observationsCount === 0 ? journal.add : journal.list}
                            className="relative z-10 rounded-sm text-primary underline-offset-4 hover:underline"
                          >
                            {r.observationsCount === 0 ? "Brak obserwacji – dodaj pierwszą" : obsText}
                            <span className="sr-only"> – dziennik: {r.name}</span>
                          </Link>
                        ) : (
                          obsText
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
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
