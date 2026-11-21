import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/AppShell";
import { ObservationForm } from "@/components/obserwacje/ObservationForm";
import { competencyOptions } from "@/components/obserwacje/form-data";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { listSubordinates } from "@/lib/obserwacje/repo";

export const metadata: Metadata = { title: "Nowa obserwacja – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

export default async function NowaObserwacjaPage({ searchParams }: { searchParams: Promise<{ osoba?: string }> }) {
  const user = await requirePageRole("PRZELOZONY");
  const { osoba } = await searchParams;
  const people = await listSubordinates(user.id);
  const preset = people.find((p) => p.id === osoba)?.id;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Nowa obserwacja"
        description="Opisz jedno konkretne zdarzenie. Najwięcej warte są fakty: co się działo, co ta osoba zrobiła i jaki był skutek."
      />
      <ObservationForm
        people={people}
        competencies={competencyOptions()}
        today={todayIso()}
        defaultEmployeeId={preset}
        cancelHref={`/obserwacje${preset ? `?osoba=${encodeURIComponent(preset)}` : ""}`}
      />
    </div>
  );
}
