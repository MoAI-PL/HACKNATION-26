// Zapoznanie z oceną na prawdziwym PostgreSQL: dwa równoczesne potwierdzenia (przełożony i oceniany)
// zamykają ocenę raz – jedna nowa ocena na kolejny okres i jeden wpis w dzienniku.
// Uruchamia się tylko z TEST_DATABASE_URL (jak tests/db/integracja.test.ts).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { applyAcknowledgment } from "@/lib/ocena/zapoznanie";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("zapoznanie z oceną – równoczesne potwierdzenia", () => {
  let prisma: PrismaClient;
  const sfx = Date.now().toString(36);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("drugie potwierdzenie nie tworzy kolejnej oceny ani drugiego wpisu", async () => {
    const ewa = await prisma.user.create({ data: { email: `ewa.zap.${sfx}@demo.gov.test`, passwordHash: "x", name: "Ewa", role: "PRZELOZONY" } });
    const emp = await prisma.employee.create({
      data: { firstName: "Jan", lastName: "Testowy", employmentStart: new Date("2020-01-02"), permanentFrom: new Date("2020-01-02"), supervisorId: ewa.id },
    });
    const ev = await prisma.evaluation.create({
      data: { employeeId: emp.id, evaluatorId: ewa.id, type: "OKRESOWA", sheet: "C", status: "CZEKA_NA_ZAPOZNANIE", evaluatedAt: new Date("2026-11-02"), result: "NEGATYWNA" },
    });
    const input = { id: ev.id, employeeId: emp.id, evaluatorId: ewa.id, sheet: "C" as const, result: "NEGATYWNA" as const };

    const results = await Promise.all([
      prisma.$transaction((tx) => applyAcknowledgment(tx, input, "2026-11-03", ewa.id, "PRZELOZONY")),
      prisma.$transaction((tx) => applyAcknowledgment(tx, input, "2026-11-03", ewa.id, "OCENIANY")),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const all = await prisma.evaluation.findMany({ where: { employeeId: emp.id }, orderBy: { createdAt: "asc" } });
    expect(all).toHaveLength(2);
    expect(all[0]!.status).toBe("ZAKONCZONA");
    expect(all[1]).toMatchObject({ status: "DO_ROZPOCZECIA", isReevaluation: true });
    expect(await prisma.auditLog.count({ where: { entityId: ev.id, action: "ZAPOZNANIE_Z_OCENA" } })).toBe(1);

    await prisma.auditLog.deleteMany({ where: { entityId: ev.id } });
    await prisma.employee.delete({ where: { id: emp.id } });
    await prisma.user.delete({ where: { id: ewa.id } });
  });
});
