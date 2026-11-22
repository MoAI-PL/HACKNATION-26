import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { DeadlineBadge, EvaluationStatusBadge } from "@/components/ui/status-badge";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { listHrRecords } from "@/lib/hr/repo";
import { firstEvaluationRows, type FirstEvaluationRow } from "@/lib/kierujacy/pierwsze-oceny";
import { formatDatePl } from "@/lib/rules/kalendarz";
import { DEADLINE_KIND_LABELS } from "@/lib/rules/terminy";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pierwsze oceny w komórce – Kompas Kompetencji" };

// Ekran kierującego komórką: pierwsze oceny nowych pracowników komórki (Employee.unitHeadId = kierujący),
// z terminami z silnika terminów i opisem roli kierującego w procesie. Podgląd – oceny sporządza bezpośredni przełożony.
export default async function KierujacyPage() {
  const user = await requirePageRole("KIERUJACY_KOMORKA");
  const today = todayIso();
  const rows = firstEvaluationRows(await listHrRecords({ where: { type: "PIERWSZA", employee: { unitHeadId: user.id } } }), today);

  return (
    <>
      <PageHeader
        title="Pierwsze oceny w Twojej komórce"
        description="Nowi pracownicy Twojej komórki: etap pierwszej oceny, terminy liczone według przepisów i to, w czym uczestniczysz."
      />

      <Notice tone="info" title="Twoja rola w pierwszej ocenie" className="mb-6" legalBasis="art. 38 ust. 2 i 3 ustawy o służbie cywilnej; § 8 ust. 2 i § 10 ust. 6 rozporządzenia o pierwszej ocenie">
        <ul className="list-disc space-y-1 pl-5">
          <li>Bezpośredni przełożony ustala oceny cząstkowe i wynik w porozumieniu z Tobą.</li>
          <li>Możesz uczestniczyć w rozmowie oceniającej.</li>
          <li>Podpisujesz arkusz pierwszej oceny obok przełożonego; wnioski dotyczące rozwoju zawodowego powstają w porozumieniu z Tobą.</li>
          <li>Po ocenie składasz wniosek do dyrektora generalnego urzędu o umowę na czas nieokreślony albo o jej niezawieranie.</li>
        </ul>
      </Notice>

      {rows.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nie ma teraz pierwszych ocen w Twojej komórce"
          description="Gdy do komórki dołączy nowa osoba, zobaczysz tu jej pierwszą ocenę i terminy."
        />
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Pierwsze oceny">
          {rows.map((r) => (
            <li key={r.evaluationId}>
              <PierwszaOcena r={r} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PierwszaOcena({ r }: { r: FirstEvaluationRow }) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{r.employeeName}</CardTitle>
          <EvaluationStatusBadge type={r.type} status={r.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {r.orgUnit ? `${r.orgUnit} · ` : ""}zatrudnienie od {formatDatePl(r.employmentStart)}
          {r.contractEnd && ` · umowa do ${formatDatePl(r.contractEnd)}`} · bezpośredni przełożony: {r.evaluatorName}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm">{r.nextStep}</p>

        {r.deadline && r.urgency && r.daysLeft !== null && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Najbliższy termin: {DEADLINE_KIND_LABELS[r.deadline.kind]}</span>
            <span>{formatDatePl(r.deadline.date)}</span>
            <DeadlineBadge daysLeft={r.daysLeft} urgency={r.urgency} />
          </div>
        )}

        {r.calendar.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Kalendarz pierwszej oceny</h3>
            <ol className="flex flex-col gap-1 text-sm">
              {r.calendar.map((c) => (
                <li key={c.label} className={cn("flex flex-wrap gap-x-2", c.past && "text-muted-foreground")}>
                  <span className="min-w-[min(100%,14rem)]">{c.label}</span>
                  <span className="font-medium">{formatDatePl(c.date)}</span>
                  {c.legalBasis && <span className="text-xs text-muted-foreground">({c.legalBasis})</span>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
