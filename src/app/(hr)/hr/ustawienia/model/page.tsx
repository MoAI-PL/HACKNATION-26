import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/AppShell";
import { FormularzOpisow } from "@/components/hr/FormularzOpisow";
import { HistoriaZmian, UstawieniaZakladki } from "@/components/hr/UstawieniaZakladki";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePageRole } from "@/lib/auth/guard";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import { BEHAVIOR_LEVEL_TO_LEVEL, LEVEL_LABELS } from "@/lib/domain/slownik";
import type { BehaviorLevel } from "@/lib/domain/types";
import { changeViews } from "@/lib/konfiguracja/historia";
import { LEVEL_KEYS, currentRuntimeConfig, defaultBehavior } from "@/lib/konfiguracja/stan";

export const metadata: Metadata = { title: "Opisy zachowań – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Panel HR, część 2 (Z19): opisy zachowań z modelu kompetencji (karty zachowań w ocenie, Z14) bez zmian w kodzie.
export default async function OpisyZachowanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("HR");
  const requested = (await searchParams).wskaznik;
  const changed = currentRuntimeConfig().model ?? {};
  const indicator = competencyModel.getIndicator(String(requested ?? "")) ?? competencyModel.indicators[0]!;
  const competency = competencyModel.getCompetency(indicator.competency);
  const changedCount = Object.keys(changed).length;

  const levels = LEVEL_KEYS.map((l) => ({
    level: l,
    label: LEVEL_LABELS[BEHAVIOR_LEVEL_TO_LEVEL[Number(l) as BehaviorLevel]],
    value: indicator.levels[Number(l) as BehaviorLevel],
    fileValue: defaultBehavior(indicator.id, l) ?? "",
  }));

  return (
    <>
      <PageHeader
        title="Przepisy i model kompetencji"
        description="Opisy zachowań to treść kart, które przełożony klika przy ocenie wskaźników. Popraw opis, gdy jest niejasny albo gdy urząd przyjmie nową wersję modelu – bez programisty."
        badge={
          changedCount > 0 ? (
            <StatusBadge tone="warning">Zmienione wskaźniki: {changedCount}</StatusBadge>
          ) : (
            <StatusBadge tone="success">Opisy z modelu kompetencji</StatusBadge>
          )
        }
      />
      <UstawieniaZakladki active="/hr/ustawienia/model" />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xl">
          <Label htmlFor="wskaznik">Wskaźnik</Label>
          <select
            id="wskaznik"
            name="wskaznik"
            defaultValue={indicator.id}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-base text-foreground"
          >
            {competencyModel.competencies.map((c) => (
              <optgroup key={c.code} label={c.name}>
                {c.indicators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} – {i.name.length > 70 ? `${i.name.slice(0, 70).replace(/\s+\S*$/, "")}…` : i.name}
                    {changed[i.id] ? " (zmieniony)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Pokaż opisy
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            {competency.name} · {indicator.id}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{indicator.name}</p>
        </CardHeader>
        <CardContent>
          <FormularzOpisow key={indicator.id} indicatorId={indicator.id} levels={levels} overridden={Boolean(changed[indicator.id])} />
        </CardContent>
      </Card>

      <HistoriaZmian changes={await changeViews()} />
    </>
  );
}
