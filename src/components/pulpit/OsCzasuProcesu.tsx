// Oś czasu procesu pracownika (Z37) na karcie pracownika: historia, nieobecności, terminy prawne i „dziś” na jednej linii.
// Komponent serwerowy, bez JavaScriptu po stronie przeglądarki. Dane: processTimeline() z src/lib/dashboard/os-czasu.ts.

import { CalendarRange, Check, Clock, MapPin, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineBadge } from "@/components/ui/status-badge";
import { Dlaczego } from "@/components/ui/dlaczego";
import type { TimelineEntry } from "@/lib/dashboard/os-czasu";
import { formatDatePl, formatRangePl } from "@/lib/rules/kalendarz";
import { cn } from "@/lib/utils";

const DOT: Record<string, { icon: LucideIcon; className: string; srLabel: string }> = {
  ZDARZENIE_ZROBIONE: { icon: Check, className: "bg-primary text-primary-foreground border-primary", srLabel: "Zrobione" },
  ZDARZENIE_PRZED_NAMI: { icon: Clock, className: "bg-card text-muted-foreground border-border", srLabel: "Zaplanowane" },
  OKRES: { icon: CalendarRange, className: "bg-muted text-muted-foreground border-border", srLabel: "Okres" },
  TERMIN_PRZED_NAMI: { icon: Clock, className: "bg-card text-primary border-primary", srLabel: "Termin" },
  TERMIN_DZIS: { icon: TriangleAlert, className: "bg-warning-soft text-warning border-warning", srLabel: "Termin mija dziś" },
  TERMIN_PO_TERMINIE: { icon: TriangleAlert, className: "bg-danger-soft text-danger border-danger", srLabel: "Termin minął" },
};

function dotFor(x: TimelineEntry) {
  if (x.kind === "OKRES") return DOT.OKRES!;
  if (x.kind === "TERMIN") return DOT[`TERMIN_${x.state === "ZROBIONE" ? "PRZED_NAMI" : x.state}`] ?? DOT.TERMIN_PRZED_NAMI!;
  return x.state === "PRZED_NAMI" ? DOT.ZDARZENIE_PRZED_NAMI! : DOT.ZDARZENIE_ZROBIONE!;
}

function when(x: TimelineEntry): string {
  if (!x.until) return formatDatePl(x.date);
  return x.kind === "TERMIN" ? `od ${formatDatePl(x.date)} do ${formatDatePl(x.until)}` : formatRangePl(x.date, x.until);
}

export function OsCzasuProcesu({ entries, className }: { entries: readonly TimelineEntry[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle as="h2">Oś czasu procesu</CardTitle>
        <p className="text-sm text-muted-foreground">Co już się wydarzyło i jakie terminy są przed Tobą – z podstawą prawną.</p>
      </CardHeader>
      <CardContent>
        <ol aria-label="Oś czasu procesu pracownika" className="ml-3 border-l-2 border-border">
          {entries.map((x, i) => {
            if (x.kind === "DZIS") {
              return (
                <li key={`dzis-${i}`} aria-current="date" className="relative py-3 pl-6">
                  <span className="absolute top-1/2 -left-[9px] size-4 -translate-y-1/2 rounded-full border-2 border-card bg-foreground" aria-hidden />
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="size-4" aria-hidden />
                    Dziś, {formatDatePl(x.date)}
                  </p>
                </li>
              );
            }
            const dot = dotFor(x);
            const Icon = dot.icon;
            const future = x.kind !== "TERMIN" && x.state === "PRZED_NAMI";
            return (
              <li key={`${x.kind}-${x.date}-${i}`} className="relative pb-5 pl-6 last:pb-0">
                <span
                  className={cn("absolute top-0.5 -left-[13px] flex size-6 items-center justify-center rounded-full border-2", dot.className)}
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>
                <div className={cn("flex flex-col gap-1", future && "text-muted-foreground")}>
                  <p className="text-sm text-muted-foreground">
                    <span className="sr-only">{dot.srLabel}: </span>
                    {when(x)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{x.title}</h3>
                    {x.kind === "TERMIN" && x.daysLeft !== undefined && x.urgency && <DeadlineBadge daysLeft={x.daysLeft} urgency={x.urgency} />}
                    {x.hint && <Dlaczego id={x.hint} />}
                  </div>
                  {x.detail && <p className="text-sm">{x.detail}</p>}
                  {x.legalBasis && <p className="text-xs text-muted-foreground">Podstawa: {x.legalBasis}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
