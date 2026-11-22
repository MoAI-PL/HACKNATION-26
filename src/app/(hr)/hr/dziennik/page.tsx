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
import { AUDIT_KINDS, AUDIT_KIND_LABELS, actionLabel, auditQuery, formatDateTimePl, parseAuditFilters } from "@/lib/audit/dziennik";
import { describeAudit, plainReason, type DescLine } from "@/lib/audit/opis";
import { listAudit } from "@/lib/audit/repo";

export const metadata: Metadata = { title: "Dziennik decyzji – Kompas Kompetencji" };
export const dynamic = "force-dynamic";

const SCREEN_LIMIT = 200;

/** Opis wpisu – pierwsza linia wyróżniona; listy (oceny, kryteria) pozycja pod pozycją; pusty opis = „—”. */
function Lines({ lines }: { lines: DescLine[] }) {
  if (lines.length === 0) return <>—</>;
  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((l, i) =>
        typeof l === "string" ? (
          <li key={i} className={i === 0 ? "font-medium text-foreground" : undefined}>
            {l}
          </li>
        ) : (
          <li key={i}>
            <span className={i === 0 ? "font-medium text-foreground" : undefined}>{l.label}:</span>
            <ul className="mt-0.5 flex flex-col gap-0.5 border-l-2 border-border pl-2">
              {l.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          </li>
        ),
      )}
    </ul>
  );
}

export default async function DziennikDecyzjiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("HR");
  const filters = parseAuditFilters(await searchParams);
  const rows = await listAudit(filters, SCREEN_LIMIT, { withSubjects: true });
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
              {rows.length === SCREEN_LIMIT ? `Pokazano ${SCREEN_LIMIT} najnowszych wpisów – pełna lista w pliku CSV.` : `Wpisów: ${rows.length}.`} Długie
              treści są skrócone – pełne dane są w pliku CSV.
            </p>
            <table className="w-full min-w-[64rem] text-left text-sm">
              <caption className="sr-only">Dziennik decyzji – od najnowszych</caption>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Kiedy</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Kto</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Dotyczy</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Działanie</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Propozycja AI</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Decyzja człowieka / zmiana</th>
                  <th scope="col" className="py-2 font-medium">Powód</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const ai = r.action === "AI_WSTAW" || r.action === "AI_ODRZUC";
                  const d = describeAudit(r);
                  return (
                    <tr key={i} className="border-b align-top last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateTimePl(r.createdAt)}</td>
                      <td className="py-2 pr-3">
                        {r.userName ?? "—"}
                        {r.userRole && <span className="block text-xs text-muted-foreground">{ROLE_LABELS[r.userRole as Role] ?? r.userRole}</span>}
                      </td>
                      <td className="py-2 pr-3">{r.subject ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {ai ? <StatusBadge tone="ai">{actionLabel(r.action)}</StatusBadge> : actionLabel(r.action)}
                      </td>
                      <td className="max-w-80 py-2 pr-3 break-words text-muted-foreground">
                        <Lines lines={d.ai} />
                      </td>
                      <td className="max-w-80 py-2 pr-3 break-words">
                        <Lines lines={d.decision} />
                      </td>
                      <td className="max-w-56 py-2 break-words">{plainReason(r.reason)}</td>
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
