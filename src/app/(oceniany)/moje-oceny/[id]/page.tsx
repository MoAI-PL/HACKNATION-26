import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { EvaluationStatusBadge } from "@/components/ui/status-badge";
import { WynikOceny } from "@/components/ocena/WynikOceny";
import { PotwierdzZapoznanie } from "@/components/oceniany/PotwierdzZapoznanie";
import { requirePageRole } from "@/lib/auth/guard";
import { CONVERSATION_TYPE_LABELS, CRITERION_KIND_LABELS } from "@/lib/domain/slownik";
import { formatDatePl } from "@/lib/rules/kalendarz";
import { loadOwnEvaluation } from "@/lib/oceniany/dane";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moja ocena – Kompas Kompetencji" };

// Szczegóły własnej oceny (Z46). Przed sporządzeniem: część I arkusza. Po sporządzeniu: cała ocena i potwierdzenie zapoznania się.
export default async function MojaOcenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("OCENIANY");
  const v = await loadOwnEvaluation(id, user.id);
  if (!v) notFound();

  return (
    <>
      <Link href="/moje-oceny" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Moje oceny
      </Link>
      <PageHeader title={v.title} description={v.stageText} badge={<EvaluationStatusBadge type={v.type} status={v.status} />} />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informacje o ocenie</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Info label="Oceniający">{v.evaluatorName}</Info>
              <Info label="Arkusz">{v.sheetLabel}</Info>
              {v.criteriaSetAt && <Info label="Kryteria ustalone">{formatDatePl(v.criteriaSetAt)}</Info>}
              {(v.dueDate || !v.finalized) && <Info label="Termin oceny">{v.dueDate ? formatDatePl(v.dueDate) : "zostanie ustalony"}</Info>}
              {v.evaluatedAt && <Info label="Ocena sporządzona">{formatDatePl(v.evaluatedAt)}</Info>}
              {v.acknowledgedAt && <Info label="Zapoznanie się z oceną">{formatDatePl(v.acknowledgedAt)}</Info>}
              {v.conversations.map((c, i) => (
                <Info key={i} label={CONVERSATION_TYPE_LABELS[c.type]}>
                  {formatDatePl(c.date)}
                </Info>
              ))}
            </dl>
          </CardContent>
        </Card>

        {v.canAcknowledge && <PotwierdzZapoznanie evaluationId={v.id} />}

        {v.finalized && v.result && v.scoredCriteria ? (
          <WynikOceny criteria={v.scoredCriteria} result={v.result} previous={v.previous ?? null} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Kryteria oceny</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {v.criteria.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kryteria zostaną ustalone na rozmowie z przełożonym.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {v.criteria.map((c) => (
                    <li key={c.competency} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{CRITERION_KIND_LABELS[c.kind]}</span>
                      </div>
                      {c.selectionReason && <p className="mt-1 text-sm text-muted-foreground">{c.selectionReason}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {!v.finalized && (
                <p className="text-xs text-muted-foreground">
                  Oceny cząstkowe zobaczysz po sporządzeniu oceny przez przełożonego (§ 12 rozporządzenia).
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {v.finalized && (
          <Card>
            <CardHeader>
              <CardTitle>Uzasadnienie i rozwój</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <Section title="Uzasadnienie oceny">{v.justification || "Brak uzasadnienia."}</Section>
              <Section title="Wnioski do indywidualnego programu rozwoju zawodowego">{v.developmentPlan || "—"}</Section>
              {v.partThree && <Section title="Część III – wniosek o kolejny stopień służbowy">{v.partThree}</Section>}
            </CardContent>
          </Card>
        )}

        {v.objection && (
          <Notice tone="info" title={`Sprzeciw możesz wnieść do ${formatDatePl(v.objection.date)}`} legalBasis="art. 83 ustawy o służbie cywilnej">
            Sprzeciw składasz w ciągu 7 dni od zapoznania się z oceną do dyrektora generalnego urzędu, a gdy nie ma tego stanowiska – do
            kierownika urzędu. Sprzeciw rozpatruje się w ciągu 14 dni.
          </Notice>
        )}
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="whitespace-pre-line">{children}</p>
    </div>
  );
}
