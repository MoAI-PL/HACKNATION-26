// GET /api/v1/oceny/{id}/pdf?wariant=pelny|czesc-i – arkusz oceny okresowej B / C w PDF,
// a dla pierwszej oceny – arkusz pierwszej oceny w służbie cywilnej (bez wariantów: po rozmowie wstępnej
// z danymi rozmowy, po sporządzeniu oceny – z wynikiem).
// pelny (domyślnie) – po sporządzeniu oceny (części I–III); czesc-i – kopia części I dla ocenianego (§ 6 ust. 3).
// Dostęp jak w eksporcie oceny: HR, przełożony (oceniający albo bezpośredni przełożony), oceniany – własna ocena
// (pełny arkusz po sporządzeniu, § 12 ust. 2; część I po ustaleniu kryteriów). Ocena spoza zakresu = 404.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/auth/guard";
import { SHEET_VARIANTS, buildSheetData, sheetFileName, sheetInclude, sheetProblem, sheetScope } from "@/lib/pdf/arkusz";
import { renderSheetPdf } from "@/lib/pdf/ArkuszOkresowyPdf";
import { buildFirstSheetData, firstSheetFileName, firstSheetInclude, firstSheetProblem } from "@/lib/pdf/arkusz-pierwszej";
import { renderFirstSheetPdf } from "@/lib/pdf/ArkuszPierwszejPdf";

function pdfResponse(pdf: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

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

  // Pierwsza ocena: oceniany widzi arkusz po rozmowie wstępnej (zakres „część I” = ustalone kryteria albo ocena sporządzona).
  const first = await prisma.evaluation.findFirst({
    where: { AND: [{ id, type: "PIERWSZA" }, sheetScope(user, "CZESC_I")!] },
    include: firstSheetInclude,
  });
  if (first) {
    const problem = firstSheetProblem(first);
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    const data = buildFirstSheetData(first);
    return pdfResponse(await renderFirstSheetPdf(data), firstSheetFileName(data));
  }

  const row = await prisma.evaluation.findFirst({ where: { AND: [{ id }, scope] }, include: sheetInclude });
  if (!row) return NextResponse.json({ error: "Nie znaleziono oceny." }, { status: 404 });

  const problem = sheetProblem(row, variant);
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });

  const data = buildSheetData(row, variant);
  return pdfResponse(await renderSheetPdf(data), sheetFileName(data));
});
