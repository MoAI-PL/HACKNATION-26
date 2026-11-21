// Test integracyjny modelu danych na prawdziwym PostgreSQL.
// Uruchamia się tylko z ustawionym TEST_DATABASE_URL (osobna, pusta baza z zastosowanymi migracjami):
//   TEST_DATABASE_URL=postgresql://kompas:kompas@localhost:5432/kompas_test npx prisma migrate deploy
//   TEST_DATABASE_URL=... npm test
// Bez tej zmiennej testy są pomijane, więc `npm test` działa bez bazy.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { fromDbDate, toDbDate } from "@/lib/domain/daty";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("model danych na PostgreSQL", () => {
  // Klient tworzony dopiero w beforeAll – przy pominiętych testach (brak bazy) nie powstaje wcale.
  let prisma: PrismaClient;
  const sfx = Date.now().toString(36);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("zapisuje pełny scenariusz oceny okresowej i odczytuje go z relacjami", async () => {
    const unit = await prisma.orgUnit.create({ data: { name: "Departament Współpracy Międzynarodowej", shortName: "DWM" } });
    const przelozona = await prisma.user.create({
      data: { email: `ewa.${sfx}@demo.gov.test`, passwordHash: "x", name: "Ewa Kowalczyk", role: "PRZELOZONY" },
    });
    const position = await prisma.position.create({
      data: {
        title: "Radca",
        orgUnitId: unit.id,
        purpose: "Zapewnienie obsługi merytorycznej współpracy z zagranicą.",
        dominantTasks: ["Przygotowywanie stanowisk", "Prowadzenie uzgodnień"],
        otherTasks: [],
        subordinates: "BRAK",
        requiredCompetencies: ["komunikacja", "współpraca"],
      },
    });
    const emp = await prisma.employee.create({
      data: {
        firstName: "Łucja",
        lastName: "Żółkiewska-Ślązak",
        employmentStart: new Date("2022-03-01"),
        permanentFrom: new Date("2022-03-01"),
        isCivilServant: true,
        orgUnitId: unit.id,
        positionId: position.id,
        supervisorId: przelozona.id,
      },
    });
    const ev = await prisma.evaluation.create({
      data: {
        employeeId: emp.id,
        evaluatorId: przelozona.id,
        type: "OKRESOWA",
        sheet: "C",
        startChecklist: { obowiazki: true, kryteria: true, oczekiwania: true, cele: false },
        criteria: {
          create: [
            {
              competency: "KOMUNIKACJA",
              kind: "OBOWIAZKOWE",
              score: 5,
              suggestedScore: 7,
              overrideReason: "Dwa przykłady z ostatniego kwartału przemawiają za oceną niższą.",
              ratings: {
                create: [
                  { indicatorId: "KOMUNIKACJA.1", level: 4, note: "Sytuacja – działanie – rezultat" },
                  { indicatorId: "KOMUNIKACJA.2", level: null },
                ],
              },
            },
            { competency: "NEGOCJOWANIE", kind: "DODATKOWE", selectionReason: "„Prowadzi uzgodnienia z…” (OSP)" },
          ],
        },
      },
    });
    await prisma.observation.create({
      data: {
        employeeId: emp.id,
        authorId: przelozona.id,
        date: new Date("2026-10-15"),
        competency: "WSPOLPRACA",
        indicatorId: "WSPOLPRACA.3",
        originalText: "Łucja świetnie ogarnęła spotkanie z DSI ✦",
        source: "SZYBKA_AI",
      },
    });
    await prisma.absence.create({
      data: { employeeId: emp.id, kind: "ZWOLNIENIE_LEKARSKIE", from: new Date("2026-03-12"), to: new Date("2026-04-24") },
    });

    const got = await prisma.evaluation.findUniqueOrThrow({
      where: { id: ev.id },
      include: { criteria: { include: { ratings: true } }, employee: { include: { observations: true, absences: true } } },
    });
    expect(got.criteria).toHaveLength(2);
    const kom = got.criteria.find((c) => c.competency === "KOMUNIKACJA")!;
    expect(kom.ratings.map((r) => r.level).sort()).toEqual([4, null]);
    expect(got.employee.lastName).toBe("Żółkiewska-Ślązak");
    expect(got.employee.observations[0]!.originalText).toBe("Łucja świetnie ogarnęła spotkanie z DSI ✦");
    expect(got.startChecklist).toEqual({ obowiazki: true, kryteria: true, oczekiwania: true, cele: false });
  });

  it("kolumny @db.Date zachowują dzień przy zapisie przez toDbDate/fromDbDate", async () => {
    const e = await prisma.employee.create({
      data: { firstName: "Test", lastName: "Daty", employmentStart: toDbDate("2024-08-31") },
    });
    const back = await prisma.employee.findUniqueOrThrow({ where: { id: e.id } });
    expect(fromDbDate(back.employmentStart)).toBe("2024-08-31");
  });

  it("nie pozwala dodać tego samego kryterium dwa razy w jednej ocenie", async () => {
    const u = await prisma.user.create({ data: { email: `u2.${sfx}@demo.gov.test`, passwordHash: "x", name: "U2", role: "PRZELOZONY" } });
    const e = await prisma.employee.create({ data: { firstName: "A", lastName: "B", employmentStart: new Date("2024-01-01") } });
    const ev = await prisma.evaluation.create({ data: { employeeId: e.id, evaluatorId: u.id, type: "OKRESOWA", sheet: "C" } });
    await prisma.evaluationCriterion.create({ data: { evaluationId: ev.id, competency: "RZETELNOSC", kind: "OBOWIAZKOWE" } });
    await expect(
      prisma.evaluationCriterion.create({ data: { evaluationId: ev.id, competency: "RZETELNOSC", kind: "DODATKOWE" } }),
    ).rejects.toThrow();
  });

  it("usunięcie pracownika usuwa jego oceny, kryteria, oceny wskaźników i obserwacje", async () => {
    const u = await prisma.user.create({ data: { email: `u3.${sfx}@demo.gov.test`, passwordHash: "x", name: "U3", role: "PRZELOZONY" } });
    const e = await prisma.employee.create({ data: { firstName: "C", lastName: "D", employmentStart: new Date("2024-01-01") } });
    const ev = await prisma.evaluation.create({
      data: {
        employeeId: e.id,
        evaluatorId: u.id,
        type: "PIERWSZA",
        sheet: "PIERWSZA",
        report: { create: { dueFrom: new Date("2024-08-01"), dueTo: new Date("2024-08-15") } },
        criteria: { create: [{ competency: "RZETELNOSC", kind: "OBOWIAZKOWE", ratings: { create: [{ indicatorId: "RZETELNOSC.1", level: 3 }] } }] },
      },
    });
    await prisma.observation.create({ data: { employeeId: e.id, authorId: u.id, date: new Date("2024-05-05") } });
    await prisma.positionChange.create({ data: { employeeId: e.id, date: toDbDate("2024-06-01"), newPositionTitle: "Starszy specjalista" } });

    await prisma.employee.delete({ where: { id: e.id } });

    expect(await prisma.positionChange.count({ where: { employeeId: e.id } })).toBe(0);

    expect(await prisma.evaluation.count({ where: { id: ev.id } })).toBe(0);
    expect(await prisma.evaluationCriterion.count({ where: { evaluationId: ev.id } })).toBe(0);
    expect(await prisma.firstEvalReport.count({ where: { evaluationId: ev.id } })).toBe(0);
    expect(await prisma.observation.count({ where: { employeeId: e.id } })).toBe(0);
  });

  it("nie pozwala usunąć użytkownika, który jest oceniającym (ochrona historii ocen)", async () => {
    const u = await prisma.user.create({ data: { email: `u4.${sfx}@demo.gov.test`, passwordHash: "x", name: "U4", role: "PRZELOZONY" } });
    const e = await prisma.employee.create({ data: { firstName: "E", lastName: "F", employmentStart: new Date("2024-01-01") } });
    await prisma.evaluation.create({ data: { employeeId: e.id, evaluatorId: u.id, type: "OKRESOWA", sheet: "B" } });
    await expect(prisma.user.delete({ where: { id: u.id } })).rejects.toThrow();
  });

  it("dziennik decyzji zapisuje propozycję AI obok decyzji człowieka", async () => {
    const log = await prisma.auditLog.create({
      data: {
        action: "ZMIANA_SUGESTII",
        entity: "EvaluationCriterion",
        aiProposal: { points: 7 },
        humanDecision: { points: 5 },
        reason: "Dwa przykłady przemawiają za oceną niższą.",
      },
    });
    expect(log.aiProposal).toEqual({ points: 7 });
  });
});
