// GET /hr/dziennik/csv – eksport dziennika decyzji do CSV (Z35). Tylko HR; te same filtry co ekran.

import { withRole } from "@/lib/auth/guard";
import { todayIso } from "@/lib/domain/daty";
import { auditCsv, parseAuditFilters } from "@/lib/audit/dziennik";
import { listAudit } from "@/lib/audit/repo";

export const dynamic = "force-dynamic";

/** Górny limit wierszy w jednym eksporcie. */
const MAX_ROWS = 10_000;

export const GET = withRole(["HR"], async (req) => {
  const filters = parseAuditFilters(Object.fromEntries(new URL(req.url).searchParams));
  const csv = auditCsv(await listAudit(filters, MAX_ROWS));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dziennik-decyzji-${todayIso()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
