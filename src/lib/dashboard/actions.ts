"use server";
// Akcje serwerowe pulpitu (Z11). Każda sprawdza rolę na serwerze (Z04), niezależnie od ukrycia przycisku.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, AccessError } from "@/lib/auth/guard";
import { toDbDate } from "@/lib/domain/daty";
import { fieldErrors, parseNewEmployeeForm, sheetForSubordinates, type FieldErrors } from "./nowy-pracownik";

export type AddEmployeeState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: FieldErrors }
  | { status: "ok"; employeeId: string; name: string };

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

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const orgUnit = v.orgUnit
        ? ((await tx.orgUnit.findFirst({ where: { name: v.orgUnit } })) ?? (await tx.orgUnit.create({ data: { name: v.orgUnit } })))
        : null;
      const position = await tx.position.create({
        data: {
          title: v.positionTitle,
          orgUnitId: orgUnit?.id,
          purpose: "",
          dominantTasks: [],
          otherTasks: [],
          requiredCompetencies: [],
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
          newValue: { ...v, sheet, evaluationId: evaluation.id },
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
