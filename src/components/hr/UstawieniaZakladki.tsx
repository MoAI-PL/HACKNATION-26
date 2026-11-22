// Panel HR (Z19): zakładki „Parametry przepisów” / „Opisy zachowań” i historia zmian z dziennika decyzji.

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTimePl } from "@/lib/audit/dziennik";

const TABS = [
  { href: "/hr/ustawienia", label: "Parametry przepisów" },
  { href: "/hr/ustawienia/model", label: "Opisy zachowań (model kompetencji)" },
] as const;

export function UstawieniaZakladki({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Ustawienia" className="mb-6 flex flex-wrap gap-2 border-b">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium no-underline",
            t.href === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export interface ChangeView {
  id: string;
  createdAt: Date;
  who: string;
  what: string;
  reason?: string | null;
  lines: string[];
}

export function HistoriaZmian({ changes }: { changes: ChangeView[] }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle as="h2" className="text-lg">
          Historia zmian
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Każda zmiana trafia do <Link href="/hr/dziennik">dziennika decyzji</Link>: kto, kiedy, poprzednia i nowa wartość.
        </p>
      </CardHeader>
      <CardContent>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bez zmian – obowiązują wartości z plików w repozytorium.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {changes.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <p className="text-sm">
                  <span className="font-medium">{c.what}</span> · {c.who} · <time dateTime={c.createdAt.toISOString()}>{formatDateTimePl(c.createdAt)}</time>
                </p>
                <ul className="text-sm text-muted-foreground">
                  {c.lines.map((l) => (
                    <li key={l} className="break-words">
                      {l}
                    </li>
                  ))}
                </ul>
                {c.reason && <p className="text-sm">Powód: {c.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
