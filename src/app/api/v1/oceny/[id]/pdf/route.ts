// GET /api/v1/oceny/{id}/pdf?wariant=pelny|czesc-i – arkusz oceny okresowej B / C w PDF (Z16).
// pelny (domyślnie) – po sporządzeniu oceny (części I–III); czesc-i – kopia części I dla ocenianego (§ 6 ust. 3).
// Dostęp jak w eksporcie oceny (Z38): HR, przełożony (oceniający albo bezpośredni przełożony), oceniany – własna ocena
// (pełny arkusz po sporządzeniu, § 12 ust. 2; część I po ustaleniu kryteriów). Ocena spoza zakresu = 404.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/auth/guard";
import { SHEET_VARIANTS, buildSheetData, sheetFileName, sheetInclude, sheetProblem, sheetScope } from "@/lib/pdf/arkusz";
import { renderSheetPdf } from "@/lib/pdf/ArkuszOkresowyPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withRole(["HR", "PRZELOZONY", "OCENIANY"], async (req, ctx, user) => {
  const { id } = await ctx.params;
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "Nie znaleziono oceny." }, { status: 404 });

  const param = new URL(req.url).searchParams.get("wariant") ?? "pelny";
  const variant = SHEET_VARIANTS[param];
  if (!variant) return NextResponse.json({ error: "Niepoprawny wariant arkusza – użyj „pelny” albo „czesc-i”." }, { status: 400 });

  const scope = sheetScope(user, variant);
  if (!scope) return NextResponse.json({ error: "Brak dostępu do arkuszy ocen." }, { status: 403 });

  const row = await prisma.evaluation.findFirst({ where: { AND: [{ id }, scope] }, include: sheetInclude });
  if (!row) return NextResponse.json({ error: "Nie znaleziono oceny." }, { status: 404 });

  const problem = sheetProblem(row, variant);
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });

  const data = buildSheetData(row, variant);
  const pdf = await renderSheetPdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${sheetFileName(data)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
