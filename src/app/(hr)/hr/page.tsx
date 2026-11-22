import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { HrEvaluationsTable } from "@/components/hr/HrEvaluationsTable";
import { RemindersQueue } from "@/components/hr/RemindersQueue";
import { ResetDemoCard } from "@/components/hr/ResetDemoCard";
import { isDemoMode } from "@/lib/auth/demo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { requirePageRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { EVALUATION_STATUS_LABELS } from "@/lib/domain/slownik";
import { EVALUATION_STATUSES } from "@/lib/domain/types";
import { applyHrFilters, needsReminder, parseHrFilters, sortHrRows, summarize, toHrRow } from "@/lib/hr/panel";
import { listHrRecords, listReminders } from "@/lib/hr/repo";
import { selectClass } from "@/lib/obserwacje/stale";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Panel HR – Kompas Kompetencji" };
export const dynamic = "force-dynamic";
// Reset danych demo zapisuje kilkadziesiąt rekordów – na Vercelu z bazą Neon potrzebuje więcej niż domyślny limit czasu.
export const maxDuration = 60;

// Panel HR, część 1: wszystkie oceny z terminami z silnika (z wydłużeniami), filtry i kolejka przypomnień.

const MESSAGES: Record<string, { tone: "success" | "info" | "warning"; text: string }> = {
  wyslano: { tone: "success", text: "Przypomnienie wysłane (symulacja). Znacznik „wysłano” i wpis w dzienniku zdarzeń zapisane." },
  "juz-wyslane": { tone: "info", text: "To przypomnienie zostało już wysłane wcześniej." },
  dodano: { tone: "success", text: "Przypomnienie dodane do kolejki. Sprawdź podgląd i wyślij." },
  "nie-trzeba": { tone: "info", text: "Dla tej oceny przypomnienie nie jest teraz potrzebne albo już czeka w kolejce." },
  "brak-oceny": { tone: "warning", text: "Nie znaleziono tej oceny. Odśwież stronę." },
  reset: { tone: "success", text: "Dane demo przywrócone do stanu początkowego. Terminy liczone od dzisiaj." },
  "reset-wylaczony": { tone: "warning", text: "Reset danych demo jest wyłączony – działa tylko w trybie demo (DEMO_MODE=true)." },
};

const URGENCY_OPTIONS = [
  ["PO_TERMINIE", "Po terminie"],
  ["PILNE", "Do 7 dni"],
  ["WKROTCE", "Do 30 dni"],
  ["W_TERMINIE", "W terminie (ponad 30 dni)"],
  ["BEZ_TERMINU", "Bez terminu"],
] as const;

export default async function HrPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole("HR");
  const params = await searchParams;
  const filters = parseHrFilters(params);
  const today = todayIso();
  const [records, reminders] = await Promise.all([listHrRecords(), listReminders()]);
  const allRows = sortHrRows(records.map((r) => toHrRow(r, today)));
  const rows = applyHrFilters(allRows, filters);
  const summary = summarize(allRows);
  const orgUnits = [...new Set(allRows.map((r) => r.orgUnit).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pl"));
  const message = typeof params.komunikat === "string" ? MESSAGES[params.komunikat] : undefined;
  const filtered = Boolean(filters.status || filters.urgency || filters.orgUnit);
  const toSend = reminders.filter((r) => !r.sentAt).length;

  const stats = [
    { label: "Oceny w toku", value: summary.open },
    { label: "Po terminie", value: summary.overdue },
    { label: "Termin do 7 dni", value: summary.urgent },
    { label: "Terminy wydłużone nieobecnością", value: summary.extended },
    { label: "Przypomnienia do wysłania", value: toSend },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <PageHeader
        title="Panel HR"
        description="Wszystkie oceny w urzędzie z terminami liczonymi według przepisów – także wydłużonymi przez nieobecności – i przypomnienia dla oceniających."
        action={
          toSend > 0 ? (
            <a href="#przypomnienia" className={cn(buttonVariants(), "h-10")}>
              Przypomnienia do wysłania: {toSend}
            </a>
          ) : undefined
        }
      />

      {message && <Notice tone={message.tone} title={message.text} />}

      {/* Liczba kolumn z szerokości w rem – przy powiększonym tekście (przycisk „Dostępność”) kafelki same przechodzą do nowego wiersza. */}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3" aria-label="Podsumowanie">
        {stats.map((s) => (
          <li key={s.label}>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-1 py-4">
                <span className="text-2xl font-semibold">{s.value}</span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <section aria-labelledby="oceny" className="flex flex-col gap-4">
        <h2 id="oceny" className="text-xl">Oceny</h2>
        <form method="get" action="/hr" className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]" aria-label="Filtry ocen">
          <Field label="Etap">
            <select name="etap" defaultValue={filters.status ?? ""} className={selectClass}>
              <option value="">W toku (bez zakończonych)</option>
              {EVALUATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EVALUATION_STATUS_LABELS.OKRESOWA[s]}
                  {EVALUATION_STATUS_LABELS.PIERWSZA[s] !== EVALUATION_STATUS_LABELS.OKRESOWA[s] ? ` / ${EVALUATION_STATUS_LABELS.PIERWSZA[s]}` : ""}
                </option>
              ))}
              <option value="WSZYSTKIE">Wszystkie, także zakończone</option>
            </select>
          </Field>
          <Field label="Termin">
            <select name="termin" defaultValue={filters.urgency ?? ""} className={selectClass}>
              <option value="">Wszystkie terminy</option>
              {URGENCY_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Komórka">
            <select name="komorka" defaultValue={filters.orgUnit ?? ""} className={selectClass}>
              <option value="">Wszystkie komórki</option>
              {orgUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="outline" className="h-10">
              Pokaż
            </Button>
            {filtered && (
              <Link href="/hr" className={cn(buttonVariants({ variant: "ghost" }), "h-10")}>
                Wyczyść
              </Link>
            )}
          </div>
        </form>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          Ocen na liście: {rows.length}
        </p>
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={filtered ? "Brak ocen dla wybranych filtrów" : "Nie ma ocen w toku"}
            description={filtered ? "Zmień etap, termin albo komórkę." : "Oceny pojawią się, gdy przełożeni rozpoczną proces oceny."}
          />
        ) : (
          <HrEvaluationsTable rows={rows} reminderFor={(row) => needsReminder(row, reminders)} />
        )}
      </section>

      <section id="przypomnienia" aria-labelledby="przypomnienia-tytul" className="flex scroll-mt-24 flex-col gap-4">
        <div>
          <h2 id="przypomnienia-tytul" className="text-xl">Przypomnienia</h2>
          <p className="text-sm text-muted-foreground">Wysyłka e-mail jest symulowana: przycisk „Wyślij” zapisuje datę wysłania. Odbiorcą jest oceniający.</p>
        </div>
        <RemindersQueue reminders={reminders} />
      </section>

      {isDemoMode() && <ResetDemoCard />}
    </div>
  );
}
