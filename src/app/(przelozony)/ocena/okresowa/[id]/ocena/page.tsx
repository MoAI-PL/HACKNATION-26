import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EvaluationStatusBadge } from "@/components/ui/status-badge";
import { ZakonczenieOceny } from "@/components/ocena/ZakonczenieOceny";
import { requirePageRole } from "@/lib/auth/guard";
import { ASSESSABLE, loadAssessment } from "@/lib/ocena/dane-oceny";
import { formatDatePl } from "@/lib/rules/kalendarz";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zakończ ocenę – Kompas Kompetencji" };

export default async function ZakonczenieOcenyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("PRZELOZONY");
  const data = await loadAssessment(id, user.id);
  if (!data) notFound();

  const header = (
    <PageHeader
      title={`Zakończ ocenę: ${data.employee.name}`}
      description={
        data.dueDate
          ? `Oceń każdy wskaźnik opisem zachowania, potem zdecyduj o ocenie cząstkowej kryterium. Termin sporządzenia oceny: ${formatDatePl(data.dueDate)}.`
          : "Oceń każdy wskaźnik opisem zachowania, potem zdecyduj o ocenie cząstkowej kryterium."
      }
      badge={<EvaluationStatusBadge type="OKRESOWA" status={data.status} />}
      action={
        <Button asChild variant="outline">
          <Link href={`/ocena/okresowa/${data.evaluationId}`}>Część I arkusza</Link>
        </Button>
      }
    />
  );

  if (!ASSESSABLE.includes(data.status) || data.criteria.length === 0) {
    return (
      <>
        {header}
        <Notice
          tone="info"
          title={data.criteria.length === 0 ? "Najpierw ustal kryteria" : "Tej oceny nie można teraz zmieniać"}
          action={
            <Button asChild>
              <Link href={`/ocena/okresowa/${data.evaluationId}`}>Przejdź do oceny</Link>
            </Button>
          }
        >
          {data.criteria.length === 0
            ? "Ocenę wskaźników zaczyna się po rozmowie rozpoczynającej i ustaleniu kryteriów (część I arkusza)."
            : "Oceny wskaźników można zmieniać tylko w okresie oceny i podczas jej sporządzania."}
        </Notice>
      </>
    );
  }

  return (
    <>
      {header}
      <ZakonczenieOceny data={data} />
    </>
  );
}
