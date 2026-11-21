import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePageRole } from "@/lib/auth/guard";
import { CONVERSATION_LABELS } from "@/lib/rozmowa/przygotowanie";
import { listConversationTargets } from "@/lib/rozmowa/repo";
import { deadlineText } from "@/lib/ui/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Asystent rozmowy – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

// Asystent rozmowy (Z24): lista podwładnych z rozmową, która jest następna według etapu oceny.

export default async function RozmowaPage() {
  const user = await requirePageRole("PRZELOZONY");
  const targets = await listConversationTargets(user.id);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Asystent rozmowy"
        description="Przygotuj rozmowę wstępną, rozpoczynającą albo oceniającą: agenda według przepisów, pytania oparte na notatkach z dziennika, informacja zwrotna i pomysły na rozwój. Ściągę możesz wydrukować."
      />
      {targets.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="Nie masz jeszcze podwładnych w systemie" description="Asystent rozmowy przygotowuje rozmowy z osobami, które Ci bezpośrednio podlegają." />
      ) : (
        <ul className="flex flex-col gap-3">
          {targets.map((t) => (
            <li key={t.employeeId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-base font-medium">{t.employeeName}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.positionTitle ?? "stanowisko nieuzupełnione"} · następna: {CONVERSATION_LABELS[t.suggested].toLocaleLowerCase("pl")}
                </p>
                {t.deadlineText && t.daysLeft !== null && (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    {t.deadlineText}
                    <StatusBadge tone={t.daysLeft < 0 ? "danger" : t.daysLeft <= 7 ? "danger" : t.daysLeft <= 30 ? "warning" : "success"}>{deadlineText(t.daysLeft)}</StatusBadge>
                  </span>
                )}
              </div>
              <Link href={`/ocena/rozmowa/${t.employeeId}?typ=${t.suggested}`} className={cn(buttonVariants(), "h-10")} aria-label={`Przygotuj rozmowę: ${t.employeeName}`}>
                Przygotuj rozmowę
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
