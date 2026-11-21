import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/AppShell";
import { PrintButton } from "@/components/hr/PrintButton";
import { buttonVariants } from "@/components/ui/button";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { changeNoticeFor } from "@/lib/hr/panel";
import { listHrRecords } from "@/lib/hr/repo";
import { formatDatePl } from "@/lib/rules/kalendarz";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Zawiadomienie o zmianie terminu oceny – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Wzór pisemnego zawiadomienia o zmianie terminu oceny (§ 8 rozporządzenia) – do wydruku i podpisu.

export default async function ZawiadomieniePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("HR");
  const { id } = await params;
  const record = (await listHrRecords()).find((r) => r.id === id);
  const notice = record ? changeNoticeFor(record) : null;
  if (!record || !notice) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="print:hidden">
        <PageHeader
          title="Zawiadomienie o zmianie terminu oceny"
          description="Wzór pisma do ocenianego (§ 8 rozporządzenia). Uzupełnij dane urzędu, wydrukuj i podpisz. Kopię dołącz do arkusza oceny."
          action={
            <div className="flex gap-2">
              <Link href="/hr" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                Wróć do panelu
              </Link>
              <PrintButton />
            </div>
          }
        />
      </div>

      <article className="flex flex-col gap-4 rounded-lg border bg-card p-8 leading-relaxed print:border-0 print:p-0" aria-label="Treść zawiadomienia">
        <p className="text-right">{record.employee.orgUnit ?? "(nazwa komórki organizacyjnej)"}, {formatDatePl(todayIso())}</p>
        <p>
          Pani/Pan
          <br />
          <strong>{notice.employeeName}</strong>
        </p>
        <h2 className="text-center text-lg font-semibold">Zawiadomienie o zmianie terminu sporządzenia oceny okresowej</h2>
        {notice.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="text-sm text-muted-foreground">Podstawa prawna: {notice.legalBasis}.</p>
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <p className="border-t pt-2 text-center">podpis oceniającego ({record.evaluatorName})</p>
          <p className="border-t pt-2 text-center">data i podpis ocenianego (zapoznałam/zapoznałem się)</p>
        </div>
      </article>
    </div>
  );
}
