"use server";
// Akcje serwerowe pulpitu (Z11). Każda sprawdza rolę na serwerze (Z04), niezależnie od ukrycia przycisku.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, AccessError } from "@/lib/auth/guard";
import { toDbDate } from "@/lib/domain/daty";
import { fieldErrors, parseNewEmployeeForm, sheetForSubordinates, type FieldErrors } from "./nowy-pracownik";
import { ospPreview, readOspFile, type OspPreview } from "./osp-plik";

export type AddEmployeeState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: FieldErrors & { osp?: string } }
  | { status: "ok"; employeeId: string; name: string };

export type OspPreviewState = { status: "ok"; preview: OspPreview } | { status: "error"; problems: string[] };

/** Podgląd pliku OSP w formularzu: wypełnia stanowisko, komórkę i liczbę podległych, wyjaśnia wybór arkusza (Z06). */
export async function previewOspAction(form: FormData): Promise<OspPreviewState> {
  try {
    await requireRole("PRZELOZONY");
  } catch (e) {
    if (e instanceof AccessError) return { status: "error", problems: [e.message] };
    throw e;
  }
  const r = await readOspFile(form.get("osp"));
  if (r.status === "none") return { status: "error", problems: ["Wybierz plik OSP (.docx)."] };
  if (r.status === "error") return r;
  return { status: "ok", preview: ospPreview(r.result, r.fileName) };
}

export async function addEmployeeAction(_prev: AddEmployeeState, form: FormData): Promise<AddEmployeeState> {
  let user;
  try {
    user = await requireRole("PRZELOZONY");
  } catch (e) {
    if (e instanceof AccessError) return { status: "error", message: e.message };
    throw e;
  }

  const parsed = parseNewEmployeeForm(form);
  if (!parsed.success) {
    return { status: "error", message: "Popraw zaznaczone pola.", fields: fieldErrors(parsed.error) };
  }
  const v = parsed.data;
  const sheet = v.evaluationType === "PIERWSZA" ? "PIERWSZA" : sheetForSubordinates(v.subordinates);

  // Plik OSP (opcjonalny): serwer odczytuje go ponownie i zapisuje pełny opis stanowiska.
  // Nazwę, komórkę i liczbę podległych bierzemy z pól formularza – przełożony mógł je poprawić.
  const osp = await readOspFile(form.get("osp"));
  if (osp.status === "error") {
    return { status: "error", message: "Popraw zaznaczone pola.", fields: { osp: osp.problems.join(" ") } };
  }
  const desc = osp.status === "ok" ? osp.result.position : undefined;

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const orgUnit = v.orgUnit
        ? ((await tx.orgUnit.findFirst({ where: { name: v.orgUnit } })) ?? (await tx.orgUnit.create({ data: { name: v.orgUnit } })))
        : null;
      const position = await tx.position.create({
        data: {
          title: v.positionTitle,
          orgUnitId: orgUnit?.id,
          purpose: desc?.purpose ?? "",
          dominantTasks: desc?.dominantTasks ?? [],
          otherTasks: desc?.otherTasks ?? [],
          requiredCompetencies: desc?.requiredCompetencies ?? [],
          authorizations: desc?.authorizations ?? null,
          rawText: osp.status === "ok" ? osp.result.rawText : null,
          sourceFileName: osp.status === "ok" ? osp.fileName : null,
          subordinates: v.subordinates,
        },
      });
      const created = await tx.employee.create({
        data: {
          firstName: v.firstName,
          lastName: v.lastName,
          isCivilServant: v.isCivilServant,
          employmentStart: toDbDate(v.employmentStart),
          permanentFrom: v.permanentFrom ? toDbDate(v.permanentFrom) : null,
          contractEnd: v.contractEnd ? toDbDate(v.contractEnd) : null,
          orgUnitId: orgUnit?.id,
          positionId: position.id,
          supervisorId: user.id,
        },
      });
      if (v.evaluationType === "OKRESOWA" && v.lastEvaluationAt) {
        // Punkt odniesienia dla 24 miesięcy: poprzednia ocena sporządzona przed wprowadzeniem do systemu.
        await tx.evaluation.create({
          data: {
            employeeId: created.id,
            evaluatorId: user.id,
            type: "OKRESOWA",
            sheet,
            status: "ZAKONCZONA",
            evaluatedAt: toDbDate(v.lastEvaluationAt),
          },
        });
      }
      const evaluation = await tx.evaluation.create({
        data: { employeeId: created.id, evaluatorId: user.id, type: v.evaluationType, sheet, status: "DO_ROZPOCZECIA" },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "DODANIE_PRACOWNIKA",
          entity: "Employee",
          entityId: created.id,
          newValue: { ...v, sheet, evaluationId: evaluation.id, ospFile: osp.status === "ok" ? osp.fileName : null },
        },
      });
      return created;
    });

    revalidatePath("/pulpit");
    return { status: "ok", employeeId: employee.id, name: `${employee.firstName} ${employee.lastName}` };
  } catch (e) {
    console.error("Dodanie pracownika nie powiodło się:", e);
    return { status: "error", message: "Nie udało się zapisać pracownika z powodu błędu serwera. Spróbuj ponownie za chwilę." };
  }
}
