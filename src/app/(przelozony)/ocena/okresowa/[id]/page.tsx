import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EvaluationStatusBadge } from "@/components/ui/status-badge";
import { CzescIArkusza } from "@/components/ocena/CzescIArkusza";
import { KreatorOkresowej } from "@/components/ocena/KreatorOkresowej";
import { requirePageRole } from "@/lib/auth/guard";
import { loadWizardData } from "@/lib/ocena/dane-kreatora";
import { formatDatePl } from "@/lib/rules/kalendarz";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ocena okresowa – część I – Kompas Kompetencji" };

export default async function KreatorOcenyOkresowejPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("PRZELOZONY");
  const data = await loadWizardData(id, user.id);
  if (!data) notFound();

  const badge = <EvaluationStatusBadge type="OKRESOWA" status={data.status} />;

  if (data.status === "DO_ROZPOCZECIA") {
    return (
      <>
        <PageHeader
          title={`Ocena okresowa: ${data.employee.name}`}
          description="Krok po kroku: opis stanowiska, arkusz, kryteria i rozmowa rozpoczynająca. Zmiany zapisują się same – możesz wyjść i wrócić w to samo miejsce."
          badge={badge}
        />
        <KreatorOkresowej data={data} />
      </>
    );
  }

  const saved = data.saved!;
  return (
    <>
      <PageHeader
        title={`Ocena okresowa: ${data.employee.name}`}
        description={
          saved.criteriaSetAt
            ? `Kryteria ustalone ${formatDatePl(saved.criteriaSetAt)}. Do terminu oceny zapisuj obserwacje w dzienniku.`
            : undefined
        }
        badge={badge}
        action={
          data.status === "W_OKRESIE_OCENY" || data.status === "W_OCENIE" ? (
            <Button asChild>
              <Link href={`/ocena/okresowa/${data.evaluationId}/ocena`}>
                {data.status === "W_OCENIE" ? "Kontynuuj ocenę" : "Zakończ ocenę"}
              </Link>
            </Button>
          ) : data.status === "CZEKA_NA_ZAPOZNANIE" || data.status === "ZAKONCZONA" ? (
            <Button asChild>
              <Link href={`/ocena/okresowa/${data.evaluationId}/podsumowanie`}>
                {data.status === "CZEKA_NA_ZAPOZNANIE" ? "Potwierdź zapoznanie" : "Zobacz ocenę"}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/ocena/okresowa">Wróć do listy</Link>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-4">
        {saved.sheetOverridden && (
          <Notice tone="info" title="Arkusz zmieniony przez przełożonego">
            Arkusz różni się od wskazanego przez OSP – powód zapisano w dzienniku decyzji.
          </Notice>
        )}
        <CzescIArkusza
          employeeName={data.employee.name}
          positionTitle={data.employee.positionTitle}
          sheet={saved.sheet}
          criteria={saved.criteria}
          dueDate={saved.dueDate}
          dueExplanation={data.deadlines?.evaluation.date === saved.dueDate ? data.deadlines?.evaluation.explanation : undefined}
          conversationDate={saved.criteriaSetAt}
          expectations={saved.expectations}
          goals={saved.goals}
        />
      </div>
    </>
  );
}
