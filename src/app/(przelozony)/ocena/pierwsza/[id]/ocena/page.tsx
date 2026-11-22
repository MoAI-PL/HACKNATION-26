import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EvaluationStatusBadge } from "@/components/ui/status-badge";
import { ZakonczenieOceny } from "@/components/ocena/ZakonczenieOceny";
import { requirePageRole } from "@/lib/auth/guard";
import { assessableStatuses, loadAssessment } from "@/lib/ocena/dane-oceny";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ocena elementów – Kompas Kompetencji" };

/** Ocena 5 elementów pierwszej oceny kartami zachowań – te same komponenty co w ocenie wskaźników, skala 3/5/7 (§ 9 ust. 1). */
export default async function OcenaElementowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("PRZELOZONY");
  const data = await loadAssessment(id, user.id, "PIERWSZA");
  if (!data) notFound();

  const header = (
    <PageHeader
      title={`Ocena elementów: ${data.employee.name}`}
      description="Oceń każdy wskaźnik opisem zachowania, potem zdecyduj o ocenie elementu: 3 pkt (poniżej oczekiwań), 5 pkt (na poziomie) albo 7 pkt (powyżej)."
      badge={<EvaluationStatusBadge type="PIERWSZA" status={data.status} />}
      action={
        <Button asChild variant="outline">
          <Link href={`/ocena/pierwsza/${data.evaluationId}`}>Przebieg pierwszej oceny</Link>
        </Button>
      }
    />
  );

  if (!assessableStatuses("PIERWSZA").includes(data.status) || data.criteria.length === 0) {
    return (
      <>
        {header}
        <Notice
          tone="info"
          title="Tej oceny nie można teraz zmieniać"
          action={
            <Button asChild>
              <Link href={`/ocena/pierwsza/${data.evaluationId}`}>Przejdź do przebiegu oceny</Link>
            </Button>
          }
        >
          Elementy ocenia się po rozmowie wstępnej i odnotowaniu sprawozdania, przed sporządzeniem oceny.
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
