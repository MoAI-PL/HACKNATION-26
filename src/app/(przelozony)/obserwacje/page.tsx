import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { IndicatorNotes, ObservationCard } from "@/components/obserwacje/ObservationCard";
import { JournalFilters } from "@/components/obserwacje/JournalFilters";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { requirePageRole } from "@/lib/auth/guard";
import { filtersToQuery, groupByIndicator, groupByMonth, parseFilters } from "@/lib/obserwacje/dziennik";
import { listObservations, listSubordinates } from "@/lib/obserwacje/repo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dziennik obserwacji – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Dziennik obserwacji (Z13): notatki Sytuacja – Działanie – Rezultat o podwładnych, zbierane na bieżąco przez cały okres oceny.

const SAVED: Record<string, string> = {
  nowa: "Obserwacja zapisana. Zobaczysz ją także przy wskaźniku podczas oceny.",
  zmiana: "Zmiany w obserwacji zapisane.",
  usunieto: "Obserwacja usunięta.",
  brak: "Tej obserwacji już nie ma.",
};

export default async function ObserwacjePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageRole("PRZELOZONY");
  const params = await searchParams;
  const filters = parseFilters(params);
  const [people, observations] = await Promise.all([listSubordinates(user.id), listObservations(user.id, filters)]);
  const person = people.find((p) => p.id === filters.employeeId);
  const saved = typeof params.zapisano === "string" ? SAVED[params.zapisano] : undefined;
  const filtered = Boolean(filters.employeeId || filters.competency || filters.from || filters.to);
  const newHref = `/obserwacje/nowa${person ? `?osoba=${encodeURIComponent(person.id)}` : ""}`;

  const viewLink = (view: "os" | "wskazniki", label: string) => {
    const current = filters.view === view;
    return (
      <Link
        href={`/obserwacje${filtersToQuery({ ...filters, view })}`}
        aria-current={current ? "page" : undefined}
        className={cn(buttonVariants({ variant: current ? "secondary" : "ghost", size: "sm" }), "h-9 px-3")}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Dziennik obserwacji"
        description="Zapisuj konkretne zachowania na bieżąco: sytuację, działanie i rezultat. Przy ocenie zobaczysz je obok kart zachowań, więc ocena nie oprze się na ostatnich tygodniach."
        action={
          <Link href={newHref} className={cn(buttonVariants(), "h-10")}>
            <Plus aria-hidden /> Dodaj obserwację
          </Link>
        }
      />

      {saved && <Notice tone={params.zapisano === "brak" ? "warning" : "success"} title={saved} />}

      {people.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Nie masz jeszcze pracowników w systemie"
          description="Dziennik prowadzisz dla osób, które Ci bezpośrednio podlegają. Poproś komórkę kadr o przypisanie pracowników."
        />
      ) : (
        <>
          <JournalFilters filters={filters} people={people} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {observations.length === 0 ? "Brak obserwacji" : `Obserwacje: ${observations.length}`}
              {person ? ` · ${person.name}` : ""}
            </p>
            <nav aria-label="Widok dziennika" className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
              {viewLink("os", "Oś czasu")}
              {viewLink("wskazniki", "Według wskaźników")}
            </nav>
          </div>

          {observations.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title={filtered ? "Brak obserwacji dla wybranych filtrów" : "Nie masz jeszcze obserwacji"}
              description={
                filtered
                  ? "Zmień osobę, kompetencję albo okres – albo dodaj pierwszą obserwację z tego zakresu."
                  : "Dodaj pierwszą: wystarczy jedno zdanie o tym, co ktoś zrobił i jaki był skutek. Zajmie to mniej niż minutę."
              }
              action={
                <Link href={newHref} className={cn(buttonVariants(), "h-10")}>
                  <Plus aria-hidden /> Dodaj obserwację
                </Link>
              }
            />
          ) : filters.view === "os" ? (
            <ol className="flex flex-col gap-8" aria-label="Oś czasu obserwacji">
              {groupByMonth(observations).map((g) => (
                <li key={g.key} className="flex flex-col gap-3">
                  <h2 className="text-lg font-medium capitalize">
                    {g.label} <span className="text-sm font-normal text-muted-foreground normal-case">({g.items.length})</span>
                  </h2>
                  <ul className="flex flex-col gap-3 border-l-2 border-border pl-4">
                    {g.items.map((o) => (
                      <li key={o.id}>
                        <ObservationCard observation={o} showEmployee={!person} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : (
            <IndicatorSections view={groupByIndicator(observations)} showEmployee={!person} />
          )}
        </>
      )}
    </div>
  );
}

function IndicatorSections({ view, showEmployee }: { view: ReturnType<typeof groupByIndicator>; showEmployee: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      {view.competencies.map((c) => (
        <section key={c.competency} aria-labelledby={`k-${c.competency}`} className="flex flex-col gap-4">
          <h2 id={`k-${c.competency}`} className="text-lg font-medium">
            {c.name} <span className="text-sm font-normal text-muted-foreground">({c.count})</span>
          </h2>
          {c.indicators.map((i) => (
            <div key={i.indicatorId} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
              <h3 className="text-sm font-medium">{i.name}</h3>
              {showEmployee ? (
                <ul className="flex flex-col gap-3">
                  {i.items.map((o) => (
                    <li key={o.id}>
                      <ObservationCard observation={o} showIndicator={false} headingLevel="h4" />
                    </li>
                  ))}
                </ul>
              ) : (
                <IndicatorNotes observations={i.items} />
              )}
            </div>
          ))}
        </section>
      ))}
      {view.unpinned.length > 0 && (
        <section aria-labelledby="k-nieprzypiete" className="flex flex-col gap-3">
          <h2 id="k-nieprzypiete" className="text-lg font-medium">
            Nieprzypięte do wskaźnika <span className="text-sm font-normal text-muted-foreground">({view.unpinned.length})</span>
          </h2>
          <p className="text-sm text-muted-foreground">Przypnij je do wskaźnika (Edytuj), żeby były widoczne przy ocenie.</p>
          <ul className="flex flex-col gap-3">
            {view.unpinned.map((o) => (
              <li key={o.id}>
                <ObservationCard observation={o} showEmployee={showEmployee} showIndicator={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
