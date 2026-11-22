// GET /api/v1/oceny/{id} – eksport oceny w JSON pod EZD i system kadrowy (docs/openapi.yaml).
// Dostęp jak w liście ocen; ocena spoza zakresu użytkownika = 404 (bez ujawniania, że istnieje).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/auth/guard";
import { evaluationExportInclude, evaluationScope, toEvaluationExport } from "@/lib/api/eksport-oceny";

export const dynamic = "force-dynamic";

export const GET = withRole(["HR", "PRZELOZONY", "OCENIANY"], async (_req, ctx, user) => {
  const { id } = await ctx.params;
  const scope = evaluationScope(user);
  if (!scope) return NextResponse.json({ error: "Brak dostępu do ocen." }, { status: 403 });
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "Nie znaleziono oceny." }, { status: 404 });

  const row = await prisma.evaluation.findFirst({ where: { AND: [{ id }, scope] }, include: evaluationExportInclude });
  if (!row) return NextResponse.json({ error: "Nie znaleziono oceny." }, { status: 404 });

  return NextResponse.json(toEvaluationExport(row), {
    headers: { "Content-Disposition": `inline; filename="ocena-${row.id}.json"` },
  });
});
