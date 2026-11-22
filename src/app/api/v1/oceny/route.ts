// GET /api/v1/oceny – lista ocen, np. dla systemu kadrowego. Filtry: ?status=…&typ=…&pracownikId=…
// Dostęp: HR – wszystkie, przełożony – swoich podwładnych, oceniany – własne sporządzone; inne role 403.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/auth/guard";
import { fromDbDate } from "@/lib/domain/daty";
import { API_VERSION, evaluationScope, listQuerySchema } from "@/lib/api/eksport-oceny";

export const dynamic = "force-dynamic";

export const GET = withRole(["HR", "PRZELOZONY", "OCENIANY"], async (req, _ctx, user) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const query = listQuerySchema.safeParse(params);
  if (!query.success) {
    return NextResponse.json({ error: `Niepoprawny filtr: ${query.error.issues[0]?.path.join(".") ?? "zapytanie"}.` }, { status: 400 });
  }
  const scope = evaluationScope(user);
  if (!scope) return NextResponse.json({ error: "Brak dostępu do ocen." }, { status: 403 });
  const { status, typ, pracownikId } = query.data;

  const rows = await prisma.evaluation.findMany({
    where: { AND: [scope, { ...(status ? { status } : {}), ...(typ ? { type: typ } : {}), ...(pracownikId ? { employeeId: pracownikId } : {}) }] },
    select: {
      id: true,
      type: true,
      sheet: true,
      status: true,
      dueDate: true,
      evaluatedAt: true,
      result: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({
    apiVersion: API_VERSION,
    data: rows.map((r) => ({
      id: r.id,
      type: r.type,
      sheet: r.sheet,
      status: r.status,
      dueDate: r.dueDate ? fromDbDate(r.dueDate) : null,
      evaluatedAt: r.evaluatedAt ? fromDbDate(r.evaluatedAt) : null,
      result: r.result,
      employee: { id: r.employee.id, firstName: r.employee.firstName, lastName: r.employee.lastName },
      links: { self: `/api/v1/oceny/${r.id}` },
    })),
  });
});
