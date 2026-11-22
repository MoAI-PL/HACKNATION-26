// Historia zmian z panelu HR (Z19) – wpisy z dziennika decyzji w postaci do wyświetlenia. Tylko serwer.

import type { ChangeView } from "@/components/hr/UstawieniaZakladki";
import { actionLabel } from "@/lib/audit/dziennik";
import { describeChange } from "./pola";
import { recentChanges } from "./repo";

export async function changeViews(): Promise<ChangeView[]> {
  const rows = await recentChanges().catch(() => []);
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    who: r.user?.name ?? r.user?.email ?? "nieznany użytkownik",
    what: actionLabel(r.action) + (r.action === "EDYCJA_MODELU" && r.entityId ? ` (${r.entityId})` : ""),
    reason: r.reason,
    lines: describeChange(r.action, r.oldValue, r.newValue),
  }));
}
