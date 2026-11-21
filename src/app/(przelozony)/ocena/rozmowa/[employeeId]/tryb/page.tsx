import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrybRozmowy } from "@/components/rozmowa/TrybRozmowy";
import { requirePageRole } from "@/lib/auth/guard";
import { buildConversationPrep, type ConversationKind } from "@/lib/rozmowa/przygotowanie";
import { loadPrepData } from "@/lib/rozmowa/repo";
import { buildConversationSteps } from "@/lib/rozmowa/tryb";

export const metadata: Metadata = { title: "Tryb rozmowy – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Tryb rozmowy (Z43): ta sama ściąga co w Z24, ale jako kroki do przejścia w trakcie rozmowy.

export default async function TrybRozmowyPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ typ?: string }>;
}) {
  const user = await requirePageRole("PRZELOZONY");
  const { employeeId } = await params;
  const { typ } = await searchParams;
  const data = await loadPrepData(user.id, employeeId);
  if (!data) notFound();
  // Ta sama reguła co na ściądze: rodzaj z adresu tylko, jeśli dotyczy oceny tego pracownika.
  const kind: ConversationKind = data.allowed.includes(typ as ConversationKind) ? (typ as ConversationKind) : data.suggested;
  const prep = buildConversationPrep({ ...data.input, kind });

  return (
    <TrybRozmowy
      key={kind}
      employeeId={employeeId}
      kind={kind}
      title={prep.title}
      steps={buildConversationSteps(prep)}
      prepHref={`/ocena/rozmowa/${encodeURIComponent(employeeId)}?typ=${kind}`}
    />
  );
}
