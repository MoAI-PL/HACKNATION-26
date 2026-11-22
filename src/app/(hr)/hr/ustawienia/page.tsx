import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/AppShell";
import { FormularzPrzepisow, type RuleGroupView } from "@/components/hr/FormularzPrzepisow";
import { HistoriaZmian, UstawieniaZakladki } from "@/components/hr/UstawieniaZakladki";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePageRole } from "@/lib/auth/guard";
import { rules } from "@/lib/domain/przepisy";
import { changeViews } from "@/lib/konfiguracja/historia";
import { RULE_GROUPS, basisOf, displayValue, unitWord } from "@/lib/konfiguracja/pola";
import { currentRuntimeConfig, defaultRules } from "@/lib/konfiguracja/stan";

export const metadata: Metadata = { title: "Parametry przepisów – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Panel HR, część 2 (Z19): parametry przepisów bez zmian w kodzie. Zmiana działa od razu w terminach, ocenie i Lustrze.
export default async function ParametryPrzepisowPage() {
  await requirePageRole("HR");
  const file = defaultRules();
  const overridden = currentRuntimeConfig().rules !== null;
  const groups: RuleGroupView[] = RULE_GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    assumption: g.assumption,
    fields: g.fields.map((f) => ({
      path: f.path,
      label: f.label,
      unit: f.unit,
      unitWord: unitWord(f.unit),
      min: f.min,
      max: f.max,
      step: f.step,
      value: displayValue(f, rules),
      fileValue: displayValue(f, file),
      basis: basisOf(f, rules),
    })),
  }));

  return (
    <>
      <PageHeader
        title="Przepisy i model kompetencji"
        description="Gdy zmienią się przepisy albo praktyka urzędu, zmienisz parametry tutaj – bez programisty i bez nowej wersji aplikacji. Zmiana obowiązuje od razu we wszystkich ocenach i terminach."
        badge={overridden ? <StatusBadge tone="warning">Zmienione w panelu HR</StatusBadge> : <StatusBadge tone="success">Wartości z pliku przepisów</StatusBadge>}
      />
      <UstawieniaZakladki active="/hr/ustawienia" />
      <Notice tone="info" title="Co się zmieni po zapisie" className="mb-6">
        Silnik terminów od razu przeliczy terminy na pulpitach i w panelu HR, kreator ocen zastosuje nowy limit kryteriów, a Lustro – nowe progi.
        Skali punktów i progów wyniku z § 11 nie zmieniamy w formularzu: wynikają wprost z rozporządzenia i obowiązują wszystkie urzędy.
      </Notice>
      <FormularzPrzepisow groups={groups} overridden={overridden} />
      <HistoriaZmian changes={await changeViews()} />
    </>
  );
}
