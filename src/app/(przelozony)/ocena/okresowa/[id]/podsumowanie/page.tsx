import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { EvaluationStatusBadge } from "@/components/ui/status-badge";
import { PodsumowanieOceny } from "@/components/ocena/PodsumowanieOceny";
import { WynikOceny } from "@/components/ocena/WynikOceny";
import { ZapoznanieZOcena } from "@/components/ocena/ZapoznanieZOcena";
import { requirePageRole } from "@/lib/auth/guard";
import { loadSummary, type SummaryData } from "@/lib/ocena/dane-podsumowania";
import { missingText } from "@/lib/ocena/podsumowanie";
import { formatDatePl } from "@/lib/rules/kalendarz";

export const dynamic = "force-dynamic";
export const metadata = { title: "Podsumowanie oceny – Kompas Kompetencji" };

export default async function PodsumowanieOcenyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("PRZELOZONY");
  const data = await loadSummary(id, user.id);
  if (!data) notFound();

  const header = (description: string, action?: React.ReactNode) => (
    <PageHeader
      title={`Podsumowanie oceny: ${data.employee.name}`}
      description={description}
      badge={<EvaluationStatusBadge type="OKRESOWA" status={data.status} />}
      action={action}
    />
  );
  const backToList = (
    <Button asChild variant="outline">
      <Link href="/ocena/okresowa">Wróć do listy</Link>
    </Button>
  );

  if (data.status === "W_OCENIE") {
    if (!data.summary.complete) {
      return (
        <>
          {header("Wynik oceny powstaje z ocen cząstkowych wszystkich kryteriów.")}
          <Notice
            tone="warning"
            title="Najpierw oceń wszystkie kryteria"
            action={
              <Button asChild>
                <Link href={`/ocena/okresowa/${data.evaluationId}/ocena`}>Wróć do oceny wskaźników</Link>
              </Button>
            }
          >
            {missingText(data.summary.missing)}
          </Notice>
        </>
      );
    }
    return (
      <>
        {header("Sprawdź wynik wyliczony według § 11, uzupełnij uzasadnienie i wnioski do IPRZ, a potem sporządź ocenę.")}
        <PodsumowanieOceny data={data} result={data.summary.result} />
      </>
    );
  }

  if ((data.status === "CZEKA_NA_ZAPOZNANIE" || data.status === "ZAKONCZONA") && data.summary.complete && data.form.evaluatedAt) {
    return (
      <>
        {header(`Ocena sporządzona ${formatDatePl(data.form.evaluatedAt)}.`, backToList)}
        <div className="flex flex-col gap-6">
          {data.status === "ZAKONCZONA" && data.objection && (
            <Notice tone="info" title={`Oceniany może złożyć sprzeciw do ${formatDatePl(data.objection.date)}`} legalBasis={data.objection.explanation.legalBasis}>
              Oceniany zapoznał się z oceną {data.acknowledgedAt ? formatDatePl(data.acknowledgedAt) : ""}. Sprzeciw składa się w ciągu 7 dni do
              dyrektora generalnego urzędu, a gdy nie ma tego stanowiska – do kierownika urzędu.
            </Notice>
          )}
          <WynikOceny criteria={data.criteria} result={data.summary.result} previous={data.previous} />
          <Uzasadnienie data={data} />
          {data.status === "CZEKA_NA_ZAPOZNANIE" && (
            <ZapoznanieZOcena evaluationId={data.evaluationId} evaluatedAt={data.form.evaluatedAt} today={data.today} />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {header("Podsumowanie jest dostępne po ocenie wskaźników.", backToList)}
      <Notice
        tone="info"
        title="Ta ocena nie ma jeszcze ocen cząstkowych"
        action={
          <Button asChild>
            <Link href={`/ocena/okresowa/${data.evaluationId}`}>Przejdź do oceny</Link>
          </Button>
        }
      >
        Najpierw ustal kryteria (część I), a po okresie oceny oceń wskaźniki.
      </Notice>
    </>
  );
}

function Uzasadnienie({ data }: { data: SummaryData }) {
  const f = data.form;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uzasadnienie i rozwój</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div>
          <h2 className="mb-1 font-semibold">Uzasadnienie</h2>
          <p className="whitespace-pre-line">{f.justification || "Bez uzasadnienia (ocena pozytywna)."}</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Wnioski do IPRZ</h2>
          <p className="whitespace-pre-line">{f.developmentPlan}</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Część III – wniosek o kolejny stopień służbowy</h2>
          <p className="whitespace-pre-line">
            {!data.employee.isCivilServant
              ? "NIE DOTYCZY"
              : f.promotionRequest
                ? `Wniosek o stopień ${f.requestedGrade}. ${f.promotionJustification}`
                : "Bez wniosku."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
