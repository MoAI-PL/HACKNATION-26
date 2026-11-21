// Dane panelu HR „Lustro ocen” (Z36) – sporządzone oceny okresowe pogrupowane według komórek, bez nazwisk ocenianych.

import { prisma } from "@/lib/db";
import type { CompletedEvaluation } from "@/lib/rules/lustro";

export async function loadCompletedForMirror(): Promise<CompletedEvaluation[]> {
  const rows = await prisma.evaluation.findMany({
    where: { type: "OKRESOWA", evaluatedAt: { not: null }, average: { not: null }, result: { not: null }, overallLevel: { not: null } },
    select: {
      average: true,
      result: true,
      overallLevel: true,
      evaluator: { select: { id: true, name: true } },
      employee: { select: { orgUnit: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((r) => ({
    unitId: r.employee.orgUnit?.id ?? "brak",
    unitName: r.employee.orgUnit?.name ?? "Bez przypisanej komórki",
    evaluatorId: r.evaluator.id,
    evaluatorName: r.evaluator.name,
    average: r.average!,
    result: r.result!,
    level: r.overallLevel!,
  }));
}
