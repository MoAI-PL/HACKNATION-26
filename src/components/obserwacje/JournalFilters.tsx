import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { COMPETENCY_NAMES } from "@/lib/domain/slownik";
import { COMPETENCY_CODES } from "@/lib/domain/types";
import { filtersToQuery, type JournalFilters as Filters } from "@/lib/obserwacje/dziennik";
import { selectClass } from "@/lib/obserwacje/stale";
import type { Subordinate } from "@/lib/obserwacje/repo";
import { cn } from "@/lib/utils";

// Filtry dziennika: zwykły formularz GET – działa bez JavaScriptu, a wynik można udostępnić linkiem.


export function JournalFilters({ filters, people }: { filters: Filters; people: Subordinate[] }) {
  const active = Boolean(filters.employeeId || filters.competency || filters.from || filters.to);
  return (
    <form method="get" action="/obserwacje" className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_auto]" aria-label="Filtry dziennika">
      {filters.view === "wskazniki" && <input type="hidden" name="widok" value="wskazniki" />}
      <Field label="Osoba">
        <select name="osoba" defaultValue={filters.employeeId ?? ""} className={selectClass}>
          <option value="">Wszyscy pracownicy</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Kompetencja">
        <select name="kompetencja" defaultValue={filters.competency ?? ""} className={selectClass}>
          <option value="">Wszystkie kompetencje</option>
          {COMPETENCY_CODES.map((c) => (
            <option key={c} value={c}>
              {COMPETENCY_NAMES[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Od">
        <Input type="date" name="od" defaultValue={filters.from ?? ""} />
      </Field>
      <Field label="Do">
        <Input type="date" name="do" defaultValue={filters.to ?? ""} />
      </Field>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" variant="outline" className="h-10">
          Pokaż
        </Button>
        {active && (
          <Link href={`/obserwacje${filtersToQuery({ view: filters.view })}`} className={cn(buttonVariants({ variant: "ghost" }), "h-10")}>
            Wyczyść
          </Link>
        )}
      </div>
    </form>
  );
}
