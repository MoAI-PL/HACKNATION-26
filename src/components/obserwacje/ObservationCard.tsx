import Link from "next/link";
import { Pencil } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import { BEHAVIOR_LEVEL_TO_LEVEL, COMPETENCY_NAMES, LEVEL_LABELS } from "@/lib/domain/slownik";
import { formatDatePl, type ObservationView } from "@/lib/obserwacje/dziennik";
import { cn } from "@/lib/utils";

// Jedna obserwacja z dziennika: data, osoba, wskaźnik, opis zachowania i Sytuacja – Działanie – Rezultat.
// Używana na osi czasu, w widoku według wskaźników i obok kart zachowań w ocenie (przez IndicatorNotes).

const SDR: { key: "situation" | "action" | "outcome"; label: string }[] = [
  { key: "situation", label: "Sytuacja" },
  { key: "action", label: "Działanie" },
  { key: "outcome", label: "Rezultat" },
];

export function ObservationCard({
  observation: o,
  showEmployee = true,
  showIndicator = true,
  editable = true,
  headingLevel = "h3",
}: {
  observation: ObservationView;
  showEmployee?: boolean;
  showIndicator?: boolean;
  editable?: boolean;
  headingLevel?: "h3" | "h4";
}) {
  const indicator = o.indicatorId ? competencyModel.getIndicator(o.indicatorId) : undefined;
  const Heading = headingLevel;
  const hasSdr = SDR.some((s) => o[s.key]);
  const behavior = o.behaviorLevel && indicator ? indicator.levels[o.behaviorLevel] : null;

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading className="text-base font-medium">
            <time dateTime={o.date}>{formatDatePl(o.date)}</time>
            {showEmployee && <span className="text-muted-foreground"> · {o.employeeName}</span>}
          </Heading>
          {showIndicator &&
            (indicator ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{COMPETENCY_NAMES[indicator.competency]}</span> – {indicator.name}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nieprzypięta do wskaźnika</p>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {o.behaviorLevel && <StatusBadge tone="info" icon={null}>{LEVEL_LABELS[BEHAVIOR_LEVEL_TO_LEVEL[o.behaviorLevel]]}</StatusBadge>}
          {o.source === "SZYBKA_AI" && <StatusBadge tone="ai">Szybka notatka</StatusBadge>}
          {editable && (
            <Link
              href={`/obserwacje/${o.id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8")}
              aria-label={`Edytuj obserwację z ${formatDatePl(o.date)}${showEmployee ? ` – ${o.employeeName}` : ""}`}
            >
              <Pencil aria-hidden /> Edytuj
            </Link>
          )}
        </div>
      </header>

      {behavior && <p className="rounded-md bg-muted px-3 py-2 text-sm">Najbliższy opis zachowania: {behavior}</p>}

      {hasSdr ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-[7rem_1fr]">
          {SDR.filter((s) => o[s.key]).map((s) => (
            <div key={s.key} className="contents">
              <dt className="font-medium text-muted-foreground">{s.label}</dt>
              <dd className="whitespace-pre-line">{o[s.key]}</dd>
            </div>
          ))}
        </dl>
      ) : (
        o.originalText && <p className="text-sm whitespace-pre-line">{o.originalText}</p>
      )}
    </article>
  );
}

/** Notatki z dziennika przy jednym wskaźniku (obok kart zachowań). */
export function IndicatorNotes({ observations, emptyText = "Brak notatek przy tym wskaźniku." }: { observations: ObservationView[]; emptyText?: string }) {
  if (observations.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label={`Notatki z dziennika: ${observations.length}`}>
      {observations.map((o) => (
        <li key={o.id}>
          <ObservationCard observation={o} showEmployee={false} showIndicator={false} headingLevel="h4" />
        </li>
      ))}
    </ul>
  );
}
