import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDatePl } from "@/lib/rules/kalendarz";
import { DEADLINE_KIND_LABELS } from "@/lib/rules/terminy";
import type { DeadlineKind } from "@/lib/domain/types";
import { sendReminderAction } from "@/lib/hr/actions";
import type { ReminderView } from "@/lib/hr/repo";

// Kolejka przypomnień: podgląd e-maila i „Wyślij” jako symulacja (znacznik „wysłano”, wpis w dzienniku zdarzeń).

const timeFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function ReminderItem({ r }: { r: ReminderView }) {
  const label = DEADLINE_KIND_LABELS[r.kind as DeadlineKind] ?? r.kind;
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 className="text-base font-medium">{r.subject}</h4>
          <p className="text-sm text-muted-foreground">
            Do: {r.recipientName} · {label} · termin {formatDatePl(r.dueDate)}
          </p>
        </div>
        {r.sentAt ? (
          <StatusBadge tone="success">Wysłano {timeFmt.format(r.sentAt)}</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Do wysłania</StatusBadge>
        )}
      </div>
      <details className="rounded-md bg-muted/50 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Podgląd e-maila</summary>
        <dl className="mt-2 grid gap-1 sm:grid-cols-[5rem_1fr]">
          <dt className="text-muted-foreground">Do</dt>
          <dd>
            {r.recipientName} &lt;{r.recipientEmail}&gt;
          </dd>
          <dt className="text-muted-foreground">Temat</dt>
          <dd>{r.subject}</dd>
        </dl>
        <p className="mt-2 whitespace-pre-line">{r.body}</p>
      </details>
      {!r.sentAt && (
        <form action={sendReminderAction} className="self-start">
          <input type="hidden" name="id" value={r.id} />
          <Button type="submit" size="sm" className="h-9" aria-label={`Wyślij przypomnienie: ${r.subject}`}>
            <Send aria-hidden /> Wyślij
          </Button>
        </form>
      )}
    </li>
  );
}

export function RemindersQueue({ reminders }: { reminders: ReminderView[] }) {
  if (reminders.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Kolejka przypomnień jest pusta"
        description="Przy ocenach z terminem w ciągu 30 dni albo po terminie pojawi się przycisk „Dodaj przypomnienie”. Treść przygotuje system na podstawie przepisów."
      />
    );
  }
  const pending = reminders.filter((r) => !r.sentAt);
  const sent = reminders.filter((r) => r.sentAt);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium">Do wysłania ({pending.length})</h3>
        {pending.length === 0 ? <p className="text-sm text-muted-foreground">Wszystkie przypomnienia zostały wysłane.</p> : <ul className="flex flex-col gap-3">{pending.map((r) => <ReminderItem key={r.id} r={r} />)}</ul>}
      </div>
      {sent.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-medium">Wysłane ({sent.length})</h3>
          <ul className="flex flex-col gap-3">{sent.map((r) => <ReminderItem key={r.id} r={r} />)}</ul>
        </div>
      )}
    </div>
  );
}
