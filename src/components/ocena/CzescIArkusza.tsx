import * as React from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { COMPETENCY_NAMES, CRITERION_KIND_LABELS, SHEET_LABELS } from "@/lib/domain/slownik";
import type { CompetencyCode, Deadline, IsoDate, Sheet } from "@/lib/domain/types";
import { formatDatePl } from "@/lib/rules/kalendarz";

// Część I arkusza oceny okresowej (Z12): kryteria i termin sporządzenia oceny (§ 5 ust. 3).
// Ten sam widok w ostatnim kroku kreatora (podgląd przed zatwierdzeniem) i po zatwierdzeniu.

export interface PartOneCriterion {
  competency: CompetencyCode;
  kind: "OBOWIAZKOWE" | "DODATKOWE";
  reason?: string;
}

export function CzescIArkusza({
  employeeName,
  positionTitle,
  sheet,
  criteria,
  dueDate,
  dueExplanation,
  conversationDate,
  expectations,
  goals,
}: {
  employeeName: string;
  positionTitle?: string;
  sheet: Sheet;
  criteria: PartOneCriterion[];
  dueDate?: IsoDate;
  dueExplanation?: Deadline["explanation"];
  conversationDate?: IsoDate;
  expectations?: string;
  goals?: string;
}) {
  const mandatory = criteria.filter((c) => c.kind === "OBOWIAZKOWE");
  const additional = criteria.filter((c) => c.kind === "DODATKOWE");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Część I arkusza – {SHEET_LABELS[sheet]}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {employeeName}
          {positionTitle ? `, ${positionTitle}` : ""}
          {conversationDate ? ` · rozmowa rozpoczynająca ${formatDatePl(conversationDate)}` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section aria-labelledby="czesc-i-kryteria">
          <h2 id="czesc-i-kryteria" className="mb-2 text-base font-semibold">
            Kryteria oceny
          </h2>
          <ol className="flex flex-col gap-2">
            {mandatory.map((c) => (
              <li key={c.competency} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{COMPETENCY_NAMES[c.competency]}</span>
                <span className="text-sm text-muted-foreground">{CRITERION_KIND_LABELS[c.kind]}</span>
              </li>
            ))}
            {additional.map((c) => (
              <li key={c.competency} className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{COMPETENCY_NAMES[c.competency]}</span>
                  <span className="text-sm text-muted-foreground">{CRITERION_KIND_LABELS[c.kind]}</span>
                </span>
                {c.reason && <span className="text-sm text-muted-foreground">Dlaczego: {c.reason}</span>}
              </li>
            ))}
          </ol>
          {additional.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Bez kryteriów dodatkowych – są nieobowiązkowe (§ 2 ust. 2).</p>
          )}
        </section>

        <section aria-labelledby="czesc-i-termin" className="flex flex-col gap-1">
          <h2 id="czesc-i-termin" className="flex items-center gap-2 text-base font-semibold">
            <CalendarClock className="size-4 text-primary" aria-hidden />
            Termin sporządzenia oceny na piśmie
            {dueExplanation && (
              <InfoTip legalBasis={dueExplanation.legalBasis} label="Skąd ten termin?">
                {dueExplanation.text}
              </InfoTip>
            )}
          </h2>
          <p className="text-lg font-medium">{dueDate ? formatDatePl(dueDate) : "—"}</p>
        </section>

        {(expectations || goals) && (
          <section aria-labelledby="czesc-i-rozmowa" className="flex flex-col gap-2">
            <h2 id="czesc-i-rozmowa" className="text-base font-semibold">
              Ustalenia z rozmowy rozpoczynającej
            </h2>
            {expectations && (
              <p className="whitespace-pre-line text-sm">
                <span className="font-medium">Oczekiwania: </span>
                {expectations}
              </p>
            )}
            {goals && (
              <p className="whitespace-pre-line text-sm">
                <span className="font-medium">Cele: </span>
                {goals}
              </p>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
