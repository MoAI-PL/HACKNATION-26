import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { EvaluationStatusBadge } from "@/components/ui/status-badge";
import { requirePageRole } from "@/lib/auth/guard";
import { RESULT_LABELS } from "@/lib/domain/slownik";
import { formatDatePl } from "@/lib/rules/kalendarz";
import { hasEmployeeRecord, loadOwnEvaluations } from "@/lib/oceniany/dane";
import type { OwnEvaluationView } from "@/lib/oceniany/moje-oceny";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moje oceny – Kompas Kompetencji" };

// Ekran ocenianego: własne oceny – bieżąca (część I) i sporządzone (wynik, potwierdzenie zapoznania się).
export default async function MojeOcenyPage() {
  const user = await requirePageRole("OCENIANY");
  const [views, linked] = await Promise.all([loadOwnEvaluations(user.id), hasEmployeeRecord(user.id)]);
  const toAck = views.filter((v) => v.canAcknowledge);

  return (
    <>
      <PageHeader
        title="Moje oceny"
        description="Twoje oceny okresowe: kryteria i termin bieżącej oceny oraz sporządzone oceny z wynikiem i uzasadnieniem."
      />

      {toAck.length > 0 && (
        <Notice tone="warning" title="Masz ocenę do zapoznania się" className="mb-6" legalBasis="§ 12 ust. 1 rozporządzenia o ocenach okresowych">
          Przełożony sporządził ocenę. Przeczytaj ją i potwierdź zapoznanie się – od tego dnia biegnie 7-dniowy termin na ewentualny sprzeciw.
        </Notice>
      )}

      {!linked || views.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nie masz jeszcze ocen"
          description={
            linked
              ? "Gdy przełożony ustali z Tobą kryteria oceny, zobaczysz je tutaj."
              : "Twoje konto nie jest jeszcze powiązane z kartoteką pracownika. Skontaktuj się z komórką kadr."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Lista ocen">
          {views.map((v) => (
            <li key={v.id}>
              <OcenaWiersz v={v} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function OcenaWiersz({ v }: { v: OwnEvaluationView }) {
  const when = v.evaluatedAt
    ? `sporządzona ${formatDatePl(v.evaluatedAt)}`
    : v.dueDate
      ? `termin oceny: ${formatDatePl(v.dueDate)}`
      : "termin zostanie ustalony na rozmowie rozpoczynającej";
  return (
    <Link href={`/moje-oceny/${v.id}`} className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <Card className="flex flex-row flex-wrap items-center justify-between gap-3 p-4 transition-colors group-hover:bg-accent/50">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{v.title}</span>
            <EvaluationStatusBadge type={v.type} status={v.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {v.sheetLabel} · {when}
            {v.result && ` · ${RESULT_LABELS[v.result.result]}`}
          </p>
        </div>
        <span className="flex items-center gap-1 text-sm font-medium text-primary">
          {v.canAcknowledge ? "Zapoznaj się" : "Zobacz"}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </Card>
    </Link>
  );
}
