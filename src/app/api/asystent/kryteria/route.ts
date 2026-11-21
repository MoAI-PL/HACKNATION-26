// API analizy OSP (Z23): propozycja do 3 kryteriów dodatkowych z uzasadnieniem i cytatem zadania.
//   POST /api/asystent/kryteria  (multipart/form-data: plik = OSP .docx, arkusz? = B|C)
//   POST /api/asystent/kryteria  (JSON: { pracownikId, arkusz? })  – OSP pracownika zapisany w bazie
// Odpowiedź: { propozycja: CriteriaProposalResult, arkusz: SheetSelection & { wybrany }, stanowisko, uwagi }.
// Arkusz domyślnie z OSP (§ 3); przełożony może go zmienić w kreatorze (Z12) i przekazać w polu „arkusz”.
//
// Dostęp (Z04): przełożony (tylko własni podwładni) i HR; bez sesji 401, inna rola 403.

import { NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import type { PositionDescription, Role } from "@/lib/domain/types";
import { OspImportError, parseOsp } from "@/lib/import/osp";
import { selectSheet } from "@/lib/rules/arkusz";
import { positionFromRecord, proposeAdditionalCriteria } from "@/lib/ai/funkcje/kryteria-z-osp";

export const dynamic = "force-dynamic";

const ROLES: readonly Role[] = ["PRZELOZONY", "HR"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const sheetSchema = z.enum(["B", "C"], { error: "Arkusz musi mieć wartość B albo C." }).optional();
const jsonSchema = z.object({ pracownikId: z.string({ error: "Podaj pracownika." }).min(1, "Podaj pracownika."), arkusz: sheetSchema });

// Prosty limit zapytań na użytkownika (chroni darmowy limit dostawcy modelu).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

const bad = (blad: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ blad, ...extra }, { status });

export const POST = withRole(ROLES, async (req, _ctx, user) => {
  if (rateLimited(user.id)) return bad("Zbyt wiele zapytań w krótkim czasie. Spróbuj ponownie za minutę.", 429);

  let position: PositionDescription;
  let warnings: string[] = [];
  let requestedSheet: "B" | "C" | undefined;

  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return bad("Niepoprawne dane formularza.");
    }
    const file = form.get("plik");
    if (!(file instanceof File)) return bad("Dołącz plik OSP (.docx) w polu „plik”.");
    if (file.size > MAX_FILE_BYTES) return bad("Plik OSP może mieć najwyżej 5 MB.", 413);
    const sheet = sheetSchema.safeParse(form.get("arkusz") ?? undefined);
    if (!sheet.success) return bad(sheet.error.issues[0]!.message);
    requestedSheet = sheet.data;
    try {
      const r = parseOsp(new Uint8Array(await file.arrayBuffer()));
      position = r.position;
      warnings = r.warnings;
    } catch (e) {
      if (e instanceof OspImportError) return bad("Nie udało się odczytać OSP.", 422, { problemy: e.problems });
      throw e;
    }
  } else {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return bad("Niepoprawne dane zapytania.");
    }
    const parsed = jsonSchema.safeParse(json);
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Niepoprawne dane zapytania.");
    requestedSheet = parsed.data.arkusz;
    // Przełożony widzi tylko swoich podwładnych – cudzy pracownik wygląda jak nieistniejący (bez ujawniania danych).
    const employee = await prisma.employee.findFirst({
      where: { id: parsed.data.pracownikId, ...(user.role === "HR" ? {} : { supervisorId: user.id }) },
      select: { position: true },
    });
    if (!employee) return bad("Nie znaleziono pracownika.", 404);
    if (!employee.position) return bad("Pracownik nie ma przypisanego opisu stanowiska pracy. Dodaj OSP, a potem poproś o propozycję.", 409);
    position = positionFromRecord(employee.position);
  }

  const auto = selectSheet(position.subordinates);
  const sheet = requestedSheet ?? auto.sheet;
  const propozycja = await proposeAdditionalCriteria(position, sheet);
  return NextResponse.json({
    propozycja,
    // „wybrany” różni się od „sheet”, gdy przełożony zmienił arkusz wskazany przez OSP.
    arkusz: { ...auto, wybrany: sheet },
    stanowisko: { tytul: position.title, komorka: position.orgUnit ?? null },
    uwagi: warnings,
  });
});
