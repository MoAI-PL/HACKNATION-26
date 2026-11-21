import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/AppShell";
import { ObservationForm } from "@/components/obserwacje/ObservationForm";
import { competencyOptions } from "@/components/obserwacje/form-data";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { formatDatePl } from "@/lib/obserwacje/dziennik";
import { getObservation, listSubordinates } from "@/lib/obserwacje/repo";

export const metadata: Metadata = { title: "Edycja obserwacji – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

export default async function EdycjaObserwacjiPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("PRZELOZONY");
  const { id } = await params;
  const [observation, people] = await Promise.all([getObservation(user.id, id), listSubordinates(user.id)]);
  if (!observation) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Edycja obserwacji" description={`${observation.employeeName} · ${formatDatePl(observation.date)}`} />
      <ObservationForm
        people={people}
        competencies={competencyOptions()}
        today={todayIso()}
        initial={observation}
        cancelHref={`/obserwacje?osoba=${encodeURIComponent(observation.employeeId)}`}
      />
    </div>
  );
}
