import type { Metadata } from "next";
import { Download, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePageRole } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/domain/slownik";
import type { Role } from "@/lib/domain/types";
import { AUDIT_KINDS, AUDIT_KIND_LABELS, actionLabel, auditQuery, compactJson, formatDateTimePl, parseAuditFilters } from "@/lib/audit/dziennik";
import { listAudit } from "@/lib/audit/repo";

export const metadata: Metadata = { title: "Dziennik decyzji – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

const SCREEN_LIMIT = 200;

// Dziennik decyzji (Z35): kto, co i kiedy – propozycje AI obok decyzji człowieka, zmiany sugestii i arkusza.
export default async function DziennikDecyzjiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("HR");
  const filters = parseAuditFilters(await searchParams);
  const rows = await listAudit(filters, SCREEN_LIMIT);
  const query = auditQuery(filters);

  return (
    <>
      <PageHeader
        title="Dziennik decyzji"
        description="Każda propozycja AI obok decyzji człowieka, zmiany sugestii i arkusza, ustalenie kryteriów i sporządzenie oceny – kto, co i kiedy."
        action={
          <Button asChild>
            <a href={`/hr/dziennik/csv${query}`} download>
              <Download aria-hidden />
              Pobierz CSV
            </a>
          </Button>
        }
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4" aria-label="Filtry dziennika">
        <Field label="Rodzaj wpisów" className="min-w-56">
          <select
            name="rodzaj"
            defaultValue={filters.rodzaj}
            className="h-10 rounded-md border border-input bg-card px-3 text-base"
          >
            {AUDIT_KINDS.map((k) => (
              <option key={k} value={k}>
                {AUDIT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Od dnia">
          <Input type="date" name="od" defaultValue={filters.od ?? ""} />
        </Field>
        <Field label="Do dnia">
          <Input type="date" name="do" defaultValue={filters.do ?? ""} />
        </Field>
        <Button type="submit" variant="outline">
          Pokaż
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Brak wpisów dla wybranych filtrów"
          description="Wpisy pojawiają się, gdy przełożeni ustalają kryteria, oceniają, korzystają z propozycji AI albo sporządzają oceny."
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto py-4">
            <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              {rows.length === SCREEN_LIMIT ? `Pokazano ${SCREEN_LIMIT} najnowszych wpisów – pełna lista w pliku CSV.` : `Wpisów: ${rows.length}.`}
            </p>
            <table className="w-full min-w-[56rem] text-left text-sm">
              <caption className="sr-only">Dziennik decyzji – od najnowszych</caption>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Kiedy</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Kto</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Działanie</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Propozycja AI</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Decyzja człowieka / zmiana</th>
                  <th scope="col" className="py-2 font-medium">Powód</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const ai = r.action === "AI_WSTAW" || r.action === "AI_ODRZUC";
                  const change = [compactJson(r.oldValue), compactJson(r.newValue)].filter(Boolean).join(" → ");
                  return (
                    <tr key={i} className="border-b align-top last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateTimePl(r.createdAt)}</td>
                      <td className="py-2 pr-3">
                        {r.userName ?? "—"}
                        {r.userRole && <span className="block text-xs text-muted-foreground">{ROLE_LABELS[r.userRole as Role] ?? r.userRole}</span>}
                      </td>
                      <td className="py-2 pr-3">
                        {ai ? <StatusBadge tone="ai">{actionLabel(r.action)}</StatusBadge> : actionLabel(r.action)}
                      </td>
                      <td className="max-w-72 py-2 pr-3 break-words text-muted-foreground">{compactJson(r.aiProposal) || "—"}</td>
                      <td className="max-w-72 py-2 pr-3 break-words">{compactJson(r.humanDecision) || change || "—"}</td>
                      <td className="max-w-56 py-2 break-words">{r.reason ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
