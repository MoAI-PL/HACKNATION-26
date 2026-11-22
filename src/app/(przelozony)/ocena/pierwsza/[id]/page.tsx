import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { EvaluationStatusBadge } from "@/components/ui/status-badge";
import { WizardProgress } from "@/components/ui/wizard";
import { RozmowaWstepna } from "@/components/pierwsza-ocena/RozmowaWstepna";
import { SprawozdanieIEgzamin } from "@/components/pierwsza-ocena/SprawozdanieIEgzamin";
import { SporzadzeniePierwszej, WynikPierwszej, ZapoznaniePierwszej } from "@/components/pierwsza-ocena/WynikPierwszejOceny";
import { PobierzArkuszPierwszej } from "@/components/pierwsza-ocena/PobierzArkuszPierwszej";
import { requirePageRole } from "@/lib/auth/guard";
import { EXAM_EXEMPTION_LABELS, EXAM_RESULT_LABELS } from "@/lib/domain/slownik";
import { loadFirstEval, type FirstEvalData } from "@/lib/pierwsza-ocena/dane";
import { FIRST_EVAL_STEPS, examMissing, proposedReportWindow, stepNumber } from "@/lib/pierwsza-ocena/przebieg";
import { formatDatePl } from "@/lib/rules/kalendarz";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pierwsza ocena – Kompas Kompetencji" };

export default async function PierwszaOcenaPrzebiegPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("PRZELOZONY");
  const data = await loadFirstEval(id, user.id);
  if (!data) notFound();

  const e = data.employee;
  const person = { employmentStart: e.employmentStart, contractEnd: e.contractEnd, absences: e.absences };
  const reportCtx = { ...person, conversationDate: data.conversation?.date, dueFrom: data.report.dueFrom, dueTo: data.report.dueTo };
  const rated = data.elements.filter((x) => x.score !== null).length;
  const allRated = data.elements.length > 0 && rated === data.elements.length;
  const noExam = examMissing(data.exam, data.examExemption);
  const done = data.stage === "ZAPOZNANIE" || data.stage === "ZAKONCZONA";

  return (
    <>
      <PageHeader
        title={`Pierwsza ocena: ${e.name}`}
        description={e.positionTitle ?? "Osoba podejmująca po raz pierwszy pracę w służbie cywilnej."}
        badge={<EvaluationStatusBadge type="PIERWSZA" status={data.status} />}
        action={
          <Button asChild variant="outline">
            <Link href="/ocena/pierwsza">Wróć do listy</Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-6">
        <WizardProgress steps={[...FIRST_EVAL_STEPS]} current={stepNumber(data.stage)} />
        <Fakty data={data} />
        {data.stage !== "ROZMOWA_WSTEPNA" && <Ustalenia data={data} />}
        {(data.stage === "SPRAWOZDANIE" || data.stage === "OCENA") && (
          <PobierzArkuszPierwszej evaluationId={data.evaluationId} label="Arkusz z rozmową wstępną do podpisu (PDF)" />
        )}

        {data.stage === "ROZMOWA_WSTEPNA" && (
          <RozmowaWstepna
            evaluationId={data.evaluationId}
            person={person}
            today={data.today}
            deadline={data.deadlines.initialConversation}
            proposal={(() => {
              const p = proposedReportWindow(person);
              return { dueFrom: p.dueFrom, dueTo: p.dueTo, explanation: p.deadline.explanation.text, legalBasis: p.deadline.explanation.legalBasis };
            })()}
          />
        )}

        {data.stage === "SPRAWOZDANIE" && (
          <SprawozdanieIEgzamin
            evaluationId={data.evaluationId}
            context={reportCtx}
            deadline={data.report.deadline}
            today={data.today}
            initial={{ exam: data.exam, examExemption: data.examExemption, recorded: false }}
          />
        )}

        {data.stage === "OCENA" && (
          <>
            {!data.summary.complete && allRated && noExam ? (
              <Notice tone="warning" title="Brakuje wyniku egzaminu ze służby przygotowawczej" legalBasis="§ 10 ust. 1 pkt 1, § 10 ust. 3">
                Elementy są ocenione, ale wynik pierwszej oceny zależy też od egzaminu. Uzupełnij go poniżej („Uzupełnij wynik egzaminu”) – potem
                pojawi się wynik i sporządzenie oceny.
              </Notice>
            ) : !data.summary.complete ? (
              <Notice
                tone="info"
                title={`Oceń pięć elementów kartami zachowań (ocenione: ${rated} z ${data.elements.length})`}
                legalBasis="§ 2 pkt 1, § 9 ust. 1"
                action={
                  <Button asChild>
                    <Link href={`/ocena/pierwsza/${data.evaluationId}/ocena`}>{rated ? "Kontynuuj ocenę elementów" : "Oceń elementy"}</Link>
                  </Button>
                }
              >
                Przy każdym wskaźniku wybierz opis zachowania, który najlepiej pasuje do ocenianego. System zasugeruje ocenę w skali 3 / 5 / 7 pkt,
                a ostateczną decyzję podejmujesz Ty.
              </Notice>
            ) : (
              <>
                <WynikPierwszej elements={data.elements} result={data.summary.result} />
                <div>
                  <Button asChild variant="outline">
                    <Link href={`/ocena/pierwsza/${data.evaluationId}/ocena`}>Zmień oceny elementów</Link>
                  </Button>
                </div>
                {data.deadlines.windowFrom && data.today < data.deadlines.windowFrom.date && (
                  <Notice tone="warning" title={`Ocenę możesz sporządzić od ${formatDatePl(data.deadlines.windowFrom.date)}`} legalBasis={data.deadlines.windowFrom.explanation.legalBasis}>
                    {data.deadlines.windowFrom.explanation.text}
                  </Notice>
                )}
                <SporzadzeniePierwszej
                  evaluationId={data.evaluationId}
                  result={data.summary.result}
                  person={person}
                  today={data.today}
                  reportSubmittedAt={data.report.submittedAt}
                  initial={{ evaluatedAt: data.form.evaluatedAt ?? data.today, justification: data.form.justification, developmentPlan: data.form.developmentPlan }}
                />
              </>
            )}
            <details className="rounded-lg border bg-card p-4" open={noExam}>
              <summary className="cursor-pointer font-medium text-primary">{noExam ? "Uzupełnij wynik egzaminu" : "Popraw sprawozdanie lub wynik egzaminu"}</summary>
              <div className="mt-4">
                <SprawozdanieIEgzamin
                  evaluationId={data.evaluationId}
                  context={reportCtx}
                  deadline={data.report.deadline}
                  today={data.today}
                  initial={{
                    submittedAt: data.report.submittedAt,
                    content: data.report.content,
                    fileName: data.report.fileName,
                    exam: data.exam,
                    examExemption: data.examExemption,
                    recorded: true,
                  }}
                  editing
                />
              </div>
            </details>
          </>
        )}

        {done && data.summary.complete && (
          <>
            <PobierzArkuszPierwszej evaluationId={data.evaluationId} />
            <WynikPierwszej elements={data.elements} result={data.summary.result} />
            <Card>
              <CardHeader>
                <CardTitle>Uzasadnienie i rozwój</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                <div>
                  <h2 className="mb-1 font-semibold">Uzasadnienie</h2>
                  <p className="whitespace-pre-line">{data.form.justification || "Bez uzasadnienia (ocena pozytywna)."}</p>
                </div>
                <div>
                  <h2 className="mb-1 font-semibold">Wnioski dotyczące rozwoju zawodowego</h2>
                  <p className="whitespace-pre-line">
                    {data.summary.result.result === "NEGATYWNA" ? "Nie dotyczy (ocena negatywna)." : data.form.developmentPlan || "Bez wniosków."}
                  </p>
                </div>
              </CardContent>
            </Card>
            {data.stage === "ZAPOZNANIE" && data.evaluatedAt && (
              <ZapoznaniePierwszej evaluationId={data.evaluationId} evaluatedAt={data.evaluatedAt} today={data.today} />
            )}
            {data.stage === "ZAKONCZONA" && (
              <Notice tone="success" title="Pierwsza ocena zakończona">
                Oceniany zapoznał się z oceną {data.acknowledgedAt ? formatDatePl(data.acknowledgedAt) : ""}.{" "}
                {data.summary.result.result === "POZYTYWNA"
                  ? "Ocena pozytywna – dalsze zatrudnienie na czas nieokreślony prowadzi HR (art. 38 ustawy)."
                  : "Ocena negatywna – HR rozwiązuje umowę zgodnie z art. 38 ustawy; system tego nie robi automatycznie."}
              </Notice>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Fakty({ data }: { data: FirstEvalData }) {
  const e = data.employee;
  const rows: [string, string][] = [
    ["Nawiązanie stosunku pracy", formatDatePl(e.employmentStart)],
    ["Koniec umowy", e.contractEnd ? formatDatePl(e.contractEnd) : "brak danych – uzupełnia HR"],
    [
      "Okno pierwszej oceny",
      data.deadlines.windowFrom && data.deadlines.windowTo
        ? `${formatDatePl(data.deadlines.windowFrom.date)} – ${formatDatePl(data.deadlines.windowTo.date)}`
        : "po 8 miesiącach od zatrudnienia",
    ],
    ["Kierujący komórką (podpis)", e.unitHeadName ?? "nie wskazano"],
  ];
  return (
    <Card>
      <CardContent className="py-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {data.deadlines.windowTo && (
          <p className="mt-3 text-xs text-muted-foreground">
            {data.deadlines.windowTo.explanation.text} ({data.deadlines.windowTo.explanation.legalBasis})
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Ustalenia({ data }: { data: FirstEvalData }) {
  const r = data.report;
  const reportText = !data.conversation
    ? "—"
    : data.stage === "SPRAWOZDANIE"
      ? `oczekiwane ${formatDatePl(r.dueFrom)} – ${formatDatePl(r.deadline.date)}`
      : r.submittedAt
        ? `złożone ${formatDatePl(r.submittedAt)}${r.fileName ? ` (plik ${r.fileName})` : ""} – ${r.onTime ? "w terminie" : "po terminie"}`
        : "nie złożono w terminie";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ustalenia</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div className="flex flex-col">
            <dt className="text-muted-foreground">Rozmowa wstępna</dt>
            <dd className="font-medium">{data.conversation ? formatDatePl(data.conversation.date) : "—"}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">Sprawozdanie</dt>
            <dd className="font-medium">{reportText}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">Egzamin ze służby przygotowawczej</dt>
            <dd className="font-medium">
              {data.exam ? EXAM_RESULT_LABELS[data.exam] : "—"}
              {data.exam === "NIE_DOTYCZY" && data.examExemption ? ` – ${EXAM_EXEMPTION_LABELS[data.examExemption]}` : ""}
            </dd>
          </div>
        </dl>
        {data.conversation?.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">Notatka z rozmowy: {data.conversation.notes}</p>}
      </CardContent>
    </Card>
  );
}
